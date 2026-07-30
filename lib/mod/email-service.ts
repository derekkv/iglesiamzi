/**
 * Servicio de correo electrónico (SMTP con nodemailer).
 *
 * SERVER ONLY — lee credenciales de la tabla email_config con supabaseServer.
 *
 * Consolida lo que antes estaba disperso:
 *  - un único transporter (antes había 3: este y dos inline en cron-cumpleanos)
 *  - credenciales en BD editables desde el panel, con fallback a variables de
 *    entorno (ya no hay contraseña hardcodeada en el código)
 *  - soporte de cc/bcc, replyTo y adjuntos (incluidos inline con cid:)
 *  - plantillas: email_templates en BD con fallback a las plantillas por defecto
 *  - registro de TODO envío en email_messages, junto con sus adjuntos
 */
import nodemailer from "nodemailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport"
import { supabaseServer } from "@/lib/supabase-server"
import { renderDefaultTemplate, DEFAULT_TEMPLATES, type DefaultTemplateSlug } from "./email-templates"

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

export interface EmailConfig {
  id: number
  smtp_host: string | null
  smtp_port: number | null
  smtp_secure: boolean | null
  smtp_user: string | null
  smtp_pass: string | null
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  imap_host: string | null
  imap_port: number | null
  imap_secure: boolean | null
  imap_user: string | null
  imap_pass: string | null
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

let configCache: { value: EmailConfig | null; ts: number } | null = null
const CONFIG_TTL_MS = 30_000

export function invalidateEmailConfigCache() {
  configCache = null
  transporterCache = null
}

export async function getEmailConfig(force = false): Promise<EmailConfig | null> {
  if (!force && configCache && Date.now() - configCache.ts < CONFIG_TTL_MS) {
    return configCache.value
  }

  const { data, error } = await supabaseServer
    .from("email_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    console.error("[email] Error leyendo email_config:", error.message)
    return configCache?.value ?? null
  }

  const value = (data as EmailConfig) || null
  configCache = { value, ts: Date.now() }
  return value
}

/** Config efectiva: BD primero, variables de entorno como respaldo. */
function resolveSmtp(cfg: EmailConfig | null) {
  const host = cfg?.smtp_host || process.env.SMTP_HOST || "smtp.hostinger.com"
  const port = cfg?.smtp_port || Number(process.env.SMTP_PORT) || 465
  const user = cfg?.smtp_user || process.env.SMTP_USER || ""
  const pass = cfg?.smtp_pass || process.env.SMTP_PASS || ""
  const secure = cfg?.smtp_secure ?? port === 465
  const fromEmail = cfg?.from_email || user
  const fromName = cfg?.from_name || "Iglesia Regalo de Dios"

  return { host, port, user, pass, secure, fromEmail, fromName, replyTo: cfg?.reply_to || undefined }
}

export function toPublicEmailConfig(cfg: EmailConfig | null): EmailConfigPublic {
  const smtp = resolveSmtp(cfg)
  return {
    configured: !!(smtp.host && smtp.user && smtp.pass),
    smtp_host: smtp.host,
    smtp_port: smtp.port,
    smtp_secure: smtp.secure,
    smtp_user: smtp.user || null,
    from_name: smtp.fromName,
    from_email: smtp.fromEmail || null,
    reply_to: cfg?.reply_to ?? null,
    imap_host: cfg?.imap_host ?? null,
    imap_port: cfg?.imap_port ?? null,
    imap_secure: cfg?.imap_secure ?? null,
    imap_user: cfg?.imap_user ?? null,
    imap_folders: cfg?.imap_folders ?? ["INBOX"],
    sync_enabled: cfg?.sync_enabled ?? false,
    sync_max_messages: cfg?.sync_max_messages ?? 100,
    last_sync_at: cfg?.last_sync_at ?? null,
    last_sync_error: cfg?.last_sync_error ?? null,
    last_sync_count: cfg?.last_sync_count ?? null,
    last_health_check_at: cfg?.last_health_check_at ?? null,
    last_health_ok: cfg?.last_health_ok ?? null,
    last_health_error: cfg?.last_health_error ?? null,
    updated_at: cfg?.updated_at ?? null,
    has_smtp_pass: !!smtp.pass,
    has_imap_pass: !!cfg?.imap_pass,
    imap_configured: !!(cfg?.imap_host && cfg?.imap_user && cfg?.imap_pass),
  }
}

export async function saveEmailConfig(
  patch: Record<string, any>,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const secretFields = ["smtp_pass", "imap_pass"]
  const allowed = [
    "smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass",
    "from_name", "from_email", "reply_to",
    "imap_host", "imap_port", "imap_secure", "imap_user", "imap_pass",
    "imap_folders", "sync_enabled", "sync_max_messages",
  ]

  const update: Record<string, any> = {}
  for (const key of allowed) {
    if (!(key in patch)) continue
    const value = patch[key]
    // No borrar contraseñas al enviar el formulario vacío
    if (secretFields.includes(key) && (value === "" || value === null || value === undefined)) continue
    update[key] = value
  }

  if (Object.keys(update).length === 0) return { success: true }

  update.updated_at = new Date().toISOString()
  if (userId) update.updated_by = userId

  const { error } = await supabaseServer.from("email_config").update(update).eq("id", 1)
  invalidateEmailConfigCache()

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Transporter
// ---------------------------------------------------------------------------

let transporterCache: { transporter: nodemailer.Transporter; key: string } | null = null

async function getTransporter(): Promise<{
  transporter: nodemailer.Transporter
  from: string
  replyTo?: string
} | { error: string }> {
  const cfg = await getEmailConfig()
  const smtp = resolveSmtp(cfg)

  if (!smtp.host || !smtp.user || !smtp.pass) {
    return {
      error: "SMTP no está configurado. Complete el usuario y la contraseña en WhatsApp / Email → Configuración.",
    }
  }

  const key = `${smtp.host}:${smtp.port}:${smtp.secure}:${smtp.user}:${smtp.pass.length}`

  if (!transporterCache || transporterCache.key !== key) {
    const options: SMTPTransport.Options = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    }
    transporterCache = { transporter: nodemailer.createTransport(options), key }
  }

  const from = smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail

  return { transporter: transporterCache.transporter, from, replyTo: smtp.replyTo }
}

// ---------------------------------------------------------------------------
// Tipos de envío
// ---------------------------------------------------------------------------

export interface EmailAttachmentInput {
  filename: string
  content?: Buffer | Uint8Array | string
  path?: string
  href?: string
  contentType?: string
  cid?: string
  encoding?: string
}

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  attachments?: EmailAttachmentInput[]
  /** Trazabilidad en email_messages */
  template?: string
  templateData?: Record<string, any>
  origen?: string
  sentBy?: string | null
  sentByName?: string | null
  userId?: string | null
  campaignId?: string | null
  inReplyTo?: string
  references?: string[]
  /** Si es false no se registra en email_messages (por defecto true) */
  log?: boolean
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  recordId?: string
  error?: string
}

/** Plantilla de cronograma — se mantiene la firma histórica por compatibilidad. */
export interface EmailServiceParams {
  to: string
  subject?: string
  type: "asignacion" | "alerta2" | "alerta1"
  data: {
    userName: string
    asignacion: string
    fecha: string
    horaEntrada?: string
    modulo: string
    ministerio?: string
    evento?: string
  }
  origen?: string
  sentBy?: string | null
  userId?: string | null
}

function toArray(value?: string | string[]): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function htmlToSnippet(html: string, max = 300): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

// ---------------------------------------------------------------------------
// Plantillas (BD con fallback al código)
// ---------------------------------------------------------------------------

export interface EmailTemplateRow {
  id: string
  slug: string
  nombre: string
  asunto: string
  body_html: string
  variables: string[] | null
  categoria: string | null
  is_active: boolean
}

/** Sustituye {{variable}} en el texto. */
export function interpolate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = key.split(".").reduce<any>((acc, part) => (acc == null ? acc : acc[part]), data)
    return value === undefined || value === null ? "" : String(value)
  })
}

/**
 * Resuelve una plantilla por slug: primero la versión editable en BD, y si no
 * existe (o está inactiva) la versión por defecto del código.
 */
export async function renderTemplate(
  slug: string,
  data: Record<string, any>
): Promise<{ subject: string; html: string } | null> {
  const { data: row } = await supabaseServer
    .from("email_templates")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle()

  if (row) {
    const tpl = row as EmailTemplateRow
    return {
      subject: interpolate(tpl.asunto, data),
      html: interpolate(tpl.body_html, data),
    }
  }

  if (slug in DEFAULT_TEMPLATES) {
    return renderDefaultTemplate(slug as DefaultTemplateSlug, data)
  }

  return null
}

// ---------------------------------------------------------------------------
// Registro en email_messages
// ---------------------------------------------------------------------------

async function logEmail(
  params: SendEmailParams,
  result: { success: boolean; messageId?: string; error?: string; response?: string },
  resolved: { from: string; to: string[]; cc: string[]; bcc: string[] }
): Promise<string | null> {
  if (params.log === false) return null

  const now = new Date().toISOString()

  const { data, error } = await supabaseServer
    .from("email_messages")
    .insert({
      message_id: result.messageId || null,
      direction: "outbound",
      from_email: resolved.from,
      from_name: null,
      to_emails: resolved.to,
      cc_emails: resolved.cc,
      bcc_emails: resolved.bcc,
      reply_to: params.replyTo || null,
      subject: params.subject,
      body_html: params.html,
      body_text: params.text || null,
      snippet: htmlToSnippet(params.html),
      template: params.template || null,
      template_data: params.templateData || null,
      status: result.success ? "sent" : "failed",
      error_message: result.error || null,
      smtp_response: result.response || null,
      in_reply_to: params.inReplyTo || null,
      references_ids: params.references || null,
      has_attachments: !!params.attachments?.length,
      attachment_count: params.attachments?.length || 0,
      user_id: params.userId || null,
      sent_by: params.sentBy || null,
      sent_by_name: params.sentByName || null,
      campaign_id: params.campaignId || null,
      origen: params.origen || "manual",
      sent_at: result.success ? now : null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[email] Error registrando correo:", error.message)
    return null
  }

  const emailId = data?.id as string | undefined

  // Registrar metadatos de los adjuntos (no el binario)
  if (emailId && params.attachments?.length) {
    const rows = params.attachments.map((a) => ({
      email_id: emailId,
      filename: a.filename,
      mime_type: a.contentType || null,
      size_bytes:
        a.content instanceof Buffer
          ? a.content.length
          : typeof a.content === "string"
            ? Buffer.byteLength(a.content)
            : null,
      content_id: a.cid || null,
      is_inline: !!a.cid,
      public_url: a.href || null,
    }))
    const { error: attError } = await supabaseServer.from("email_attachments").insert(rows)
    if (attError) console.error("[email] Error registrando adjuntos:", attError.message)
  }

  return emailId || null
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export const emailService = {
  /** Envío genérico con soporte completo (cc/bcc/adjuntos) y registro. */
  async sendRawEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const to = toArray(params.to)
    const cc = toArray(params.cc)
    const bcc = toArray(params.bcc)

    if (to.length === 0) {
      return { success: false, error: "Se requiere al menos un destinatario" }
    }

    const t = await getTransporter()
    if ("error" in t) {
      const recordId = await logEmail(params, { success: false, error: t.error }, {
        from: "",
        to,
        cc,
        bcc,
      })
      return { success: false, error: t.error, recordId: recordId || undefined }
    }

    try {
      const info = await t.transporter.sendMail({
        from: t.from,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        replyTo: params.replyTo || t.replyTo,
        subject: params.subject,
        html: params.html,
        text: params.text,
        inReplyTo: params.inReplyTo,
        references: params.references,
        attachments: params.attachments as any,
      })

      const recordId = await logEmail(
        params,
        { success: true, messageId: info.messageId, response: info.response },
        { from: t.from, to, cc, bcc }
      )

      return { success: true, messageId: info.messageId, recordId: recordId || undefined }
    } catch (error: any) {
      const message = error?.message || "Error enviando el correo"
      console.error("[email] Error enviando correo:", message)
      const recordId = await logEmail(params, { success: false, error: message }, {
        from: t.from,
        to,
        cc,
        bcc,
      })
      return { success: false, error: message, recordId: recordId || undefined }
    }
  },

  /** Envío por plantilla (BD o por defecto). */
  async sendTemplateEmail(params: {
    to: string | string[]
    template: string
    data: Record<string, any>
    subject?: string
    cc?: string | string[]
    bcc?: string | string[]
    attachments?: EmailAttachmentInput[]
    origen?: string
    sentBy?: string | null
    sentByName?: string | null
    userId?: string | null
    campaignId?: string | null
  }): Promise<SendEmailResult> {
    const rendered = await renderTemplate(params.template, params.data)
    if (!rendered) {
      return { success: false, error: `La plantilla "${params.template}" no existe.` }
    }

    return emailService.sendRawEmail({
      to: params.to,
      subject: params.subject || rendered.subject,
      html: rendered.html,
      cc: params.cc,
      bcc: params.bcc,
      attachments: params.attachments,
      template: params.template,
      templateData: params.data,
      origen: params.origen,
      sentBy: params.sentBy,
      sentByName: params.sentByName,
      userId: params.userId,
      campaignId: params.campaignId,
    })
  },

  /**
   * Notificación de servicio (cronograma). Firma histórica mantenida: la usan
   * cron-reminders y cronograma-service.
   */
  async sendServiceEmail(params: EmailServiceParams): Promise<SendEmailResult> {
    return emailService.sendTemplateEmail({
      to: params.to,
      template: params.type, // asignacion | alerta2 | alerta1
      data: params.data,
      subject: params.subject,
      origen: params.origen || "cronograma",
      sentBy: params.sentBy,
      userId: params.userId,
    })
  },

  /** Verifica la conexión SMTP y guarda el resultado en email_config. */
  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    const now = new Date().toISOString()
    const t = await getTransporter()

    if ("error" in t) {
      await supabaseServer
        .from("email_config")
        .update({ last_health_check_at: now, last_health_ok: false, last_health_error: t.error })
        .eq("id", 1)
      invalidateEmailConfigCache()
      return { ok: false, error: t.error }
    }

    try {
      await t.transporter.verify()
      await supabaseServer
        .from("email_config")
        .update({ last_health_check_at: now, last_health_ok: true, last_health_error: null })
        .eq("id", 1)
      invalidateEmailConfigCache()
      return { ok: true }
    } catch (error: any) {
      const message = error?.message || "No se pudo conectar al servidor SMTP"
      await supabaseServer
        .from("email_config")
        .update({ last_health_check_at: now, last_health_ok: false, last_health_error: message })
        .eq("id", 1)
      invalidateEmailConfigCache()
      return { ok: false, error: message }
    }
  },

  getConfig: getEmailConfig,
  saveConfig: saveEmailConfig,
  toPublicConfig: toPublicEmailConfig,
  renderTemplate,
  interpolate,
}
