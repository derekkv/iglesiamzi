import { NextRequest, NextResponse } from "next/server"
import { notifyError } from "@/lib/error-notifier"

/**
 * POST /api/vps-alert
 *
 * Recibe alertas del servidor (VPS) y las reenvía por WhatsApp.
 * Autenticado con INTERNAL_API_SECRET en el header X-Internal-Secret.
 *
 * Body:
 *   context  — string  (ej: "VPS Monitor")
 *   error    — string  (título del alerta, ej: "RAM crítica")
 *   details  — string  (métricas detalladas)
 *   severity — "warn" | "critical"  (opcional, default "warn")
 */
export async function POST(request: NextRequest) {
  // Autenticación
  const secret = request.headers.get("x-internal-secret")
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json() as {
      context?: string
      error?: string
      details?: string
      severity?: "warn" | "critical"
    }

    if (!body.error) {
      return NextResponse.json({ success: false, error: "Campo 'error' requerido" }, { status: 400 })
    }

    const context = body.context || "VPS Monitor"
    const severity = body.severity || "warn"
    const prefix = severity === "critical" ? "🔴 CRÍTICO" : "⚠️ ALERTA"
    const errorMsg = `${prefix}: ${body.error}`

    await notifyError({
      context,
      error: errorMsg,
      details: body.details,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
