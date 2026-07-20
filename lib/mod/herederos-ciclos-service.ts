import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "./audit-service"
import { calcularEdadDesdeNacimiento } from "./censo-ninos-service"
import { currentMonthEcuador, currentYearEcuador } from "../timezone"

// === TIPOS ===

export type HerederosCicloTipo = "herederos_baby" | "herederos_kids" | "herederos_explores" | "herederos_champions"

export const HEREDEROS_CICLO_CONFIG: Record<HerederosCicloTipo, { label: string; edadRango: string; moduleName: string }> = {
  herederos_baby: { label: "Herederos Baby", edadRango: "0-2 años", moduleName: "herederos_baby" },
  herederos_kids: { label: "Herederos Kids", edadRango: "3-5 años", moduleName: "herederos_kids" },
  herederos_explores: { label: "Herederos Explores", edadRango: "6-8 años", moduleName: "herederos_explores" },
  herederos_champions: { label: "Herederos Champions", edadRango: "9-11 años", moduleName: "herederos_champions" },
}

export interface HerederosCiclo {
  id: number
  tipo: HerederosCicloTipo
  fecha_inicio: string
  total_clases: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface HerederosParticipante {
  id: number
  ciclo_id: number
  nombre: string
  fecha_nacimiento: string | null
  edad: number | null
  salon: string | null
  nuevo: boolean
  nombre_representante: string | null
  celular: string | null
  fecha_registro: string | null
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface HerederosFecha {
  id: number
  ciclo_id: number
  numero_clase: number
  fecha: string
  created_at: string
  updated_at: string
}

export interface HerederosAsistencia {
  id: number
  ciclo_id: number
  participante_id: number
  fecha_id: number
  status: "A" | "J" | "F" | "AT" | "none"
  created_at: string
  updated_at: string
}

export interface HerederosCicloCompleto {
  ciclo: HerederosCiclo
  participantes: HerederosParticipante[]
  fechas: HerederosFecha[]
  asistencia: HerederosAsistencia[]
}

export interface HerederosParticipanteInput {
  nombre: string
  fecha_nacimiento?: string | null
  edad?: number | null
  salon?: string | null
  nuevo?: boolean
  nombre_representante?: string | null
  celular?: string | null
  fecha_registro?: string | null
  observaciones?: string | null
}

// === UTILIDADES ===

/**
 * Obtiene todos los domingos del mes actual (o de un mes/año específico).
 */
export function getDomingosMes(mes?: number, anio?: number): string[] {
  const month = mes ?? currentMonthEcuador()
  const year = anio ?? currentYearEcuador()
  const domingos: string[] = []

  // Iterar todos los días del mes
  const diasEnMes = new Date(year, month, 0).getDate()
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = new Date(year, month - 1, d)
    if (fecha.getDay() === 0) { // 0 = domingo
      const y = fecha.getFullYear()
      const m = String(fecha.getMonth() + 1).padStart(2, "0")
      const day = String(fecha.getDate()).padStart(2, "0")
      domingos.push(`${y}-${m}-${day}`)
    }
  }

  return domingos
}

/**
 * Recalcula domingos desde un índice modificado en adelante (semanales).
 */
function recalcularDomingosDesde(fechas: string[], indiceModificado: number, nuevaFecha: string): string[] {
  const resultado = [...fechas]
  resultado[indiceModificado] = nuevaFecha

  const fecha = new Date(nuevaFecha + "T12:00:00")
  for (let i = indiceModificado + 1; i < resultado.length; i++) {
    fecha.setDate(fecha.getDate() + 7)
    const y = fecha.getFullYear()
    const m = String(fecha.getMonth() + 1).padStart(2, "0")
    const d = String(fecha.getDate()).padStart(2, "0")
    resultado[i] = `${y}-${m}-${d}`
  }

  return resultado
}

// === SERVICIO ===

class HerederosCiclosService {
  // --- CICLOS ---

  async getCicloActivo(tipo: HerederosCicloTipo): Promise<HerederosCiclo | null> {
    const { data, error } = await supabase
      .from("herederos_ciclos")
      .select("*")
      .eq("tipo", tipo)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async getHistorialCiclos(tipo: HerederosCicloTipo): Promise<HerederosCiclo[]> {
    const { data, error } = await supabase
      .from("herederos_ciclos")
      .select("*")
      .eq("tipo", tipo)
      .eq("activo", false)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }

  async iniciarCiclo(tipo: HerederosCicloTipo, audit?: AuditInfo): Promise<HerederosCiclo> {
    const config = HEREDEROS_CICLO_CONFIG[tipo]

    // Obtener domingos del mes actual
    const domingos = getDomingosMes()
    if (domingos.length === 0) throw new Error("No hay domingos en el mes actual")

    const fechaInicio = domingos[0]
    const totalClases = domingos.length

    // Desactivar ciclo anterior
    await supabase
      .from("herederos_ciclos")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("tipo", tipo)
      .eq("activo", true)

    // Crear nuevo ciclo
    const { data: ciclo, error: cicloError } = await supabase
      .from("herederos_ciclos")
      .insert({
        tipo,
        fecha_inicio: fechaInicio,
        total_clases: totalClases,
        activo: true,
      })
      .select()
      .single()

    if (cicloError) throw cicloError

    // Generar fechas (domingos del mes)
    const fechasData = domingos.map((fecha, index) => ({
      ciclo_id: ciclo.id,
      numero_clase: index + 1,
      fecha,
    }))

    const { error: fechasError } = await supabase
      .from("herederos_ciclo_fechas")
      .insert(fechasData)

    if (fechasError) throw fechasError

    if (audit) {
      auditService.log({
        ...audit,
        module: "herederos",
        action: "crear",
        description: `Ciclo iniciado: ${config.label} — ${totalClases} domingos del mes`,
        details: { tipo, fecha_inicio: fechaInicio, total_clases: totalClases, domingos },
      })
    }

    return ciclo
  }

  async cerrarCiclo(cicloId: number, audit?: AuditInfo): Promise<void> {
    const { error } = await supabase
      .from("herederos_ciclos")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", cicloId)

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "herederos",
        action: "editar",
        description: `Ciclo #${cicloId} cerrado`,
        details: { ciclo_id: cicloId },
      })
    }
  }

  cicloTerminado(fechas: HerederosFecha[]): boolean {
    if (fechas.length === 0) return false
    const ultimaFecha = fechas[fechas.length - 1]
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const ultima = new Date(ultimaFecha.fecha + "T00:00:00")
    return hoy > ultima
  }

  // --- PARTICIPANTES ---

  async getParticipantes(cicloId: number): Promise<HerederosParticipante[]> {
    const { data, error } = await supabase
      .from("herederos_ciclo_participantes")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("nombre", { ascending: true })

    if (error) throw error
    return data || []
  }

  async addParticipante(cicloId: number, input: HerederosParticipanteInput, audit?: AuditInfo): Promise<HerederosParticipante> {
    const edad = input.fecha_nacimiento ? calcularEdadDesdeNacimiento(input.fecha_nacimiento) : (input.edad ?? null)

    const { data, error } = await supabase
      .from("herederos_ciclo_participantes")
      .insert({
        ciclo_id: cicloId,
        nombre: input.nombre.trim(),
        fecha_nacimiento: input.fecha_nacimiento || null,
        edad,
        salon: input.salon?.trim() || null,
        nuevo: input.nuevo ?? false,
        nombre_representante: input.nombre_representante?.trim() || null,
        celular: input.celular?.trim() || null,
        fecha_registro: input.fecha_registro || new Date().toISOString().split("T")[0],
        observaciones: input.observaciones?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "herederos",
        action: "crear",
        description: `Participante agregado: ${input.nombre}`,
        details: { ciclo_id: cicloId, nombre: input.nombre, salon: input.salon, representante: input.nombre_representante },
      })
    }

    return data
  }

  async updateParticipante(id: number, input: Partial<HerederosParticipanteInput>, audit?: AuditInfo): Promise<HerederosParticipante> {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }

    if (input.nombre !== undefined) updateData.nombre = input.nombre.trim()
    if (input.fecha_nacimiento !== undefined) {
      updateData.fecha_nacimiento = input.fecha_nacimiento || null
      updateData.edad = input.fecha_nacimiento ? calcularEdadDesdeNacimiento(input.fecha_nacimiento) : null
    }
    if (input.edad !== undefined && input.fecha_nacimiento === undefined) updateData.edad = input.edad
    if (input.salon !== undefined) updateData.salon = input.salon?.trim() || null
    if (input.nuevo !== undefined) updateData.nuevo = input.nuevo
    if (input.nombre_representante !== undefined) updateData.nombre_representante = input.nombre_representante?.trim() || null
    if (input.celular !== undefined) updateData.celular = input.celular?.trim() || null
    if (input.fecha_registro !== undefined) updateData.fecha_registro = input.fecha_registro || null
    if (input.observaciones !== undefined) updateData.observaciones = input.observaciones?.trim() || null

    // Obtener antes
    const { data: antes } = audit
      ? await supabase.from("herederos_ciclo_participantes").select("nombre, salon, nombre_representante, celular, observaciones").eq("id", id).single()
      : { data: null }

    const { data, error } = await supabase
      .from("herederos_ciclo_participantes")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "herederos",
        action: "editar",
        description: `Participante editado: ${data.nombre}`,
        details: {
          id,
          antes: antes || {},
          despues: { nombre: data.nombre, salon: data.salon, nombre_representante: data.nombre_representante, celular: data.celular, observaciones: data.observaciones },
        },
      })
    }

    return data
  }

  async deleteParticipante(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase
      .from("herederos_ciclo_participantes")
      .select("nombre, salon")
      .eq("id", id)
      .single()

    // Eliminar asistencia del participante
    await supabase
      .from("herederos_ciclo_asistencia")
      .delete()
      .eq("participante_id", id)

    const { error } = await supabase
      .from("herederos_ciclo_participantes")
      .delete()
      .eq("id", id)

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "herederos",
        action: "eliminar",
        description: `Participante eliminado: ${data?.nombre}`,
        details: { id, nombre: data?.nombre, salon: data?.salon },
      })
    }
  }

  // --- FECHAS ---

  async getFechas(cicloId: number): Promise<HerederosFecha[]> {
    const { data, error } = await supabase
      .from("herederos_ciclo_fechas")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("numero_clase", { ascending: true })

    if (error) throw error
    return data || []
  }

  async cambiarFecha(cicloId: number, fechaId: number, nuevaFecha: string, audit?: AuditInfo): Promise<HerederosFecha[]> {
    const fechas = await this.getFechas(cicloId)
    const indice = fechas.findIndex((f) => f.id === fechaId)
    if (indice === -1) throw new Error("Fecha no encontrada")

    const fechasStr = fechas.map((f) => f.fecha)
    const nuevasFechas = recalcularDomingosDesde(fechasStr, indice, nuevaFecha)

    for (let i = indice; i < fechas.length; i++) {
      const { error } = await supabase
        .from("herederos_ciclo_fechas")
        .update({ fecha: nuevasFechas[i], updated_at: new Date().toISOString() })
        .eq("id", fechas[i].id)

      if (error) throw error
    }

    if (audit) {
      auditService.log({
        ...audit,
        module: "herederos",
        action: "editar",
        description: `Fecha clase ${indice + 1} cambiada a ${nuevaFecha}`,
        details: { ciclo_id: cicloId, clase: indice + 1, nueva_fecha: nuevaFecha },
      })
    }

    return this.getFechas(cicloId)
  }

  async deleteAllFechas(cicloId: number, audit?: AuditInfo): Promise<void> {
    await supabase.from("herederos_ciclo_asistencia").delete().eq("ciclo_id", cicloId)
    const { error } = await supabase.from("herederos_ciclo_fechas").delete().eq("ciclo_id", cicloId)
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "herederos",
        action: "eliminar",
        description: `Todas las fechas eliminadas del ciclo #${cicloId}`,
        details: { ciclo_id: cicloId },
      })
    }
  }

  // --- ASISTENCIA ---

  async getAsistencia(cicloId: number): Promise<HerederosAsistencia[]> {
    const { data, error } = await supabase
      .from("herederos_ciclo_asistencia")
      .select("*")
      .eq("ciclo_id", cicloId)

    if (error) throw error
    return data || []
  }

  async upsertAsistencia(
    cicloId: number,
    participanteId: number,
    fechaId: number,
    status: "A" | "J" | "F" | "AT" | "none"
  ): Promise<HerederosAsistencia | null> {
    if (status === "none") {
      await supabase
        .from("herederos_ciclo_asistencia")
        .delete()
        .eq("participante_id", participanteId)
        .eq("fecha_id", fechaId)
      return null
    }

    const { data, error } = await supabase
      .from("herederos_ciclo_asistencia")
      .upsert(
        { ciclo_id: cicloId, participante_id: participanteId, fecha_id: fechaId, status },
        { onConflict: "participante_id,fecha_id" }
      )
      .select()
      .single()

    if (error) throw error
    return data
  }

  // --- DATOS COMPLETOS ---

  async getCicloCompleto(cicloId: number): Promise<HerederosCicloCompleto | null> {
    const { data: ciclo, error } = await supabase
      .from("herederos_ciclos")
      .select("*")
      .eq("id", cicloId)
      .single()

    if (error) return null

    const [participantes, fechas, asistencia] = await Promise.all([
      this.getParticipantes(cicloId),
      this.getFechas(cicloId),
      this.getAsistencia(cicloId),
    ])

    return { ciclo, participantes, fechas, asistencia }
  }

  async getCicloActivoCompleto(tipo: HerederosCicloTipo): Promise<HerederosCicloCompleto | null> {
    const ciclo = await this.getCicloActivo(tipo)
    if (!ciclo) return null
    return this.getCicloCompleto(ciclo.id)
  }

  /** Eliminar un ciclo completo (asistencia, participantes, fechas, ciclo) */
  async deleteCicloCompleto(cicloId: number, audit?: AuditInfo): Promise<void> {
    // Obtener info antes de eliminar
    const { data: ciclo } = await supabase.from("herederos_ciclos").select("tipo, fecha_inicio, total_clases").eq("id", cicloId).single()
    const { data: participantes } = await supabase.from("herederos_ciclo_participantes").select("id").eq("ciclo_id", cicloId)
    const cantParticipantes = participantes?.length || 0

    // Eliminar en orden: asistencia → participantes → fechas → ciclo
    await supabase.from("herederos_ciclo_asistencia").delete().eq("ciclo_id", cicloId)
    await supabase.from("herederos_ciclo_participantes").delete().eq("ciclo_id", cicloId)
    await supabase.from("herederos_ciclo_fechas").delete().eq("ciclo_id", cicloId)
    const { error } = await supabase.from("herederos_ciclos").delete().eq("id", cicloId)

    if (error) throw error

    if (audit) {
      const config = ciclo?.tipo ? HEREDEROS_CICLO_CONFIG[ciclo.tipo as HerederosCicloTipo] : null
      auditService.log({
        ...audit,
        module: "herederos",
        action: "eliminar",
        description: `Ciclo eliminado: ${config?.label || ciclo?.tipo} (inicio: ${ciclo?.fecha_inicio})`,
        details: { ciclo_id: cicloId, tipo: ciclo?.tipo, fecha_inicio: ciclo?.fecha_inicio, participantes_eliminados: cantParticipantes },
      })
    }
  }
}

export const herederosCiclosService = new HerederosCiclosService()
