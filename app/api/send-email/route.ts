import { NextRequest, NextResponse } from "next/server"
import { emailService, type EmailServiceParams } from "@/lib/mod/email-service"
import { verifyApiAuth } from "@/lib/api-auth"

/**
 * Envío de correo electrónico.
 *
 * CONTRATOS PRESERVADOS (los usan ~12 emisores del sistema):
 *   { to, subject, html }        → envío genérico
 *   { to, type, data }           → plantilla de cronograma (asignacion|alerta2|alerta1)
 *
 * AMPLIACIONES:
 *   cc, bcc, replyTo             → múltiples destinatarios
 *   attachments[]                → adjuntos ({ filename, contentBase64|href, contentType, cid })
 *   { to, template, data }       → cualquier plantilla por slug (email_templates o por defecto)
 *   origen, sentByName, userId   → trazabilidad en email_messages
 *
 * Todo envío queda registrado en email_messages, con éxito o con error.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const body = await request.json()

    // Los adjuntos llegan en base64 para poder viajar por JSON
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.map((a: any) => ({
          filename: a.filename,
          content: a.contentBase64 ? Buffer.from(a.contentBase64, "base64") : undefined,
          href: a.href,
          path: a.path,
          contentType: a.contentType,
          cid: a.cid,
        }))
      : undefined

    const common = {
      cc: body.cc,
      bcc: body.bcc,
      replyTo: body.replyTo,
      attachments,
      origen: body.origen || (auth.isInternal ? "sistema" : "manual"),
      sentBy: body.sentBy || auth.userId || null,
      sentByName: body.sentByName || null,
      userId: body.userId || null,
      campaignId: body.campaignId || null,
    }

    // --- Modo genérico: subject + html ---
    if (body.to && body.subject && body.html) {
      const result = await emailService.sendRawEmail({
        to: body.to,
        subject: body.subject,
        html: body.html,
        text: body.text,
        template: body.template || null,
        inReplyTo: body.inReplyTo,
        references: body.references,
        ...common,
      })

      return result.success
        ? NextResponse.json({ success: true, messageId: result.messageId, recordId: result.recordId })
        : NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    // --- Modo plantilla por slug ---
    if (body.to && body.template && body.data) {
      const result = await emailService.sendTemplateEmail({
        to: body.to,
        template: body.template,
        data: body.data,
        subject: body.subject,
        ...common,
      })

      return result.success
        ? NextResponse.json({ success: true, messageId: result.messageId, recordId: result.recordId })
        : NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    // --- Modo plantilla de cronograma (contrato histórico) ---
    const params = body as EmailServiceParams
    if (!params.to || !params.type || !params.data) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan campos requeridos: to, type, data (o to, subject, html, o to, template, data)",
        },
        { status: 400 }
      )
    }

    const result = await emailService.sendServiceEmail({
      ...params,
      origen: body.origen || "cronograma",
      sentBy: body.sentBy || auth.userId || null,
      userId: body.userId || null,
    })

    return result.success
      ? NextResponse.json({ success: true, messageId: result.messageId, recordId: result.recordId })
      : NextResponse.json({ success: false, error: result.error }, { status: 500 })
  } catch (error: any) {
    console.error("[/api/send-email] Error:", error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}
