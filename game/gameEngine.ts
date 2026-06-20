// Pure game logic. No React or DOM here. Every function returns a *new* state
// object (or mutates a freshly produced draft) so the engine stays easy to test
// and to drive from either local state or a future WebSocket server.

import {
  BLAST_RANGE,
  BOMB_FUSE_MS,
  COLS,
  Direction,
  EXPLOSION_MS,
  GameState,
  MOVE_COOLDOWN_MS,
  Player,
  PlayerControls,
  Position,
  ROWS,
  TileType,
} from "./types"

const DIRECTION_DELTAS: Record<Direction, Position> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
}

const PLAYER_SPAWNS: Position[] = [
  { row: 1, col: 1 }, // Player 1: top-left
  { row: ROWS - 2, col: COLS - 2 }, // Player 2: bottom-right
]

const PLAYER_COLORS = ["bg-game-p1", "bg-game-p2"]

const PLAYER_CONTROLS: PlayerControls[] = [
  { up: "w", down: "s", left: "a", right: "d", bomb: " " },
  { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", bomb: "enter" },
]

let bombCounter = 0
let explosionCounter = 0

function isBorder(row: number, col: number): boolean {
  return row === 0 || col === 0 || row === ROWS - 1 || col === COLS - 1
}

// Classic Bomberman pillar layout: indestructible walls on every other tile.
function isPillar(row: number, col: number): boolean {
  return row % 2 === 0 && col % 2 === 0
}

// Spawn corners are kept clear so players are never trapped at start.
function isSpawnSafeZone(row: number, col: number): boolean {
  return PLAYER_SPAWNS.some((spawn) => {
    const adjacent = Math.abs(spawn.row - row) + Math.abs(spawn.col - col)
    return adjacent <= 1
  })
}

function createGrid(): TileType[][] {
  const grid: TileType[][] = []
  for (let row = 0; row < ROWS; row++) {
    const line: TileType[] = []
    for (let col = 0; col < COLS; col++) {
      if (isBorder(row, col) || isPillar(row, col)) {
        line.push("wall")
      } else if (!isSpawnSafeZone(row, col) && Math.random() < 0.72) {
        line.push("brick")
      } else {
        line.push("floor")
      }
    }
    grid.push(line)
  }
  return grid
}

export function createInitialState(): GameState {
  const players: Player[] = PLAYER_SPAWNS.map((spawn, index) => ({
    id: index + 1,
    name: `Player ${index + 1}`,
    position: { ...spawn },
    alive: true,
    colorClass: PLAYER_COLORS[index],
    controls: PLAYER_CONTROLS[index],
    lastMoveAt: 0,
  }))

  return {
    grid: createGrid(),
    players,
    bombs: [],
    explosions: [],
    status: "playing",
    winnerId: undefined,
  }
}

function inBounds(pos: Position): boolean {
  return pos.row >= 0 && pos.row < ROWS && pos.col >= 0 && pos.col < COLS
}

function hasBombAt(state: GameState, pos: Position): boolean {
  return state.bombs.some((b) => b.position.row === pos.row && b.position.col === pos.col)
}

/**
 * Attempt to move a player one tile in a direction. Movement is grid-based and
 * throttled so holding a key produces steady stepping. Returns a new state.
 */
export function movePlayer(state: GameState, playerId: number, direction: Direction, now: number): GameState {
  if (state.status !== "playing") return state

  const player = state.players.find((p) => p.id === playerId)
  if (!player || !player.alive) return state
  if (now - player.lastMoveAt < MOVE_COOLDOWN_MS) return state

  const delta = DIRECTION_DELTAS[direction]
  const target: Position = { row: player.position.row + delta.row, col: player.position.col + delta.col }

  if (!inBounds(target)) return state
  if (state.grid[target.row][target.col] !== "floor") return state
  if (hasBombAt(state, target)) return state

  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, position: target, lastMoveAt: now } : p,
  )
  return { ...state, players }
}

/**
 * Place a bomb at the player's current tile, if alive and no bomb is there yet.
 */
export function placeBomb(state: GameState, playerId: number, now: number): GameState {
  if (state.status !== "playing") return state

  const player = state.players.find((p) => p.id === playerId)
  if (!player || !player.alive) return state
  if (hasBombAt(state, player.position)) return state

  const bomb = {
    id: `bomb-${bombCounter++}`,
    ownerId: playerId,
    position: { ...player.position },
    placedAt: now,
    range: BLAST_RANGE,
  }
  return { ...state, bombs: [...state.bombs, bomb] }
}

// Compute the cross-shaped blast cells for a single bomb, stopping at
// indestructible walls and after destroying the first brick in each direction.
function computeBlastCells(grid: TileType[][], origin: Position, range: number) {
  const cells: Position[] = [{ ...origin }]
  const destroyedBricks: Position[] = []

  for (const dir of Object.values(DIRECTION_DELTAS)) {
    for (let step = 1; step <= range; step++) {
      const pos: Position = { row: origin.row + dir.row * step, col: origin.col + dir.col * step }
      if (!inBounds(pos)) break
      const tile = grid[pos.row][pos.col]
      if (tile === "wall") break
      cells.push(pos)
      if (tile === "brick") {
        destroyedBricks.push(pos)
        break // blast does not pass through a brick
      }
    }
  }

  return { cells, destroyedBricks }
}

/**
 * Advance the simulation: detonate fused bombs (with chain reactions), destroy
 * bricks, kill players in blasts, and expire finished explosions.
 */
export function updateGame(state: GameState, now: number): GameState {
  if (state.status !== "playing") return state

  let grid = state.grid
  let bombs = state.bombs
  const newExplosionCells: Position[] = []

  // Detonate all bombs that have reached the end of their fuse, chaining into
  // any other bombs caught in a blast.
  const exploded = new Set<string>()
  const queue = bombs.filter((b) => now - b.placedAt >= BOMB_FUSE_MS)
  let gridChanged = false
  let workingGrid = grid.map((line) => [...line])

  while (queue.length > 0) {
    const bomb = queue.shift()!
    if (exploded.has(bomb.id)) continue
    exploded.add(bomb.id)

    const { cells, destroyedBricks } = computeBlastCells(workingGrid, bomb.position, bomb.range)
    newExplosionCells.push(...cells)

    for (const brick of destroyedBricks) {
      workingGrid[brick.row][brick.col] = "floor"
      gridChanged = true
    }

    // Chain reaction: any bomb sitting on a blasted cell detonates now too.
    for (const other of bombs) {
      if (exploded.has(other.id)) continue
      const hit = cells.some((c) => c.row === other.position.row && c.col === other.position.col)
      if (hit) queue.push(other)
    }
  }

  if (exploded.size === 0) {
    // No detonations this tick. Only expire old explosions.
    const explosions = state.explosions.filter((e) => now - e.createdAt < EXPLOSION_MS)
    if (explosions.length === state.explosions.length) return state
    return { ...state, explosions }
  }

  if (gridChanged) grid = workingGrid
  bombs = bombs.filter((b) => !exploded.has(b.id))

  // Build the new explosion record for this tick.
  const explosion = {
    id: `explosion-${explosionCounter++}`,
    cells: newExplosionCells,
    createdAt: now,
  }

  // Kill any player standing on a freshly blasted cell.
  const players = state.players.map((p) => {
    if (!p.alive) return p
    const caught = newExplosionCells.some((c) => c.row === p.position.row && c.col === p.position.col)
    return caught ? { ...p, alive: false } : p
  })

  const explosions = [
    ...state.explosions.filter((e) => now - e.createdAt < EXPLOSION_MS),
    explosion,
  ]

  let status = state.status
  let winnerId = state.winnerId
  const alivePlayers = players.filter((p) => p.alive)
  if (alivePlayers.length <= 1) {
    status = "over"
    winnerId = alivePlayers.length === 1 ? alivePlayers[0].id : null
  }

  return { ...state, grid, bombs, players, explosions, status, winnerId }
}

/**
 * Map a keyboard key to a player action. Returns null if the key is unbound.
 * Centralizing this makes it trivial to swap in network input later.
 */
export function resolveAction(
  players: Player[],
  key: string,
): { playerId: number; type: "move"; direction: Direction } | { playerId: number; type: "bomb" } | null {
  const k = key.toLowerCase()
  for (const player of players) {
    const c = player.controls
    if (k === c.up) return { playerId: player.id, type: "move", direction: "up" }
    if (k === c.down) return { playerId: player.id, type: "move", direction: "down" }
    if (k === c.left) return { playerId: player.id, type: "move", direction: "left" }
    if (k === c.right) return { playerId: player.id, type: "move", direction: "right" }
    if (k === c.bomb) return { playerId: player.id, type: "bomb" }
  }
  return null
}
