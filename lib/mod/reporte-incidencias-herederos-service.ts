import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "./audit-service"

export interface ReporteIncidencia {
  id?: number
  fecha: string
  hora: string
  nombre_nino: string
  detalle_incidencia: string
  maestro_presente: string
  created_at?: string
  updated_at?: string
}

export const reporteIncidenciasHerederosService = {
  async getAll(): Promise<ReporteIncidencia[]> {
    const { data, error } = await supabase
      .from("reporte_incidencias_herederos")
      .select("*")
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false })
    if (error) throw error
    return data || []
  },

  async create(record: Omit<ReporteIncidencia, "id" | "created_at" | "updated_at">, audit?: AuditInfo): Promise<ReporteIncidencia> {
    const { data, error } = await supabase
      .from("reporte_incidencias_herederos")
      .insert(record)
      .select()
      .single()
    if (error) throw error
    if (audit) {
      auditService.log({
        ...audit,
        module: "reporte_incidencias_herederos",
        action: "crear",
        description: `Incidencia registrada: ${record.nombre_nino} - ${record.fecha}`,
        details: { ...record },
      })
    }
    return data
  },

  async update(id: number, record: Partial<ReporteIncidencia>, audit?: AuditInfo): Promise<ReporteIncidencia> {
    const { data, error } = await supabase
      .from("reporte_incidencias_herederos")
      .update({ ...record, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    if (audit) {
      auditService.log({
        ...audit,
        module: "reporte_incidencias_herederos",
        action: "editar",
        description: `Incidencia editada: ${record.nombre_nino || ""} (ID: ${id})`,
        details: { id, ...record },
      })
    }
    return data
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { error } = await supabase
      .from("reporte_incidencias_herederos")
      .delete()
      .eq("id", id)
    if (error) throw error
    if (audit) {
      auditService.log({
        ...audit,
        module: "reporte_incidencias_herederos",
        action: "eliminar",
        description: `Incidencia eliminada (ID: ${id})`,
        details: { id },
      })
    }
  },
}
