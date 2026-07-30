/**
 * Cliente de bajo nivel para la WhatsApp Cloud API oficial (Meta Graph API).
 *
 * SERVER ONLY — usa supabaseServer (service_role) porque lee el access_token
 * y el app_secret de la tabla wa_config, que nunca deben llegar al navegador.
 * No importar desde componentes de cliente.
 *
 * Responsabilidades:
 *  - leer/guardar la configuración (wa_config) con caché corta
 *  - enviar texto, plantillas y media
 *  - subir y descargar media del CDN de Meta
 *  - listar plantillas de la WABA
 *  - health check del número
 *  - traducir los códigos de error de Meta a mensajes en español
 *
 * La lógica de CRM (contactos, ventana de 24 h, historial) vive en
 * lib/mod/wa-crm-service.ts, que se apoya en este módulo.
 */
import { supabaseServer } from "@/lib/supabase-server"

const GRAPH_BASE = "https://graph.facebook.com"
const DEFAULT_API_VERSION = "v21.0"
const REQUEST_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface WaConfig {
  id: number
  phone_number_id: string | null
  waba_id: string | null
  business_id: string | null
  access_token: string | null
  app_secret: string | null
  verify_token: string | null
  api_version: string | null
  display_phone: string | null
  verified_name: string | null
  quality_rating: string | null
  messaging_limit: string | null
  token_expires_at: string | null
  is_active: boolean
  last_health_check_at: string | null
  last_health_ok: boolean | null
  last_health_error: string | null
  auto_create_contacts: boolean
  bulk_delay_ms: number
  updated_at: string | null
}

/** Config sin secretos, apta para enviar al navegador. */
export interface WaConfigPublic {
  configured: boolean
  phone_number_id: string | null
  waba_id: string | null
  business_id: string | null
  api_version: string | null
  display_phone: string | null
  verified_name: string | null
  quality_rating: string | null
  messaging_limit: string | null
  token_expires_at: string | null
  is_active: boolean
  auto_create_contacts: boolean
  bulk_delay_ms: number
  last_health_check_at: string | null
  last_health_ok: boolean | null
  last_health_error: string | null
  updated_at: string | null
  /** Solo indican si hay valor guardado, nunca el valor */
  has_access_token: boolean
  has_app_secret: boolean
  has_verify_token: boolean
}

export interface WaSendResult {
  success: boolean
  wamid?: string
  error?: string
  errorCode?: number
  /** true si el fallo se debe a la ventana de 24 h y hace falta una plantilla */
  needsTemplate?: boolean
  raw?: any
}

export interface WaMediaType {
  type: "image" | "video" | "audio" | "document" | "sticker"
}

export type WaHealth = {
  ok: boolean
  configured: boolean
  phoneNumber: string | null
  verifiedName: string | null
  qualityRating: string | null
  messagingLimit: string | null
  error?: string
}

// ---------------------------------------------------------------------------
// Configuración (wa_config) con caché de 30 s
// ---------------------------------------------------------------------------

let configCache: { value: WaConfig | null; ts: number } | null = null
const CONFIG_TTL_MS = 30_000

export function invalidateWaConfigCache() {
  configCache = null
}

export async function getWaConfig(force = false): Promise<WaConfig | null> {
  if (!force && configCache && Date.now() - configCache.ts < CONFIG_TTL_MS) {
    return configCache.value
  }

  const { data, error } = await supabaseServer
    .from("wa_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    console.error("[wa-cloud] Error leyendo wa_config:", error.message)
    return configCache?.value ?? null
  }

  const value = (data as WaConfig) || null
  configCache = { value, ts: Date.now() }
  return value
}

/** ¿Hay credenciales mínimas para operar? */
export function isConfigured(cfg: WaConfig | null): cfg is WaConfig {
  return !!(cfg && cfg.phone_number_id && cfg.access_token && cfg.is_active)
}

export function toPublicConfig(cfg: WaConfig | null): WaConfigPublic {
  return {
    configured: isConfigured(cfg),
    phone_number_id: cfg?.phone_number_id ?? null,
    waba_id: cfg?.waba_id ?? null,
    business_id: cfg?.business_id ?? null,
    api_version: cfg?.api_version ?? DEFAULT_API_VERSION,
    display_phone: cfg?.display_phone ?? null,
    verified_name: cfg?.verified_name ?? null,
    quality_rating: cfg?.quality_rating ?? null,
    messaging_limit: cfg?.messaging_limit ?? null,
    token_expires_at: cfg?.token_expires_at ?? null,
    is_active: cfg?.is_active ?? false,
    auto_create_contacts: cfg?.auto_create_contacts ?? true,
    bulk_delay_ms: cfg?.bulk_delay_ms ?? 250,
    last_health_check_at: cfg?.last_health_check_at ?? null,
    last_health_ok: cfg?.last_health_ok ?? null,
    last_health_error: cfg?.last_health_error ?? null,
    updated_at: cfg?.updated_at ?? null,
    has_access_token: !!cfg?.access_token,
    has_app_secret: !!cfg?.app_secret,
    has_verify_token: !!cfg?.verify_token,
  }
}

/**
 * Guarda parcialmente la configuración. Los campos secretos solo se
 * sobrescriben si llegan con un valor no vacío (así la UI puede enviar el
 * formulario sin reescribir el token cada vez).
 */
export async function saveWaConfig(
  patch: Partial<Record<keyof WaConfig, any>>,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const secretFields: (keyof WaConfig)[] = ["access_token", "app_secret", "verify_token"]
  const update: Record<string, any> = {}

  const allowed: (keyof WaConfig)[] = [
    "phone_number_id", "waba_id", "business_id", "access_token", "app_secret",
    "verify_token", "api_version", "token_expires_at", "is_active",
    "auto_create_contacts", "bulk_delay_ms",
  ]

  for (const key of allowed) {
    if (!(key in patch)) continue
    const value = patch[key]
    if (secretFields.includes(key) && (value === "" || value === null || value === undefined)) {
      continue // no borrar secretos con valores vacíos
    }
    update[key] = value
  }

  if (Object.keys(update).length === 0) {
    return { success: true }
  }

  update.updated_at = new Date().toISOString()
  if (userId) update.updated_by = userId

  const { error } = await supabaseServer.from("wa_config").update(update).eq("id", 1)
  invalidateWaConfigCache()

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Llamadas HTTP a Graph API
// ---------------------------------------------------------------------------

function apiVersion(cfg: WaConfig): string {
  return cfg.api_version || DEFAULT_API_VERSION
}

/**
 * Traduce los códigos de error de Meta a mensajes accionables en español.
 * Referencia: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export function describeMetaError(code?: number, fallback?: string): string {
  switch (code) {
    case 0:
    case 190:
      return "El token de acceso expiró o es inválido. Genere uno nuevo en Meta Business y actualícelo en Configuración."
    case 3:
    case 10:
    case 200:
    case 299:
      return "La aplicación de Meta no tiene los permisos necesarios (whatsapp_business_messaging)."
    case 4:
    case 80007:
    case 130429:
      return "Se alcanzó el límite de mensajes por hora de la API. Reintente más tarde."
    case 33:
      return "El phone_number_id no existe o no pertenece a esta cuenta."
    case 131000:
      return "Error interno de WhatsApp. Reintente en unos minutos."
    case 131005:
      return "No tiene permiso de acceso sobre este número."
    case 131008:
      return "Faltan parámetros obligatorios en el mensaje."
    case 131009:
      return "Alguno de los valores enviados no es válido para WhatsApp."
    case 131016:
      return "El servicio de WhatsApp está temporalmente no disponible."
    case 131021:
      return "No se puede enviar un mensaje al mismo número que lo envía."
    case 131026:
      return "El mensaje no se puede entregar: el número no tiene WhatsApp o no puede recibir mensajes."
    case 131042:
      return "Problema de facturación en la cuenta de WhatsApp Business. Revise el método de pago en Meta."
    case 131047:
      return "Pasaron más de 24 horas desde el último mensaje del contacto: se requiere una plantilla aprobada."
    case 131051:
      return "Tipo de mensaje no soportado por la API."
    case 131052:
      return "No se pudo descargar el archivo multimedia."
    case 131053:
      return "El formato del archivo multimedia no está soportado."
    case 132000:
      return "La cantidad de parámetros no coincide con la definición de la plantilla."
    case 132001:
      return "La plantilla no existe en el idioma indicado o no está aprobada."
    case 132005:
      return "El texto traducido de la plantilla es demasiado largo."
    case 132007:
      return "El contenido de la plantilla viola las políticas de WhatsApp."
    case 132012:
      return "Formato inválido en los parámetros de la plantilla."
    case 132015:
      return "La plantilla está pausada por baja calidad."
    case 132016:
      return "La plantilla fue deshabilitada definitivamente por baja calidad."
    case 133010:
      return "El número no está registrado en la Cloud API."
    case 133004:
      return "El servidor de WhatsApp está en mantenimiento."
    default:
      return fallback || "Error desconocido de la API de WhatsApp."
  }
}

/** Códigos que significan "necesitas una plantilla para poder escribir". */
const WINDOW_ERROR_CODES = new Set([131047, 131051])

async function graphRequest(
  cfg: WaConfig,
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; json: any; error?: string; errorCode?: number }> {
  const url = `${GRAPH_BASE}/${apiVersion(cfg)}/${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? REQUEST_TIMEOUT_MS)

  try {
    const headers = new Headers(init.headers || {})
    headers.set("Authorization", `Bearer ${cfg.access_token}`)

    const res = await fetch(url, { ...init, headers, signal: controller.signal })
    const text = await res.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }

    if (!res.ok) {
      const metaError = json?.error
      const code = metaError?.code as number | undefined
      const detail = metaError?.error_data?.details || metaError?.message
      return {
        ok: false,
        status: res.status,
        json,
        errorCode: code,
        error: describeMetaError(code, detail),
      }
    }

    return { ok: true, status: res.status, json }
  } catch (err: any) {
    const aborted = err?.name === "AbortError"
    return {
      ok: false,
      status: 0,
      json: null,
      error: aborted
        ? "Tiempo de espera agotado al contactar la API de WhatsApp."
        : `No se pudo contactar la API de WhatsApp: ${err?.message || "error de red"}`,
    }
  }
}

async function graphJson(
  cfg: WaConfig,
  path: string,
  body: any,
  timeoutMs?: number
) {
  return graphRequest(cfg, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs,
  })
}

function extractWamid(json: any): string | undefined {
  return json?.messages?.[0]?.id
}

function buildSendResult(
  res: Awaited<ReturnType<typeof graphRequest>>
): WaSendResult {
  if (res.ok) {
    return { success: true, wamid: extractWamid(res.json), raw: res.json }
  }
  return {
    success: false,
    error: res.error,
    errorCode: res.errorCode,
    needsTemplate: res.errorCode !== undefined && WINDOW_ERROR_CODES.has(res.errorCode),
    raw: res.json,
  }
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------

/** Mensaje de texto libre. Solo válido dentro de la ventana de 24 h. */
export async function sendText(
  to: string,
  body: string,
  options?: { previewUrl?: boolean; replyToWamid?: string }
): Promise<WaSendResult> {
  const cfg = await getWaConfig()
  if (!isConfigured(cfg)) {
    return { success: false, error: "WhatsApp Cloud API no está configurada. Complete las credenciales en Configuración." }
  }

  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: options?.previewUrl ?? true },
  }
  if (options?.replyToWamid) payload.context = { message_id: options.replyToWamid }

  const res = await graphJson(cfg, `${cfg.phone_number_id}/messages`, payload)
  return buildSendResult(res)
}

export interface TemplateComponent {
  type: "header" | "body" | "button"
  sub_type?: string
  index?: string
  parameters: Array<Record<string, any>>
}

/** Mensaje de plantilla aprobada. Único modo válido fuera de la ventana de 24 h. */
export async function sendTemplate(
  to: string,
  templateName: string,
  language: string,
  components?: TemplateComponent[]
): Promise<WaSendResult> {
  const cfg = await getWaConfig()
  if (!isConfigured(cfg)) {
    return { success: false, error: "WhatsApp Cloud API no está configurada. Complete las credenciales en Configuración." }
  }

  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language, policy: "deterministic" },
    },
  }
  if (components && components.length > 0) payload.template.components = components

  const res = await graphJson(cfg, `${cfg.phone_number_id}/messages`, payload)
  return buildSendResult(res)
}

/**
 * Media por media_id (subido antes con uploadMedia) o por URL pública (link).
 * La Cloud API no acepta binarios en el propio mensaje.
 */
export async function sendMedia(
  to: string,
  params: {
    type: "image" | "video" | "audio" | "document" | "sticker"
    mediaId?: string
    link?: string
    caption?: string
    filename?: string
  }
): Promise<WaSendResult> {
  const cfg = await getWaConfig()
  if (!isConfigured(cfg)) {
    return { success: false, error: "WhatsApp Cloud API no está configurada. Complete las credenciales en Configuración." }
  }
  if (!params.mediaId && !params.link) {
    return { success: false, error: "Se requiere 'mediaId' o 'link' para enviar multimedia." }
  }

  const media: Record<string, any> = params.mediaId ? { id: params.mediaId } : { link: params.link }

  // audio y sticker no admiten caption en la Cloud API
  if (params.caption && params.type !== "audio" && params.type !== "sticker") {
    media.caption = params.caption
  }
  if (params.filename && params.type === "document") {
    media.filename = params.filename
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: params.type,
    [params.type]: media,
  }

  const res = await graphJson(cfg, `${cfg.phone_number_id}/messages`, payload, 60_000)
  return buildSendResult(res)
}

/** Marca un mensaje entrante como leído (doble check azul del lado del contacto). */
export async function markAsRead(wamid: string): Promise<{ success: boolean; error?: string }> {
  const cfg = await getWaConfig()
  if (!isConfigured(cfg)) return { success: false, error: "No configurado" }

  const res = await graphJson(cfg, `${cfg.phone_number_id}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: wamid,
  })
  return { success: res.ok, error: res.error }
}

// ---------------------------------------------------------------------------
// Media: subida y descarga
// ---------------------------------------------------------------------------

/** Deduce el tipo de mensaje de WhatsApp a partir del mime type. */
export function detectMediaType(mimeType: string): "image" | "video" | "audio" | "document" | "sticker" {
  const mime = (mimeType || "").toLowerCase()
  if (mime === "image/webp") return "sticker"
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  return "document"
}

/**
 * Sube un archivo al CDN de Meta y devuelve su media_id (válido 30 días).
 * Es el camino correcto para archivos generados en runtime (imagen de
 * cumpleaños, audio mp3, PDFs), que no tienen URL pública.
 */
export async function uploadMedia(
  buffer: Buffer | Uint8Array,
  mimeType: string,
  filename: string
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  const cfg = await getWaConfig()
  if (!isConfigured(cfg)) {
    return { success: false, error: "WhatsApp Cloud API no está configurada." }
  }

  const form = new FormData()
  form.append("messaging_product", "whatsapp")
  form.append("type", mimeType)
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    filename || "archivo"
  )

  const res = await graphRequest(cfg, `${cfg.phone_number_id}/media`, {
    method: "POST",
    body: form,
    timeoutMs: 120_000,
  })

  if (!res.ok) return { success: false, error: res.error }
  return { success: true, mediaId: res.json?.id }
}

/** Obtiene la URL temporal de descarga de un media entrante. */
export async function getMediaInfo(
  mediaId: string
): Promise<{ success: boolean; url?: string; mimeType?: string; sha256?: string; fileSize?: number; error?: string }> {
  const cfg = await getWaConfig()
  if (!isConfigured(cfg)) return { success: false, error: "WhatsApp Cloud API no está configurada." }

  const res = await graphRequest(cfg, mediaId, { method: "GET" })
  if (!res.ok) return { success: false, error: res.error }

  return {
    success: true,
    url: res.json?.url,
    mimeType: res.json?.mime_type,
    sha256: res.json?.sha256,
    fileSize: res.json?.file_size,
  }
}

/**
 * Descarga el binario de un media entrante. La URL del CDN de Meta exige
 * el header Authorization, así que no se puede exponer al navegador.
 */
export async function downloadMedia(
  mediaUrl: string
): Promise<{ success: boolean; buffer?: Buffer; mimeType?: string; error?: string }> {
  const cfg = await getWaConfig()
  if (!isConfigured(cfg)) return { success: false, error: "WhatsApp Cloud API no está configurada." }

  try {
    const res = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${cfg.access_token}` },
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) {
      return { success: false, error: `No se pudo descargar el archivo (HTTP ${res.status})` }
    }
    const arrayBuffer = await res.arrayBuffer()
    return {
      success: true,
      buffer: Buffer.from(arrayBuffer),
      mimeType: res.headers.get("content-type") || undefined,
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "Error descargando el archivo" }
  }
}

// ---------------------------------------------------------------------------
// Plantillas y salud
// ---------------------------------------------------------------------------

export interface MetaTemplate {
  id: string
  name: string
  language: string
  status: string
  category: string
  components: any[]
  rejected_reason?: string
  quality_score?: { score?: string }
}

/** Lista las plantillas de la WABA (hasta 200). */
export async function listTemplates(): Promise<{ success: boolean; templates?: MetaTemplate[]; error?: string }> {
  const cfg = await getWaConfig()
  if (!isConfigured(cfg)) return { success: false, error: "WhatsApp Cloud API no está configurada." }
  if (!cfg.waba_id) return { success: false, error: "Falta el WABA ID (ID de la cuenta de WhatsApp Business)." }

  const fields = "id,name,language,status,category,components,rejected_reason,quality_score"
  const res = await graphRequest(cfg, `${cfg.waba_id}/message_templates?limit=200&fields=${fields}`, {
    method: "GET",
  })
  if (!res.ok) return { success: false, error: res.error }

  return { success: true, templates: (res.json?.data as MetaTemplate[]) || [] }
}

/**
 * Comprueba el número contra Meta y persiste el resultado en wa_config.
 * Sustituye al antiguo estado de conexión de WhatsApp Web: aquí no hay
 * sesión ni QR, solo validez del token y calidad del número.
 */
export async function checkHealth(): Promise<WaHealth> {
  const cfg = await getWaConfig(true)

  if (!cfg || !cfg.phone_number_id || !cfg.access_token) {
    return {
      ok: false,
      configured: false,
      phoneNumber: null,
      verifiedName: null,
      qualityRating: null,
      messagingLimit: null,
      error: "Faltan credenciales de WhatsApp Cloud API.",
    }
  }

  const res = await graphRequest(
    cfg,
    `${cfg.phone_number_id}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status`,
    { method: "GET", timeoutMs: 10_000 }
  )

  const now = new Date().toISOString()

  if (!res.ok) {
    await supabaseServer
      .from("wa_config")
      .update({ last_health_check_at: now, last_health_ok: false, last_health_error: res.error })
      .eq("id", 1)
    invalidateWaConfigCache()

    return {
      ok: false,
      configured: true,
      phoneNumber: cfg.display_phone,
      verifiedName: cfg.verified_name,
      qualityRating: cfg.quality_rating,
      messagingLimit: cfg.messaging_limit,
      error: res.error,
    }
  }

  const displayPhone = res.json?.display_phone_number ?? null
  const verifiedName = res.json?.verified_name ?? null
  const qualityRating = res.json?.quality_rating ?? null
  const messagingLimit = res.json?.messaging_limit_tier ?? null

  await supabaseServer
    .from("wa_config")
    .update({
      display_phone: displayPhone,
      verified_name: verifiedName,
      quality_rating: qualityRating,
      messaging_limit: messagingLimit,
      last_health_check_at: now,
      last_health_ok: true,
      last_health_error: null,
    })
    .eq("id", 1)
  invalidateWaConfigCache()

  return {
    ok: true,
    configured: true,
    phoneNumber: displayPhone,
    verifiedName,
    qualityRating,
    messagingLimit,
  }
}

export const waCloud = {
  getConfig: getWaConfig,
  saveConfig: saveWaConfig,
  toPublicConfig,
  isConfigured,
  invalidateCache: invalidateWaConfigCache,
  sendText,
  sendTemplate,
  sendMedia,
  markAsRead,
  uploadMedia,
  getMediaInfo,
  downloadMedia,
  detectMediaType,
  listTemplates,
  checkHealth,
  describeMetaError,
}
