import { NextResponse } from "next/server"

const WA_SERVER_URL = process.env.WA_SERVER_URL || "http://localhost:3100"

export async function POST() {
  try {
    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Servidor WhatsApp no disponible" },
      { status: 503 }
    )
  }
}
