import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

const VAPID_PUBLIC_KEY = "BKHW7uYkfEBfrPirumVyRqNj_eiWBLpEQuV1Q6NsGImX7wJYA4oB1q_w5iGCZ7xcoO3Jgs41VczB3a7Y2FeIoYY"
const VAPID_PRIVATE_KEY = "kG6aW66CSKCC76Tgt-ACRBYSWVxHtgIHFK5Q3_QJO14"
const SUPABASE_URL = "https://backiglesia.mzipet.com"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgyOTU5NTM1LCJleHAiOjE5NDA2Mzk1MzV9.s_Np7AI-RtfyXZm279OO7mByV-CnNzWoNI8qcX8E0v8"

// Clave secreta para proteger el endpoint (configura en tu VPS como env var)
const CRON_SECRET = process.env.CRON_SECRET || "iglesia-cron-secret-2024"

webpush.setVapidDetails(
  "mailto:admin@iglesiamzi.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function GET(request: NextRequest) {
  // Verificar clave de seguridad
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    // Obtener servicios que son mañana
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split("T")[0]

    const { data: services, error: servErr } = await supabase
      .from("cronograma_servicio")
      .select("*")
      .eq("fecha", tomorrowStr)

    if (servErr) {
      return NextResponse.json({ error: "Error consultando servicios" }, { status: 500 })
    }

    if (!services || services.length === 0) {
      return NextResponse.json({ message: "No hay servicios para mañana", sent: 0 })
    }

    let totalSent = 0
    let totalCleaned = 0

    for (const service of services) {
      // Obtener suscripciones del usuario
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", service.user_id)

      if (!subscriptions || subscriptions.length === 0) continue

      const date = new Date(service.fecha + "T12:00:00")
      const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
      const day = String(date.getDate()).padStart(2, "0")
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const fechaDisplay = `${days[date.getDay()]} ${day}/${month}`

      const payload = JSON.stringify({
        title: "Recordatorio de servicio",
        body: `Mañana tienes servicio: ${service.asignacion} (${fechaDisplay})`,
        url: "/dashboard/cronograma-protocolo",
      })

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )
          totalSent++
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            totalCleaned++
            await supabase.from("push_subscriptions").delete().eq("id", sub.id)
          }
        }
      }
    }

    return NextResponse.json({
      message: "Recordatorios enviados",
      services: services.length,
      sent: totalSent,
      cleaned: totalCleaned,
    })
  } catch (error: any) {
    console.error("Error in cron-reminders:", error)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
