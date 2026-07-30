import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "./audit-service"

// === TIPOS ===

export type CicloTipo = "primeros_pasos" | "seguimos_avanzando" | "siendo_iglesia"

export const CICLO_CONFIG: Record<CicloTipo, { label: string; totalClases: number; moduleName: string }> = {
  primeros_pasos: { label: "Primeros pasos de la vida cristiana", totalClases: 13, moduleName: "discipulado_primeros_pasos" },
  seguimos_avanzando: { label: "Seguimos avanzando", totalClases: 15, moduleName: "discipulado_seguimos_avanzando" },
  siendo_iglesia: { label: "Siendo iglesia", totalClases: 11, moduleName: "discipulado_siendo_iglesia" },
}

export interface Ciclo {
  id: number
  tipo: CicloTipo
  fecha_inicio: string
  total_clases: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface CicloParticipante {
  id: number
  ciclo_id: number
  nombre: string
  estatus: "en_curso" | "aprobado" | "reprobado"
  created_at: string
  updated_at: string
}

export interface CicloFecha {
  id: number
  ciclo_id: number
  numero_clase: number
  fecha: string
  created_at: string
  updated_at: string
}

export interface CicloAsistencia {
  id: number
  ciclo_id: number
  participante_id: number
  fecha_id: number
  status: "A" | "J" | "F" | "AT" | "none"
  created_at: string
  updated_at: string
}

export interface CicloCompleto {
  ciclo: Ciclo
  participantes: CicloParticipante[]
  fechas: CicloFecha[]
  asistencia: CicloAsistencia[]
}

// === UTILIDADES ===

/**
 * Calcula N domingos consecutivos a partir de una fecha.
 * Si la fecha dada es domingo, se cuenta como el primer domingo.
 */
function calcularDomingos(fechaInicio: string, cantidad: number): string[] {
  const domingos: string[] = []
  const fecha = new Date(fechaInicio + "T12:00:00")

  // Ajustar al próximo domingo si no es domingo (0 = domingo)
  const dia = fecha.getDay()
  if (dia !== 0) {
    fecha.setDate(fecha.getDate() + (7 - dia))
  }

  for (let i = 0; i < cantidad; i++) {
    const y = fecha.getFullYear()
    const m = String(fecha.getMonth() + 1).padStart(2, "0")
    const d = String(fecha.getDate()).padStart(2, "0")
    domingos.push(`${y}-${m}-${d}`)
    fecha.setDate(fecha.getDate() + 7)
  }

  return domingos
}

/**
 * Recalcula los domingos desde una fecha modificada en adelante.
 * Las fechas anteriores al índice cambiado no se tocan.
 */
function recalcularDomingosDesde(fechas: string[], indiceModificado: number, nuevaFecha: string): string[] {
  const resultado = [...fechas]
  resultado[indiceModificado] = nuevaFecha

  // Recalcular las fechas siguientes desde la nueva fecha
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

class DiscipuladoCiclosService {
  // --- CICLOS ---

  /** Obtener el ciclo activo de un tipo */
  async getCicloActivo(tipo: CicloTipo): Promise<Ciclo | null> {
    const { data, error } = await supabase
      .from("discipulado_ciclos")
      .select("*")
      .eq("tipo", tipo)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }

  /** Obtener historial de ciclos de un tipo */
  async getHistorialCiclos(tipo: CicloTipo): Promise<Ciclo[]> {
    const { data, error } = await supabase
      .from("discipulado_ciclos")
      .select("*")
      .eq("tipo", tipo)
      .eq("activo", false)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }

  /** Iniciar un nuevo ciclo: crea el ciclo y genera las fechas (domingos) */
  async iniciarCiclo(tipo: CicloTipo, fechaInicio: string, audit?: AuditInfo): Promise<Ciclo> {
    const config = CICLO_CONFIG[tipo]

    // Desactivar ciclo anterior si existe
    await supabase
      .from("discipulado_ciclos")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("tipo", tipo)
      .eq("activo", true)

    // Crear nuevo ciclo
    const { data: ciclo, error: cicloError } = await supabase
      .from("discipulado_ciclos")
      .insert({
        tipo,
        fecha_inicio: fechaInicio,
        total_clases: config.totalClases,
        activo: true,
      })
      .select()
      .single()

    if (cicloError) throw cicloError

    // Generar fechas (domingos)
    const domingos = calcularDomingos(fechaInicio, config.totalClases)
    const fechasData = domingos.map((fecha, index) => ({
      ciclo_id: ciclo.id,
      numero_clase: index + 1,
      fecha,
    }))

    const { error: fechasError } = await supabase
      .from("discipulado_ciclo_fechas")
      .insert(fechasData)

    if (fechasError) throw fechasError

    if (audit) {
      auditService.log({
        ...audit,
        module: "discipulado",
        action: "crear",
        description: `Ciclo iniciado: ${config.label} desde ${fechaInicio} (${config.totalClases} clases)`,
        details: { tipo, fecha_inicio: fechaInicio, total_clases: config.totalClases },
      })
    }

    return ciclo
  }

  /** Verificar si el ciclo ya terminó (la última fecha ya pasó) */
  cicloTerminado(fechas: CicloFecha[]): boolean {
    if (fechas.length === 0) return false
    const ultimaFecha = fechas[fechas.length - 1]
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const ultima = new Date(ultimaFecha.fecha + "T00:00:00")
    return hoy > ultima
  }

  // --- PARTICIPANTES ---

  async getParticipantes(cicloId: number): Promise<CicloParticipante[]> {
    const { data, error } = await supabase
      .from("discipulado_ciclo_participantes")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("nombre", { ascending: true })

    if (error) throw error
    return data || []
  }

  async addParticipante(cicloId: number, nombre: string, audit?: AuditInfo): Promise<CicloParticipante> {
    const { data, error } = await supabase
      .from("discipulado_ciclo_participantes")
      .insert({ ciclo_id: cicloId, nombre: nombre.trim() })
      .select()
      .single()

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "discipulado",
        action: "crear",
        description: `Participante agregado: ${nombre}`,
        details: { ciclo_id: cicloId, nombre },
      })
    }

    return data
  }

  async updateParticipante(id: number, nombre: string, audit?: AuditInfo): Promise<CicloParticipante> {
    const { data, error } = await supabase
      .from("discipulado_ciclo_participantes")
      .update({ nombre: nombre.trim(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "discipulado",
        action: "editar",
        description: `Participante renombrado a: ${nombre}`,
        details: { id, nuevo_nombre: nombre },
      })
    }

    return data
  }

  async deleteParticipante(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase
      .from("discipulado_ciclo_participantes")
      .select("nombre")
      .eq("id", id)
      .single()

    const { error } = await supabase
      .from("discipulado_ciclo_participantes")
      .delete()
      .eq("id", id)

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "discipulado",
        action: "eliminar",
        description: `Participante eliminado: ${data?.nombre}`,
        details: { id, nombre: data?.nombre },
      })
    }
  }

  async updateEstatus(id: number, estatus: "en_curso" | "aprobado" | "reprobado", audit?: AuditInfo): Promise<void> {
    const { data: antes } = await supabase
      .from("discipulado_ciclo_participantes")
      .select("nombre, estatus")
      .eq("id", id)
      .single()

    const { error } = await supabase
      .from("discipulado_ciclo_participantes")
      .update({ estatus, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "discipulado",
        action: "editar",
        description: `Estatus de ${antes?.nombre}: ${antes?.estatus} → ${estatus}`,
        details: { id, nombre: antes?.nombre, antes: antes?.estatus, despues: estatus },
      })
    }
  }

  // --- FECHAS ---

  async getFechas(cicloId: number): Promise<CicloFecha[]> {
    const { data, error } = await supabase
      .from("discipulado_ciclo_fechas")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("numero_clase", { ascending: true })

    if (error) throw error
    return data || []
  }

  /** Cerrar (desactivar) el ciclo activo sin crear uno nuevo */
  async cerrarCiclo(cicloId: number, audit?: AuditInfo): Promise<void> {
    const { error } = await supabase
      .from("discipulado_ciclos")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", cicloId)

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "discipulado",
        action: "editar",
        description: `Ciclo #${cicloId} cerrado`,
        details: { ciclo_id: cicloId },
      })
    }
  }

  /** Eliminar todas las fechas (y asistencia asociada) de un ciclo */
  async deleteAllFechas(cicloId: number, audit?: AuditInfo): Promise<void> {
    // Eliminar asistencia asociada a las fechas del ciclo
    const { error: asistError } = await supabase
      .from("discipulado_ciclo_asistencia")
      .delete()
      .eq("ciclo_id", cicloId)

    if (asistError) throw asistError

    // Eliminar todas las fechas
    const { error: fechasError } = await supabase
      .from("discipulado_ciclo_fechas")
      .delete()
      .eq("ciclo_id", cicloId)

    if (fechasError) throw fechasError

    if (audit) {
      auditService.log({
        ...audit,
        module: "discipulado",
        action: "eliminar",
        description: `Todas las fechas eliminadas del ciclo #${cicloId}`,
        details: { ciclo_id: cicloId },
      })
    }
  }

  /**
   * Cambiar una fecha y recalcular las siguientes.
   * Solo las fechas posteriores al índice cambiado se recalculan como domingos consecutivos.
   */
  async cambiarFecha(cicloId: number, fechaId: number, nuevaFecha: string, audit?: AuditInfo): Promise<CicloFecha[]> {
    // Obtener todas las fechas del ciclo
    const fechas = await this.getFechas(cicloId)
    const indice = fechas.findIndex((f) => f.id === fechaId)
    if (indice === -1) throw new Error("Fecha no encontrada")

    const fechasStr = fechas.map((f) => f.fecha)
    const nuevasFechas = recalcularDomingosDesde(fechasStr, indice, nuevaFecha)

    // Actualizar todas las fechas desde el índice en adelante
    for (let i = indice; i < fechas.length; i++) {
      const { error } = await supabase
        .from("discipulado_ciclo_fechas")
        .update({ fecha: nuevasFechas[i], updated_at: new Date().toISOString() })
        .eq("id", fechas[i].id)

      if (error) throw error
    }

    if (audit) {
      auditService.log({
        ...audit,
        module: "discipulado",
        action: "editar",
        description: `Fecha clase ${indice + 1} cambiada a ${nuevaFecha}, recalculando siguientes`,
        details: { ciclo_id: cicloId, clase: indice + 1, nueva_fecha: nuevaFecha },
      })
    }

    return this.getFechas(cicloId)
  }

  // --- ASISTENCIA ---

  async getAsistencia(cicloId: number): Promise<CicloAsistencia[]> {
    const { data, error } = await supabase
      .from("discipulado_ciclo_asistencia")
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
  ): Promise<CicloAsistencia | null> {
    if (status === "none") {
      const { error } = await supabase
        .from("discipulado_ciclo_asistencia")
        .delete()
        .eq("participante_id", participanteId)
        .eq("fecha_id", fechaId)

      if (error) throw error
      return null
    }

    const { data, error } = await supabase
      .from("discipulado_ciclo_asistencia")
      .upsert(
        {
          ciclo_id: cicloId,
          participante_id: participanteId,
          fecha_id: fechaId,
          status,
        },
        { onConflict: "participante_id,fecha_id" }
      )
      .select()
      .single()

    if (error) throw error
    return data
  }

  // --- DATOS COMPLETOS ---

  async getCicloCompleto(cicloId: number): Promise<CicloCompleto | null> {
    const { data: ciclo, error: cicloError } = await supabase
      .from("discipulado_ciclos")
      .select("*")
      .eq("id", cicloId)
      .single()

    if (cicloError) return null

    const [participantes, fechas, asistencia] = await Promise.all([
      this.getParticipantes(cicloId),
      this.getFechas(cicloId),
      this.getAsistencia(cicloId),
    ])

    return { ciclo, participantes, fechas, asistencia }
  }

  async getCicloActivoCompleto(tipo: CicloTipo): Promise<CicloCompleto | null> {
    const ciclo = await this.getCicloActivo(tipo)
    if (!ciclo) return null
    return this.getCicloCompleto(ciclo.id)
  }
}

export const discipuladoCiclosService = new DiscipuladoCiclosService()
