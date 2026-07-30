/**
 * Tipos del módulo WhatsApp / Email (lado cliente).
 *
 * Espejan las tablas wa_* y email_*. Se declaran aquí y no se importan de
 * lib/mod/wa-*-service porque esos módulos son server-only (usan supabaseServer).
 */

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

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

export type WaDirection = "inbound" | "outbound"

export type WaStatus =
  | "pending" | "sent" | "delivered" | "read" | "failed" | "received" | "skipped"

export interface WaMessage {
  id: string
  wamid: string | null
  contact_id: string | null
  wa_id: string
  direction: WaDirection
  type: string
  body: string | null
  caption: string | null
  media_id: string | null
  media_url: string | null
  media_mime: string | null
  media_filename: string | null
  template_name: string | null
  template_language: string | null
  template_params: any
  status: WaStatus
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  failed_at: string | null
  error_code: number | null
  error_title: string | null
  error_message: string | null
  sent_by: string | null
  sent_by_name: string | null
  campaign_id: string | null
  origen: string | null
  context_wamid: string | null
  conversation_id: string | null
  pricing_category: string | null
  created_at: string
}

export interface WaTemplate {
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
  rejected_reason: string | null
  quality_score: string | null
  synced_at: string | null
}

export interface WaCampaign {
  id: string
  nombre: string
  canal: "whatsapp" | "email"
  tipo: "texto" | "plantilla" | "media"
  template_name: string | null
  template_language: string | null
  body: string | null
  asunto: string | null
  media_url: string | null
  total: number
  enviados: number
  entregados: number
  leidos: number
  fallidos: number
  estado: "borrador" | "enviando" | "pausada" | "completada" | "cancelada"
  created_by: string | null
  created_by_name: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface WaCampaignRecipient {
  id: string
  campaign_id: string
  contact_id: string | null
  wa_id: string | null
  email: string | null
  nombre: string | null
  status: "pendiente" | "enviado" | "entregado" | "leido" | "fallido" | "omitido"
  wamid: string | null
  error_message: string | null
  sent_at: string | null
}

export interface WaTag {
  id: string
  nombre: string
  color: string
  descripcion: string | null
}

export interface WaQuickReply {
  id: string
  atajo: string
  texto: string
  categoria: string | null
  uso_count: number
}

export interface WaWebhookEvent {
  id: string
  event_type: string | null
  payload: any
  signature_valid: boolean | null
  processed: boolean
  error: string | null
  received_at: string
}

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
  has_access_token: boolean
  has_app_secret: boolean
  has_verify_token: boolean
}

export interface WaHealthResponse {
  connected: boolean
  connecting: boolean
  phoneNumber: string | null
  name: string | null
  lastConnected: string | null
  error?: string
  configured: boolean
  quality: string | null
  messagingLimit: string | null
  provider: string
  config: WaConfigPublic
}

export interface WaSendResultRow {
  phone: string
  success: boolean
  error?: string
  messageId?: string
  mode?: string
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export interface EmailMessage {
  id: string
  message_id: string | null
  direction: "inbound" | "outbound"
  from_email: string | null
  from_name: string | null
  to_emails: string[]
  cc_emails: string[]
  bcc_emails: string[]
  reply_to: string | null
  subject: string | null
  body_html: string | null
  body_text: string | null
  snippet: string | null
  template: string | null
  status: "pending" | "sent" | "failed" | "received"
  error_message: string | null
  thread_id: string | null
  in_reply_to: string | null
  imap_uid: number | null
  folder: string | null
  is_read: boolean
  is_starred: boolean
  has_attachments: boolean
  attachment_count: number
  user_id: string | null
  sent_by: string | null
  sent_by_name: string | null
  campaign_id: string | null
  origen: string | null
  sent_at: string | null
  received_at: string | null
  created_at: string
}

export interface EmailAttachment {
  id: string
  email_id: string
  filename: string | null
  mime_type: string | null
  size_bytes: number | null
  storage_path: string | null
  public_url: string | null
  content_id: string | null
  is_inline: boolean
}

export interface EmailTemplate {
  id: string
  slug: string
  nombre: string
  asunto: string
  body_html: string
  variables: string[] | null
  categoria: string | null
  descripcion: string | null
  is_active: boolean
  is_system: boolean
  updated_at: string | null
}

export interface EmailTemplateDefault {
  slug: string
  nombre: string
  asunto: string
  categoria: string
  descripcion: string
  variables: string[]
}

export interface EmailConfigPublic {
  configured: boolean
  smtp_host: string | null
  smtp_port: number | null
  smtp_secure: boolean | null
  smtp_user: string | null
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  imap_host: string | null
  imap_port: number | null
  imap_secure: boolean | null
  imap_user: string | null
  imap_folders: string[] | null
  sync_enabled: boolean
  sync_max_messages: number | null
  last_sync_at: string | null
  last_sync_error: string | null
  last_sync_count: number | null
  last_health_check_at: string | null
  last_health_ok: boolean | null
  last_health_error: string | null
  updated_at: string | null
  has_smtp_pass: boolean
  has_imap_pass: boolean
  imap_configured: boolean
}

// ---------------------------------------------------------------------------
// Comunes
// ---------------------------------------------------------------------------

export interface SystemUser {
  id: string
  username: string
  displayName: string
  email?: string | null
  phone?: string | null
  account_type?: string
  ministerio_name?: string | null
  is_active?: boolean
}

/** Etiquetas legibles de los orígenes registrados en el historial. */
export const ORIGEN_LABELS: Record<string, string> = {
  manual: "Manual",
  cronograma: "Cronograma",
  cumpleanos: "Cumpleaños",
  citacion: "Citaciones",
  nomina: "Nómina",
  pago_diario: "Pago diario",
  atraso: "Atrasos",
  sistema: "Sistema",
  requerimiento: "Requerimientos",
  campana: "Campaña",
  herederos: "Herederos",
  redil: "Redil",
  recuperacion: "Recuperación de clave",
  imap: "Recibido (IMAP)",
}

export const WA_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Fallido",
  received: "Recibido",
  skipped: "Omitido",
}
