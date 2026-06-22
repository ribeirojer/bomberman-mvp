"use client"

import { Lobby } from "@/components/Lobby"

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
          Bomberman
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">Last one standing wins.</p>
      </header>

      <Lobby />
    </main>
  )
}
