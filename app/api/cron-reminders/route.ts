import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"
import { emailService } from "@/lib/mod/email-service"
import { formatPhoneForWhatsApp } from "@/lib/format-phone"

const VAPID_PUBLIC_KEY = "BKHW7uYkfEBfrPirumVyRqNj_eiWBLpEQuV1Q6NsGImX7wJYA4oB1q_w5iGCZ7xcoO3Jgs41VczB3a7Y2FeIoYY"
const VAPID_PRIVATE_KEY = "kG6aW66CSKCC76Tgt-ACRBYSWVxHtgIHFK5Q3_QJO14"
const SUPABASE_URL = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const WA_SERVER_URL = process.env.WA_SERVER_URL || "http://localhost:3100"
const CRON_SECRET = process.env.CRON_SECRET || "iglesia-cron-secret-2024"

webpush.setVapidDetails(
  "mailto:admin@iglesiaregalodedios.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Helpers
function formatFechaLarga(fechaStr: string): string {
  const date = new Date(fechaStr + "T12:00:00")
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`
}

function getModuleLabel(modulo: string): string {
  const labels: Record<string, string> = { protocolo: "Protocolo", administracion: "Administración", discipulado: "Discipulado", mdg: "MDG" }
  return labels[modulo] || modulo
}

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

// Enviar push a un usuario
async function sendPush(userId: string, title: string, body: string): Promise<number> {
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)

  if (!subscriptions || subscriptions.length === 0) return 0

  let sent = 0
  const payload = JSON.stringify({ title, body, url: "/dashboard" })

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id)
      }
    }
  }
  return sent
}

// Enviar WhatsApp
async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const formatted = formatPhoneForWhatsApp(phone)
    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: formatted, message }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Procesar alertas para un conjunto de servicios
async function processAlerts(
  services: any[],
  alertType: "alerta2" | "alerta1",
  alertLabel: string,
  daysText: string
): Promise<{ pushSent: number; emailsSent: number; whatsappSent: number; buzonSent: number }> {
  let pushSent = 0, emailsSent = 0, whatsappSent = 0, buzonSent = 0

  for (const service of services) {
    const fechaDisplay = formatFechaLarga(service.fecha)
    const moduloLabel = getModuleLabel(service.modulo)

    // Obtener datos del usuario (email, phone)
    const { data: userData } = await supabase
      .from("users")
      .select("email, phone")
      .eq("id", service.user_id)
      .single()

    // 1. Buzón interno
    try {
      const emoji = alertType === "alerta2" ? "⏰" : "🚨"
      await supabase.from("buzon_mensajes").insert({
        user_id: service.user_id,
        titulo: `${emoji} ${alertLabel}`,
        mensaje: `${daysText} tienes servicio: ${service.asignacion} — ${fechaDisplay}${service.hora_entrada ? ` a las ${service.hora_entrada}` : ""} (${moduloLabel})`,
        tipo: "info",
        referencia_tipo: "cronograma",
        referencia_id: service.id,
      })
      buzonSent++
    } catch (e) {
      console.warn("Error buzón:", e)
    }

    // 2. Push
    try {
      const title = `${alertType === "alerta2" ? "⏰" : "🚨"} ${alertLabel}`
      const body = `${daysText}: ${service.asignacion} - ${fechaDisplay}${service.hora_entrada ? ` (${service.hora_entrada})` : ""}`
      const sent = await sendPush(service.user_id, title, body)
      pushSent += sent
    } catch (e) {}

    // 3. Email
    let emailOk = false
    if (userData?.email) {
      try {
        const result = await emailService.sendServiceEmail({
          to: userData.email,
          type: alertType,
          data: {
            userName: service.user_name,
            asignacion: service.asignacion,
            fecha: service.fecha,
            horaEntrada: service.hora_entrada,
            modulo: service.modulo,
            ministerio: service.ministerio,
            evento: service.evento,
          },
        })
        if (result.success) {
          emailsSent++
          emailOk = true
        }
      } catch (e) {}
    }

    // 4. WhatsApp
    let waOk = false
    if (userData?.phone) {
      const emoji = alertType === "alerta2" ? "⏰" : "🚨"
      const waMessage = `${emoji} *${alertLabel}*\n\nHola ${service.user_name}, ${daysText.toLowerCase()} tienes servicio:\n\n📅 *Fecha:* ${fechaDisplay}\n📍 *Asignación:* ${service.asignacion}${service.hora_entrada ? `\n🕐 *Hora:* ${service.hora_entrada}` : ""}\n🏛️ *Módulo:* ${moduloLabel}${service.ministerio ? `\n⛪ *Ministerio:* ${service.ministerio}` : ""}\n\nPor favor ingresa a la app y confirma que estás enterado.`

      waOk = await sendWhatsApp(userData.phone, waMessage)
      if (waOk) whatsappSent++
    }

    // 5. Marcar como enviada
    try {
      const updateFields: any = {
        [`${alertType}_enviada`]: true,
        [`${alertType}_enviada_at`]: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (emailOk) updateFields[`email_${alertType}_enviado`] = true
      if (waOk) updateFields[`whatsapp_${alertType}_enviado`] = true

      await supabase
        .from("cronograma_servicio")
        .update(updateFields)
        .eq("id", service.id)
    } catch (e) {
      console.warn("Error marcando alerta:", e)
    }
  }

  return { pushSent, emailsSent, whatsappSent, buzonSent }
}

// ============ ENDPOINT ============
export async function GET(request: NextRequest) {
  // Verificar clave de seguridad
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const today = new Date()
    const in5Days = addDays(today, 5)
    const tomorrow = addDays(today, 1)

    // === ALERTA 2: Servicios que son en exactamente 5 días y no se ha enviado ===
    const { data: alerta2Services, error: err2 } = await supabase
      .from("cronograma_servicio")
      .select("*")
      .eq("fecha", in5Days)
      .eq("alerta2_enviada", false)

    if (err2) {
      console.error("Error consultando alerta2:", err2)
    }

    // === ALERTA 1: Servicios que son mañana y no se ha enviado ===
    const { data: alerta1Services, error: err1 } = await supabase
      .from("cronograma_servicio")
      .select("*")
      .eq("fecha", tomorrow)
      .eq("alerta1_enviada", false)

    if (err1) {
      console.error("Error consultando alerta1:", err1)
    }

    // Procesar Alerta 2
    let stats2 = { pushSent: 0, emailsSent: 0, whatsappSent: 0, buzonSent: 0 }
    if (alerta2Services && alerta2Services.length > 0) {
      stats2 = await processAlerts(
        alerta2Services,
        "alerta2",
        "Recordatorio de Servicio (5 días)",
        "En 5 días"
      )
    }

    // Procesar Alerta 1
    let stats1 = { pushSent: 0, emailsSent: 0, whatsappSent: 0, buzonSent: 0 }
    if (alerta1Services && alerta1Services.length > 0) {
      stats1 = await processAlerts(
        alerta1Services,
        "alerta1",
        "¡Mañana tienes servicio!",
        "Mañana"
      )
    }

    return NextResponse.json({
      message: "Alertas procesadas",
      alerta2: {
        services: alerta2Services?.length || 0,
        ...stats2,
      },
      alerta1: {
        services: alerta1Services?.length || 0,
        ...stats1,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Error in cron-reminders:", error)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
