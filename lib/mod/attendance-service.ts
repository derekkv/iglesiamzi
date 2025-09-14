import { supabase } from "../supabase"

export interface AttendanceDetail {
  id: number
  mes_id: string
  nombre: string
  orden: number
}

export interface AttendanceColumn {
  id: number
  mes_id: string
  nombre: string
  orden: number
}

export interface AttendanceData {
  id: number
  mes_id: string
  detalle_id: number
  columna_id: number
  cantidad: number
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

  async createDetail(mesId: string, nombre: string): Promise<AttendanceDetail> {

    await this.ensureMonthExists(mesId)

    const orden = await this.getNextOrder("asistencia_detalles", mesId)

    const { data, error } = await this.supabase
      .from("asistencia_detalles")
      .insert({
        mes_id: mesId,
        nombre,
        orden,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating detail:", error)
      throw error
    }
    return data
  }

  async updateDetail(id: number, nombre: string): Promise<void> {
    const { error } = await this.supabase.from("asistencia_detalles").update({ nombre }).eq("id", id)

    if (error) {
      console.error("[v0] Error updating detail:", error)
      throw error
    }
  }

  async deleteDetail(id: number): Promise<void> {
    const { error } = await this.supabase.from("asistencia_detalles").delete().eq("id", id)

    if (error) {
      console.error("[v0] Error deleting detail:", error)
      throw error
    }
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

  async createColumn(mesId: string, nombre: string): Promise<AttendanceColumn> {

    await this.ensureMonthExists(mesId)

    const orden = await this.getNextOrder("asistencia_columnas", mesId)

    const { data, error } = await this.supabase
      .from("asistencia_columnas")
      .insert({
        mes_id: mesId,
        nombre,
        orden,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating column:", error)
      throw error
    }
    return data
  }

  async updateColumn(id: number, nombre: string): Promise<void> {
    const { error } = await this.supabase.from("asistencia_columnas").update({ nombre }).eq("id", id)

    if (error) {
      console.error("[v0] Error updating column:", error)
      throw error
    }
  }

  async deleteColumn(id: number): Promise<void> {
    const { error } = await this.supabase.from("asistencia_columnas").delete().eq("id", id)

    if (error) {
      console.error("[v0] Error deleting column:", error)
      throw error
    }
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

    await this.ensureMonthExists(mesId)

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

  // Ensure month exists before creating related records
  private async ensureMonthExists(mesId: string): Promise<void> {

    // Check if month already exists
    const { data: existingMonth, error: checkError } = await this.supabase
      .from("meses")
      .select("id")
      .eq("id", mesId)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("[v0] Error checking if month exists:", checkError)
      throw checkError
    }

    if (existingMonth) {
      return
    }

    const [year, month] = mesId.split("-").map(Number)
    const monthDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // Last day of the month

    // Create the month if it doesn't exist
    const { error: insertError } = await this.supabase.from("meses").insert({
      id: mesId,
      name: mesId, // Use 'name' instead of 'nombre'
      year: year,
      month: month,
      start_date: monthDate.toISOString(),
      end_date: endDate.toISOString(),
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error("[v0] Error creating month:", insertError)
      throw insertError
    }

  }
}

export const attendanceService = new AttendanceService()
