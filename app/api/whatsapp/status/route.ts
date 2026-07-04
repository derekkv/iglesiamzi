import { NextResponse } from "next/server"

const WA_SERVER_URL = process.env.WA_SERVER_URL || "http://localhost:3100"

export async function GET() {
  try {
    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/status`, {
      cache: "no-store",
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, connecting: false, error: "Servidor WhatsApp no disponible" },
      { status: 503 }
    )
  }
}
