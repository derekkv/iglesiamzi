import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { sendPush } from "@/lib/mod/push-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { user_id: string; title: string; body?: string; url?: string }

    // Verificar autenticación
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || "No autorizado" }, { status: 401 })
    }

    const { user_id, title, body: notifBody, url } = body

    if (!user_id || !title) {
      return NextResponse.json({ error: "user_id y title son requeridos" }, { status: 400 })
    }

    const result = await sendPush(user_id, title, notifBody || "", { url: url || "/dashboard" })

    if (!result.success && result.error === "Sin suscripciones activas") {
      return NextResponse.json({ message: "Usuario sin suscripciones push", sent: 0 })
    }

    return NextResponse.json({
      message: "Notificaciones enviadas",
      sent: result.sent,
      cleaned: result.cleaned,
    })
  } catch (error: any) {
    console.error("Error sending notification:", error)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
