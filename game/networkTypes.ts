import type { Direction, GameState } from "./types"

// Messages sent between host and guest over Supabase Realtime Broadcast.

export interface InputMessage {
  type: "input"
  playerId: number
  /** True = key pressed, false = key released */
  pressed: boolean
  action: MoveAction | BombAction
}

export interface MoveAction {
  actionType: "move"
  direction: Direction
}

export interface BombAction {
  actionType: "bomb"
}

export interface StateMessage {
  type: "state"
  state: GameState
}

export interface StartMessage {
  type: "start"
  hostPlayerId: number
  guestPlayerId: number
}

export type BroadcastMessage = InputMessage | StateMessage | StartMessage
