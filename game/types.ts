// Core game types. Kept framework-agnostic so the same shapes can later be
// serialized over WebSockets for real multiplayer.

export const COLS = 13
export const ROWS = 11

export const BOMB_FUSE_MS = 3000 // time before a bomb explodes
export const EXPLOSION_MS = 500 // how long the explosion visual/hitbox lasts
export const BLAST_RANGE = 2 // tiles affected in each direction
export const MOVE_COOLDOWN_MS = 130 // throttle for grid-based movement

export type TileType = "floor" | "wall" | "brick"

export interface Position {
  row: number
  col: number
}

export type Direction = "up" | "down" | "left" | "right"

export interface PlayerControls {
  up: string
  down: string
  left: string
  right: string
  bomb: string
}

export interface Player {
  id: number
  name: string
  position: Position
  alive: boolean
  /** CSS class used to color the player token. */
  colorClass: string
  controls: PlayerControls
  /** Timestamp of last move, used to throttle movement. */
  lastMoveAt: number
}

export interface Bomb {
  id: string
  ownerId: number
  position: Position
  placedAt: number
  range: number
}

export interface Explosion {
  id: string
  cells: Position[]
  createdAt: number
}

export type GameStatus = "playing" | "over"

export interface GameState {
  /** grid[row][col] */
  grid: TileType[][]
  players: Player[]
  bombs: Bomb[]
  explosions: Explosion[]
  status: GameStatus
  /** id of the winning player, null = draw, undefined = still playing */
  winnerId: number | null | undefined
}
