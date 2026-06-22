"use client"

import { Button } from "@/components/ui/button"

interface WaitingScreenProps {
  roomCode: string
  isHost: boolean
  presenceCount: number
  onBackToLobby: () => void
}

export function WaitingScreen({ roomCode, isHost, presenceCount, onBackToLobby }: WaitingScreenProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-lg border border-border bg-card px-6 py-4 text-center">
        <p className="text-lg font-semibold text-card-foreground">Room: {roomCode}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isHost
            ? presenceCount < 2
              ? "Waiting for opponent to join…"
              : "Starting game…"
            : "Waiting for host to start…"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Players connected: {presenceCount}/2</p>
      </div>
      <Button onClick={onBackToLobby} variant="outline" size="sm">
        Leave Room
      </Button>
    </div>
  )
}
