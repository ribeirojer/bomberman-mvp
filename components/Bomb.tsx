"use client"

import { BOMB_FUSE_MS, type Bomb as BombType } from "@/game/types"

interface BombProps {
  bomb: BombType
  cellSize: number
  now: number
}

export function Bomb({ bomb, cellSize, now }: BombProps) {
  // Fuse progress 0 → 1. The closer to detonation, the faster the pulse.
  const progress = Math.min(1, (now - bomb.placedAt) / BOMB_FUSE_MS)
  const pulseDuration = 0.5 - progress * 0.38 // 500ms → ~120ms

  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center"
      style={{
        top: 0,
        left: 0,
        width: cellSize,
        height: cellSize,
        transform: `translate(${bomb.position.col * cellSize}px, ${bomb.position.row * cellSize}px)`,
        zIndex: 10,
      }}
      aria-label="Bomb"
    >
      <div
        className="relative rounded-full bg-game-bomb shadow-lg ring-2 ring-game-explosion/50"
        style={{
          width: "66%",
          height: "66%",
          animation: `bomb-tick ${pulseDuration}s ease-in-out infinite`,
        }}
      >
        {/* highlight */}
        <span
          className="absolute rounded-full bg-background/40"
          style={{ width: "26%", height: "26%", left: "18%", top: "16%" }}
          aria-hidden
        />
        {/* fuse cap */}
        <span
          className="absolute left-1/2 h-[18%] w-[14%] -translate-x-1/2 rounded-sm bg-game-floor"
          style={{ top: "-12%" }}
          aria-hidden
        />
        {/* spark */}
        <span
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-game-explosion-core"
          style={{
            top: "-22%",
            width: "20%",
            height: "20%",
            animation: "explosion-core 0.16s infinite",
          }}
          aria-hidden
        />
      </div>
    </div>
  )
}
