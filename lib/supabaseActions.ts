import { supabase } from "@/lib/supabase"

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
