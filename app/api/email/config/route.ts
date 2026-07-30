import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { supabaseServer } from "@/lib/supabase-server"
import { emailService, getEmailConfig, toPublicEmailConfig } from "@/lib/mod/email-service"

/**
 * Configuración de correo (SMTP salida + IMAP entrada).
 *
 * email_config no es accesible por /api/db (guarda smtp_pass e imap_pass), así
 * que esta ruta es la única vía. El GET nunca devuelve contraseñas: solo las
 * banderas has_smtp_pass / has_imap_pass.
 *
 * Requiere can_admin en el módulo "comunicaciones".
 */

async function requireAdmin(userId?: string): Promise<boolean> {
  if (!userId) return false
  const { data } = await supabaseServer
    .from("user_permissions")
    .select("can_admin, module:system_modules!inner(name)")
    .eq("user_id", userId)
    .eq("can_admin", true)

  return (data || []).some((p: any) => p.module?.name === "comunicaciones")
}

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }
  if (!auth.isInternal && !(await requireAdmin(auth.userId))) {
    return NextResponse.json(
      { success: false, error: "Requiere permiso de administrador en el módulo WhatsApp / Email" },
      { status: 403 }
    )
  }

  const cfg = await getEmailConfig(true)
  return NextResponse.json({ success: true, config: toPublicEmailConfig(cfg) })
}

export async function PUT(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }
  if (!auth.isInternal && !(await requireAdmin(auth.userId))) {
    return NextResponse.json(
      { success: false, error: "Requiere permiso de administrador en el módulo WhatsApp / Email" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const saved = await emailService.saveConfig(body, auth.userId)
    if (!saved.success) {
      return NextResponse.json({ success: false, error: saved.error }, { status: 500 })
    }

    // Validar SMTP inmediatamente para dar feedback en el mismo guardado
    const health = await emailService.verifyConnection()
    const cfg = await getEmailConfig(true)

    return NextResponse.json({ success: true, health, config: toPublicEmailConfig(cfg) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error guardando la configuración" },
      { status: 500 }
    )
  }
}

/** POST → prueba de conexión SMTP sin guardar nada. */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  const health = await emailService.verifyConnection()
  const cfg = await getEmailConfig(true)
  return NextResponse.json({ success: health.ok, health, config: toPublicEmailConfig(cfg) })
}
