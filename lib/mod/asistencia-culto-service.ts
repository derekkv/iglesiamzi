/**
 * Servicio de Asistencia al Culto.
 *
 * Gestiona la asistencia dominical de los miembros de la iglesia
 * (censos protocolo, mdg y jóvenes) y el seguimiento automático
 * de quienes acumulan 2+ faltas en el mes.
 */
import { supabase } from "@/lib/secure-db"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface PersonaCulto {
  id: number
  nombre: string
  apellido: string
  celular: string | null
  fuente: "protocolo" | "mdg" | "jovenes"
}

export interface RegistroAsistencia {
  id?: number
  mes_id: string
  persona_id: number
  fuente: string
  nombre: string
  apellido: string
  celular: string | null
  fecha_domingo: string
  asistio: boolean | null
  registrado_por?: string
  registrado_por_nombre?: string
}

export interface SeguimientoCulto {
  id: number
  mes_id: string
  persona_id: number
  fuente: string
  nombre: string
  apellido: string
  celular: string | null
  total_faltas: number
  gestionado: boolean
  respuesta_gestion: string | null
  gestionado_por: string | null
  gestionado_por_nombre: string | null
  fecha_gestion: string | null
  movido_automaticamente: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Utilidades de fechas
// ---------------------------------------------------------------------------

/**
 * Separa "APELLIDO NOMBRE" en apellido y nombre.
 * El campo apellidos_nombres de los censos suele estar en formato "APELLIDOS NOMBRES"
 * donde las primeras 1-2 palabras son apellidos. Usamos heurística simple:
 * la primera palabra es apellido, el resto es nombre.
 */
function splitNombre(full: string): { apellido: string; nombre: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1) return { apellido: parts[0] || "", nombre: "" }
  // Heurística: si tiene 4+ partes, tomar las 2 primeras como apellido
  if (parts.length >= 4) {
    return { apellido: parts.slice(0, 2).join(" "), nombre: parts.slice(2).join(" ") }
  }
  // 2-3 partes: primera = apellido, resto = nombre
  return { apellido: parts[0], nombre: parts.slice(1).join(" ") }
}

/**
 * Obtiene todas las fechas de domingo de un mes dado (formato YYYY-MM-DD).
 * Basado en la zona horaria de Ecuador (UTC-5).
 */
export function getDomingosDelMes(year: number, month: number): string[] {
  const domingos: string[] = []
  // month es 1-indexed
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    if (date.getDay() === 0) {
      // Domingo
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, "0")
      const dd = String(date.getDate()).padStart(2, "0")
      domingos.push(`${yyyy}-${mm}-${dd}`)
    }
  }

  return domingos
}

/**
 * Obtiene el domingo de hoy o el último domingo pasado en hora Ecuador.
 */
export function getDomingoActual(): string {
  const now = new Date()
  // UTC-5 para Ecuador
  const ecNow = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const day = ecNow.getUTCDay() // 0 = domingo
  const diff = day // cuántos días atrás está el domingo
  const domingo = new Date(ecNow)
  domingo.setUTCDate(domingo.getUTCDate() - diff)
  const yyyy = domingo.getUTCFullYear()
  const mm = String(domingo.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(domingo.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Carga de personas desde censos
// ---------------------------------------------------------------------------

/**
 * Carga todas las personas de los 3 censos relevantes.
 * Devuelve la lista ordenada alfabéticamente por apellido.
 */
export async function cargarPersonasCensos(): Promise<PersonaCulto[]> {
  const [resProtocolo, resMdg, resJovenes] = await Promise.all([
    supabase.from("censo").select("id, apellidos_nombres, celular"),
    supabase.from("censo_mdg").select("id, apellidos_nombres, celular"),
    supabase.from("censo_jovenes").select("id, apellidos_nombres, celular"),
  ])

  const personas: PersonaCulto[] = []

  for (const row of resProtocolo.data || []) {
    const { nombre, apellido } = splitNombre(row.apellidos_nombres || "")
    personas.push({ id: row.id, nombre, apellido, celular: row.celular || null, fuente: "protocolo" })
  }

  for (const row of resMdg.data || []) {
    const { nombre, apellido } = splitNombre(row.apellidos_nombres || "")
    personas.push({ id: row.id, nombre, apellido, celular: row.celular || null, fuente: "mdg" })
  }

  for (const row of resJovenes.data || []) {
    const { nombre, apellido } = splitNombre(row.apellidos_nombres || "")
    personas.push({ id: row.id, nombre, apellido, celular: row.celular || null, fuente: "jovenes" })
  }

  // Ordenar por apellido A-Z
  personas.sort((a, b) => {
    const cmp = a.apellido.localeCompare(b.apellido, "es", { sensitivity: "base" })
    if (cmp !== 0) return cmp
    return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  })

  return personas
}

// ---------------------------------------------------------------------------
// Registro de asistencia
// ---------------------------------------------------------------------------

/**
 * Registra o actualiza la asistencia de una persona en un domingo.
 */
export async function registrarAsistencia(params: {
  mes_id: string
  persona_id: number
  fuente: string
  nombre: string
  apellido: string
  celular: string | null
  fecha_domingo: string
  asistio: boolean
  registrado_por?: string
  registrado_por_nombre?: string
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("asistencia_culto").upsert(
    {
      mes_id: params.mes_id,
      persona_id: params.persona_id,
      fuente: params.fuente,
      nombre: params.nombre,
      apellido: params.apellido,
      celular: params.celular,
      fecha_domingo: params.fecha_domingo,
      asistio: params.asistio,
      registrado_por: params.registrado_por || null,
      registrado_por_nombre: params.registrado_por_nombre || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "persona_id,fuente,fecha_domingo" }
  )

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Obtiene todos los registros de asistencia para un mes.
 */
export async function getAsistenciaMes(mesId: string): Promise<RegistroAsistencia[]> {
  const { data, error } = await supabase
    .from("asistencia_culto")
    .select("*")
    .eq("mes_id", mesId)
    .order("apellido", { ascending: true })

  if (error) {
    console.error("[asistencia-culto] Error cargando asistencia:", error.message)
    return []
  }

  return data || []
}

// ---------------------------------------------------------------------------
// Seguimiento
// ---------------------------------------------------------------------------

/**
 * Obtiene todos los registros de seguimiento para un mes.
 */
export async function getSeguimientoMes(mesId: string): Promise<SeguimientoCulto[]> {
  const { data, error } = await supabase
    .from("asistencia_culto_seguimiento")
    .select("*")
    .eq("mes_id", mesId)
    .order("apellido", { ascending: true })

  if (error) {
    console.error("[asistencia-culto] Error cargando seguimiento:", error.message)
    return []
  }

  return data || []
}

/**
 * Gestiona un registro de seguimiento (marcar como gestionado + respuesta).
 */
export async function gestionarSeguimiento(params: {
  id: number
  respuesta: string
  gestionado_por: string
  gestionado_por_nombre: string
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("asistencia_culto_seguimiento")
    .update({
      gestionado: true,
      respuesta_gestion: params.respuesta,
      gestionado_por: params.gestionado_por,
      gestionado_por_nombre: params.gestionado_por_nombre,
      fecha_gestion: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Elimina un registro de seguimiento (para deshacer o limpiar).
 */
export async function eliminarSeguimiento(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("asistencia_culto_seguimiento")
    .delete()
    .eq("id", id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Mueve una persona a seguimiento si tiene 2+ faltas en el mes.
 * Se llama inmediatamente al registrar una falta.
 */
export async function moverASeguimientoSiCorresponde(params: {
  mes_id: string
  persona_id: number
  fuente: string
  nombre: string
  apellido: string
  celular: string | null
}): Promise<{ movido: boolean; error?: string }> {
  // Contar faltas actuales de esta persona en el mes
  const { data, error: errCount } = await supabase
    .from("asistencia_culto")
    .select("id")
    .eq("mes_id", params.mes_id)
    .eq("persona_id", params.persona_id)
    .eq("fuente", params.fuente)
    .eq("asistio", false)

  if (errCount) return { movido: false, error: errCount.message }

  const totalFaltas = (data || []).length

  if (totalFaltas < 2) return { movido: false }

  // Insertar/actualizar en seguimiento
  const { error: errIns } = await supabase
    .from("asistencia_culto_seguimiento")
    .upsert(
      {
        mes_id: params.mes_id,
        persona_id: params.persona_id,
        fuente: params.fuente,
        nombre: params.nombre,
        apellido: params.apellido,
        celular: params.celular,
        total_faltas: totalFaltas,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "persona_id,fuente,mes_id" }
    )

  if (errIns) return { movido: false, error: errIns.message }
  return { movido: true }
}

/**
 * Calcula y mueve automáticamente a seguimiento a personas con 2+ faltas.
 * Se llama desde el cron (domingos ~14:00) o manualmente.
 */
export async function procesarSeguimientoAutomatico(mesId: string): Promise<{
  success: boolean
  movidos: number
  error?: string
}> {
  // 1. Obtener todos los registros del mes
  const { data: registros, error: errReg } = await supabase
    .from("asistencia_culto")
    .select("persona_id, fuente, nombre, apellido, celular, asistio")
    .eq("mes_id", mesId)

  if (errReg) return { success: false, movidos: 0, error: errReg.message }

  // 2. Contar faltas por persona
  const faltasMap = new Map<string, { persona_id: number; fuente: string; nombre: string; apellido: string; celular: string | null; faltas: number }>()

  for (const r of registros || []) {
    if (r.asistio === false) {
      const key = `${r.persona_id}-${r.fuente}`
      const existing = faltasMap.get(key)
      if (existing) {
        existing.faltas++
      } else {
        faltasMap.set(key, {
          persona_id: r.persona_id,
          fuente: r.fuente,
          nombre: r.nombre,
          apellido: r.apellido,
          celular: r.celular,
          faltas: 1,
        })
      }
    }
  }

  // 3. Filtrar los que tienen 2+ faltas
  const conDosFaltas = Array.from(faltasMap.values()).filter((p) => p.faltas >= 2)

  if (conDosFaltas.length === 0) return { success: true, movidos: 0 }

  // 4. Insertar en seguimiento (upsert para no duplicar)
  const rows = conDosFaltas.map((p) => ({
    mes_id: mesId,
    persona_id: p.persona_id,
    fuente: p.fuente,
    nombre: p.nombre,
    apellido: p.apellido,
    celular: p.celular,
    total_faltas: p.faltas,
    movido_automaticamente: true,
    updated_at: new Date().toISOString(),
  }))

  const { error: errIns } = await supabase
    .from("asistencia_culto_seguimiento")
    .upsert(rows, { onConflict: "persona_id,fuente,mes_id" })

  if (errIns) return { success: false, movidos: 0, error: errIns.message }

  return { success: true, movidos: conDosFaltas.length }
}

// ---------------------------------------------------------------------------
// Estadísticas para resumen-mensual y pastoral
// ---------------------------------------------------------------------------

export interface StatsAsistenciaCulto {
  totalPersonas: number
  asistieron: number
  faltaron: number
  enSeguimiento: number
  sinGestionar: number
}

/**
 * Obtiene estadísticas del mes para mostrar en tarjetas de resumen.
 */
export async function getStatsMes(mesId: string): Promise<StatsAsistenciaCulto> {
  const [regRes, segRes, personasRes] = await Promise.all([
    supabase.from("asistencia_culto").select("persona_id, fuente, asistio").eq("mes_id", mesId),
    supabase.from("asistencia_culto_seguimiento").select("id, gestionado").eq("mes_id", mesId),
    // Contar personas únicas en los censos
    Promise.all([
      supabase.from("censo").select("id", { count: "exact", head: true }),
      supabase.from("censo_mdg").select("id", { count: "exact", head: true }),
      supabase.from("censo_jovenes").select("id", { count: "exact", head: true }),
    ]),
  ])

  const registros = regRes.data || []
  const seguimiento = segRes.data || []
  const [cProtocolo, cMdg, cJovenes] = personasRes

  const totalPersonas = (cProtocolo.count || 0) + (cMdg.count || 0) + (cJovenes.count || 0)

  // Contar personas únicas que asistieron al menos una vez
  const personasAsistieron = new Set<string>()
  const personasFaltaron = new Set<string>()

  for (const r of registros) {
    const key = `${r.persona_id}-${r.fuente}`
    if (r.asistio === true) {
      personasAsistieron.add(key)
    } else if (r.asistio === false) {
      personasFaltaron.add(key)
    }
  }

  // Quitar de faltaron los que también asistieron en otro domingo
  for (const key of personasAsistieron) {
    personasFaltaron.delete(key)
  }

  return {
    totalPersonas,
    asistieron: personasAsistieron.size,
    faltaron: personasFaltaron.size,
    enSeguimiento: seguimiento.length,
    sinGestionar: seguimiento.filter((s) => !s.gestionado).length,
  }
}
