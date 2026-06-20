"use client"

import { cn } from "@/lib/utils"
import { COLS, EXPLOSION_MS, ROWS, type GameState, type TileType } from "@/game/types"
import { Bomb } from "./Bomb"
import { Player } from "./Player"

interface BoardProps {
  state: GameState
  cellSize: number
  now: number
}

function tileStyle(tile: TileType, row: number, col: number): React.CSSProperties {
  if (tile === "wall") {
    return {
      boxShadow: "inset 2px 2px 0 oklch(1 0 0 / 0.12), inset -2px -2px 0 oklch(0 0 0 / 0.35)",
    }
  }
  if (tile === "brick") {
    return {
      backgroundImage:
        "repeating-linear-gradient(0deg, oklch(0 0 0 / 0.18) 0 1px, transparent 1px 33%), repeating-linear-gradient(90deg, oklch(0 0 0 / 0.18) 0 1px, transparent 1px 50%)",
      boxShadow: "inset 1px 1px 0 oklch(1 0 0 / 0.18), inset -2px -2px 0 oklch(0 0 0 / 0.3)",
    }
  }
  // floor: subtle checkerboard for retro depth
  return { filter: (row + col) % 2 === 0 ? "none" : "brightness(0.93)" }
}

const TILE_CLASS: Record<TileType, string> = {
  floor: "bg-game-floor",
  wall: "bg-game-wall",
  brick: "bg-game-brick",
}

export function Board({ state, cellSize, now }: BoardProps) {
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
              className={cn("box-border", TILE_CLASS[tile])}
              style={{ width: cellSize, height: cellSize, ...tileStyle(tile, row, col) }}
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
            className="pointer-events-none absolute flex items-center justify-center"
            style={{
              top: 0,
              left: 0,
              width: cellSize,
              height: cellSize,
              transform: `translate(${col * cellSize}px, ${row * cellSize}px)`,
              zIndex: 15,
            }}
          >
            <div
              className="anim-explosion-pop flex h-full w-full items-center justify-center rounded-md bg-game-explosion shadow-[0_0_12px_2px_var(--game-explosion)]"
              style={{ ["--explosion-ms" as string]: `${EXPLOSION_MS}ms` }}
            >
              <div className="anim-explosion-core h-[60%] w-[60%] rounded-full bg-game-explosion-core" />
            </div>
          </div>
        )
      })}

      {/* Bombs */}
      {state.bombs.map((bomb) => (
        <Bomb key={bomb.id} bomb={bomb} cellSize={cellSize} now={now} />
      ))}

      {/* Players */}
      {state.players.map((player) => (
        <Player key={player.id} player={player} cellSize={cellSize} />
      ))}
    </div>
  )
}
