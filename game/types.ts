// Core game types. Kept framework-agnostic so the same shapes can later be
// serialized over WebSockets for real multiplayer.

export const COLS = 13
export const ROWS = 11

export const BOMB_FUSE_MS = 3000 // time before a bomb explodes
export const EXPLOSION_MS = 550 // how long the explosion visual/hitbox lasts
export const BLAST_RANGE = 2 // tiles affected in each direction
export const MOVE_SPEED = 5.5 // continuous movement speed in tiles per second
/** How close (in tiles) render position must be to its target cell to count as aligned. */
export const ALIGN_EPSILON = 0.001

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
  /** Logical target cell (integer). Bombs and blast hits resolve against the
   *  cell the player is currently closest to. */
  position: Position
  /** Smooth render position in tile units (floats). x = column, y = row. */
  x: number
  y: number
  /** Direction the character is facing, for sprite orientation. */
  facing: Direction
  /** True while the render position is still catching up to its target cell. */
  moving: boolean
  alive: boolean
  /** Timestamp the player died, used to drive the death animation. */
  diedAt?: number
  /** CSS class used to color the player token. */
  colorClass: string
  controls: PlayerControls
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
