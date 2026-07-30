import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { sendSmartMedia, type BulkSendResult } from "@/lib/mod/wa-crm-service"
import { uploadMedia, detectMediaType, getWaConfig } from "@/lib/mod/wa-cloud-service"

/**
 * Envío masivo de multimedia por la Cloud API oficial.
 *
 * CONTRATO PRESERVADO (multipart/form-data):
 *   phones (JSON array como string, req), file (req), caption?, mediaType?
 *   → { success, results: SendResult[] }
 *
 * Optimización: el archivo se sube UNA sola vez al CDN de Meta y el media_id
 * resultante se reutiliza para todos los destinatarios.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const formData = await request.formData()
    const phonesRaw = formData.get("phones") as string | null
    const file = formData.get("file") as File | null
    const caption = (formData.get("caption") as string) || undefined
    const mediaType = (formData.get("mediaType") as string) || undefined
    const useCase = (formData.get("useCase") as string) || undefined
    const origen = (formData.get("origen") as string) || undefined
    const campaignId = (formData.get("campaignId") as string) || undefined

    if (!phonesRaw || !file) {
      return NextResponse.json(
        { success: false, error: "Se requiere 'phones' (JSON array) y 'file'" },
        { status: 400 }
      )
    }

    let phones: string[]
    try {
      phones = JSON.parse(phonesRaw)
      if (!Array.isArray(phones)) throw new Error("no es array")
    } catch {
      return NextResponse.json(
        { success: false, error: "'phones' debe ser un JSON array válido" },
        { status: 400 }
      )
    }

    if (phones.length === 0) {
      return NextResponse.json({ success: true, results: [] })
    }

    // Subir el archivo una sola vez y reutilizar el media_id
    const mime = file.type || "application/octet-stream"
    const buffer = Buffer.from(await file.arrayBuffer())
    const upload = await uploadMedia(buffer, mime, file.name)

    if (!upload.success) {
      return NextResponse.json({ success: false, error: upload.error }, { status: 502 })
    }

    const cfg = await getWaConfig()
    const delay = cfg?.bulk_delay_ms ?? 250
    const type = (mediaType as any) || detectMediaType(mime)
    const results: BulkSendResult[] = []

    for (const phone of phones) {
      const res = await sendSmartMedia({
        to: phone,
        mediaId: upload.mediaId,
        mimeType: mime,
        filename: file.name,
        caption,
        type,
        useCase,
        origen: origen || (campaignId ? "campana" : auth.isInternal ? "sistema" : "manual"),
        campaignId: campaignId || null,
        sentBy: auth.userId || null,
      })

      results.push({
        phone: res.waId || phone,
        success: res.success,
        error: res.error,
        messageId: res.wamid,
        mode: res.mode,
      })

      if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    }

    return NextResponse.json({
      success: true,
      results,
      enviados: results.filter((r) => r.success).length,
      fallidos: results.filter((r) => !r.success).length,
    })
  } catch (error: any) {
    console.error("[/api/whatsapp/send-bulk-media] Error:", error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno en el envío masivo" },
      { status: 500 }
    )
  }
}
