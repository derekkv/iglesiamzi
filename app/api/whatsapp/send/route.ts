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

    const body = await request.json() as { phone?: string; message?: string }
    const { phone, message } = body

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: "Se requiere 'phone' y 'message'" },
        { status: 400 }
      )
    }

    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
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
