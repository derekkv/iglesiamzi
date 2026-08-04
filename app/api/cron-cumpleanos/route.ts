import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"
import { verifyApiAuth } from "@/lib/api-auth"
import { sendSmart, getOrCreateContact, getTemplateForUseCase, buildTemplateComponents, normalizeWaId } from "@/lib/mod/wa-crm-service"
import { uploadMedia, sendTemplate } from "@/lib/mod/wa-cloud-service"
import { emailService } from "@/lib/mod/email-service"
import { getBirthdayVideo, getBirthdayImage } from "@/lib/pdf-to-image"
import { CHURCH, CHURCH_SIGNATURE } from "@/lib/branding"

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno del servidor")
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${CHURCH.contactEmail || "admin@example.com"}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function generarMensajeCumple(nombre: string, edad: number): string {
  return `🎉🎂 *¡Feliz cumpleaños, hermano/a ${nombre}!* 🎂🎉\n\n` +
    `En este día damos gracias a Dios por tu vida y por el privilegio de celebrar un año más de las bendiciones que Él te ha concedido.\n\n` +
    `Oramos para que el Señor continúe fortaleciéndote, llenándote de sabiduría, salud, paz y gozo. ` +
    `Que Su presencia te acompañe cada día y que este nuevo año esté lleno de victorias, ` +
    `crecimiento espiritual y del cumplimiento de los propósitos que Dios tiene para tu vida.\n\n` +
    `*"Este es el día que hizo el Señor; nos gozaremos y alegraremos en él."* (Salmo 118:24)\n\n` +
    `¡Que Dios te bendiga abundantemente! Recibe un fuerte abrazo y nuestros mejores deseos en este día tan especial.\n\n` +
    `Con cariño y en el amor de Cristo,\n` +
    `*${CHURCH_SIGNATURE}*`
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

// Enviar WhatsApp con vídeo de cumpleaños (imagen + audio cumpleanos-feliz.ogg)
// Siempre usa la plantilla felicitacion_cumpleanos — el cron corre en horario fijo y la
// ventana de 24 h rara vez está abierta para los destinatarios de cumpleaños.
async function sendWhatsAppImage(phone: string, nombre: string, caption: string, edad?: number): Promise<boolean> {
  try {
    const media = await getBirthdayVideo(nombre)
    if (!media) {
      console.warn("[cron-cumpleanos] No se pudo generar el vídeo de cumpleaños")
      return false
    }

    // 1. Resolver la plantilla
    const template = await getTemplateForUseCase("felicitacion_cumpleanos")
    if (!template) {
      console.warn("[cron-cumpleanos] No hay plantilla aprobada con use_case='felicitacion_cumpleanos'. Configúrela en WhatsApp → Plantillas.")
      return false
    }

    // 2. Subir el vídeo al CDN de Meta para obtener un media_id
    const up = await uploadMedia(media.buffer, media.type, media.filename)
    if (!up.success || !up.mediaId) {
      console.warn("[cron-cumpleanos] No se pudo subir el vídeo a Meta:", up.error)
      return false
    }

    // 3. Construir componentes y enviar siempre por plantilla
    const waId = normalizeWaId(phone)
    const components = buildTemplateComponents(
      template,
      { nombre, edad: edad ?? "" },
      { id: up.mediaId }
    )
    const result = await sendTemplate(waId, template.name, template.language, components)

    // 4. Registrar en wa_messages a través del CRM
    const contact = await getOrCreateContact(waId)
    if (result.success && contact) {
      const { supabaseServer } = await import("@/lib/supabase-server")
      await supabaseServer.from("wa_messages").insert({
        wamid: result.wamid || null,
        contact_id: contact.id,
        wa_id: waId,
        direction: "outbound",
        type: "template",
        caption,
        media_id: up.mediaId,
        media_mime: media.type,
        media_filename: media.filename,
        template_name: template.name,
        template_language: template.language,
        template_params: { data: { nombre, edad }, components },
        status: "sent",
        sent_at: new Date().toISOString(),
        origen: "cumpleanos",
      })
      await supabaseServer.from("wa_contacts").update({
        last_outbound_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        last_message_preview: caption.slice(0, 200),
        updated_at: new Date().toISOString(),
      }).eq("id", contact.id)
    }

    if (!result.success) {
      console.warn(`[cron-cumpleanos] Plantilla a ${phone} falló: ${result.error}`)
    }
    return result.success
  } catch (err) {
    console.error("[cron-cumpleanos] Error enviando vídeo WhatsApp:", err)
    return false
  }
}

// Enviar email de cumpleaños con imagen inline.
// Usa el emailService único (plantilla "cumpleanos", editable desde el panel)
// en lugar de un transporter nodemailer propio, y queda registrado en email_messages.
async function sendBirthdayEmail(to: string, nombre: string, edad: number): Promise<boolean> {
  try {
    // Misma imagen personalizada que se envía por WhatsApp
    const attachments: any[] = []
    const media = await getBirthdayImage(nombre)
    if (media) {
      attachments.push({
        filename: media.filename,
        content: media.buffer,
        contentType: "image/png",
        cid: "cumpleanos-imagen", // referencia inline en la plantilla
      })
    }

    const result = await emailService.sendTemplateEmail({
      to,
      template: "cumpleanos",
      data: { nombre, edad, tieneImagen: !!media },
      attachments,
      origen: "cumpleanos",
    })

    if (!result.success) {
      console.error("Error enviando email cumpleaños:", result.error)
    }
    return result.success
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
          `La ${CHURCH.name} te desea un bendecido cumpleaños #${edad}`
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
      resultados.whatsapp_imagen = await sendWhatsAppImage(celular, nombre, mensaje)
    }

    // 4. Registrar envío en tabla de tracking
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

// IDs de admins que reciben notificación de cumpleaños
const ADMIN_BIRTHDAY_NOTIFY_IDS = [
  "bb4dce93-0345-4203-8e8a-76b6d58490e8",
  "5047fe7d-0e7b-4752-b25a-ae3b9bbac009",
]

// Enviar WhatsApp texto simple (resumen a administradores)
async function sendWhatsAppText(phone: string, message: string): Promise<boolean> {
  try {
    const result = await sendSmart({
      to: phone,
      message,
      useCase: "resumen_admin",
      templateData: { resumen: message.slice(0, 500) },
      origen: "cumpleanos",
    })
    if (!result.success) {
      console.warn(`[cron-cumpleanos] Texto a ${phone} falló: ${result.error}`)
    }
    return result.success
  } catch {
    return false
  }
}

// Enviar email simple HTML a través del servicio único (queda registrado)
async function sendSimpleEmail(to: string, subject: string, html: string): Promise<boolean> {
  const result = await emailService.sendRawEmail({
    to,
    subject,
    html,
    origen: "cumpleanos",
    template: "resumen_cumpleanos",
  })
  if (!result.success) {
    console.error("Error enviando email admin:", result.error)
  }
  return result.success
}

/**
 * Notifica a los admins configurados sobre los cumpleañeros del día.
 * Canales: WhatsApp (texto + imágenes), Email, Push, Buzón (modal in-app)
 */
async function notifyAdminsBirthdays(
  cumpleaneros: Array<{ id: number; nombre: string; edad: number; celular: string | null; fuente: string }>,
  dia: number,
  mes: number,
  anio: number
) {
  const fechaHoy = `${dia}/${String(mes).padStart(2, "0")}/${anio}`
  const lista = cumpleaneros.map((c) => `• ${c.nombre} (${c.edad} años)`).join("\n")
  const listaHtml = cumpleaneros.map((c) => `<li><strong>${c.nombre}</strong> — ${c.edad} años</li>`).join("")

  const waMessage = `📋🎂 *Cumpleaños de hoy — ${fechaHoy}*\n\n${lista}\n\n_Total: ${cumpleaneros.length} persona(s)_`

  const emailSubject = `🎂 Cumpleaños de hoy (${fechaHoy}) — ${cumpleaneros.length} persona(s)`
  const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #f9fafb;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #7c3aed, #ec4899); padding: 24px; text-align: center;">
      <h2 style="color: white; margin: 0;">🎂 Cumpleaños de Hoy</h2>
      <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">${fechaHoy}</p>
    </div>
    <div style="padding: 24px;">
      <p style="color: #374151; font-size: 15px; margin-bottom: 12px;">Hoy cumplen años las siguientes personas:</p>
      <ul style="color: #374151; font-size: 15px; line-height: 2;">${listaHtml}</ul>
      <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">Total: ${cumpleaneros.length} persona(s)</p>
    </div>
  </div>
</body></html>`

  const pushTitle = `🎂 Cumpleaños hoy (${cumpleaneros.length})`
  const pushBody = cumpleaneros.length <= 3
    ? cumpleaneros.map((c) => c.nombre).join(", ")
    : `${cumpleaneros.slice(0, 2).map((c) => c.nombre).join(", ")} y ${cumpleaneros.length - 2} más`

  const buzonMensaje = `Hoy cumplen años:\n${lista}`

  // Pre-generar los vídeos de cada cumpleañero para enviar a admins
  const imagenesGeneradas: Array<{ nombre: string; media: { buffer: Buffer; type: string; filename: string } }> = []
  for (const c of cumpleaneros) {
    try {
      const media = await getBirthdayVideo(c.nombre)
      if (media) {
        imagenesGeneradas.push({ nombre: c.nombre, media })
      }
    } catch {}
  }

  for (const adminId of ADMIN_BIRTHDAY_NOTIFY_IDS) {
    try {
      // Obtener datos del admin
      const { data: adminUser } = await supabase
        .from("users")
        .select("id, email, phone")
        .eq("id", adminId)
        .single()

      if (!adminUser) continue

      // 1. Buzón (modal in-app)
      await supabase.from("buzon_mensajes").insert({
        user_id: adminId,
        titulo: `🎂 Cumpleaños de hoy — ${fechaHoy}`,
        mensaje: buzonMensaje,
        tipo: "info",
        referencia_tipo: "cumpleanos",
      })

      // 2. Push
      await sendPush(adminId, pushTitle, pushBody)

      // 3. WhatsApp — primero el resumen en texto
      if (adminUser.phone) {
        await sendWhatsAppText(adminUser.phone, waMessage)
        await new Promise((r) => setTimeout(r, 1500))

        // Enviar cada cumpleañero: vídeo por plantilla + mensaje de felicitación
        for (const c of cumpleaneros) {
          try {
            const img = imagenesGeneradas.find((i) => i.nombre === c.nombre)
            if (img) {
              const template = await getTemplateForUseCase("felicitacion_cumpleanos")
              if (template) {
                const up = await uploadMedia(img.media.buffer, img.media.type, img.media.filename)
                if (up.success && up.mediaId) {
                  const adminWaId = normalizeWaId(adminUser.phone)
                  const components = buildTemplateComponents(
                    template,
                    { nombre: c.nombre, edad: c.edad },
                    { id: up.mediaId }
                  )
                  await sendTemplate(adminWaId, template.name, template.language, components)
                }
              }
              await new Promise((r) => setTimeout(r, 2000))
            }

            // Mensaje de felicitación completo (el mismo que recibe la persona)
            const mensajeFelicitacion = generarMensajeCumple(c.nombre, c.edad)
            await sendWhatsAppText(adminUser.phone, `📨 *Mensaje enviado a ${c.nombre}:*\n\n${mensajeFelicitacion}`)
            await new Promise((r) => setTimeout(r, 1500))
          } catch {}
        }
      }

      // 4. Email
      if (adminUser.email) {
        await sendSimpleEmail(adminUser.email, emailSubject, emailHtml)
      }
    } catch (err) {
      console.error(`Error notificando admin ${adminId}:`, err)
    }
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
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

    // Buscar cumpleañeros de hoy en censo, censo_mdg y censo_jovenes
    const fetchCenso = (table: string) =>
      supabase
        .from(table)
        .select("id, apellidos_nombres, fecha_nacimiento, celular, correo")
        .not("fecha_nacimiento", "is", null)
        .limit(5000)

    const [{ data: protocolo }, { data: mdg }, { data: jovenes }] = await Promise.all([
      fetchCenso("censo"),
      fetchCenso("censo_mdg"),
      fetchCenso("censo_jovenes"),
    ])

    // Helper: parsea fecha_nacimiento (soporta YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY)
    function parseFecha(fecha: string): { year: number; month: number; day: number } | null {
      if (!fecha) return null
      if (fecha.includes("-")) {
        const parts = fecha.split("-")
        if (parts.length === 3) {
          const first = parseInt(parts[0], 10)
          const second = parseInt(parts[1], 10)
          const third = parseInt(parts[2], 10)
          if (!isNaN(first) && !isNaN(second) && !isNaN(third)) {
            if (parts[0].length === 4) return { year: first, month: second, day: third }
            else if (second >= 1 && second <= 12 && first >= 1 && first <= 31) return { year: third, month: second, day: first }
          }
        }
      }
      if (fecha.includes("/")) {
        const parts = fecha.split("/")
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10)
          const month = parseInt(parts[1], 10)
          const year = parseInt(parts[2], 10)
          if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12) return { year, month, day }
        }
      }
      return null
    }

    // Filtrar los de hoy
    const cumpleanosHoy: Array<{ id: number; nombre: string; celular: string | null; correo: string | null; edad: number; fuente: string; fecha: string }> = []

    const addIfToday = (rows: any[], fuente: string) => {
      for (const r of rows || []) {
        if (!r.fecha_nacimiento) continue
        const parsed = parseFecha(r.fecha_nacimiento)
        if (!parsed || parsed.month !== mes || parsed.day !== dia) continue
        const isDup = cumpleanosHoy.some((c) => c.nombre === r.apellidos_nombres && c.fuente !== fuente)
        if (!isDup) {
          cumpleanosHoy.push({
            id: r.id,
            nombre: r.apellidos_nombres,
            celular: r.celular,
            correo: r.correo,
            edad: anio - parsed.year,
            fuente,
            fecha: r.fecha_nacimiento,
          })
        }
      }
    }

    addIfToday(protocolo || [], "protocolo")
    addIfToday(mdg || [], "mdg")
    addIfToday(jovenes || [], "jovenes")

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
      const resultados = { buzon: false, push: false, email: false, whatsapp_imagen: false }

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

      // WhatsApp imagen
      if (c.celular) {
        resultados.whatsapp_imagen = await sendWhatsAppImage(c.celular, c.nombre, mensaje)
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
          enviado_at: new Date().toISOString(),
        })
      } catch {}

      enviados++
    }

    // === NOTIFICAR A ADMINS sobre los cumpleañeros de hoy ===
    if (cumpleanosHoy.length > 0) {
      await notifyAdminsBirthdays(cumpleanosHoy, dia, mes, anio)
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
