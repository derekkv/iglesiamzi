/**
 * Notificador de errores por WhatsApp.
 * Envía un mensaje al número configurado cuando ocurre un error en el sistema.
 *
 * SERVER ONLY: solo lo importan API routes (app/api/db, app/api/report-error).
 * Llama a sendSmart() directamente en lugar de hacer un salto HTTP a sí mismo,
 * así el aviso queda registrado en wa_messages con origen "sistema".
 *
 * Ojo: fuera de la ventana de 24 h la Cloud API exige plantilla aprobada. Para
 * que estas alertas lleguen siempre hay que asignar una plantilla al caso de
 * uso "alerta_sistema" en WhatsApp / Email → Plantillas.
 */

const ERROR_PHONE = process.env.ERROR_NOTIFY_PHONE || "593980932062"

const recentErrors = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000

function getErrorKey(context: string, message: string): string {
  return `${context}:${message.slice(0, 80)}`
}

function isRateLimited(key: string): boolean {
  const lastSent = recentErrors.get(key)
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) return true
  recentErrors.set(key, Date.now())
  if (recentErrors.size > 100) {
    const now = Date.now()
    for (const [k, v] of recentErrors) {
      if (now - v > RATE_LIMIT_MS) recentErrors.delete(k)
    }
  }
  return false
}

export async function notifyError(opts: {
  context: string
  error: string
  details?: string
  userId?: string
  table?: string
}) {
  try {
    const key = getErrorKey(opts.context, opts.error)
    if (isRateLimited(key)) return

    const now = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
    let msg = `*ERROR EN EL SISTEMA*\n\n`
    msg += `*Fecha:* ${now}\n`
    msg += `*Contexto:* ${opts.context}\n`
    if (opts.table) msg += `*Tabla:* ${opts.table}\n`
    if (opts.userId) msg += `*Usuario:* ${opts.userId}\n`
    msg += `*Error:* ${opts.error}\n`
    if (opts.details) msg += `*Detalles:* ${opts.details.slice(0, 300)}\n`

    const { sendSmart } = await import("@/lib/mod/wa-crm-service")

    await sendSmart({
      to: ERROR_PHONE,
      message: msg,
      useCase: "alerta_sistema",
      templateData: {
        contexto: opts.context,
        error: opts.error.slice(0, 200),
        fecha: now,
      },
      origen: "sistema",
    })
  } catch {
  }
}
