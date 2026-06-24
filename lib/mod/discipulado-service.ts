import { supabase } from "../supabase"
import { auditService, type AuditInfo } from "./audit-service"

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



  // Participants CRUD
  async getParticipants(mesId: string): Promise<Participant[]> {

    const { data, error } = await this.supabase
      .from("discipulado_participantes")
      .select("*")
      .eq("mes_id", mesId)
      .order("name")

    if (error) {
      throw error
    }

    return data || []
  }

  async addParticipant(mesId: string, name: string, audit?: AuditInfo): Promise<Participant> {
    const { data, error } = await this.supabase.from("discipulado_participantes").insert({ mes_id: mesId, name: name.trim() }).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "discipulado", action: "crear", description: `Participante: ${name}`, details: { id: data.id, nombre: name, mes_id: mesId } })
    return data
  }

  async updateParticipant(id: number, name: string, audit?: AuditInfo): Promise<Participant> {
    const { data, error } = await this.supabase.from("discipulado_participantes").update({ name: name.trim() }).eq("id", id).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "discipulado", action: "editar", description: `Participante renombrado a: ${name}`, details: { id, nuevo_nombre: name } })
    return data
  }

  async deleteParticipant(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await this.supabase.from("discipulado_participantes").select("name").eq("id", id).single()
    const { error } = await this.supabase.from("discipulado_participantes").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "discipulado", action: "eliminar", description: `Participante: ${data?.name}`, details: { id, nombre: data?.name } })
  }

  // Dates CRUD
  async getDates(mesId: string): Promise<DiscipuladoDate[]> {

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

  async addDate(mesId: string, fecha: string, audit?: AuditInfo): Promise<DiscipuladoDate> {
    const { data, error } = await this.supabase.from("discipulado_fechas").insert({ mes_id: mesId, fecha }).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "discipulado", action: "crear", description: `Fecha: ${fecha}`, details: { id: data.id, fecha, mes_id: mesId } })
    return data
  }

  async deleteDate(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await this.supabase.from("discipulado_fechas").select("fecha").eq("id", id).single()
    const { error } = await this.supabase.from("discipulado_fechas").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "discipulado", action: "eliminar", description: `Fecha: ${data?.fecha}`, details: { id, fecha: data?.fecha } })
  }

  // Attendance CRUD
  async getAttendance(mesId: string): Promise<AttendanceRecord[]> {

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
