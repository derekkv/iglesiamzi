/**
 * Configuración pública de Push Notifications.
 * Este archivo es seguro para importar tanto en server como en client components.
 * NO importa dependencias server-only (web-push, supabase-server).
 */

/** Clave pública VAPID — segura para exponer al navegador. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || ""
