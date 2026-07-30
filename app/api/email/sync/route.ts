import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { syncInbox, verifyImapConnection } from "@/lib/mod/email-inbox-service"

/**
 * Sincronización de correo entrante (IMAP).
 *
 *  POST            → descarga los correos nuevos. Idempotente.
 *  POST { force }  → ejecuta incluso con sync_enabled = false (botón "Sincronizar ahora")
 *  GET             → prueba de conexión IMAP y lista de carpetas disponibles
 *
 * Pensada también para un cron cada 5 minutos:
 *   curl -X POST -H "X-Internal-Secret: $INTERNAL_API_SECRET" \
 *        https://panel.iglesiaregalodedios.com/api/email/sync
 *
 * La descarga puede tardar: Next mantiene la petición abierta, así que el
 * cliente debería usar un timeout generoso.
 */
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  try {
    let force = false
    try {
      const body = await request.json()
      force = body?.force === true
    } catch {
      // Sin cuerpo: comportamiento por defecto
    }

    const result = await syncInbox({ force })

    return NextResponse.json(result, { status: result.success ? 200 : 502 })
  } catch (error: any) {
    console.error("[/api/email/sync] Error:", error?.message)
    return NextResponse.json(
      { success: false, synced: 0, skipped: 0, folders: [], error: error?.message || "Error sincronizando" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  const result = await verifyImapConnection()
  return NextResponse.json({ success: result.ok, ...result }, { status: result.ok ? 200 : 502 })
}
