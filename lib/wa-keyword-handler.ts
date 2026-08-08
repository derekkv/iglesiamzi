/**
 * Manejo de keywords en mensajes entrantes de WhatsApp.
 *
 * Procesado ASÍNCRONAMENTE desde el webhook (fire-and-forget) para no
 * bloquear la respuesta a Meta.
 *
 * Keywords soportadas:
 *  - "ver" → admin recibe los videos de cumpleaños del día (ventana 24h abierta = gratis)
 */
import { supabaseServer } from "@/lib/supabase-server"
import { sendSmartMedia, sendSmart, normalizeWaId } from "@/lib/mod/wa-crm-service"
import { getBirthdayVideo } from "@/lib/pdf-to-image"
import { generarMensajeCumple } from "@/lib/mod/cumpleanos-service"

// IDs de admins que pueden usar el comando "ver".
// Se resuelve igual que en el cron: tabla → env → fallback.
const FALLBACK_ADMIN_IDS = [
  "bb4dce93-0345-4203-8e8a-76b6d58490e8",
  "5047fe7d-0e7b-4752-b25a-ae3b9bbac009",
  "8a799e01-11bb-4ea4-8a95-9f7033e90fb1",
]

async function getAdminPhones(): Promise<string[]> {
  const ids = await getAdminBirthdayNotifyIds()
  const { data } = await supabaseServer
    .from("users")
    .select("phone")
    .in("id", ids)

  return (data || []).map((u) => normalizeWaId(u.phone)).filter(Boolean) as string[]
}

async function getAdminBirthdayNotifyIds(): Promise<string[]> {
  try {
    const { data } = await supabaseServer
      .from("admin_notification_config")
      .select("user_ids")
      .eq("config_key", "birthday_notify")
      .eq("is_active", true)
      .maybeSingle()

    if (data?.user_ids && data.user_ids.length > 0) {
      return data.user_ids
    }
  } catch {}

  const envIds = process.env.ADMIN_BIRTHDAY_NOTIFY_IDS
  if (envIds) {
    const ids = envIds.split(",").map((s) => s.trim()).filter(Boolean)
    if (ids.length > 0) return ids
  }

  return FALLBACK_ADMIN_IDS
}

/**
 * Punto de entrada: recibe el wa_id del remitente y el texto del mensaje.
 * Detecta keywords y ejecuta la acción correspondiente.
 */
export async function handleKeyword(waId: string, body: string): Promise<void> {
  const keyword = body.trim().toLowerCase()

  if (keyword === "ver") {
    await handleVerCumpleanos(waId)
  }
  // Agregar más keywords aquí si es necesario
}

/**
 * Handler "VER": envía los videos de cumpleaños del día al admin que lo pidió.
 * Como el admin acaba de enviar un mensaje, la ventana de 24h está abierta
 * y los videos se envían como mensajes libres (gratis, sin plantilla).
 */
async function handleVerCumpleanos(waId: string): Promise<void> {
  // Verificar que es un admin autorizado
  const adminPhones = await getAdminPhones()
  if (!adminPhones.includes(waId)) {
    // No es admin — ignorar silenciosamente
    return
  }

  // Obtener los cumpleañeros pendientes del día
  const { data: pendientes } = await supabaseServer
    .from("cumpleanos_pendientes_ver")
    .select("*")
    .order("nombre")

  if (!pendientes || pendientes.length === 0) {
    await sendSmart({
      to: waId,
      message: "ℹ️ No hay cumpleañeros registrados para hoy.",
      origen: "cumpleanos",
    })
    return
  }

  // Confirmar recepción
  await sendSmart({
    to: waId,
    message: `🎂 Generando ${pendientes.length} video(s) de felicitación... Un momento.`,
    origen: "cumpleanos",
  })

  let enviados = 0
  let fallidos = 0

  for (const c of pendientes) {
    try {
      // Generar video personalizado
      const media = await getBirthdayVideo(c.nombre)
      if (!media) {
        console.warn(`[keyword-ver] No se pudo generar video para "${c.nombre}"`)
        fallidos++
        continue
      }

      // Enviar video (ventana abierta = gratis como mensaje libre)
      const result = await sendSmartMedia({
        to: waId,
        buffer: media.buffer,
        mimeType: media.type,
        filename: media.filename,
        caption: `🎂 ${c.nombre} — ${c.edad} años`,
        type: "video",
        origen: "cumpleanos",
      })

      if (result.success) {
        enviados++
      } else {
        console.warn(`[keyword-ver] Error enviando video de ${c.nombre}: ${result.error}`)
        fallidos++
      }

      // Enviar el mensaje de felicitación que se le envió al cumpleañero
      const mensajeFelicitacion = generarMensajeCumple(c.nombre, c.edad)
      await sendSmart({
        to: waId,
        message: `📨 *Mensaje enviado a ${c.nombre}:*\n\n${mensajeFelicitacion}`,
        origen: "cumpleanos",
      })

      // Esperar un poco entre envíos para no saturar
      await new Promise((r) => setTimeout(r, 1500))
    } catch (err: any) {
      console.error(`[keyword-ver] Error procesando ${c.nombre}:`, err?.message)
      fallidos++
    }
  }

  // Resumen final
  const resumen = fallidos > 0
    ? `✅ Listo: ${enviados} video(s) enviado(s), ${fallidos} fallido(s).`
    : `✅ Listo: ${enviados} video(s) de felicitación enviados.`

  await sendSmart({
    to: waId,
    message: resumen,
    origen: "cumpleanos",
  })
}
