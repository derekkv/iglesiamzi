/**
 * Notificador de errores por WhatsApp.
 * Envía un mensaje al número configurado cuando ocurre un error en el sistema.
 */

const WA_SERVER_URL = process.env.WA_SERVER_URL || "http://localhost:3100"
const ERROR_PHONE = "593980932062"

// Rate limiting: máximo 1 mensaje por error similar cada 5 minutos
const recentErrors = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000

function getErrorKey(context: string, message: string): string {
  return `${context}:${message.slice(0, 80)}`
}

function isRateLimited(key: string): boolean {
  const lastSent = recentErrors.get(key)
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) return true
  recentErrors.set(key, Date.now())
  // Limpiar entradas viejas
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

    await fetch(`${WA_SERVER_URL}/api/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: ERROR_PHONE, message: msg }),
    })
  } catch {
    // Silenciar errores del notificador para no causar cascada
  }
}
