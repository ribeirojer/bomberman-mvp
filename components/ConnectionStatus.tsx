"use client"

interface ConnectionStatusProps {
  roomCode: string
  isConnected: boolean
}

export function ConnectionStatus({ roomCode, isConnected }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2 text-sm" aria-live="polite">
      <span className="text-muted-foreground">
        Room: <span className="font-mono font-semibold text-foreground">{roomCode}</span>
      </span>
      <span className="text-muted-foreground">|</span>
      <span className={isConnected ? "text-green-500" : "text-destructive"}>
        {isConnected ? "Connected" : "Disconnected"}
      </span>
    </div>
  )
}
