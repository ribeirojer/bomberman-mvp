"use client"

import type { GameState } from "@/game/types"

interface GameOverBannerProps {
  state: GameState
}

export function GameOverBanner({ state }: GameOverBannerProps) {
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
