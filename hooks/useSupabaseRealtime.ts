"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { BroadcastMessage } from "@/game/networkTypes"

interface PresenceEntry {
  playerId: number
  online_at: string
}

export function createRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function createRoom(roomCode: string): Promise<boolean> {
  const { error } = await supabase
    .from("bomberman_rooms")
    .insert({ room_code: roomCode, status: "waiting" })
  return !error
}

export async function joinRoom(roomCode: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("bomberman_rooms")
    .select("id, status")
    .eq("room_code", roomCode)
    .eq("status", "waiting")
    .single()

  if (error || !data) return false
  return true
}

export async function updateRoomStatus(
  roomCode: string,
  status: "playing" | "finished",
): Promise<void> {
  await supabase
    .from("bomberman_rooms")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("room_code", roomCode)
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
