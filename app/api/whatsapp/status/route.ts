import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { checkHealth, getWaConfig, toPublicConfig } from "@/lib/mod/wa-cloud-service"

/**
 * Estado del canal de WhatsApp.
 *
 * Reinterpretada para la Cloud API: ya no existe sesión ni QR, así que
 * "connected" pasa a significar "credenciales válidas y número operativo".
 *
 * SE MANTIENE LA FORMA DE LA RESPUESTA ANTERIOR
 *   { connected, connecting, phoneNumber, name, lastConnected }
 * porque los cron jobs la consultan antes de enviar. Se añaden campos nuevos
 * (quality, messagingLimit, configured) que la UI nueva sí usa.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json(
        { connected: false, connecting: false, error: auth.error || "No autorizado" },
        { status: 401 }
      )
    }

    const health = await checkHealth()
    const cfg = await getWaConfig()

    return NextResponse.json({
      // --- contrato antiguo ---
      connected: health.ok,
      connecting: false,
      phoneNumber: health.phoneNumber,
      name: health.verifiedName,
      lastConnected: cfg?.last_health_check_at ?? null,
      error: health.error,
      // --- campos nuevos ---
      configured: health.configured,
      quality: health.qualityRating,
      messagingLimit: health.messagingLimit,
      provider: "whatsapp-cloud-api",
      config: toPublicConfig(cfg),
    })
  } catch (error: any) {
    console.error("[/api/whatsapp/status] Error:", error?.message)
    return NextResponse.json(
      {
        connected: false,
        connecting: false,
        configured: false,
        error: error?.message || "No se pudo verificar el estado de WhatsApp",
      },
      { status: 500 }
    )
  }
}
