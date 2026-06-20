"use client"

import { useState } from "react"
import { BombermanGame } from "@/components/BombermanGame"
import { Lobby } from "@/components/Lobby"

export default function Page() {
  const [mode, setMode] = useState<"local" | "online">("local")

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
          Bomberman
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">Last one standing wins.</p>
      </header>

      {/* Mode toggle */}
      <div className="inline-flex rounded-lg border border-border bg-muted p-0.5">
        <button
          onClick={() => setMode("local")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "local"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Local
        </button>
        <button
          onClick={() => setMode("online")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "online"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Online
        </button>
      </div>

      {mode === "local" ? <BombermanGame /> : <Lobby />}
    </main>
  )
}
