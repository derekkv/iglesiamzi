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

    // Leer el FormData del request y reenviarlo al servidor WhatsApp
    const formData = await request.formData()
    const phone = formData.get("phone") as string
    const file = formData.get("file") as File | null
    const caption = formData.get("caption") as string | null
    const mediaType = formData.get("mediaType") as string | null

    if (!phone || !file) {
      return NextResponse.json(
        { success: false, error: "Se requiere 'phone' y 'file'" },
        { status: 400 }
      )
    }

    // Reconstruir FormData para enviar al servidor WhatsApp
    const forwardFormData = new FormData()
    forwardFormData.append("phone", phone)
    forwardFormData.append("file", file)
    if (caption) forwardFormData.append("caption", caption)
    if (mediaType) forwardFormData.append("mediaType", mediaType)

    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/send-media`, {
      method: "POST",
      body: forwardFormData,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error("Error en /api/whatsapp/send-media:", error.message)
    return NextResponse.json(
      { success: false, error: "Servidor WhatsApp no disponible" },
      { status: 503 }
    )
  }
}
