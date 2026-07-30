import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { sendSmart } from "@/lib/mod/wa-crm-service"

/**
 * Envío de un mensaje de WhatsApp por la Cloud API oficial.
 *
 * CONTRATO PRESERVADO (lo consumen 6 emisores del sistema):
 *   POST { phone, message } → { success, messageId }
 *
 * Campos opcionales nuevos:
 *   useCase       caso de uso para resolver la plantilla si la ventana de 24 h
 *                 está cerrada (ver WA_USE_CASES)
 *   templateData  valores de las variables de esa plantilla
 *   origen        etiqueta de trazabilidad en el historial
 *   sentBy/sentByName  usuario que dispara el envío
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const body = (await request.json()) as {
      phone?: string
      message?: string
      useCase?: string
      templateData?: Record<string, any>
      origen?: string
      sentBy?: string
      sentByName?: string
      replyToWamid?: string
    }

    const { phone, message } = body

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: "Se requiere 'phone' y 'message'" },
        { status: 400 }
      )
    }

    const result = await sendSmart({
      to: phone,
      message,
      useCase: body.useCase,
      templateData: body.templateData,
      origen: body.origen || (auth.isInternal ? "sistema" : "manual"),
      sentBy: body.sentBy || auth.userId || null,
      sentByName: body.sentByName || null,
      replyToWamid: body.replyToWamid || null,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          needsTemplate: result.needsTemplate,
          mode: result.mode,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.wamid,
      mode: result.mode,
      contactId: result.contactId,
    })
  } catch (error: any) {
    console.error("[/api/whatsapp/send] Error:", error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno enviando el mensaje" },
      { status: 500 }
    )
  }
}
