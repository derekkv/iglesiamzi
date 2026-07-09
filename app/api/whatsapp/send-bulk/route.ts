import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"

const WA_SERVER_URL = process.env.WA_SERVER_URL || "http://localhost:3100"

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const body = await request.json() as { phones?: string[]; message?: string }
    const { phones, message } = body

    if (!phones || !Array.isArray(phones) || !message) {
      return NextResponse.json(
        { success: false, error: "Se requiere 'phones' (array) y 'message'" },
        { status: 400 }
      )
    }

    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/send-bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones, message }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Servidor WhatsApp no disponible" },
      { status: 503 }
    )
  }
}
