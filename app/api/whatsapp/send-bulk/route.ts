import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { sendBulkSmart } from "@/lib/mod/wa-crm-service"

/**
 * Envío masivo de texto por la Cloud API oficial.
 *
 * CONTRATO PRESERVADO:
 *   POST { phones: string[], message } → { success, results: SendResult[] }
 *   SendResult = { phone, success, error?, messageId? }
 *
 * Opcionales: useCase, templateData, origen, campaignId, sentBy, sentByName.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const body = (await request.json()) as {
      phones?: string[]
      message?: string
      useCase?: string
      templateData?: Record<string, any>
      origen?: string
      campaignId?: string
      sentBy?: string
      sentByName?: string
    }

    const { phones, message } = body

    if (!phones || !Array.isArray(phones) || !message) {
      return NextResponse.json(
        { success: false, error: "Se requiere 'phones' (array) y 'message'" },
        { status: 400 }
      )
    }

    if (phones.length === 0) {
      return NextResponse.json({ success: true, results: [] })
    }

    const results = await sendBulkSmart(phones, {
      message,
      useCase: body.useCase,
      templateData: body.templateData,
      origen: body.origen || (body.campaignId ? "campana" : auth.isInternal ? "sistema" : "manual"),
      campaignId: body.campaignId || null,
      sentBy: body.sentBy || auth.userId || null,
      sentByName: body.sentByName || null,
    })

    return NextResponse.json({
      success: true,
      results,
      enviados: results.filter((r) => r.success).length,
      fallidos: results.filter((r) => !r.success).length,
    })
  } catch (error: any) {
    console.error("[/api/whatsapp/send-bulk] Error:", error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno en el envío masivo" },
      { status: 500 }
    )
  }
}
