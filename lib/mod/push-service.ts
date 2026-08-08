/**
 * Servicio centralizado de Push Notifications.
 *
 * SERVER ONLY — reemplaza las implementaciones duplicadas en cron-cumpleanos,
 * cron-reminders y send-notification.
 *
 * Funcionalidad:
 *  - Enviar push a un usuario por su ID
 *  - Limpieza automática de suscripciones expiradas (404/410)
 *  - Logging de errores con contexto
 */
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"
import { CHURCH } from "@/lib/branding"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

// Re-exportar para compatibilidad (server-side)
export { VAPID_PUBLIC_KEY } from "./push-config"
import { VAPID_PUBLIC_KEY } from "./push-config"

let vapidConfigured = false

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${CHURCH.contactEmail || "admin@example.com"}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
  vapidConfigured = true
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno del servidor")
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

export interface PushResult {
  success: boolean
  sent: number
  failed: number
  cleaned: number
  error?: string
}

/**
 * Envía una notificación push a todas las suscripciones de un usuario.
 * Limpia automáticamente suscripciones expiradas.
 */
export async function sendPush(
  userId: string,
  title: string,
  body: string,
  options?: { url?: string; data?: Record<string, any> }
): Promise<PushResult> {
  if (!vapidConfigured) {
    return {
      success: false,
      sent: 0,
      failed: 0,
      cleaned: 0,
      error: "VAPID keys no configuradas. Push notifications deshabilitadas.",
    }
  }

  try {
    const supabase = getSupabase()
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)

    if (error) {
      console.error("[push-service] Error consultando suscripciones:", error.message)
      return { success: false, sent: 0, failed: 0, cleaned: 0, error: error.message }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, sent: 0, failed: 0, cleaned: 0, error: "Sin suscripciones activas" }
    }

    const payload = JSON.stringify({
      title,
      body,
      url: options?.url || "/dashboard",
      ...(options?.data || {}),
    })

    let sent = 0
    let failed = 0
    let cleaned = 0

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err: any) {
        failed++
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Suscripción expirada o inválida — eliminar
          await supabase.from("push_subscriptions").delete().eq("id", sub.id)
          cleaned++
        } else {
          console.warn(`[push-service] Error enviando push a ${userId}:`, err.statusCode || err.message)
        }
      }
    }

    return { success: sent > 0, sent, failed, cleaned }
  } catch (err: any) {
    console.error("[push-service] Error inesperado:", err)
    return { success: false, sent: 0, failed: 0, cleaned: 0, error: err.message }
  }
}

/**
 * Envía push a múltiples usuarios (para notificaciones admin).
 */
export async function sendPushBulk(
  userIds: string[],
  title: string,
  body: string,
  options?: { url?: string; data?: Record<string, any> }
): Promise<Record<string, PushResult>> {
  const results: Record<string, PushResult> = {}
  for (const userId of userIds) {
    results[userId] = await sendPush(userId, title, body, options)
  }
  return results
}

/** Verifica si el servicio de push está correctamente configurado. */
export function isPushConfigured(): boolean {
  return vapidConfigured && !!SUPABASE_URL && !!SUPABASE_SERVICE_KEY
}
