"use client"

import { cn } from "@/lib/utils"
import { COLS, ROWS, type GameState } from "@/game/types"
import { Bomb } from "./Bomb"
import { Player } from "./Player"

interface BoardProps {
  state: GameState
  cellSize: number
}

const TILE_CLASS: Record<string, string> = {
  floor: "bg-game-floor",
  wall: "bg-game-wall",
  brick: "bg-game-brick",
}

export function Board({ state, cellSize }: BoardProps) {
  const width = COLS * cellSize
  const height = ROWS * cellSize

  // Flatten explosion cells into a lookup so we can render the blast overlay.
  const explosionCells = new Set<string>()
  for (const explosion of state.explosions) {
    for (const cell of explosion.cells) {
      explosionCells.add(`${cell.row}-${cell.col}`)
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg border-4 border-game-wall bg-game-board shadow-2xl"
      style={{ width, height }}
      role="img"
      aria-label="Bomberman game board"
    >
      {/* Static tile layer */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
        }}
      >
        {state.grid.map((line, row) =>
          line.map((tile, col) => (
            <div
              key={`${row}-${col}`}
              className={cn(
                "box-border",
                TILE_CLASS[tile],
                tile === "wall" && "border border-background/20",
                tile === "brick" && "border-2 border-background/15",
              )}
              style={{ width: cellSize, height: cellSize }}
            />
          )),
        )}
      </div>

      {/* Explosion overlay layer */}
      {[...explosionCells].map((key) => {
        const [row, col] = key.split("-").map(Number)
        return (
          <div
            key={`exp-${key}`}
            className="absolute flex items-center justify-center"
            style={{
              width: cellSize,
              height: cellSize,
              transform: `translate(${col * cellSize}px, ${row * cellSize}px)`,
            }}
          >
            <div className="h-full w-full animate-pulse rounded-sm bg-game-explosion">
              <div className="h-full w-full scale-75 rounded-full bg-game-explosion-core" />
            </div>
          </div>
        )
      })}

      {/* Bombs */}
      {state.bombs.map((bomb) => (
        <Bomb key={bomb.id} bomb={bomb} cellSize={cellSize} />
      ))}

      {/* Players */}
      {state.players.map((player) => (
        <Player key={player.id} player={player} cellSize={cellSize} />
      ))}
    </div>
  )
}
