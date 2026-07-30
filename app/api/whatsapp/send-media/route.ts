import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { sendSmartMedia } from "@/lib/mod/wa-crm-service"

/**
 * Envío de multimedia por la Cloud API oficial.
 *
 * CONTRATO PRESERVADO (multipart/form-data):
 *   phone (req), file (req), caption?, mediaType?
 *   → { success, messageId }
 *
 * A diferencia de WhatsApp Web, la Cloud API no acepta binarios dentro del
 * mensaje: el archivo se sube primero al CDN de Meta (uploadMedia) y se envía
 * por media_id. Eso lo resuelve sendSmartMedia.
 *
 * Alternativa sin multipart: JSON { phone, link, mediaType?, caption? }.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const contentType = request.headers.get("content-type") || ""

    // --- Modo JSON: enviar por URL pública ---
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        phone?: string
        link?: string
        mediaType?: string
        caption?: string
        filename?: string
        useCase?: string
        templateData?: Record<string, any>
        origen?: string
      }

      if (!body.phone || !body.link) {
        return NextResponse.json(
          { success: false, error: "Se requiere 'phone' y 'link'" },
          { status: 400 }
        )
      }

      const result = await sendSmartMedia({
        to: body.phone,
        link: body.link,
        type: body.mediaType as any,
        caption: body.caption,
        filename: body.filename,
        useCase: body.useCase,
        templateData: body.templateData,
        origen: body.origen || (auth.isInternal ? "sistema" : "manual"),
        sentBy: auth.userId || null,
      })

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, errorCode: result.errorCode, needsTemplate: result.needsTemplate },
          { status: 502 }
        )
      }
      return NextResponse.json({ success: true, messageId: result.wamid, mode: result.mode })
    }

    // --- Modo multipart (contrato original) ---
    const formData = await request.formData()
    const phone = formData.get("phone") as string | null
    const file = formData.get("file") as File | null
    const caption = (formData.get("caption") as string) || undefined
    const mediaType = (formData.get("mediaType") as string) || undefined
    const useCase = (formData.get("useCase") as string) || undefined
    const origen = (formData.get("origen") as string) || undefined
    const templateDataRaw = formData.get("templateData") as string | null

    if (!phone || !file) {
      return NextResponse.json(
        { success: false, error: "Se requiere 'phone' y 'file'" },
        { status: 400 }
      )
    }

    let templateData: Record<string, any> | undefined
    if (templateDataRaw) {
      try {
        templateData = JSON.parse(templateDataRaw)
      } catch {
        return NextResponse.json(
          { success: false, error: "'templateData' debe ser un JSON válido" },
          { status: 400 }
        )
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await sendSmartMedia({
      to: phone,
      buffer,
      mimeType: file.type || undefined,
      filename: file.name,
      caption,
      type: mediaType as any,
      useCase,
      templateData,
      origen: origen || (auth.isInternal ? "sistema" : "manual"),
      sentBy: auth.userId || null,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode, needsTemplate: result.needsTemplate },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, messageId: result.wamid, mode: result.mode })
  } catch (error: any) {
    console.error("[/api/whatsapp/send-media] Error:", error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno enviando el archivo" },
      { status: 500 }
    )
  }
}
