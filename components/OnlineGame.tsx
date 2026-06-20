"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Board } from "./Board"
import { PlayerStatusBar } from "./PlayerStatusBar"
import type { Direction, GameState } from "@/game/types"
import {
  createInitialState,
  movePlayer,
  placeBomb,
  tickMovement,
  updateGame,
} from "@/game/gameEngine"
import type { BroadcastMessage, InputMessage } from "@/game/networkTypes"
import { useSupabaseRealtime, updateRoomStatus } from "@/hooks/useSupabaseRealtime"
import { useCellSize } from "@/hooks/useCellSize"

const GUEST_PLAYER_ID = 2

const KEY_TO_DIR: Record<string, Direction> = {
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
}

const GAME_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  " ",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "enter",
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

      if (key === "enter") {
        sendBroadcast("game", {
          type: "input",
          playerId: GUEST_PLAYER_ID,
          pressed: true,
          action: { actionType: "bomb" },
        } satisfies InputMessage)
        return
      }

      const dir = KEY_TO_DIR[key]
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
      const dir = KEY_TO_DIR[e.key.toLowerCase()]
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

      if (key === " ") {
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
        const dir = KEY_TO_DIR[key]
        if (dir) next = movePlayer(next, 1, dir, now)
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
  // Clean up room on game over
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state?.status === "over") {
      updateRoomStatus(roomCode, "finished")
    }
  }, [state?.status, roomCode])

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WaitingScreen({
  roomCode,
  isHost,
  presenceCount,
  onBackToLobby,
}: {
  roomCode: string
  isHost: boolean
  presenceCount: number
  onBackToLobby: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-lg border border-border bg-card px-6 py-4 text-center">
        <p className="text-lg font-semibold text-card-foreground">Room: {roomCode}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isHost
            ? presenceCount < 2
              ? "Waiting for opponent to join…"
              : "Starting game…"
            : "Waiting for host to start…"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Players connected: {presenceCount}/2</p>
      </div>
      <Button onClick={onBackToLobby} variant="outline" size="sm">
        Leave Room
      </Button>
    </div>
  )
}

function ConnectionStatus({ roomCode, isConnected }: { roomCode: string; isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm" aria-live="polite">
      <span className="text-muted-foreground">
        Room: <span className="font-mono font-semibold text-foreground">{roomCode}</span>
      </span>
      <span className="text-muted-foreground">|</span>
      <span className={isConnected ? "text-green-500" : "text-destructive"}>
        {isConnected ? "Connected" : "Disconnected"}
      </span>
    </div>
  )
}

function GameOverBanner({ state }: { state: GameState }) {
  return (
    <div
      className="rounded-lg border border-border bg-card px-6 py-3 text-center"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-lg font-bold text-card-foreground">
        {state.winnerId ? `Player ${state.winnerId} wins!` : "Draw — everyone got caught!"}
      </p>
    </div>
  )
}
