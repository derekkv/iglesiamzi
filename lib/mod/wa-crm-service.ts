/**
 * Capa CRM sobre la WhatsApp Cloud API.
 *
 * SERVER ONLY — usa supabaseServer (service_role).
 *
 * Aporta lo que la API cruda no da:
 *  - contactos (wa_contacts) creados/actualizados automáticamente
 *  - control de la ventana de servicio de 24 h
 *  - "envío inteligente": texto libre si la ventana está abierta, plantilla
 *    aprobada si está cerrada, con fallback automático ante el error 131047
 *  - historial bidireccional en wa_messages, incluidos los estados que llegan
 *    por webhook (sent → delivered → read / failed)
 *  - sincronización del catálogo de plantillas de Meta
 *
 * Todos los emisores del sistema (cronograma, cumpleaños, citaciones, nómina,
 * atrasos, alertas) pasan por sendSmart() y por eso quedan registrados.
 */
import { supabaseServer } from "@/lib/supabase-server"
import { formatPhoneForWhatsApp } from "@/lib/format-phone"
import {
  getWaConfig,
  isConfigured,
  sendText,
  sendTemplate,
  sendMedia,
  listTemplates,
  detectMediaType,
  type TemplateComponent,
  type WaSendResult,
} from "./wa-cloud-service"

/** Casos de uso del sistema que necesitan una plantilla aprobada en Meta. */
export const WA_USE_CASES = [
  "asignacion_servicio",
  "recordatorio_5dias",
  "recordatorio_manana",
  "felicitacion_cumpleanos",
  "citacion_ministerio",
  "aviso_pago",
  "alerta_atraso_servidor",
  "alerta_sistema",
  "resumen_admin",
  "aviso_requerimiento",
  "aviso_ayuda_social",
  "aviso_herederos",
] as const

export type WaUseCase = (typeof WA_USE_CASES)[number]

export const WA_USE_CASE_LABELS: Record<string, string> = {
  asignacion_servicio: "Asignación de servicio (cronograma)",
  recordatorio_5dias: "Recordatorio: servicio en 5 días",
  recordatorio_manana: "Recordatorio: servicio mañana",
  felicitacion_cumpleanos: "Felicitación de cumpleaños",
  citacion_ministerio: "Citaciones y mensajes a ministerios",
  aviso_pago: "Aviso de pago (nómina / transporte / pago diario)",
  alerta_atraso_servidor: "Alerta de servidor atrasado (a líderes)",
  alerta_sistema: "Alerta técnica del sistema",
  resumen_admin: "Resumen diario a administradores",
  aviso_requerimiento: "Requerimientos de bienes y servicios",
  aviso_ayuda_social: "Redil / ayuda social",
  aviso_herederos: "Herederos del Reino (ciclos)",
}

const WINDOW_MS = 24 * 60 * 60 * 1000

export interface WaContact {
  id: string
  wa_id: string
  display_name: string | null
  profile_name: string | null
  user_id: string | null
  censo_id: number | null
  censo_fuente: string | null
  ministerio: string | null
  tags: string[]
  assigned_to: string | null
  notes: string | null
  opt_in: boolean
  opt_out_at: string | null
  blocked: boolean
  last_inbound_at: string | null
  last_outbound_at: string | null
  window_expires_at: string | null
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  created_at: string
  updated_at: string
}

export interface WaTemplateRow {
  id: string
  meta_id: string | null
  name: string
  language: string
  category: string | null
  status: string
  components: any
  body_preview: string | null
  header_format: string | null
  variable_count: number
  use_case: string | null
  variable_map: Record<string, string> | null
}

export type WaOrigen =
  | "manual" | "cronograma" | "cumpleanos" | "citacion" | "nomina"
  | "atraso" | "sistema" | "requerimiento" | "campana" | "herederos"
  | "pago_diario" | "redil"

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

export function normalizeWaId(phone: string): string {
  return formatPhoneForWhatsApp(String(phone || "").trim())
}

/** ¿Se puede enviar texto libre ahora mismo? (ventana de servicio de 24 h) */
export function isWindowOpen(contact: Pick<WaContact, "window_expires_at"> | null): boolean {
  if (!contact?.window_expires_at) return false
  return new Date(contact.window_expires_at).getTime() > Date.now()
}

export async function getContactByWaId(waId: string): Promise<WaContact | null> {
  const { data } = await supabaseServer
    .from("wa_contacts")
    .select("*")
    .eq("wa_id", waId)
    .maybeSingle()
  return (data as WaContact) || null
}

/**
 * Devuelve el contacto o lo crea. Si el número corresponde a un usuario del
 * sistema, lo vincula automáticamente para que el CRM muestre el nombre real.
 */
export async function getOrCreateContact(
  waId: string,
  seed?: { profileName?: string; displayName?: string; userId?: string }
): Promise<WaContact | null> {
  const existing = await getContactByWaId(waId)
  if (existing) {
    // Completar datos que lleguen después (nombre de perfil, vínculo con usuario)
    const patch: Record<string, any> = {}
    if (seed?.profileName && seed.profileName !== existing.profile_name) {
      patch.profile_name = seed.profileName
    }
    if (seed?.userId && !existing.user_id) patch.user_id = seed.userId
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString()
      await supabaseServer.from("wa_contacts").update(patch).eq("id", existing.id)
      return { ...existing, ...patch } as WaContact
    }
    return existing
  }

  // Intentar vincular con un usuario del sistema por teléfono
  let userId = seed?.userId ?? null
  let displayName = seed?.displayName ?? null
  if (!userId) {
    const { data: users } = await supabaseServer
      .from("users")
      .select("id, displayName, phone, ministerio_name")
      .not("phone", "is", null)
      .limit(500)

    const match = (users || []).find((u: any) => u.phone && normalizeWaId(u.phone) === waId)
    if (match) {
      userId = match.id
      displayName = displayName || match.displayName
    }
  }

  const { data, error } = await supabaseServer
    .from("wa_contacts")
    .insert({
      wa_id: waId,
      display_name: displayName,
      profile_name: seed?.profileName || null,
      user_id: userId,
    })
    .select("*")
    .single()

  if (error) {
    // Carrera con otro request: reintentar la lectura
    if (error.code === "23505" || error.message?.includes("duplicate")) {
      return getContactByWaId(waId)
    }
    console.error("[wa-crm] Error creando contacto:", error.message)
    return null
  }

  return data as WaContact
}

/** Registra actividad entrante: abre la ventana de 24 h y suma no leídos. */
async function touchInbound(contactId: string, preview: string, at: string) {
  const windowExpires = new Date(new Date(at).getTime() + WINDOW_MS).toISOString()

  // Usar incremento atómico via RPC para evitar race condition.
  // Si no existe la función RPC, fallback al patrón anterior.
  try {
    await supabaseServer.rpc("increment_unread_count", { contact_id_param: contactId })
  } catch {
    // Fallback: incremento no atómico (mejor que nada si no existe la RPC)
    const { data: current } = await supabaseServer
      .from("wa_contacts")
      .select("unread_count")
      .eq("id", contactId)
      .maybeSingle()

    await supabaseServer
      .from("wa_contacts")
      .update({
        last_inbound_at: at,
        window_expires_at: windowExpires,
        last_message_at: at,
        last_message_preview: preview.slice(0, 200),
        unread_count: (current?.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId)
    return
  }

  // Si la RPC tuvo éxito, actualizar el resto de campos sin tocar unread_count
  await supabaseServer
    .from("wa_contacts")
    .update({
      last_inbound_at: at,
      window_expires_at: windowExpires,
      last_message_at: at,
      last_message_preview: preview.slice(0, 200),
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId)
}

async function touchOutbound(contactId: string, preview: string, at: string) {
  await supabaseServer
    .from("wa_contacts")
    .update({
      last_outbound_at: at,
      last_message_at: at,
      last_message_preview: preview.slice(0, 200),
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId)
}

export async function markConversationRead(contactId: string) {
  await supabaseServer
    .from("wa_contacts")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", contactId)
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

export async function getTemplateForUseCase(useCase: string): Promise<WaTemplateRow | null> {
  const { data } = await supabaseServer
    .from("wa_templates")
    .select("*")
    .eq("use_case", useCase)
    .maybeSingle()

  const tpl = (data as WaTemplateRow) || null
  if (!tpl) return null
  // Solo sirven las aprobadas
  if (tpl.status && tpl.status.toUpperCase() !== "APPROVED") return null
  return tpl
}

/**
 * Normaliza un valor para usarlo como parámetro de plantilla.
 *
 * Meta rechaza los parámetros vacíos (error 132000) y no admite saltos de
 * línea, tabulaciones ni más de 4 espacios consecutivos dentro de un
 * parámetro. Sin esta limpieza, un campo opcional sin valor (por ejemplo
 * "hora de entrada" o "ministerio") tumbaría todo el envío.
 */
export function sanitizeTemplateParam(value: any): string {
  if (value === undefined || value === null) return "—"
  const text = String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{4,}/g, "   ")
    .trim()
  return text.length > 0 ? text : "—"
}

/**
 * Construye los `components` de la plantilla a partir de un objeto de datos y
 * el `variable_map` configurado ({ "1": "userName", "2": "asignacion" }).
 */
export function buildTemplateComponents(
  template: WaTemplateRow,
  data: Record<string, any>,
  headerMedia?: { id?: string; link?: string }
): TemplateComponent[] {
  const components: TemplateComponent[] = []

  const headerFormat = (template.header_format || "NONE").toUpperCase()
  if (headerMedia && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)) {
    const key = headerFormat.toLowerCase()
    const value: Record<string, any> = headerMedia.id ? { id: headerMedia.id } : { link: headerMedia.link }
    components.push({
      type: "header",
      parameters: [{ type: key, [key]: value }],
    })
  }

  const map = template.variable_map || {}
  const mapIndices = Object.keys(map)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)

  // Usar variable_count como fuente de verdad para la cantidad de parámetros.
  // Si variable_map tiene menos llaves de las que la plantilla declara,
  // Meta rechaza el envío por discrepancia en el número de parámetros.
  const expectedCount = template.variable_count || 0
  const indices =
    mapIndices.length >= expectedCount
      ? mapIndices
      : Array.from({ length: expectedCount }, (_, i) => i + 1)

  if (indices.length > 0) {
    const parameters = indices.map((i) => {
      const field = map[String(i)]
      // Si el campo existe en el map, buscar por nombre; si no, buscar por índice directo
      const value = field ? data?.[field] : data?.[String(i)]
      return { type: "text" as const, text: sanitizeTemplateParam(value) }
    })
    components.push({ type: "body", parameters })
  }

  return components
}

/** Trae el catálogo de plantillas de Meta y lo refleja en wa_templates. */
export async function syncTemplates(): Promise<{
  success: boolean
  synced?: number
  removed?: number
  error?: string
}> {
  const result = await listTemplates()
  if (!result.success || !result.templates) {
    return { success: false, error: result.error }
  }

  let synced = 0
  const syncedNames = new Set<string>()

  for (const t of result.templates) {
    const components = Array.isArray(t.components) ? t.components : []
    const bodyComponent = components.find((c: any) => c?.type === "BODY")
    const headerComponent = components.find((c: any) => c?.type === "HEADER")
    const bodyText: string = bodyComponent?.text || ""
    const variableCount = new Set(bodyText.match(/\{\{(\d+)\}\}/g) || []).size

    const { error } = await supabaseServer
      .from("wa_templates")
      .upsert(
        {
          meta_id: t.id,
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          components,
          body_preview: bodyText.slice(0, 1000),
          header_format: (headerComponent?.format || "NONE").toUpperCase(),
          variable_count: variableCount,
          rejected_reason: t.rejected_reason || null,
          quality_score: t.quality_score?.score || null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "name,language" }
      )

    if (error) {
      console.error(`[wa-crm] Error sincronizando plantilla ${t.name}:`, error.message)
      continue
    }
    syncedNames.add(`${t.name}__${t.language}`)
    synced++
  }

  // Eliminar plantillas que ya no existen en Meta (soft-delete: marcar como "DELETED")
  let removed = 0
  if (syncedNames.size > 0) {
    const { data: dbTemplates } = await supabaseServer
      .from("wa_templates")
      .select("id, name, language, status")
      .neq("status", "DELETED")

    if (dbTemplates) {
      for (const row of dbTemplates) {
        const key = `${row.name}__${row.language}`
        if (!syncedNames.has(key)) {
          await supabaseServer
            .from("wa_templates")
            .update({ status: "DELETED", synced_at: new Date().toISOString() })
            .eq("id", row.id)
          removed++
        }
      }
    }
  }

  return { success: true, synced, removed }
}

// ---------------------------------------------------------------------------
// Historial (wa_messages)
// ---------------------------------------------------------------------------

interface LogOutboundParams {
  contactId: string | null
  waId: string
  type: string
  body?: string | null
  caption?: string | null
  mediaId?: string | null
  mediaUrl?: string | null
  mediaMime?: string | null
  mediaFilename?: string | null
  templateName?: string | null
  templateLanguage?: string | null
  templateParams?: any
  result: WaSendResult | { success: boolean; error?: string; errorCode?: number; wamid?: string }
  sentBy?: string | null
  sentByName?: string | null
  origen?: WaOrigen | string
  campaignId?: string | null
  contextWamid?: string | null
  /** Fuerza el estado (p. ej. "skipped" cuando no se intentó enviar) */
  forcedStatus?: string
}

async function logOutbound(params: LogOutboundParams): Promise<string | null> {
  const now = new Date().toISOString()
  const ok = params.result.success

  const row: Record<string, any> = {
    wamid: params.result.wamid || null,
    contact_id: params.contactId,
    wa_id: params.waId,
    direction: "outbound",
    type: params.type,
    body: params.body ?? null,
    caption: params.caption ?? null,
    media_id: params.mediaId ?? null,
    media_url: params.mediaUrl ?? null,
    media_mime: params.mediaMime ?? null,
    media_filename: params.mediaFilename ?? null,
    template_name: params.templateName ?? null,
    template_language: params.templateLanguage ?? null,
    template_params: params.templateParams ?? null,
    status: params.forcedStatus || (ok ? "sent" : "failed"),
    sent_at: ok ? now : null,
    failed_at: ok ? null : now,
    error_code: (params.result as any).errorCode ?? null,
    error_message: params.result.error ?? null,
    sent_by: params.sentBy ?? null,
    sent_by_name: params.sentByName ?? null,
    campaign_id: params.campaignId ?? null,
    origen: params.origen || "manual",
    context_wamid: params.contextWamid ?? null,
  }

  const { data, error } = await supabaseServer
    .from("wa_messages")
    .insert(row)
    .select("id")
    .single()

  if (error) {
    console.error("[wa-crm] Error registrando mensaje saliente:", error.message)
    return null
  }
  return data?.id || null
}

/** Registra un mensaje entrante recibido por webhook. */
export async function logInbound(params: {
  wamid: string
  waId: string
  profileName?: string
  type: string
  body?: string | null
  caption?: string | null
  mediaId?: string | null
  mediaMime?: string | null
  mediaFilename?: string | null
  contextWamid?: string | null
  timestamp?: string
  raw?: any
}): Promise<{ success: boolean; duplicated?: boolean }> {
  const at = params.timestamp || new Date().toISOString()
  const contact = await getOrCreateContact(params.waId, { profileName: params.profileName })

  const preview =
    params.body ||
    params.caption ||
    (params.type === "image" ? "📷 Imagen"
      : params.type === "audio" ? "🎤 Audio"
      : params.type === "video" ? "🎬 Video"
      : params.type === "document" ? "📄 Documento"
      : params.type === "sticker" ? "Sticker"
      : params.type === "location" ? "📍 Ubicación"
      : "Mensaje")

  const { error } = await supabaseServer.from("wa_messages").insert({
    wamid: params.wamid,
    contact_id: contact?.id || null,
    wa_id: params.waId,
    direction: "inbound",
    type: params.type,
    body: params.body ?? null,
    caption: params.caption ?? null,
    media_id: params.mediaId ?? null,
    media_mime: params.mediaMime ?? null,
    media_filename: params.mediaFilename ?? null,
    status: "received",
    context_wamid: params.contextWamid ?? null,
    raw: params.raw ?? null,
    created_at: at,
  })

  if (error) {
    // El webhook de Meta puede reintentar: ignorar duplicados por wamid
    if (error.code === "23505" || error.message?.includes("duplicate")) {
      return { success: true, duplicated: true }
    }
    console.error("[wa-crm] Error registrando mensaje entrante:", error.message)
    return { success: false }
  }

  if (contact) await touchInbound(contact.id, preview, at)
  return { success: true }
}

/** Actualiza el estado de un mensaje saliente desde el webhook de Meta. */
export async function updateMessageStatus(params: {
  wamid: string
  status: "sent" | "delivered" | "read" | "failed"
  timestamp?: string
  errorCode?: number
  errorTitle?: string
  errorMessage?: string
  conversationId?: string
  pricingCategory?: string
  billable?: boolean
}): Promise<void> {
  const at = params.timestamp || new Date().toISOString()

  // No degradar el estado: read > delivered > sent
  const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 }

  const { data: existing } = await supabaseServer
    .from("wa_messages")
    .select("id, status, campaign_id")
    .eq("wamid", params.wamid)
    .maybeSingle()

  if (!existing) return

  const patch: Record<string, any> = {}
  if ((rank[params.status] ?? 0) >= (rank[existing.status] ?? 0)) {
    patch.status = params.status
  }
  if (params.status === "sent") patch.sent_at = at
  if (params.status === "delivered") patch.delivered_at = at
  if (params.status === "read") patch.read_at = at
  if (params.status === "failed") {
    patch.failed_at = at
    patch.error_code = params.errorCode ?? null
    patch.error_title = params.errorTitle ?? null
    patch.error_message = params.errorMessage ?? null
  }
  if (params.conversationId) patch.conversation_id = params.conversationId
  if (params.pricingCategory) patch.pricing_category = params.pricingCategory
  if (params.billable !== undefined) patch.billable = params.billable

  if (Object.keys(patch).length > 0) {
    await supabaseServer.from("wa_messages").update(patch).eq("id", existing.id)
  }

  // Propagar a campaña y destinatario
  if (existing.campaign_id) {
    const statusMap: Record<string, string> = {
      sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido",
    }
    await supabaseServer
      .from("wa_campaign_recipients")
      .update({ status: statusMap[params.status] || "enviado", error_message: params.errorMessage ?? null })
      .eq("wamid", params.wamid)

    await recalcCampaignMetrics(existing.campaign_id)
  }
}

export async function recalcCampaignMetrics(campaignId: string): Promise<void> {
  const { data } = await supabaseServer
    .from("wa_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId)

  const rows = data || []
  const count = (s: string) => rows.filter((r: any) => r.status === s).length

  await supabaseServer
    .from("wa_campaigns")
    .update({
      total: rows.length,
      enviados: rows.length - count("pendiente") - count("fallido") - count("omitido"),
      entregados: count("entregado") + count("leido"),
      leidos: count("leido"),
      fallidos: count("fallido"),
    })
    .eq("id", campaignId)
}

// ---------------------------------------------------------------------------
// Envío inteligente
// ---------------------------------------------------------------------------

export interface SmartSendParams {
  /** Teléfono en cualquier formato: se normaliza internamente */
  to: string
  /** Texto libre. Se usa si la ventana de 24 h está abierta. */
  message: string
  /** Caso de uso para resolver la plantilla si la ventana está cerrada */
  useCase?: WaUseCase | string
  /** Datos para rellenar las variables de la plantilla */
  templateData?: Record<string, any>
  /** Media de cabecera si la plantilla la exige */
  headerMedia?: { id?: string; link?: string }
  origen?: WaOrigen | string
  sentBy?: string | null
  sentByName?: string | null
  campaignId?: string | null
  replyToWamid?: string | null
  /** Si es false, no intenta plantilla y falla si la ventana está cerrada */
  allowTemplateFallback?: boolean
}

export interface SmartSendResult extends WaSendResult {
  /** Cómo se envió finalmente */
  mode?: "text" | "template" | "skipped"
  messageId?: string | null
  contactId?: string | null
  waId?: string
}

/**
 * Envía respetando las reglas de la Cloud API:
 *  1. Normaliza el número y resuelve el contacto.
 *  2. Si el contacto está bloqueado o dio opt-out, omite el envío (queda registrado).
 *  3. Si la ventana de 24 h está abierta, envía texto libre.
 *  4. Si está cerrada y hay plantilla aprobada para el caso de uso, la usa.
 *  5. Si creía la ventana abierta pero Meta responde 131047, reintenta con plantilla.
 */
export async function sendSmart(params: SmartSendParams): Promise<SmartSendResult> {
  const waId = normalizeWaId(params.to)
  if (!waId || waId.length < 8) {
    return { success: false, error: `Número de teléfono inválido: "${params.to}"`, waId }
  }

  const cfg = await getWaConfig()
  const contact = await getOrCreateContact(waId)

  if (!isConfigured(cfg)) {
    // Se registra igualmente: el historial debe reflejar todo intento de envío,
    // sobre todo los automáticos, para poder auditar qué no llegó a salir.
    const error =
      "WhatsApp Cloud API no está configurada. Complete las credenciales en WhatsApp / Email → Configuración."
    const messageId = await logOutbound({
      contactId: contact?.id || null,
      waId,
      type: "text",
      body: params.message,
      result: { success: false, error },
      sentBy: params.sentBy,
      sentByName: params.sentByName,
      origen: params.origen,
      campaignId: params.campaignId,
    })
    return { success: false, error, messageId, contactId: contact?.id || null, waId }
  }

  // Respetar opt-out y bloqueos
  if (contact && (contact.blocked || !contact.opt_in)) {
    const reason = contact.blocked
      ? "El contacto está bloqueado en el CRM."
      : "El contacto solicitó no recibir mensajes (opt-out)."
    const messageId = await logOutbound({
      contactId: contact.id,
      waId,
      type: "text",
      body: params.message,
      result: { success: false, error: reason },
      sentBy: params.sentBy,
      sentByName: params.sentByName,
      origen: params.origen,
      campaignId: params.campaignId,
      forcedStatus: "skipped",
    })
    return { success: false, error: reason, mode: "skipped", messageId, contactId: contact.id, waId }
  }

  const allowFallback = params.allowTemplateFallback !== false
  const windowOpen = isWindowOpen(contact)
  const template = params.useCase && allowFallback ? await getTemplateForUseCase(params.useCase) : null

  // Ventana cerrada y hay plantilla → ir directo a plantilla
  if (!windowOpen && template) {
    return sendViaTemplate(template)
  }

  // Intento de texto libre
  const textResult = await sendText(waId, params.message, {
    replyToWamid: params.replyToWamid || undefined,
  })

  if (textResult.success) {
    const now = new Date().toISOString()
    const messageId = await logOutbound({
      contactId: contact?.id || null,
      waId,
      type: "text",
      body: params.message,
      result: textResult,
      sentBy: params.sentBy,
      sentByName: params.sentByName,
      origen: params.origen,
      campaignId: params.campaignId,
      contextWamid: params.replyToWamid,
    })
    if (contact) await touchOutbound(contact.id, params.message, now)
    return { ...textResult, mode: "text", messageId, contactId: contact?.id || null, waId }
  }

  // Meta rechazó por ventana cerrada → reintentar con plantilla
  if (textResult.needsTemplate && template) {
    return sendViaTemplate(template)
  }

  const failMessage =
    textResult.needsTemplate && params.useCase && !template
      ? `${textResult.error} No hay plantilla aprobada asignada al caso de uso "${
          WA_USE_CASE_LABELS[params.useCase] || params.useCase
        }". Configúrela en WhatsApp / Email → Plantillas.`
      : textResult.error

  const messageId = await logOutbound({
    contactId: contact?.id || null,
    waId,
    type: "text",
    body: params.message,
    result: { ...textResult, error: failMessage },
    sentBy: params.sentBy,
    sentByName: params.sentByName,
    origen: params.origen,
    campaignId: params.campaignId,
  })

  return { ...textResult, error: failMessage, mode: "text", messageId, contactId: contact?.id || null, waId }

  // --- helper interno ---
  async function sendViaTemplate(tpl: WaTemplateRow): Promise<SmartSendResult> {
    const data = params.templateData || {}
    const components = buildTemplateComponents(tpl, data, params.headerMedia)
    const result = await sendTemplate(waId, tpl.name, tpl.language, components)

    const now = new Date().toISOString()
    const messageId = await logOutbound({
      contactId: contact?.id || null,
      waId,
      // Guardamos el texto equivalente para poder leer el historial sin ir a Meta
      type: "template",
      body: params.message,
      templateName: tpl.name,
      templateLanguage: tpl.language,
      templateParams: { data, components },
      result,
      sentBy: params.sentBy,
      sentByName: params.sentByName,
      origen: params.origen,
      campaignId: params.campaignId,
    })

    if (result.success && contact) await touchOutbound(contact.id, params.message, now)
    return { ...result, mode: "template", messageId, contactId: contact?.id || null, waId }
  }
}

/**
 * Envío de multimedia. Acepta un buffer (se sube a Meta) o una URL pública.
 * Fuera de la ventana de 24 h la Cloud API exige plantilla, así que si se
 * indica useCase con plantilla de cabecera IMAGE/VIDEO/DOCUMENT se usa esa vía.
 */
export async function sendSmartMedia(params: {
  to: string
  buffer?: Buffer | Uint8Array
  mimeType?: string
  filename?: string
  link?: string
  mediaId?: string
  caption?: string
  type?: "image" | "video" | "audio" | "document" | "sticker"
  useCase?: WaUseCase | string
  templateData?: Record<string, any>
  origen?: WaOrigen | string
  sentBy?: string | null
  sentByName?: string | null
  campaignId?: string | null
}): Promise<SmartSendResult> {
  const waId = normalizeWaId(params.to)
  if (!waId || waId.length < 8) {
    return { success: false, error: `Número de teléfono inválido: "${params.to}"`, waId }
  }

  const cfg = await getWaConfig()
  const contact = await getOrCreateContact(waId)

  if (!isConfigured(cfg)) {
    const error =
      "WhatsApp Cloud API no está configurada. Complete las credenciales en WhatsApp / Email → Configuración."
    const messageId = await logOutbound({
      contactId: contact?.id || null,
      waId,
      type: params.type || "document",
      caption: params.caption,
      mediaFilename: params.filename,
      result: { success: false, error },
      sentBy: params.sentBy,
      sentByName: params.sentByName,
      origen: params.origen,
      campaignId: params.campaignId,
    })
    return { success: false, error, messageId, contactId: contact?.id || null, waId }
  }

  if (contact && (contact.blocked || !contact.opt_in)) {
    const reason = contact.blocked
      ? "El contacto está bloqueado en el CRM."
      : "El contacto solicitó no recibir mensajes (opt-out)."
    const messageId = await logOutbound({
      contactId: contact.id,
      waId,
      type: params.type || "document",
      caption: params.caption,
      result: { success: false, error: reason },
      sentBy: params.sentBy,
      sentByName: params.sentByName,
      origen: params.origen,
      campaignId: params.campaignId,
      forcedStatus: "skipped",
    })
    return { success: false, error: reason, mode: "skipped", messageId, contactId: contact.id, waId }
  }

  const mime = params.mimeType || "application/octet-stream"
  const type = params.type || detectMediaType(mime)

  // Resolver el media: id existente, subida del buffer, o link público
  let mediaId = params.mediaId
  if (!mediaId && !params.link && params.buffer) {
    const { uploadMedia } = await import("./wa-cloud-service")
    const up = await uploadMedia(params.buffer, mime, params.filename || "archivo")
    if (!up.success) {
      const messageId = await logOutbound({
        contactId: contact?.id || null,
        waId,
        type,
        caption: params.caption,
        mediaMime: mime,
        mediaFilename: params.filename,
        result: { success: false, error: up.error },
        sentBy: params.sentBy,
        sentByName: params.sentByName,
        origen: params.origen,
        campaignId: params.campaignId,
      })
      return { success: false, error: up.error, messageId, contactId: contact?.id || null, waId }
    }
    mediaId = up.mediaId
  }

  const windowOpen = isWindowOpen(contact)
  const template = params.useCase ? await getTemplateForUseCase(params.useCase) : null
  const templateSupportsMedia =
    template && ["IMAGE", "VIDEO", "DOCUMENT"].includes((template.header_format || "").toUpperCase())

  // Fuera de la ventana solo se puede usar plantilla con cabecera multimedia
  if (!windowOpen && templateSupportsMedia && template) {
    const components = buildTemplateComponents(template, params.templateData || {}, {
      id: mediaId,
      link: params.link,
    })
    const result = await sendTemplate(waId, template.name, template.language, components)
    const messageId = await logOutbound({
      contactId: contact?.id || null,
      waId,
      type: "template",
      caption: params.caption,
      mediaId,
      mediaUrl: params.link,
      mediaMime: mime,
      mediaFilename: params.filename,
      templateName: template.name,
      templateLanguage: template.language,
      templateParams: { data: params.templateData, components },
      result,
      sentBy: params.sentBy,
      sentByName: params.sentByName,
      origen: params.origen,
      campaignId: params.campaignId,
    })
    if (result.success && contact) {
      await touchOutbound(contact.id, params.caption || "Multimedia", new Date().toISOString())
    }
    return { ...result, mode: "template", messageId, contactId: contact?.id || null, waId }
  }

  const result = await sendMedia(waId, {
    type,
    mediaId,
    link: params.link,
    caption: params.caption,
    filename: params.filename,
  })

  const failMessage =
    !result.success && result.needsTemplate && !templateSupportsMedia
      ? `${result.error} Para enviar multimedia fuera de la ventana de 24 horas se necesita una plantilla aprobada con cabecera de imagen/video/documento.`
      : result.error

  const messageId = await logOutbound({
    contactId: contact?.id || null,
    waId,
    type,
    caption: params.caption,
    mediaId,
    mediaUrl: params.link,
    mediaMime: mime,
    mediaFilename: params.filename,
    result: { ...result, error: failMessage },
    sentBy: params.sentBy,
    sentByName: params.sentByName,
    origen: params.origen,
    campaignId: params.campaignId,
  })

  if (result.success && contact) {
    await touchOutbound(contact.id, params.caption || "Multimedia", new Date().toISOString())
  }

  return { ...result, error: failMessage, mode: "text", messageId, contactId: contact?.id || null, waId }
}

/** Resultado por destinatario, compatible con el contrato antiguo del panel. */
export interface BulkSendResult {
  phone: string
  success: boolean
  error?: string
  messageId?: string
  mode?: string
}

/** Opciones de configuración para envío masivo. */
export interface BulkSendOptions {
  /** Máximo de fallos consecutivos antes de abortar (circuit breaker). Default: 10 */
  maxConsecutiveFailures?: number
  /** Porcentaje máximo de fallos sobre total enviados antes de abortar. Default: 0.7 (70%) */
  maxFailureRate?: number
  /** Mínimo de envíos antes de evaluar la tasa de fallos. Default: 5 */
  minSampleSize?: number
}

/**
 * Envío masivo secuencial con pausa configurable entre mensajes.
 * Incluye circuit breaker: aborta si hay demasiados fallos consecutivos
 * o si la tasa de error supera el umbral configurado.
 */
export async function sendBulkSmart(
  phones: string[],
  base: Omit<SmartSendParams, "to">,
  options?: BulkSendOptions
): Promise<BulkSendResult[]> {
  const cfg = await getWaConfig()
  const delay = cfg?.bulk_delay_ms ?? 250
  const results: BulkSendResult[] = []

  const maxConsecutiveFailures = options?.maxConsecutiveFailures ?? 10
  const maxFailureRate = options?.maxFailureRate ?? 0.7
  const minSampleSize = options?.minSampleSize ?? 5

  let consecutiveFailures = 0
  let totalFailures = 0

  for (const phone of phones) {
    const res = await sendSmart({ ...base, to: phone })
    results.push({
      phone: res.waId || phone,
      success: res.success,
      error: res.error,
      messageId: res.wamid,
      mode: res.mode,
    })

    // Circuit breaker: evaluar si debemos abortar
    if (res.success) {
      consecutiveFailures = 0
    } else {
      consecutiveFailures++
      totalFailures++

      // Abortar por fallos consecutivos
      if (consecutiveFailures >= maxConsecutiveFailures) {
        const remaining = phones.length - results.length
        console.error(
          `[wa-crm] Bulk send abortado: ${maxConsecutiveFailures} fallos consecutivos. ` +
          `${results.length}/${phones.length} procesados, ${remaining} omitidos.`
        )
        // Marcar los restantes como no enviados
        const remainingPhones = phones.slice(results.length)
        for (const p of remainingPhones) {
          results.push({
            phone: p,
            success: false,
            error: `Envío abortado: ${maxConsecutiveFailures} fallos consecutivos previos`,
            mode: "skipped",
          })
        }
        break
      }

      // Abortar por tasa de error alta (solo si tenemos suficiente muestra)
      if (results.length >= minSampleSize) {
        const failureRate = totalFailures / results.length
        if (failureRate >= maxFailureRate) {
          const remaining = phones.length - results.length
          console.error(
            `[wa-crm] Bulk send abortado: tasa de error ${(failureRate * 100).toFixed(0)}% ` +
            `(>${(maxFailureRate * 100).toFixed(0)}%). ${results.length}/${phones.length} procesados, ${remaining} omitidos.`
          )
          const remainingPhones = phones.slice(results.length)
          for (const p of remainingPhones) {
            results.push({
              phone: p,
              success: false,
              error: `Envío abortado: tasa de error demasiado alta (${(failureRate * 100).toFixed(0)}%)`,
              mode: "skipped",
            })
          }
          break
        }
      }
    }

    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
  }

  return results
}

export const waCrm = {
  normalizeWaId,
  isWindowOpen,
  getContactByWaId,
  getOrCreateContact,
  markConversationRead,
  getTemplateForUseCase,
  buildTemplateComponents,
  syncTemplates,
  logInbound,
  updateMessageStatus,
  recalcCampaignMetrics,
  sendSmart,
  sendSmartMedia,
  sendBulkSmart,
}
