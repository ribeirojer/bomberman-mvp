"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Board } from "@/components/Board"
import { PlayerStatusBar } from "@/components/PlayerStatusBar"
import { WaitingScreen } from "@/components/WaitingScreen"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { GameOverBanner } from "@/components/GameOverBanner"
import {
  createInitialState,
  GUEST_BOMB_KEY,
  GUEST_DIR_MAP,
  HOST_BOMB_KEY,
  movePlayer,
  placeBomb,
  resolveAction,
  tickMovement,
  updateGame,
  type Direction,
  type GameState,
} from "@/game"
import type { BroadcastMessage, InputMessage } from "@/game/networkTypes"
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime"
import { updateRoomStatus } from "@/lib/supabaseActions"
import { useCellSize } from "@/hooks/useCellSize"

const GUEST_PLAYER_ID = 2

const GAME_KEYS = new Set([
  HOST_BOMB_KEY,
  "w",
  "a",
  "s",
  "d",
  GUEST_BOMB_KEY,
  ...Object.keys(GUEST_DIR_MAP),
])

interface OnlineGameProps {
  roomCode: string
  isHost: boolean
  playerId: number
  onBackToLobby: () => void
}

export function OnlineGame({ roomCode, isHost, playerId, onBackToLobby }: OnlineGameProps) {
  const [state, setState] = useState<GameState | null>(null)
  const [renderNow, setRenderNow] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)

  const stateRef = useRef<GameState | null>(state)
  const pressedKeys = useRef<Set<string>>(new Set())
  const remoteHeldKeys = useRef<Set<Direction>>(new Set())
  const roomActive = useRef(false)

  const cellSize = useCellSize()
  const { isConnected, presenceCount, sendBroadcast, setOnBroadcast } = useSupabaseRealtime(
    roomCode,
    isHost,
  )

  stateRef.current = state

  // ---------------------------------------------------------------------------
  // Host: auto-start when 2 players are present
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost || gameStarted || presenceCount < 2) return
    const fresh = createInitialState()
    stateRef.current = fresh
    setState(fresh)
    setGameStarted(true)
    updateRoomStatus(roomCode, "playing")
  }, [isHost, gameStarted, presenceCount, roomCode])

  // ---------------------------------------------------------------------------
  // Broadcast handler: guest renders state, host processes remote inputs
  // ---------------------------------------------------------------------------
  const handleBroadcast = useCallback(
    (msg: BroadcastMessage) => {
      if (msg.type === "state" && !isHost) {
        const next = msg.state
        stateRef.current = next
        setState(next)
        if (next.bombs.length > 0) setRenderNow(Date.now())
        if (!gameStarted) setGameStarted(true)
        return
      }

      if (msg.type === "input" && isHost) {
        if (msg.action.actionType === "move") {
          if (msg.pressed) {
            remoteHeldKeys.current.add(msg.action.direction)
          } else {
            remoteHeldKeys.current.delete(msg.action.direction)
          }
        } else if (msg.action.actionType === "bomb" && msg.pressed) {
          const next = placeBomb(stateRef.current!, GUEST_PLAYER_ID, Date.now())
          stateRef.current = next
          setState(next)
        }
      }
    },
    [isHost, gameStarted],
  )

  useEffect(() => {
    setOnBroadcast(handleBroadcast)
  }, [setOnBroadcast, handleBroadcast])

  // ---------------------------------------------------------------------------
  // Guest: keyboard → send input over broadcast
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isHost || !gameStarted) return

    const heldDirections = new Set<Direction>()

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (!GAME_KEYS.has(key)) return
      e.preventDefault()
      if (e.repeat) return

      if (key === GUEST_BOMB_KEY) {
        sendBroadcast("game", {
          type: "input",
          playerId: GUEST_PLAYER_ID,
          pressed: true,
          action: { actionType: "bomb" },
        } satisfies InputMessage)
        return
      }

      const dir = GUEST_DIR_MAP[key]
      if (dir && !heldDirections.has(dir)) {
        heldDirections.add(dir)
        sendBroadcast("game", {
          type: "input",
          playerId: GUEST_PLAYER_ID,
          pressed: true,
          action: { actionType: "move", direction: dir },
        } satisfies InputMessage)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const dir = GUEST_DIR_MAP[e.key.toLowerCase()]
      if (dir && heldDirections.has(dir)) {
        heldDirections.delete(dir)
        sendBroadcast("game", {
          type: "input",
          playerId: GUEST_PLAYER_ID,
          pressed: false,
          action: { actionType: "move", direction: dir },
        } satisfies InputMessage)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isHost, gameStarted, sendBroadcast])

  // ---------------------------------------------------------------------------
  // Host: keyboard input → game engine
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost || !gameStarted) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (!GAME_KEYS.has(key)) return
      e.preventDefault()
      if (e.repeat) return

      if (!stateRef.current) return

      if (key === HOST_BOMB_KEY) {
        const next = placeBomb(stateRef.current, 1, Date.now())
        stateRef.current = next
        setState(next)
      } else {
        pressedKeys.current.add(key)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.current.delete(e.key.toLowerCase())
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isHost, gameStarted])

  // ---------------------------------------------------------------------------
  // Host: game loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isHost || !gameStarted) return

    let frame: number
    let last = performance.now()

    const loop = (ts: number) => {
      const now = Date.now()
      const dt = Math.min(0.05, (ts - last) / 1000)
      last = ts

      let next = stateRef.current
      if (!next || next.status !== "playing") {
        frame = requestAnimationFrame(loop)
        return
      }

      for (const key of pressedKeys.current) {
        const action = resolveAction(next.players, key)
        if (action && action.type === "move") {
          next = movePlayer(next, action.playerId, action.direction, now)
        }
      }

      for (const dir of remoteHeldKeys.current) {
        next = movePlayer(next, GUEST_PLAYER_ID, dir, now)
      }

      next = tickMovement(next, dt)
      next = updateGame(next, now)

      if (next !== stateRef.current) {
        stateRef.current = next
        setState(next)
        sendBroadcast("game", { type: "state", state: next })
      }

      if (next.bombs.length > 0) setRenderNow(now)

      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [isHost, gameStarted, sendBroadcast])

  // ---------------------------------------------------------------------------
  // Clean up room on game over or when leaving
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (gameStarted) roomActive.current = true

    if (state?.status === "over") {
      updateRoomStatus(roomCode, "finished")
      roomActive.current = false
    }

    return () => {
      if (roomActive.current) {
        updateRoomStatus(roomCode, "finished")
      }
    }
  }, [state?.status, gameStarted, roomCode])

  // ---------------------------------------------------------------------------
  // Restart (host only)
  // ---------------------------------------------------------------------------
  const restart = useCallback(() => {
    if (!isHost) return
    pressedKeys.current.clear()
    remoteHeldKeys.current.clear()
    const fresh = createInitialState()
    stateRef.current = fresh
    setState(fresh)
    updateRoomStatus(roomCode, "playing")
  }, [isHost, roomCode])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!isConnected) {
    return (
      <div
        className="flex h-[440px] w-full items-center justify-center text-sm text-muted-foreground"
        role="status"
        aria-label="Connecting to server"
      >
        Connecting to server…
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <WaitingScreen
        roomCode={roomCode}
        isHost={isHost}
        presenceCount={presenceCount}
        onBackToLobby={onBackToLobby}
      />
    )
  }

  if (!state) {
    return (
      <div
        className="flex h-[440px] w-full items-center justify-center text-sm text-muted-foreground"
        role="status"
        aria-label="Waiting for game state"
      >
        Waiting for game state…
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <PlayerStatusBar state={state} localPlayerId={playerId} />

      <ConnectionStatus roomCode={roomCode} isConnected={isConnected} />

      <Board state={state} cellSize={cellSize} now={renderNow} />

      {state.status === "over" && <GameOverBanner state={state} />}

      <div className="flex flex-col items-center gap-3">
        {isHost && (
          <Button onClick={restart} size="lg">
            Restart game
          </Button>
        )}
        <Button onClick={onBackToLobby} variant="outline" size="sm">
          Leave Room
        </Button>
      </div>
    </div>
  )
}
