import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "./audit-service"
import { currentMonthEcuador, currentYearEcuador } from "../timezone"

export interface ConsolidacionHeredero {
  id: number
  participante_id: number
  participante_nombre: string
  salon: string
  celular_representante: string | null
  nombre_representante: string | null
  total_faltas: number
  mes: number
  anio: number
  gestionado: boolean
  respuesta: string | null
  gestionado_por: string | null
  gestionado_por_nombre: string | null
  fecha_gestion: string | null
  created_at: string
  updated_at: string
}

export interface NinoConFaltas {
  participante_id: number
  nombre: string
  salon: string
  celular: string | null
  nombre_representante: string | null
  total_faltas: number
  ciclo_tipo: string
}

/**
 * Obtiene los niños de todos los salones de Herederos que tienen 3+ faltas en el mes actual.
 * Consulta la asistencia de los ciclos activos y cuenta las faltas ("F") del mes.
 */
export async function getNinosConFaltasMes(): Promise<NinoConFaltas[]> {
  const mes = currentMonthEcuador()
  const anio = currentYearEcuador()
  const mesStr = `${anio}-${String(mes).padStart(2, "0")}`

  // 1. Obtener ciclos activos de herederos
  const { data: ciclos } = await supabase
    .from("herederos_ciclos")
    .select("id, tipo")
    .eq("activo", true)

  if (!ciclos || ciclos.length === 0) return []

  const cicloIds = ciclos.map((c) => c.id)
  const cicloTipoMap: Record<number, string> = {}
  for (const c of ciclos) cicloTipoMap[c.id] = c.tipo

  // 2. Obtener fechas de este mes para esos ciclos
  const { data: fechas } = await supabase
    .from("herederos_ciclo_fechas")
    .select("id, ciclo_id, fecha")
    .in("ciclo_id", cicloIds)
    .gte("fecha", `${mesStr}-01`)
    .lte("fecha", `${mesStr}-31`)

  if (!fechas || fechas.length === 0) return []

  const fechaIds = fechas.map((f) => f.id)

  // 3. Obtener asistencia de esas fechas (solo faltas "F")
  const { data: asistencia } = await supabase
    .from("herederos_ciclo_asistencia")
    .select("participante_id, fecha_id, status")
    .in("fecha_id", fechaIds)
    .eq("status", "F")

  if (!asistencia || asistencia.length === 0) return []

  // 4. Contar faltas por participante
  const faltasPorParticipante: Record<number, number> = {}
  for (const a of asistencia) {
    faltasPorParticipante[a.participante_id] = (faltasPorParticipante[a.participante_id] || 0) + 1
  }

  // Filtrar los que tienen 3+
  const participantesConFaltas = Object.entries(faltasPorParticipante)
    .filter(([, count]) => count >= 3)
    .map(([id, count]) => ({ id: Number(id), faltas: count }))

  if (participantesConFaltas.length === 0) return []

  // 5. Obtener datos de los participantes
  const participanteIds = participantesConFaltas.map((p) => p.id)
  const { data: participantes } = await supabase
    .from("herederos_ciclo_participantes")
    .select("id, ciclo_id, nombre, salon, celular, nombre_representante")
    .in("id", participanteIds)

  if (!participantes) return []

  // 6. Construir resultado
  return participantes.map((p) => {
    const faltas = participantesConFaltas.find((f) => f.id === p.id)!
    return {
      participante_id: p.id,
      nombre: p.nombre,
      salon: p.salon || cicloTipoMap[p.ciclo_id] || "Sin salón",
      celular: p.celular,
      nombre_representante: p.nombre_representante,
      total_faltas: faltas.faltas,
      ciclo_tipo: cicloTipoMap[p.ciclo_id] || "",
    }
  })
}

/**
 * Obtiene los registros de consolidación del mes actual.
 */
export async function getConsolidacionMes(): Promise<ConsolidacionHeredero[]> {
  const mes = currentMonthEcuador()
  const anio = currentYearEcuador()

  const { data, error } = await supabase
    .from("consolidacion_herederos")
    .select("*")
    .eq("mes", mes)
    .eq("anio", anio)
    .order("participante_nombre", { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * Sincroniza los niños con 3+ faltas al listado de consolidación.
 * Inserta nuevos registros (upsert) sin sobrescribir los que ya fueron gestionados.
 */
export async function sincronizarConsolidacion(): Promise<{ nuevos: number; total: number }> {
  const mes = currentMonthEcuador()
  const anio = currentYearEcuador()

  const ninosConFaltas = await getNinosConFaltasMes()
  if (ninosConFaltas.length === 0) return { nuevos: 0, total: 0 }

  // Obtener los que ya están registrados este mes
  const existentes = await getConsolidacionMes()
  const existenteIds = new Set(existentes.map((e) => e.participante_id))

  // Solo insertar los nuevos
  const nuevos = ninosConFaltas.filter((n) => !existenteIds.has(n.participante_id))

  if (nuevos.length > 0) {
    const registros = nuevos.map((n) => ({
      participante_id: n.participante_id,
      participante_nombre: n.nombre,
      salon: n.salon,
      celular_representante: n.celular,
      nombre_representante: n.nombre_representante,
      total_faltas: n.total_faltas,
      mes,
      anio,
      gestionado: false,
    }))

    const { error } = await supabase
      .from("consolidacion_herederos")
      .upsert(registros, { onConflict: "participante_id,mes,anio" })

    if (error) throw error
  }

  // Actualizar conteo de faltas para los existentes no gestionados
  for (const existente of existentes.filter((e) => !e.gestionado)) {
    const ninoActualizado = ninosConFaltas.find((n) => n.participante_id === existente.participante_id)
    if (ninoActualizado && ninoActualizado.total_faltas !== existente.total_faltas) {
      await supabase
        .from("consolidacion_herederos")
        .update({ total_faltas: ninoActualizado.total_faltas, updated_at: new Date().toISOString() })
        .eq("id", existente.id)
    }
  }

  return { nuevos: nuevos.length, total: ninosConFaltas.length }
}

/**
 * Registra la gestión de un niño.
 */
export async function gestionarNino(
  id: number,
  data: { gestionado: boolean; respuesta: string },
  audit?: AuditInfo
): Promise<ConsolidacionHeredero> {
  const { data: updated, error } = await supabase
    .from("consolidacion_herederos")
    .update({
      gestionado: data.gestionado,
      respuesta: data.respuesta,
      gestionado_por: audit?.user_id,
      gestionado_por_nombre: audit?.user_name,
      fecha_gestion: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  if (audit) {
    auditService.log({
      ...audit,
      module: "consolidacion_herederos",
      action: "editar",
      description: `Consolidación Herederos - ${updated.participante_nombre}`,
      details: { id, gestionado: data.gestionado, respuesta: data.respuesta },
    })
  }

  return updated
}

/**
 * Edita una gestión existente.
 */
export async function editarGestionConsolidacion(
  id: number,
  data: { gestionado: boolean; respuesta: string },
  audit?: AuditInfo
): Promise<ConsolidacionHeredero> {
  const { data: updated, error } = await supabase
    .from("consolidacion_herederos")
    .update({
      gestionado: data.gestionado,
      respuesta: data.respuesta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  if (audit) {
    auditService.log({
      ...audit,
      module: "consolidacion_herederos",
      action: "editar",
      description: `Consolidación Herederos editado - ${updated.participante_nombre}`,
      details: { id, gestionado: data.gestionado, respuesta: data.respuesta },
    })
  }

  return updated
}

/**
 * Elimina un registro de consolidación.
 */
export async function eliminarConsolidacion(
  id: number,
  audit?: AuditInfo
): Promise<void> {
  const { data: registro } = await supabase
    .from("consolidacion_herederos")
    .select("participante_nombre")
    .eq("id", id)
    .single()

  const { error } = await supabase
    .from("consolidacion_herederos")
    .delete()
    .eq("id", id)

  if (error) throw error

  if (audit) {
    auditService.log({
      ...audit,
      module: "consolidacion_herederos",
      action: "eliminar",
      description: `Consolidación Herederos eliminado - ${registro?.participante_nombre}`,
      details: { id },
    })
  }
}
