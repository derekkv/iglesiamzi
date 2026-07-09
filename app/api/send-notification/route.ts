import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"
import { verifyApiAuth } from "@/lib/api-auth"

const VAPID_PUBLIC_KEY = "BKHW7uYkfEBfrPirumVyRqNj_eiWBLpEQuV1Q6NsGImX7wJYA4oB1q_w5iGCZ7xcoO3Jgs41VczB3a7Y2FeIoYY"
const VAPID_PRIVATE_KEY = "kG6aW66CSKCC76Tgt-ACRBYSWVxHtgIHFK5Q3_QJO14"
const SUPABASE_URL = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

webpush.setVapidDetails(
  "mailto:admin@iglesiaregalodedios.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { user_id: string; title: string; body?: string; url?: string }

    // Verificar autenticación
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || "No autorizado" }, { status: 401 })
    }

    const { user_id, title, body: notifBody, url } = body

    if (!user_id || !title) {
      return NextResponse.json({ error: "user_id y title son requeridos" }, { status: 400 })
    }

    // Obtener suscripciones del usuario
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id)

    if (error) {
      return NextResponse.json({ error: "Error obteniendo suscripciones" }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: "Usuario sin suscripciones push", sent: 0 })
    }

    const payload = JSON.stringify({
      title,
      body: notifBody || "",
      url: url || "/dashboard",
    })

    let sent = 0
    const failed: number[] = []

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
        sent++
      } catch (err: any) {
        // Si la suscripción expiró o es inválida, eliminarla
        if (err.statusCode === 404 || err.statusCode === 410) {
          failed.push(sub.id)
          await supabase.from("push_subscriptions").delete().eq("id", sub.id)
        }
      }
    }

    return NextResponse.json({ message: "Notificaciones enviadas", sent, cleaned: failed.length })
  } catch (error: any) {
    console.error("Error sending notification:", error)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
