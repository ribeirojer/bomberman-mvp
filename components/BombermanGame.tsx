"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Board } from "./Board"
import { PlayerStatusBar } from "./PlayerStatusBar"
import type { GameState } from "@/game/types"
import {
  createInitialState,
  movePlayer,
  placeBomb,
  resolveAction,
  tickMovement,
  updateGame,
} from "@/game/gameEngine"
import { useCellSize } from "@/hooks/useCellSize"

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

export function BombermanGame() {
  // Start null so the random board is generated only on the client.
  // This avoids an SSR/client hydration mismatch caused by Math.random() in createGrid().
  const [state, setState] = useState<GameState | null>(null)
  const [renderNow, setRenderNow] = useState(0)

  const stateRef = useRef<GameState | null>(state)
  const pressedKeys = useRef<Set<string>>(new Set())
  const cellSize = useCellSize()

  stateRef.current = state

  // Initialise the board after mount (client only).
  useEffect(() => {
    const fresh = createInitialState()
    stateRef.current = fresh
    setState(fresh)
  }, [])

  const restart = useCallback(() => {
    pressedKeys.current.clear()
    const fresh = createInitialState()
    stateRef.current = fresh
    setState(fresh)
  }, [])

  // Keyboard input.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (!GAME_KEYS.has(key)) return
      e.preventDefault()
      if (e.repeat) return

      if (!stateRef.current) return
      const action = resolveAction(stateRef.current.players, key)
      if (!action) return

      if (action.type === "bomb") {
        const next = placeBomb(stateRef.current, action.playerId, Date.now())
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
  }, [])

  // Main game loop.
  useEffect(() => {
    let frame: number
    let last = performance.now()

    const loop = (ts: number) => {
      const now = Date.now()
      // Delta time in seconds, clamped so tab-switch stalls don't teleport players.
      const dt = Math.min(0.05, (ts - last) / 1000)
      last = ts

      let next = stateRef.current
      if (!next) {
        frame = requestAnimationFrame(loop)
        return
      }

      // 1. Apply held movement intents (only commits when a player is aligned).
      for (const key of pressedKeys.current) {
        const action = resolveAction(next.players, key)
        if (action && action.type === "move") {
          next = movePlayer(next, action.playerId, action.direction, now)
        }
      }

      // 2. Advance smooth render positions toward target cells.
      next = tickMovement(next, dt)

      // 3. Advance bombs / explosions / deaths.
      next = updateGame(next, now)

      if (next !== stateRef.current) {
        stateRef.current = next
        setState(next)
      }

      // Keep the fuse pulse animating smoothly while bombs are ticking.
      if (next.bombs.length > 0) setRenderNow(now)

      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  if (!state) {
    return (
      <div
        className="flex h-[440px] w-full items-center justify-center text-sm text-muted-foreground"
        role="status"
        aria-label="Loading game"
      >
        Loading game…
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <PlayerStatusBar state={state} />

      <Board state={state} cellSize={cellSize} now={renderNow} />

      {state.status === "over" && (
        <div className="rounded-lg border border-border bg-card px-6 py-3 text-center">
          <p className="text-lg font-bold text-card-foreground">
            {state.winnerId ? `Player ${state.winnerId} wins!` : "Draw — everyone got caught!"}
          </p>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <Button onClick={restart} size="lg">
          Restart game
        </Button>
        <Controls />
      </div>
    </div>
  )
}

function Controls() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-center text-xs text-muted-foreground">
      <span>
        <span className="font-semibold text-foreground">Player 1:</span> WASD to move, Space to bomb
      </span>
      <span>
        <span className="font-semibold text-foreground">Player 2:</span> Arrows to move, Enter to
        bomb
      </span>
    </div>
  )
}
