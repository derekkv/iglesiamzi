import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { sendTemplate } from "@/lib/mod/wa-cloud-service"
import { normalizeWaId, getOrCreateContact, getTemplateForUseCase, buildTemplateComponents } from "@/lib/mod/wa-crm-service"
import { supabaseServer } from "@/lib/supabase-server"

/**
 * Envío explícito de una plantilla aprobada.
 *
 * POST {
 *   phone,
 *   template?  nombre exacto de la plantilla en Meta
 *   useCase?   alternativa: resolver la plantilla por caso de uso
 *   language?  por defecto el idioma guardado de la plantilla
 *   data?      valores de las variables según variable_map
 *   headerMedia? { id } | { link }
 * } → { success, messageId }
 *
 * Es la única forma de contactar a alguien fuera de la ventana de 24 h.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const body = (await request.json()) as {
      phone?: string
      template?: string
      useCase?: string
      language?: string
      data?: Record<string, any>
      headerMedia?: { id?: string; link?: string }
      origen?: string
      sentByName?: string
      previewText?: string
    }

    if (!body.phone || (!body.template && !body.useCase)) {
      return NextResponse.json(
        { success: false, error: "Se requiere 'phone' y ('template' o 'useCase')" },
        { status: 400 }
      )
    }

    const waId = normalizeWaId(body.phone)

    // Resolver la plantilla
    let tpl = null as any
    if (body.useCase) {
      tpl = await getTemplateForUseCase(body.useCase)
      if (!tpl) {
        return NextResponse.json(
          {
            success: false,
            error: `No hay plantilla aprobada asignada al caso de uso "${body.useCase}". Asígnela en WhatsApp / Email → Plantillas.`,
          },
          { status: 400 }
        )
      }
    } else {
      let query = supabaseServer.from("wa_templates").select("*").eq("name", body.template)
      if (body.language) query = query.eq("language", body.language)
      const { data } = await query.limit(1).maybeSingle()
      tpl = data
      if (!tpl) {
        return NextResponse.json(
          {
            success: false,
            error: `La plantilla "${body.template}" no está en el catálogo local. Sincronice las plantillas desde Meta primero.`,
          },
          { status: 400 }
        )
      }
      if ((tpl.status || "").toUpperCase() !== "APPROVED") {
        return NextResponse.json(
          { success: false, error: `La plantilla "${tpl.name}" no está aprobada (estado: ${tpl.status}).` },
          { status: 400 }
        )
      }
    }

    const contact = await getOrCreateContact(waId)
    const components = buildTemplateComponents(tpl, body.data || {}, body.headerMedia)
    const language = body.language || tpl.language

    const result = await sendTemplate(waId, tpl.name, language, components)
    const now = new Date().toISOString()

    // Registrar en el historial
    const { data: inserted } = await supabaseServer
      .from("wa_messages")
      .insert({
        wamid: result.wamid || null,
        contact_id: contact?.id || null,
        wa_id: waId,
        direction: "outbound",
        type: "template",
        body: body.previewText || tpl.body_preview || null,
        template_name: tpl.name,
        template_language: language,
        template_params: { data: body.data, components },
        status: result.success ? "sent" : "failed",
        sent_at: result.success ? now : null,
        failed_at: result.success ? null : now,
        error_code: result.errorCode ?? null,
        error_message: result.error ?? null,
        sent_by: auth.userId || null,
        sent_by_name: body.sentByName || null,
        origen: body.origen || (auth.isInternal ? "sistema" : "manual"),
      })
      .select("id")
      .single()

    if (result.success && contact) {
      await supabaseServer
        .from("wa_contacts")
        .update({
          last_outbound_at: now,
          last_message_at: now,
          last_message_preview: (body.previewText || tpl.body_preview || "Plantilla").slice(0, 200),
          updated_at: now,
        })
        .eq("id", contact.id)
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.wamid,
      recordId: inserted?.id,
      template: tpl.name,
    })
  } catch (error: any) {
    console.error("[/api/whatsapp/send-template] Error:", error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno enviando la plantilla" },
      { status: 500 }
    )
  }
}
