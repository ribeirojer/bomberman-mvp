"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { OnlineGame } from "@/components/OnlineGame"
import { createRoom, createRoomCode, joinRoom } from "@/lib/supabaseActions"

type LobbyState =
  | { phase: "menu" }
  | { phase: "creating" }
  | { phase: "joining" }
  | { phase: "playing"; roomCode: string; isHost: boolean; playerId: number }
  | { phase: "error"; message: string }

export function Lobby() {
  const [lobbyState, setLobbyState] = useState<LobbyState>({ phase: "menu" })
  const [joinCode, setJoinCode] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCreate = useCallback(async () => {
    setLoading(true)
    setLobbyState({ phase: "creating" })

    const code = createRoomCode()
    const ok = await createRoom(code)

    if (ok) {
      setLobbyState({ phase: "playing", roomCode: code, isHost: true, playerId: 1 })
    } else {
      setLobbyState({ phase: "error", message: "Failed to create room. Try again." })
    }
    setLoading(false)
  }, [])

  const handleJoin = useCallback(async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 4) {
      setLobbyState({ phase: "error", message: "Room code must be 4 characters." })
      return
    }

    setLoading(true)
    const ok = await joinRoom(code)

    if (ok) {
      setLobbyState({ phase: "playing", roomCode: code, isHost: false, playerId: 2 })
    } else {
      setLobbyState({ phase: "error", message: "Room not found or already full." })
    }
    setLoading(false)
  }, [joinCode])

  const handleBackToLobby = useCallback(() => {
    setLobbyState({ phase: "menu" })
  }, [])

  if (lobbyState.phase === "playing") {
    return (
      <OnlineGame
        roomCode={lobbyState.roomCode}
        isHost={lobbyState.isHost}
        playerId={lobbyState.playerId}
        onBackToLobby={handleBackToLobby}
      />
    )
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">Multiplayer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a room or join a friend&apos;s game
        </p>
      </div>

      {lobbyState.phase === "menu" && (
        <div className="flex w-full flex-col gap-4">
          <Button onClick={handleCreate} size="lg" disabled={loading} className="w-full">
            Create Room
          </Button>

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <label htmlFor="room-code-input" className="sr-only">
              Room code
            </label>
            <input
              id="room-code-input"
              type="text"
              maxLength={4}
              placeholder="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-center font-mono text-lg uppercase tracking-widest text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <Button
              onClick={handleJoin}
              disabled={loading || joinCode.length !== 4}
              aria-label="Join room"
            >
              Join
            </Button>
          </div>
        </div>
      )}

      {lobbyState.phase === "creating" && (
        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <p className="text-sm text-muted-foreground">Creating room…</p>
        </div>
      )}

      {lobbyState.phase === "error" && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-destructive">{lobbyState.message}</p>
          <Button onClick={() => setLobbyState({ phase: "menu" })} variant="outline" size="sm">
            Back
          </Button>
        </div>
      )}
    </div>
  )
}
