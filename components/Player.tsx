"use client"

import { cn } from "@/lib/utils"
import type { Player as PlayerType } from "@/game/types"

interface PlayerProps {
  player: PlayerType
  cellSize: number
}

export function Player({ player, cellSize }: PlayerProps) {
  if (!player.alive) return null

  return (
    <div
      className="absolute flex items-center justify-center transition-all duration-100 ease-linear"
      style={{
        width: cellSize,
        height: cellSize,
        transform: `translate(${player.position.col * cellSize}px, ${player.position.row * cellSize}px)`,
      }}
      aria-label={`${player.name} token`}
    >
      <div
        className={cn(
          "h-[70%] w-[70%] rounded-full border-2 border-background/70 shadow-md",
          player.colorClass,
        )}
      >
        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-background">
          {player.id}
        </span>
      </div>
    </div>
  )
}
