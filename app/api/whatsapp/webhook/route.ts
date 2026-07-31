import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { supabaseServer } from "@/lib/supabase-server"
import { getWaConfig } from "@/lib/mod/wa-cloud-service"
import { logInbound, updateMessageStatus } from "@/lib/mod/wa-crm-service"

/**
 * Webhook de WhatsApp Cloud API.
 *
 * RUTA PÚBLICA a propósito: la llama Meta, no el navegador. No usa
 * verifyApiAuth; la autenticidad se comprueba de dos formas:
 *   GET  → token de verificación (hub.verify_token) contra wa_config.verify_token
 *   POST → firma HMAC SHA-256 del cuerpo crudo (X-Hub-Signature-256) con app_secret
 *
 * Sin este webhook no hay estados reales (delivered/read), ni mensajes
 * entrantes, ni ventana de 24 h: es decir, no hay CRM.
 *
 * Configurar en Meta → WhatsApp → Configuración → Webhooks:
 *   URL de callback: https://panel.iglesiaregalodedios.com/api/whatsapp/webhook
 *   Campos suscritos: messages
 */

// Meta espera respuesta rápida (<20 s) o reintenta. Nunca devolver 5xx por
// errores de procesamiento: se registra el evento y se responde 200.
export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// GET — verificación del webhook
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge")

  const cfg = await getWaConfig()
  const expected = cfg?.verify_token

  if (!expected) {
    console.warn("[wa-webhook] Verificación rechazada: no hay verify_token configurado")
    return new NextResponse("Webhook no configurado", { status: 503 })
  }

  if (mode === "subscribe" && token === expected) {
    return new NextResponse(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  return new NextResponse("Token de verificación inválido", { status: 403 })
}

// ---------------------------------------------------------------------------
// POST — eventos
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // 1. Leer el cuerpo CRUDO (necesario para validar la firma)
  const rawBody = await request.text()
  console.log(`[wa-webhook] 🔔 POST recibido | tamaño: ${rawBody.length} bytes`)

  let signatureValid = false
  try {
    const cfg = await getWaConfig()
    const appSecret = cfg?.app_secret
    const header = request.headers.get("x-hub-signature-256") || ""

    if (appSecret && header.startsWith("sha256=")) {
      const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")
      const received = header.slice(7)
      // Comparación en tiempo constante
      signatureValid =
        received.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"))
    } else if (!appSecret) {
      // Sin app_secret configurado no se puede validar. Se acepta pero se
      // marca como no verificado para que se vea en el panel.
      signatureValid = false
    }

    if (appSecret && !signatureValid) {
      console.warn("[wa-webhook] Firma inválida — evento descartado")
      await logEvent("invalid_signature", safeParse(rawBody), false, "Firma HMAC inválida")
      return new NextResponse("Firma inválida", { status: 401 })
    }
  } catch (err: any) {
    console.error("[wa-webhook] Error validando firma:", err?.message)
    return new NextResponse("EVENT_RECEIVED", { status: 200 })
  }

  // 2. Procesar
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    await logEvent("unparseable", { raw: rawBody.slice(0, 2000) }, signatureValid, "Cuerpo no es JSON")
    return new NextResponse("EVENT_RECEIVED", { status: 200 })
  }

  try {
    await processPayload(payload, signatureValid)
  } catch (err: any) {
    console.error("[wa-webhook] Error procesando evento:", err?.message)
    await logEvent("error", payload, signatureValid, err?.message || "Error procesando")
  }

  // Meta solo necesita un 200
  return new NextResponse("EVENT_RECEIVED", { status: 200 })
}

// ---------------------------------------------------------------------------
// Procesamiento
// ---------------------------------------------------------------------------

async function processPayload(payload: any, signatureValid: boolean) {
  if (payload?.object !== "whatsapp_business_account") {
    console.log("[wa-webhook] Evento ignorado: object =", payload?.object)
    await logEvent("unknown_object", payload, signatureValid)
    return
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const field = change.field
      const value = change.value || {}

      // --- Mensajes entrantes ---
      if (Array.isArray(value.messages) && value.messages.length > 0) {
        const contacts = value.contacts || []

        for (const msg of value.messages) {
          const waId: string = msg.from
          const profile = contacts.find((c: any) => c.wa_id === waId)
          const profileName = profile?.profile?.name
          const { type, body, caption, mediaId, mediaMime, mediaFilename } = extractContent(msg)

          console.log(
            `[wa-webhook] 📩 Mensaje entrante | de: ${waId} (${profileName || "sin nombre"}) | tipo: ${type} | wamid: ${msg.id}` +
            (body ? ` | body: "${body.slice(0, 80)}"` : "") +
            (caption ? ` | caption: "${caption.slice(0, 50)}"` : "") +
            (mediaId ? ` | media: ${mediaId}` : "")
          )

          await logInbound({
            wamid: msg.id,
            waId,
            profileName,
            type,
            body,
            caption,
            mediaId,
            mediaMime,
            mediaFilename,
            contextWamid: msg.context?.id || null,
            timestamp: msg.timestamp
              ? new Date(Number(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
            raw: msg,
          })
        }

        console.log(`[wa-webhook] ✅ ${value.messages.length} mensaje(s) entrante(s) procesado(s)`)
        await logEvent("messages", change, signatureValid)
        continue
      }

      // --- Estados de mensajes enviados ---
      if (Array.isArray(value.statuses) && value.statuses.length > 0) {
        for (const st of value.statuses) {
          const error = Array.isArray(st.errors) ? st.errors[0] : undefined

          console.log(
            `[wa-webhook] 📬 Status | wamid: ${st.id} | status: ${st.status}` +
            (st.conversation?.id ? ` | conv: ${st.conversation.id}` : "") +
            (st.pricing?.category ? ` | pricing: ${st.pricing.category}` : "") +
            (error ? ` | ❌ error: ${error.code} ${error.title}` : "")
          )

          await updateMessageStatus({
            wamid: st.id,
            status: st.status,
            timestamp: st.timestamp
              ? new Date(Number(st.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
            errorCode: error?.code,
            errorTitle: error?.title,
            errorMessage: error?.error_data?.details || error?.message || error?.title,
            conversationId: st.conversation?.id,
            pricingCategory: st.pricing?.category,
            billable: st.pricing?.billable,
          })
        }

        console.log(`[wa-webhook] ✅ ${value.statuses.length} status(es) procesado(s)`)
        await logEvent("statuses", change, signatureValid)
        continue
      }

      // --- Cambios de estado de plantillas ---
      if (field === "message_template_status_update") {
        const name = value.message_template_name
        const language = value.message_template_language
        const status = value.event

        console.log(
          `[wa-webhook] 📋 Template status | nombre: ${name} | idioma: ${language} | nuevo estado: ${status}` +
          (value.reason ? ` | razón: ${value.reason}` : "")
        )

        await logEvent("template_status", change, signatureValid)

        if (name && status) {
          const patch: Record<string, any> = { status }
          if (value.reason) patch.rejected_reason = value.reason
          let query = supabaseServer.from("wa_templates").update(patch).eq("name", name)
          if (language) query = query.eq("language", language)
          await query
        }
        continue
      }

      // --- Evento no reconocido ---
      console.log(`[wa-webhook] ⚠️ Evento no procesado | field: ${field || "unknown"} | keys: ${Object.keys(value).join(", ")}`)
      await logEvent(field || "unknown", change, signatureValid)
    }
  }
}

/** Normaliza el contenido de un mensaje entrante a nuestras columnas. */
function extractContent(msg: any): {
  type: string
  body: string | null
  caption: string | null
  mediaId: string | null
  mediaMime: string | null
  mediaFilename: string | null
} {
  const type = msg.type || "unknown"
  const base = {
    type,
    body: null as string | null,
    caption: null as string | null,
    mediaId: null as string | null,
    mediaMime: null as string | null,
    mediaFilename: null as string | null,
  }

  switch (type) {
    case "text":
      return { ...base, body: msg.text?.body ?? null }

    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const media = msg[type] || {}
      return {
        ...base,
        mediaId: media.id ?? null,
        mediaMime: media.mime_type ?? null,
        mediaFilename: media.filename ?? null,
        caption: media.caption ?? null,
      }
    }

    case "location": {
      const loc = msg.location || {}
      const label = [loc.name, loc.address].filter(Boolean).join(" — ")
      return {
        ...base,
        body: label || `${loc.latitude}, ${loc.longitude}`,
      }
    }

    case "contacts":
      return {
        ...base,
        body: (msg.contacts || [])
          .map((c: any) => c.name?.formatted_name)
          .filter(Boolean)
          .join(", "),
      }

    case "button":
      return { ...base, body: msg.button?.text ?? null }

    case "interactive": {
      const inter = msg.interactive || {}
      return {
        ...base,
        body:
          inter.button_reply?.title ||
          inter.list_reply?.title ||
          inter.nfm_reply?.body ||
          null,
      }
    }

    case "reaction":
      return { ...base, body: msg.reaction?.emoji ?? null }

    case "system":
      return { ...base, body: msg.system?.body ?? null }

    default:
      return { ...base, body: null }
  }
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text.slice(0, 2000) }
  }
}

async function logEvent(
  eventType: string,
  payload: any,
  signatureValid: boolean,
  error?: string
) {
  try {
    await supabaseServer.from("wa_webhook_events").insert({
      event_type: eventType,
      payload,
      signature_valid: signatureValid,
      processed: !error,
      error: error || null,
    })
  } catch (err: any) {
    console.error("[wa-webhook] No se pudo registrar el evento:", err?.message)
  }
}
