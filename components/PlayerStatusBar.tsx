import type { GameState } from "@/game/types"

interface PlayerStatusBarProps {
  state: GameState
  localPlayerId?: number
}

export function PlayerStatusBar({ state, localPlayerId }: PlayerStatusBarProps) {
  return (
    <div className="flex w-full max-w-[560px] items-center justify-center gap-4">
      {state.players.map((player) => (
        <div
          key={player.id}
          className="flex flex-1 items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span className={`h-4 w-4 rounded-full ${player.colorClass}`} aria-hidden />
            <span className="font-semibold text-card-foreground">
              {player.name}
              {localPlayerId !== undefined && player.id === localPlayerId ? " (You)" : ""}
            </span>
          </div>
          <span
            className={
              player.alive
                ? "text-sm font-medium text-game-p2"
                : "text-sm font-medium text-destructive"
            }
          >
            {player.alive ? "Alive" : "Dead"}
          </span>
        </div>
      ))}
    </div>
  )
}
