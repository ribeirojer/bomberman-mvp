"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { BroadcastMessage } from "@/game/networkTypes"

interface PresenceEntry {
  playerId: number
  online_at: string
}

export function useSupabaseRealtime(roomCode: string | null, isHost: boolean) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [presenceState, setPresenceState] = useState<RealtimePresenceState<PresenceEntry>>({})
  const [isConnected, setIsConnected] = useState(false)
  const onBroadcastRef = useRef<((msg: BroadcastMessage) => void) | null>(null)

  const presenceCount = Object.keys(presenceState).length

  const setOnBroadcast = useCallback((handler: (msg: BroadcastMessage) => void) => {
    onBroadcastRef.current = handler
  }, [])

  const sendBroadcast = useCallback((event: string, payload: BroadcastMessage) => {
    channelRef.current?.send({
      type: "broadcast",
      event,
      payload,
    })
  }, [])

  useEffect(() => {
    if (!roomCode) return

    const channel = supabase.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: true },
        presence: { key: isHost ? "host" : "guest" },
      },
    })

    channel.on("presence", { event: "sync" }, () => {
      setPresenceState(channel.presenceState<PresenceEntry>())
    })
    channel.on("presence", { event: "join" }, () => {
      setPresenceState(channel.presenceState<PresenceEntry>())
    })
    channel.on("presence", { event: "leave" }, () => {
      setPresenceState(channel.presenceState<PresenceEntry>())
    })

    channel.on<BroadcastMessage>("broadcast", { event: "game" }, ({ payload }) => {
      onBroadcastRef.current?.(payload)
    })

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setIsConnected(true)
        channel.track({
          playerId: isHost ? 1 : 2,
          online_at: new Date().toISOString(),
        })
      }
      if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        setIsConnected(false)
      }
    })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode, isHost])

  return {
    isConnected,
    presenceCount,
    presenceState,
    sendBroadcast,
    setOnBroadcast,
  }
}
