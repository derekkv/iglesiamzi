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
    const phones = formData.get("phones") as string
    const file = formData.get("file") as File | null
    const caption = formData.get("caption") as string | null
    const mediaType = formData.get("mediaType") as string | null

    if (!phones || !file) {
      return NextResponse.json(
        { success: false, error: "Se requiere 'phones' (JSON array) y 'file'" },
        { status: 400 }
      )
    }

    // Validar que phones sea un JSON array válido
    try {
      const parsed = JSON.parse(phones)
      if (!Array.isArray(parsed)) throw new Error()
    } catch {
      return NextResponse.json(
        { success: false, error: "'phones' debe ser un JSON array válido" },
        { status: 400 }
      )
    }

    // Reconstruir FormData para enviar al servidor WhatsApp
    const forwardFormData = new FormData()
    forwardFormData.append("phones", phones)
    forwardFormData.append("file", file)
    if (caption) forwardFormData.append("caption", caption)
    if (mediaType) forwardFormData.append("mediaType", mediaType)

    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/send-bulk-media`, {
      method: "POST",
      body: forwardFormData,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error("Error en /api/whatsapp/send-bulk-media:", error.message)
    return NextResponse.json(
      { success: false, error: "Servidor WhatsApp no disponible" },
      { status: 503 }
    )
  }
}
