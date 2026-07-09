import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"
import { formatPhoneForWhatsApp } from "@/lib/format-phone"
import { verifyApiAuth } from "@/lib/api-auth"
import * as fs from "fs"
import * as path from "path"
import { getBirthdayImage } from "@/lib/pdf-to-image"

const VAPID_PUBLIC_KEY = "BKHW7uYkfEBfrPirumVyRqNj_eiWBLpEQuV1Q6NsGImX7wJYA4oB1q_w5iGCZ7xcoO3Jgs41VczB3a7Y2FeIoYY"
const VAPID_PRIVATE_KEY = "kG6aW66CSKCC76Tgt-ACRBYSWVxHtgIHFK5Q3_QJO14"
const SUPABASE_URL = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const WA_SERVER_URL = process.env.WA_SERVER_URL || "http://localhost:3100"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://panel.iglesiaregalodedios.com"

webpush.setVapidDetails(
  "mailto:admin@iglesiaregalodedios.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Archivos de media para WhatsApp
const BIRTHDAY_AUDIO_PATH = path.join(process.cwd(), "public", "Cumpleaños Feliz  Happy Birthday  Queremos que Partan la Torta.mp3")

function generarMensajeCumple(nombre: string, edad: number): string {
  return `🎉🎂 *¡Feliz cumpleaños, hermano/a ${nombre}!* 🎂🎉\n\n` +
    `En este día damos gracias a Dios por tu vida y por el privilegio de celebrar un año más de las bendiciones que Él te ha concedido.\n\n` +
    `Oramos para que el Señor continúe fortaleciéndote, llenándote de sabiduría, salud, paz y gozo. ` +
    `Que Su presencia te acompañe cada día y que este nuevo año esté lleno de victorias, ` +
    `crecimiento espiritual y del cumplimiento de los propósitos que Dios tiene para tu vida.\n\n` +
    `*"Este es el día que hizo el Señor; nos gozaremos y alegraremos en él."* (Salmo 118:24)\n\n` +
    `¡Que Dios te bendiga abundantemente! Recibe un fuerte abrazo y nuestros mejores deseos en este día tan especial.\n\n` +
    `Con cariño y en el amor de Cristo,\n` +
    `*Iglesia Regalo de Dios* ❤️🙏`
}

function generarHTMLEmail(nombre: string, edad: number): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #fff5f7; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(236,72,153,0.15);">
    <div style="background: linear-gradient(135deg, #ec4899, #f97316); padding: 40px 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🎂 ¡Feliz Cumpleaños! 🎉</h1>
      <p style="color: rgba(255,255,255,0.9); margin-top: 8px; font-size: 18px;">${nombre}</p>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #374151; line-height: 1.6;">
        Querido/a <strong>${nombre}</strong>,
      </p>
      <p style="font-size: 16px; color: #374151; line-height: 1.6;">
        En este día damos gracias a Dios por tu vida y por el privilegio de celebrar un año más 
        de las bendiciones que Él te ha concedido.
      </p>
      <p style="font-size: 16px; color: #374151; line-height: 1.6;">
        Oramos para que el Señor continúe fortaleciéndote, llenándote de sabiduría, salud, paz y gozo. 
        Que Su presencia te acompañe cada día y que este nuevo año esté lleno de victorias, 
        crecimiento espiritual y del cumplimiento de los propósitos que Dios tiene para tu vida.
      </p>
      <div style="background: #fdf2f8; border-left: 4px solid #ec4899; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <p style="font-style: italic; color: #9d174d; margin: 0; font-size: 15px;">
          "Este es el día que hizo el Señor; nos gozaremos y alegraremos en él."
        </p>
        <p style="color: #be185d; margin: 8px 0 0; font-weight: bold; font-size: 14px;">— Salmo 118:24</p>
      </div>
      <p style="font-size: 16px; color: #374151; line-height: 1.6;">
        ¡Que Dios te bendiga abundantemente! Recibe un fuerte abrazo y nuestros mejores deseos en este día tan especial.
      </p>
      <p style="font-size: 15px; color: #6b7280; margin-top: 24px;">
        Con cariño y en el amor de Cristo,<br>
        <strong>Iglesia Regalo de Dios</strong> ❤️🙏
      </p>
    </div>
    <div style="background: #fdf2f8; padding: 16px; text-align: center; border-top: 1px solid #fce7f3;">
      <p style="color: #9d174d; margin: 0; font-size: 13px;">🎈 ¡Que tengas un maravilloso día! 🎈</p>
    </div>
  </div>
</body>
</html>`
}

// Enviar push notification
async function sendPush(userId: string, title: string, body: string): Promise<boolean> {
  try {
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)

    if (!subscriptions || subscriptions.length === 0) return false

    const payload = JSON.stringify({ title, body, url: "/dashboard/cumpleanos" })
    let sent = false

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent = true
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id)
        }
      }
    }
    return sent
  } catch {
    return false
  }
}

// Enviar WhatsApp con imagen de cumpleaños
async function sendWhatsAppImage(phone: string, caption: string): Promise<boolean> {
  try {
    const formatted = formatPhoneForWhatsApp(phone)

    const media = await getBirthdayImage()
    if (!media) {
      console.warn("No se pudo obtener imagen de cumpleaños")
      return false
    }

    const blob = new Blob([new Uint8Array(media.buffer)], { type: media.type })
    const mediaType = media.type === "image/png" ? "image" : "document"

    const formData = new FormData()
    formData.append("phone", formatted)
    formData.append("file", blob, media.filename)
    formData.append("caption", caption)
    formData.append("mediaType", mediaType)

    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/send-media`, {
      method: "POST",
      body: formData,
    })
    return res.ok
  } catch (err) {
    console.error("Error enviando imagen WhatsApp:", err)
    return false
  }
}

// Enviar WhatsApp con audio
async function sendWhatsAppAudio(phone: string): Promise<boolean> {
  try {
    const formatted = formatPhoneForWhatsApp(phone)

    if (!fs.existsSync(BIRTHDAY_AUDIO_PATH)) {
      console.warn("Archivo de audio de cumpleaños no encontrado:", BIRTHDAY_AUDIO_PATH)
      return false
    }

    const fileBuffer = fs.readFileSync(BIRTHDAY_AUDIO_PATH)
    const blob = new Blob([fileBuffer], { type: "audio/mpeg" })

    const formData = new FormData()
    formData.append("phone", formatted)
    formData.append("file", blob, "Cumpleanos Feliz.mp3")
    formData.append("mediaType", "audio")

    const res = await fetch(`${WA_SERVER_URL}/api/whatsapp/send-media`, {
      method: "POST",
      body: formData,
    })
    return res.ok
  } catch (err) {
    console.error("Error enviando audio WhatsApp:", err)
    return false
  }
}

// Enviar email de cumpleaños con imagen adjunta
async function sendBirthdayEmail(to: string, nombre: string, edad: number): Promise<boolean> {
  try {
    const nodemailer = require("nodemailer")
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.hostinger.com",
      port: parseInt(process.env.SMTP_PORT || "465"),
      secure: true,
      auth: {
        user: process.env.SMTP_USER || "notificaciones@iglesiaregalodedios.com",
        pass: process.env.SMTP_PASS,
      },
    })

    // Adjuntar imagen convertida del PDF
    const attachments: any[] = []
    const media = await getBirthdayImage()
    if (media) {
      attachments.push({
        filename: `Feliz Cumpleaños - ${nombre}.${media.type === "image/png" ? "png" : "pdf"}`,
        content: media.buffer,
        cid: "cumpleanos-imagen",
      })
    }

    await transporter.sendMail({
      from: `"Iglesia Regalo de Dios" <${process.env.SMTP_USER || "notificaciones@iglesiaregalodedios.com"}>`,
      to,
      subject: `🎂 ¡Feliz Cumpleaños, ${nombre}! — Iglesia Regalo de Dios`,
      html: generarHTMLEmail(nombre, edad),
      attachments,
    })
    return true
  } catch (err) {
    console.error("Error enviando email cumpleaños:", err)
    return false
  }
}

/**
 * POST: Enviar felicitación de cumpleaños a un individuo (desde el panel).
 * Body: { censoId, fuente, nombre, celular, correo, edad, fecha_cumple }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json() as {
      censoId: number
      fuente: string
      nombre: string
      celular?: string | null
      correo?: string | null
      edad: number
      fecha_cumple: string
    }

    const { censoId, fuente, nombre, celular, correo, edad, fecha_cumple } = body

    if (!censoId || !nombre || !edad) {
      return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 })
    }

    const anio = new Date().getFullYear()
    const mensaje = generarMensajeCumple(nombre, edad)

    const resultados = {
      buzon: false,
      push: false,
      email: false,
      whatsapp_imagen: false,
      whatsapp_audio: false,
    }

    // 1. Buzón interno — buscar user con la misma cédula o nombre
    try {
      // Intentar encontrar el usuario por nombre en la tabla users
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .ilike("displayName", `%${nombre.split(" ").slice(-2).join(" ")}%`)
        .limit(1)
        .maybeSingle()

      if (userData) {
        await supabase.from("buzon_mensajes").insert({
          user_id: userData.id,
          titulo: "🎂 ¡Feliz Cumpleaños!",
          mensaje: `¡La iglesia te desea un feliz cumpleaños! Que Dios te bendiga en tus ${edad} años. 🎉🎈`,
          tipo: "info",
          referencia_tipo: "cumpleanos",
        })
        resultados.buzon = true

        // Push al usuario del sistema
        resultados.push = await sendPush(
          userData.id,
          "🎂 ¡Feliz Cumpleaños!",
          `La Iglesia Regalo de Dios te desea un bendecido cumpleaños #${edad}`
        )
      }
    } catch (err) {
      console.warn("Error buzón/push cumpleaños:", err)
    }

    // 2. Email
    if (correo) {
      resultados.email = await sendBirthdayEmail(correo, nombre, edad)
    }

    // 3. WhatsApp — imagen con felicitación
    if (celular) {
      resultados.whatsapp_imagen = await sendWhatsAppImage(celular, mensaje)

      // Esperar un poco entre mensajes para no disparar anti-spam
      await new Promise((r) => setTimeout(r, 2000))

      // 4. WhatsApp — audio de cumpleaños feliz
      resultados.whatsapp_audio = await sendWhatsAppAudio(celular)
    }

    // 5. Registrar envío en tabla de tracking
    try {
      await supabase.from("cumpleanos_enviados").insert({
        censo_id: censoId,
        fuente,
        fecha_cumple,
        anio,
        canal_buzon: resultados.buzon,
        canal_push: resultados.push,
        canal_email: resultados.email,
        canal_whatsapp_imagen: resultados.whatsapp_imagen,
        canal_whatsapp_audio: resultados.whatsapp_audio,
        enviado_at: new Date().toISOString(),
      })
    } catch (err) {
      console.warn("Error registrando envío cumpleaños:", err)
    }

    return NextResponse.json({
      success: true,
      message: `Felicitación enviada a ${nombre}`,
      resultados,
    })
  } catch (error: any) {
    console.error("Error en /api/cron-cumpleanos POST:", error)
    return NextResponse.json({ success: false, error: error.message || "Error interno" }, { status: 500 })
  }
}

/**
 * GET: Cron automático — envía felicitaciones a todos los cumpleañeros de hoy que no hayan sido felicitados.
 * Protegido por CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación del cron
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET || "iglesia-cron-secret-2024"

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const now = new Date()
    // Ajustar a Ecuador (UTC-5)
    const ecuadorOffset = -5 * 60
    const utcOffset = now.getTimezoneOffset()
    const ecuadorTime = new Date(now.getTime() + (utcOffset + ecuadorOffset) * 60000)

    const mes = ecuadorTime.getMonth() + 1
    const dia = ecuadorTime.getDate()
    const anio = ecuadorTime.getFullYear()
    const monthStr = String(mes).padStart(2, "0")
    const dayStr = String(dia).padStart(2, "0")

    // Buscar cumpleañeros de hoy en censo y censo_mdg
    const [{ data: protocolo }, { data: mdg }] = await Promise.all([
      supabase
        .from("censo")
        .select("id, apellidos_nombres, fecha_nacimiento, celular, correo")
        .not("fecha_nacimiento", "is", null),
      supabase
        .from("censo_mdg")
        .select("id, apellidos_nombres, fecha_nacimiento, celular, correo")
        .not("fecha_nacimiento", "is", null),
    ])

    // Filtrar los de hoy
    const cumpleanosHoy: Array<{ id: number; nombre: string; celular: string | null; correo: string | null; edad: number; fuente: string; fecha: string }> = []

    for (const r of protocolo || []) {
      if (!r.fecha_nacimiento) continue
      const parts = r.fecha_nacimiento.split("-")
      if (parts.length === 3 && parts[1] === monthStr && parts[2] === dayStr) {
        cumpleanosHoy.push({
          id: r.id,
          nombre: r.apellidos_nombres,
          celular: r.celular,
          correo: r.correo,
          edad: anio - parseInt(parts[0]),
          fuente: "protocolo",
          fecha: r.fecha_nacimiento,
        })
      }
    }

    for (const r of mdg || []) {
      if (!r.fecha_nacimiento) continue
      const parts = r.fecha_nacimiento.split("-")
      if (parts.length === 3 && parts[1] === monthStr && parts[2] === dayStr) {
        // Evitar duplicados
        const isDup = cumpleanosHoy.some((c) => c.nombre === r.apellidos_nombres && c.fecha === r.fecha_nacimiento)
        if (!isDup) {
          cumpleanosHoy.push({
            id: r.id,
            nombre: r.apellidos_nombres,
            celular: r.celular,
            correo: r.correo,
            edad: anio - parseInt(parts[0]),
            fuente: "mdg",
            fecha: r.fecha_nacimiento,
          })
        }
      }
    }

    // Filtrar los que ya fueron enviados este año
    let pendientes: typeof cumpleanosHoy = []
    for (const c of cumpleanosHoy) {
      const { data: yaEnv } = await supabase
        .from("cumpleanos_enviados")
        .select("id")
        .eq("censo_id", c.id)
        .eq("fuente", c.fuente)
        .eq("anio", anio)
        .maybeSingle()

      if (!yaEnv) {
        pendientes.push(c)
      }
    }

    // Enviar a cada pendiente
    let enviados = 0
    for (const c of pendientes) {
      const mensaje = generarMensajeCumple(c.nombre, c.edad)
      const resultados = { buzon: false, push: false, email: false, whatsapp_imagen: false, whatsapp_audio: false }

      // Buzón + Push
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .ilike("displayName", `%${c.nombre.split(" ").slice(-2).join(" ")}%`)
          .limit(1)
          .maybeSingle()

        if (userData) {
          await supabase.from("buzon_mensajes").insert({
            user_id: userData.id,
            titulo: "🎂 ¡Feliz Cumpleaños!",
            mensaje: `¡La iglesia te desea un feliz cumpleaños! Que Dios te bendiga en tus ${c.edad} años. 🎉🎈`,
            tipo: "info",
            referencia_tipo: "cumpleanos",
          })
          resultados.buzon = true
          resultados.push = await sendPush(userData.id, "🎂 ¡Feliz Cumpleaños!", `La Iglesia te desea un bendecido cumpleaños #${c.edad}`)
        }
      } catch {}

      // Email
      if (c.correo) {
        resultados.email = await sendBirthdayEmail(c.correo, c.nombre, c.edad)
      }

      // WhatsApp imagen + audio
      if (c.celular) {
        resultados.whatsapp_imagen = await sendWhatsAppImage(c.celular, mensaje)
        await new Promise((r) => setTimeout(r, 2000))
        resultados.whatsapp_audio = await sendWhatsAppAudio(c.celular)
        await new Promise((r) => setTimeout(r, 1500))
      }

      // Registrar
      try {
        await supabase.from("cumpleanos_enviados").insert({
          censo_id: c.id,
          fuente: c.fuente,
          fecha_cumple: c.fecha,
          anio,
          canal_buzon: resultados.buzon,
          canal_push: resultados.push,
          canal_email: resultados.email,
          canal_whatsapp_imagen: resultados.whatsapp_imagen,
          canal_whatsapp_audio: resultados.whatsapp_audio,
          enviado_at: new Date().toISOString(),
        })
      } catch {}

      enviados++
    }

    return NextResponse.json({
      success: true,
      message: `Cron cumpleaños: ${enviados}/${pendientes.length} enviados. Total hoy: ${cumpleanosHoy.length}.`,
      total_hoy: cumpleanosHoy.length,
      ya_enviados: cumpleanosHoy.length - pendientes.length,
      enviados_ahora: enviados,
    })
  } catch (error: any) {
    console.error("Error en /api/cron-cumpleanos GET:", error)
    return NextResponse.json({ success: false, error: error.message || "Error interno" }, { status: 500 })
  }
}
