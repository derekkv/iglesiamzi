import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"

const WA_SERVER_URL = process.env.WA_SERVER_URL || "http://localhost:3100"

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ qr: null, available: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/qr`, {
      cache: "no-store",
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { qr: null, available: false, error: "Servidor WhatsApp no disponible" },
      { status: 503 }
    )
  }
}
