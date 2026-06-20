"use client"

import { cn } from "@/lib/utils"
import type { Direction, Player as PlayerType } from "@/game/types"

interface PlayerProps {
  player: PlayerType
  cellSize: number
}

// Where the eyes sit within the head, per facing direction.
const EYE_OFFSET: Record<Direction, { x: string; y: string }> = {
  up: { x: "0", y: "-22%" },
  down: { x: "0", y: "10%" },
  left: { x: "-20%", y: "0" },
  right: { x: "20%", y: "0" },
}

export function Player({ player, cellSize }: PlayerProps) {
  const eyes = EYE_OFFSET[player.facing]

  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center"
      style={{
        top: 0,
        left: 0,
        width: cellSize,
        height: cellSize,
        transform: `translate(${player.x * cellSize}px, ${player.y * cellSize}px)`,
        zIndex: 20,
      }}
      aria-label={`${player.name} token`}
    >
      {/* soft ground shadow */}
      <span
        className="absolute rounded-[50%] bg-game-bomb/30 blur-[1px]"
        style={{ width: "55%", height: "16%", bottom: "12%" }}
        aria-hidden
      />

      <div className={cn("relative", player.alive && player.moving && "anim-player-bob")}>
        <div
          className={cn(
            "relative flex items-center justify-center rounded-[42%] border-2 border-background/70 shadow-md",
            player.colorClass,
            !player.alive && "anim-player-die grayscale",
          )}
          style={{ width: cellSize * 0.7, height: cellSize * 0.7 }}
        >
          {/* visor / face plate */}
          <div
            className="relative flex items-center justify-center rounded-[40%] bg-background/85"
            style={{
              width: "62%",
              height: "46%",
              transform: `translate(${eyes.x}, ${eyes.y})`,
            }}
          >
            {player.alive ? (
              <>
                <span className="mx-[7%] h-[55%] w-[22%] rounded-full bg-foreground" aria-hidden />
                <span className="mx-[7%] h-[55%] w-[22%] rounded-full bg-foreground" aria-hidden />
              </>
            ) : (
              <span className="text-[9px] font-black leading-none text-foreground">x x</span>
            )}
          </div>
          <span className="absolute -top-2 text-[10px] font-bold text-foreground/80">{player.id}</span>
        </div>
      </div>
    </div>
  )
}
