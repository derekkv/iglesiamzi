import { supabase } from "../supabase"

export interface Participant {
  id: number
  mes_id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface DiscipuladoDate {
  id: number
  mes_id: string
  fecha: string
  created_at?: string
}

export interface AttendanceRecord {
  id: number
  mes_id: string
  participante_id: number
  fecha_id: number
  status: "A" | "J" | "F" | "AT" | "none"
  created_at?: string
  updated_at?: string
}

export interface DiscipuladoData {
  participants: Participant[]
  dates: DiscipuladoDate[]
  attendance: AttendanceRecord[]
}

class DiscipuladoService {
  private supabase = supabase

  private async ensureMonthExists(mesId: string): Promise<void> {

    const { data: existingMonth } = await this.supabase.from("meses").select("id").eq("id", mesId).single()

    if (!existingMonth) {
      // Parse mesId to get year and month
      const [year, month] = mesId.split("-").map(Number)
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      const { error } = await this.supabase.from("meses").insert({
        id: mesId,
        name: `${year}-${month.toString().padStart(2, "0")}`,
        year: year,
        month: month,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        status: "active",
      })

      if (error) {
        throw error
      }
    }
  }

  // Participants CRUD
  async getParticipants(mesId: string): Promise<Participant[]> {

    await this.ensureMonthExists(mesId)

    const { data, error } = await this.supabase
      .from("discipulado_participantes")
      .select("*")

      .order("name")

    if (error) {
      throw error
    }

    return data || []
  }

  async addParticipant(mesId: string, name: string): Promise<Participant> {

    await this.ensureMonthExists(mesId)

    const { data, error } = await this.supabase
      .from("discipulado_participantes")
      .insert({
        name: name.trim(),
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }

  async updateParticipant(id: number, name: string): Promise<Participant> {

    const { data, error } = await this.supabase
      .from("discipulado_participantes")
      .update({ name: name.trim() })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }

  async deleteParticipant(id: number): Promise<void> {

    const { error } = await this.supabase.from("discipulado_participantes").delete().eq("id", id)

    if (error) {
      throw error
    }
  }

  // Dates CRUD
  async getDates(mesId: string): Promise<DiscipuladoDate[]> {

    await this.ensureMonthExists(mesId)

    const { data, error } = await this.supabase
      .from("discipulado_fechas")
      .select("*")
      .eq("mes_id", mesId)
      .order("fecha")

    if (error) {
      throw error
    }

    return data || []
  }

  async addDate(mesId: string, fecha: string): Promise<DiscipuladoDate> {

    await this.ensureMonthExists(mesId)

    const { data, error } = await this.supabase
      .from("discipulado_fechas")
      .insert({
        mes_id: mesId,
        fecha: fecha,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }

  async deleteDate(id: number): Promise<void> {

    const { error } = await this.supabase.from("discipulado_fechas").delete().eq("id", id)

    if (error) {
      throw error
    }
  }

  // Attendance CRUD
  async getAttendance(mesId: string): Promise<AttendanceRecord[]> {

    await this.ensureMonthExists(mesId)

    const { data, error } = await this.supabase.from("discipulado_asistencia").select("*").eq("mes_id", mesId)

    if (error) {
      throw error
    }

    return data || []
  }

  async upsertAttendance(
    mesId: string,
    participanteId: number,
    fechaId: number,
    status: "A" | "J" | "F" | "AT" | "none",
  ): Promise<AttendanceRecord | null> {

    await this.ensureMonthExists(mesId)

    if (status === "none") {
      // Delete the record if status is 'none'
      const { error } = await this.supabase
        .from("discipulado_asistencia")
        .delete()
        .eq("participante_id", participanteId)
        .eq("fecha_id", fechaId)

      if (error) {
        throw error
      }
      return null
    }

    // Use upsert with the correct conflict resolution
    const { data, error } = await this.supabase
      .from("discipulado_asistencia")
      .upsert(
        {
          mes_id: mesId,
          participante_id: participanteId,
          fecha_id: fechaId,
          status: status,
        },
        {
          onConflict: "participante_id,fecha_id",
        },
      )
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }

  // Get all data for a month
  async getDiscipuladoData(mesId: string): Promise<DiscipuladoData> {

    await this.ensureMonthExists(mesId)

    const [participants, dates, attendance] = await Promise.all([
      this.getParticipants(mesId),
      this.getDates(mesId),
      this.getAttendance(mesId),
    ])

    return {
      participants,
      dates,
      attendance,
    }
  }

  // Helper method to get date ID by date string
  async getDateId(mesId: string, fecha: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .from("discipulado_fechas")
      .select("id")
      .eq("mes_id", mesId)
      .eq("fecha", fecha)
      .single()

    if (error || !data) {
      return null
    }

    return data.id
  }
}

export const discipuladoService = new DiscipuladoService()
