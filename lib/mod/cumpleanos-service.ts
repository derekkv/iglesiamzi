import { supabase } from "@/lib/secure-db"
import { currentMonthEcuador, currentYearEcuador, todayEcuador } from "@/lib/timezone"

export interface CumpleaneroRecord {
  id: number
  apellidos_nombres: string
  fecha_nacimiento: string
  celular: string | null
  correo: string | null
  edad_cumple: number
  dia: number
  fuente: "protocolo" | "mdg"
}

export interface CumpleanoEnviado {
  id?: number
  censo_id: number
  fuente: "protocolo" | "mdg"
  fecha_cumple: string
  anio: number
  canal_buzon: boolean
  canal_push: boolean
  canal_email: boolean
  canal_whatsapp_imagen: boolean
  canal_whatsapp_audio: boolean
  enviado_at?: string
}

/**
 * Obtiene los cumpleañeros de un mes/año específico desde censo y censo_mdg.
 * Compara el mes y día de fecha_nacimiento (formato YYYY-MM-DD).
 */
export async function getCumpleanerosMes(
  mes?: number,
  anio?: number
): Promise<CumpleaneroRecord[]> {
  const targetMonth = mes ?? currentMonthEcuador()
  const targetYear = anio ?? currentYearEcuador()
  const monthStr = String(targetMonth).padStart(2, "0")

  // Traer todos los registros con fecha_nacimiento de ambas tablas
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

  const cumpleaneros: CumpleaneroRecord[] = []

  // Procesar censo protocolo
  for (const r of protocolo || []) {
    const parsed = parseFechaNacimiento(r.fecha_nacimiento)
    if (parsed && parsed.month === targetMonth) {
      cumpleaneros.push({
        id: r.id,
        apellidos_nombres: r.apellidos_nombres,
        fecha_nacimiento: r.fecha_nacimiento,
        celular: r.celular || null,
        correo: r.correo || null,
        edad_cumple: targetYear - parsed.year,
        dia: parsed.day,
        fuente: "protocolo",
      })
    }
  }

  // Procesar censo MDG (evitar duplicados por cédula si coinciden)
  const idsProtocolo = new Set(cumpleaneros.map((c) => `${c.apellidos_nombres}-${c.fecha_nacimiento}`))
  for (const r of mdg || []) {
    const key = `${r.apellidos_nombres}-${r.fecha_nacimiento}`
    if (idsProtocolo.has(key)) continue
    const parsed = parseFechaNacimiento(r.fecha_nacimiento)
    if (parsed && parsed.month === targetMonth) {
      cumpleaneros.push({
        id: r.id,
        apellidos_nombres: r.apellidos_nombres,
        fecha_nacimiento: r.fecha_nacimiento,
        celular: r.celular || null,
        correo: r.correo || null,
        edad_cumple: targetYear - parsed.year,
        dia: parsed.day,
        fuente: "mdg",
      })
    }
  }

  // Ordenar por día del mes
  cumpleaneros.sort((a, b) => a.dia - b.dia)
  return cumpleaneros
}

/**
 * Obtiene los cumpleañeros de HOY.
 */
export async function getCumpleanosHoy(): Promise<CumpleaneroRecord[]> {
  const today = todayEcuador() // YYYY-MM-DD
  const [, monthStr, dayStr] = today.split("-")
  const mes = parseInt(monthStr, 10)
  const dia = parseInt(dayStr, 10)

  const todos = await getCumpleanerosMes(mes)
  return todos.filter((c) => c.dia === dia)
}

/**
 * Verifica si ya se envió felicitación a un cumpleañero este año.
 */
export async function yaEnviado(censoId: number, fuente: string, anio: number): Promise<boolean> {
  const { data } = await supabase
    .from("cumpleanos_enviados")
    .select("id")
    .eq("censo_id", censoId)
    .eq("fuente", fuente)
    .eq("anio", anio)
    .maybeSingle()
  return !!data
}

/**
 * Registra que se envió la felicitación.
 */
export async function registrarEnvio(envio: Omit<CumpleanoEnviado, "id" | "enviado_at">): Promise<void> {
  await supabase.from("cumpleanos_enviados").insert({
    ...envio,
    enviado_at: new Date().toISOString(),
  })
}

/**
 * Obtiene historial de envíos para un mes/año.
 */
export async function getHistorialEnvios(anio: number, mes?: number): Promise<CumpleanoEnviado[]> {
  let query = supabase
    .from("cumpleanos_enviados")
    .select("*")
    .eq("anio", anio)
    .order("enviado_at", { ascending: false })

  if (mes) {
    const monthStr = String(mes).padStart(2, "0")
    query = query.ilike("fecha_cumple", `%-${monthStr}-%`)
  }

  const { data } = await query
  return data || []
}

/**
 * Genera el mensaje de felicitación de cumpleaños.
 */
export function generarMensajeCumple(nombre: string, edad: number): string {
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

/**
 * Parsea fecha_nacimiento. Soporta YYYY-MM-DD y DD/MM/YYYY.
 */
function parseFechaNacimiento(fecha: string): { year: number; month: number; day: number } | null {
  if (!fecha) return null

  // Formato YYYY-MM-DD
  if (fecha.includes("-")) {
    const parts = fecha.split("-")
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)
      if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { year, month, day }
      }
    }
  }

  // Formato DD/MM/YYYY
  if (fecha.includes("/")) {
    const parts = fecha.split("/")
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const year = parseInt(parts[2], 10)
      if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { year, month, day }
      }
    }
  }

  return null
}
