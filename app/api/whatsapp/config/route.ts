import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { supabaseServer } from "@/lib/supabase-server"
import { getWaConfig, saveWaConfig, toPublicConfig, checkHealth } from "@/lib/mod/wa-cloud-service"

/**
 * Configuración de WhatsApp Cloud API.
 *
 * wa_config no es accesible por /api/db (contiene access_token y app_secret),
 * así que esta ruta es la única vía. El GET nunca devuelve secretos: solo
 * banderas has_access_token / has_app_secret / has_verify_token.
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

  const cfg = await getWaConfig(true)

  // URL que hay que registrar en Meta
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.nextUrl.origin ||
    ""

  return NextResponse.json({
    success: true,
    config: toPublicConfig(cfg),
    webhookUrl: `${base.replace(/\/$/, "")}/api/whatsapp/webhook`,
  })
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
    const result = await saveWaConfig(body, auth.userId)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    // Validar inmediatamente contra Meta para dar feedback en el mismo guardado
    const health = await checkHealth()
    const cfg = await getWaConfig(true)

    return NextResponse.json({
      success: true,
      health,
      config: toPublicConfig(cfg),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error guardando la configuración" },
      { status: 500 }
    )
  }
}
