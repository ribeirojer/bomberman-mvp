"use client"

import type { Bomb as BombType } from "@/game/types"

interface BombProps {
  bomb: BombType
  cellSize: number
}

export function Bomb({ bomb, cellSize }: BombProps) {
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        width: cellSize,
        height: cellSize,
        transform: `translate(${bomb.position.col * cellSize}px, ${bomb.position.row * cellSize}px)`,
      }}
      aria-label="Bomb"
    >
      <div className="h-[64%] w-[64%] animate-pulse rounded-full bg-game-bomb shadow-inner ring-2 ring-game-explosion/60">
        <span className="absolute right-[28%] top-[14%] h-1.5 w-1.5 rounded-full bg-game-explosion-core" />
      </div>
    </div>
  )
}
