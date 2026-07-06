import { supabase } from "../supabase"
import { auditService, type AuditInfo } from "./audit-service"

export interface AttendanceDetail {
  id: number
  mes_id: string
  nombre: string
  orden: number
  created_at: string
}

export interface AttendanceColumn {
  id: number
  mes_id: string
  nombre: string
  fecha?: string
  orden: number
  created_at: string
}

export interface AttendanceData {
  id: number
  mes_id: string
  detalle_id: number
  columna_id: number
  cantidad: number
  created_at: string
  updated_at: string | null
}

export class AttendanceService {
  private supabase = supabase

  private async getNextOrder(table: string, mesId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from(table)
      .select("orden")
      .eq("mes_id", mesId)
      .order("orden", { ascending: false })
      .limit(1)

    if (error) {
      return 0
    }

    return data && data.length > 0 ? data[0].orden + 1 : 0
  }

  // Detalles (filas)
  async getDetails(mesId: string): Promise<AttendanceDetail[]> {
    const { data, error } = await this.supabase
      .from("asistencia_detalles")
      .select("*")
      .eq("mes_id", mesId)
      .order("orden", { ascending: true })

    if (error) {
      console.error("[v0] Error loading details:", error)
      throw error
    }
    return data || []
  }

  async createDetail(mesId: string, nombre: string, audit?: AuditInfo): Promise<AttendanceDetail> {
    const orden = await this.getNextOrder("asistencia_detalles", mesId)
    const { data, error } = await this.supabase.from("asistencia_detalles").insert({ mes_id: mesId, nombre, orden }).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "asistencia", action: "crear", description: `Detalle: ${nombre}`, details: { id: data.id, nombre, mes_id: mesId } })
    return data
  }

  async updateDetail(id: number, nombre: string, audit?: AuditInfo): Promise<void> {
    const { error } = await this.supabase.from("asistencia_detalles").update({ nombre }).eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "asistencia", action: "editar", description: `Detalle renombrado a: ${nombre}`, details: { id, nuevo_nombre: nombre } })
  }

  async deleteDetail(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await this.supabase.from("asistencia_detalles").select("nombre").eq("id", id).single()
    const { error } = await this.supabase.from("asistencia_detalles").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "asistencia", action: "eliminar", description: `Detalle: ${data?.nombre}`, details: { id, nombre: data?.nombre } })
  }

  // Columnas (fechas)
  async getColumns(mesId: string): Promise<AttendanceColumn[]> {
    const { data, error } = await this.supabase
      .from("asistencia_columnas")
      .select("*")
      .eq("mes_id", mesId)
      .order("orden", { ascending: true })

    if (error) {
      console.error("[v0] Error loading columns:", error)
      throw error
    }
    return data || []
  }

  async createColumn(mesId: string, nombre: string, audit?: AuditInfo, fecha?: string): Promise<AttendanceColumn> {
    const orden = await this.getNextOrder("asistencia_columnas", mesId)
    const insertData: any = { mes_id: mesId, nombre, orden }
    if (fecha) insertData.fecha = fecha
    const { data, error } = await this.supabase.from("asistencia_columnas").insert(insertData).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "asistencia", action: "crear", description: `Columna/Fecha: ${nombre}`, details: { id: data.id, nombre, fecha, mes_id: mesId } })
    return data
  }

  async updateColumn(id: number, nombre: string, audit?: AuditInfo): Promise<void> {
    const { error } = await this.supabase.from("asistencia_columnas").update({ nombre }).eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "asistencia", action: "editar", description: `Columna renombrada a: ${nombre}`, details: { id, nuevo_nombre: nombre } })
  }

  async deleteColumn(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await this.supabase.from("asistencia_columnas").select("nombre").eq("id", id).single()
    const { error } = await this.supabase.from("asistencia_columnas").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "asistencia", action: "eliminar", description: `Columna: ${data?.nombre}`, details: { id, nombre: data?.nombre } })
  }

  // Datos de asistencia
  async getAttendanceData(mesId: string): Promise<AttendanceData[]> {
    const { data, error } = await this.supabase.from("asistencia_datos").select("*").eq("mes_id", mesId)

    if (error) {
      console.error("[v0] Error loading attendance data:", error)
      throw error
    }
    return data || []
  }

  async upsertAttendanceData(mesId: string, detalleId: number, columnaId: number, cantidad: number): Promise<void> {

    const { error } = await this.supabase.from("asistencia_datos").upsert(
      {
        mes_id: mesId,
        detalle_id: detalleId,
        columna_id: columnaId,
        cantidad,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "detalle_id,columna_id",
        ignoreDuplicates: false,
      },
    )

    if (error) {
      console.error("[v0] Error upserting attendance data:", error)
      throw error
    }
  }

  // Inicializar detalles por defecto para un mes nuevo
  async initializeDefaultDetails(mesId: string): Promise<void> {

    const defaultDetails = [
      "HOMBRES ASIST. GRAL",
      "MUJERES ASIST. GRAL.",
      "NIÑOS EN AUDITORIO",
      "HER. BABYS 0-3",
      "HER. EXPLORADORES 3-5",
      "HER. KIDS 6-11",
      "HOMBRES NUEVOS ACEPT. CRISTO",
      "MUJERES NUEVOS ACEPT. CRISTO",
      "JOVENES NUEVOS ACEPT. CRISTO (13-18 AÑOS)",
    ]

    const existingDetails = await this.getDetails(mesId)
    if (existingDetails.length > 0) {
      return
    }

    const detailsToInsert = defaultDetails.map((nombre, index) => ({
      mes_id: mesId,
      nombre,
      orden: index,
      
    }))

    const { error } = await this.supabase.from("asistencia_detalles").insert(detailsToInsert)

    if (error) {
      console.error("[v0] Error initializing default details:", error)
      throw error
    }
  }


}

export const attendanceService = new AttendanceService()
