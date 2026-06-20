"use client"

import { useEffect, useState } from "react"
import { COLS } from "@/game/types"

export function useCellSize(): number {
  const [cellSize, setCellSize] = useState(40)

  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return
      const available = Math.min(window.innerWidth - 32, 560)
      return Math.max(24, Math.min(40, Math.floor(available / COLS)))
    }

    setCellSize(update() ?? 40)

    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return cellSize
}
