/**
 * Sincronización de correo entrante por IMAP.
 *
 * SERVER ONLY — usa imapflow + mailparser y supabaseServer.
 *
 * Estrategia:
 *  - se conecta a las carpetas configuradas en email_config.imap_folders
 *  - descarga solo los UID mayores al último UID ya guardado por carpeta
 *    (columna imap_uid, con UNIQUE (folder, imap_uid) como red de seguridad)
 *  - guarda cabeceras, cuerpo y adjuntos en email_messages / email_attachments
 *  - los binarios de adjuntos van a Supabase Storage, no a la base de datos
 *
 * SEGURIDAD: el HTML entrante se guarda tal cual (sin sanear) porque el
 * remitente no es de confianza. La bandeja del panel DEBE renderizarlo en un
 * <iframe sandbox> — nunca con dangerouslySetInnerHTML. Tampoco se usa el
 * campo textAsHtml de mailparser.
 */
import { ImapFlow } from "imapflow"
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser"
import { supabaseServer } from "@/lib/supabase-server"
import { getEmailConfig, type EmailConfig } from "./email-service"

const STORAGE_BUCKET = "redil-archivos"
const ATTACHMENT_FOLDER = "comunicaciones/email"
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // 25 MB por adjunto

export interface SyncResult {
  success: boolean
  synced: number
  skipped: number
  folders: Array<{ folder: string; synced: number; error?: string }>
  error?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addressList(value?: AddressObject | AddressObject[]): string[] {
  if (!value) return []
  const arr = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const group of arr) {
    for (const a of group.value || []) {
      if (a.address) out.push(a.address.toLowerCase())
    }
  }
  return out
}

function firstAddress(value?: AddressObject | AddressObject[]): { email: string | null; name: string | null } {
  if (!value) return { email: null, name: null }
  const arr = Array.isArray(value) ? value : [value]
  const a = arr[0]?.value?.[0]
  return { email: a?.address?.toLowerCase() || null, name: a?.name || null }
}

function toSnippet(parsed: ParsedMail, max = 300): string {
  const text = parsed.text || ""
  if (text.trim()) return text.replace(/\s+/g, " ").trim().slice(0, max)

  // Fallback: derivar del HTML quitando etiquetas (no se usa textAsHtml)
  const html = typeof parsed.html === "string" ? parsed.html : ""
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

/**
 * Agrupa por hilo. Se usa el primer Message-ID de la cadena References, y si no
 * hay, el In-Reply-To, y si no, el propio Message-ID.
 */
function resolveThreadId(parsed: ParsedMail): string | null {
  const refs = parsed.references
  if (refs) {
    const list = Array.isArray(refs) ? refs : [refs]
    if (list.length > 0) return list[0]
  }
  if (parsed.inReplyTo) return parsed.inReplyTo.split(/\s+/)[0]
  return parsed.messageId || null
}

/** Último UID ya sincronizado en una carpeta. */
async function getLastUid(folder: string): Promise<number> {
  const { data } = await supabaseServer
    .from("email_messages")
    .select("imap_uid")
    .eq("folder", folder)
    .eq("direction", "inbound")
    .order("imap_uid", { ascending: false })
    .limit(1)
    .maybeSingle()

  return Number(data?.imap_uid) || 0
}

/** Vincula el remitente con un usuario del sistema si coincide el email. */
async function resolveUserByEmail(email: string | null): Promise<string | null> {
  if (!email) return null
  const { data } = await supabaseServer
    .from("users")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle()
  return data?.id || null
}

async function uploadAttachment(
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<{ path: string; url: string } | null> {
  const safeName = (filename || "adjunto").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
  const path = `${ATTACHMENT_FOLDER}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`

  const { data, error } = await supabaseServer.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType, upsert: false })

  if (error) {
    console.error("[email-inbox] Error subiendo adjunto:", error.message)
    return null
  }

  const { data: urlData } = supabaseServer.storage.from(STORAGE_BUCKET).getPublicUrl(data.path)
  return { path: data.path, url: urlData.publicUrl }
}

// ---------------------------------------------------------------------------
// Persistencia de un mensaje
// ---------------------------------------------------------------------------

async function saveMessage(
  parsed: ParsedMail,
  meta: { uid: number; folder: string; seen: boolean; flagged: boolean }
): Promise<"saved" | "duplicated" | "error"> {
  const from = firstAddress(parsed.from)
  const attachments = (parsed.attachments || []).filter((a) => !!a.content)

  const row = {
    message_id: parsed.messageId || null,
    direction: "inbound" as const,
    from_email: from.email,
    from_name: from.name,
    to_emails: addressList(parsed.to),
    cc_emails: addressList(parsed.cc),
    bcc_emails: [] as string[],
    reply_to: firstAddress(parsed.replyTo).email,
    subject: parsed.subject || "(sin asunto)",
    body_html: typeof parsed.html === "string" ? parsed.html : null,
    body_text: parsed.text || null,
    snippet: toSnippet(parsed),
    status: "received" as const,
    thread_id: resolveThreadId(parsed),
    in_reply_to: parsed.inReplyTo || null,
    references_ids: parsed.references
      ? Array.isArray(parsed.references)
        ? parsed.references
        : [parsed.references]
      : null,
    imap_uid: meta.uid,
    folder: meta.folder,
    is_read: meta.seen,
    is_starred: meta.flagged,
    has_attachments: attachments.length > 0,
    attachment_count: attachments.length,
    user_id: await resolveUserByEmail(from.email),
    origen: "imap",
    received_at: (parsed.date || new Date()).toISOString(),
  }

  const { data, error } = await supabaseServer
    .from("email_messages")
    .insert(row)
    .select("id")
    .single()

  if (error) {
    // UNIQUE (folder, imap_uid) → ya estaba sincronizado
    if (error.code === "23505" || error.message?.includes("duplicate")) {
      return "duplicated"
    }
    console.error("[email-inbox] Error guardando correo:", error.message)
    return "error"
  }

  const emailId = data?.id as string
  if (!emailId || attachments.length === 0) return "saved"

  for (const att of attachments) {
    const buffer = att.content as Buffer
    if (!buffer || buffer.length === 0) continue

    let stored: { path: string; url: string } | null = null
    if (buffer.length <= MAX_ATTACHMENT_BYTES) {
      stored = await uploadAttachment(
        att.filename || "adjunto",
        buffer,
        att.contentType || "application/octet-stream"
      )
    }

    const { error: attError } = await supabaseServer.from("email_attachments").insert({
      email_id: emailId,
      filename: att.filename || "adjunto",
      mime_type: att.contentType || null,
      size_bytes: buffer.length,
      storage_path: stored?.path || null,
      public_url: stored?.url || null,
      content_id: att.cid || null,
      is_inline: att.contentDisposition === "inline" || !!att.cid,
    })

    if (attError) {
      console.error("[email-inbox] Error registrando adjunto:", attError.message)
    }
  }

  return "saved"
}

// ---------------------------------------------------------------------------
// Sincronización
// ---------------------------------------------------------------------------

function resolveImap(cfg: EmailConfig | null) {
  const host = cfg?.imap_host || process.env.IMAP_HOST || "imap.hostinger.com"
  const port = cfg?.imap_port || Number(process.env.IMAP_PORT) || 993
  const secure = cfg?.imap_secure ?? true
  const user = cfg?.imap_user || process.env.IMAP_USER || cfg?.smtp_user || ""
  const pass = cfg?.imap_pass || process.env.IMAP_PASS || ""
  const folders = cfg?.imap_folders?.length ? cfg.imap_folders : ["INBOX"]
  const maxMessages = cfg?.sync_max_messages || 100

  return { host, port, secure, user, pass, folders, maxMessages }
}

/**
 * Descarga los correos nuevos de todas las carpetas configuradas.
 * Es idempotente: se puede ejecutar tantas veces como se quiera.
 */
export async function syncInbox(options?: { force?: boolean }): Promise<SyncResult> {
  const cfg = await getEmailConfig(true)
  const imap = resolveImap(cfg)

  const base: SyncResult = { success: false, synced: 0, skipped: 0, folders: [] }

  if (!imap.user || !imap.pass) {
    const error = "IMAP no está configurado. Complete usuario y contraseña en WhatsApp / Email → Configuración."
    await recordSync(0, error)
    return { ...base, error }
  }

  if (!cfg?.sync_enabled && !options?.force) {
    const error = "La sincronización IMAP está desactivada."
    return { ...base, error }
  }

  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: { user: imap.user, pass: imap.pass },
    logger: false,
    // Evita que un servidor lento bloquee la petición indefinidamente
    socketTimeout: 60_000,
  })

  let totalSynced = 0
  let totalSkipped = 0
  const folderResults: SyncResult["folders"] = []

  try {
    await client.connect()

    for (const folder of imap.folders) {
      let folderSynced = 0
      let lock: Awaited<ReturnType<typeof client.getMailboxLock>> | null = null

      try {
        lock = await client.getMailboxLock(folder)
        const lastUid = await getLastUid(folder)

        // Solo los UID nuevos. En la primera pasada se limita a los más
        // recientes para no descargar años de historial de golpe.
        const range = lastUid > 0 ? `${lastUid + 1}:*` : "1:*"
        const uids = (await client.search({ uid: range }, { uid: true })) || []
        const pending = lastUid > 0 ? uids : uids.slice(-imap.maxMessages)
        const selected = pending.filter((u) => u > lastUid).slice(0, imap.maxMessages)

        for (const uid of selected) {
          try {
            const msg = await client.fetchOne(
              String(uid),
              { source: true, flags: true, uid: true },
              { uid: true }
            )
            if (!msg || !msg.source) {
              totalSkipped++
              continue
            }

            const parsed = await simpleParser(msg.source)
            const flags = msg.flags instanceof Set ? msg.flags : new Set<string>()

            const outcome = await saveMessage(parsed, {
              uid: Number(msg.uid ?? uid),
              folder,
              seen: flags.has("\\Seen"),
              flagged: flags.has("\\Flagged"),
            })

            if (outcome === "saved") {
              folderSynced++
              totalSynced++
            } else {
              totalSkipped++
            }
          } catch (msgError: any) {
            console.error(`[email-inbox] Error con UID ${uid} en ${folder}:`, msgError?.message)
            totalSkipped++
          }
        }

        folderResults.push({ folder, synced: folderSynced })
      } catch (folderError: any) {
        console.error(`[email-inbox] Error en carpeta ${folder}:`, folderError?.message)
        folderResults.push({ folder, synced: folderSynced, error: folderError?.message })
      } finally {
        if (lock) lock.release()
      }
    }

    await client.logout().catch(() => {})
    await recordSync(totalSynced, null)

    return { success: true, synced: totalSynced, skipped: totalSkipped, folders: folderResults }
  } catch (error: any) {
    const message = error?.message || "No se pudo conectar al servidor IMAP"
    console.error("[email-inbox] Error de sincronización:", message)
    try {
      await client.close()
    } catch {}
    await recordSync(totalSynced, message)
    return { success: false, synced: totalSynced, skipped: totalSkipped, folders: folderResults, error: message }
  }
}

async function recordSync(count: number, error: string | null) {
  const { invalidateEmailConfigCache } = await import("./email-service")
  await supabaseServer
    .from("email_config")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_count: count,
      last_sync_error: error,
    })
    .eq("id", 1)
  invalidateEmailConfigCache()
}

/** Prueba de conexión IMAP sin descargar nada. */
export async function verifyImapConnection(): Promise<{
  ok: boolean
  error?: string
  mailboxes?: string[]
}> {
  const cfg = await getEmailConfig(true)
  const imap = resolveImap(cfg)

  if (!imap.user || !imap.pass) {
    return { ok: false, error: "Faltan usuario o contraseña IMAP." }
  }

  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: { user: imap.user, pass: imap.pass },
    logger: false,
    socketTimeout: 30_000,
  })

  try {
    await client.connect()
    const list = await client.list()
    const mailboxes = list.map((m) => m.path)
    await client.logout().catch(() => {})
    return { ok: true, mailboxes }
  } catch (error: any) {
    try {
      await client.close()
    } catch {}
    return { ok: false, error: error?.message || "No se pudo conectar al servidor IMAP" }
  }
}

export const emailInbox = {
  syncInbox,
  verifyImapConnection,
}
