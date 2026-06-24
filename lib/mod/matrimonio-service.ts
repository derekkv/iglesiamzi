import { supabase } from "@/lib/supabase"
import { auditService, type AuditInfo } from "@/lib/mod/audit-service"

export interface Matrimonio {
  id: number
  numero: number
  fecha: string
  nombres_esposos: string
  cedula_esposo: string
  cedula_esposa: string
  observacion?: string
  created_at: string
  updated_at: string
}

export type MatrimonioInput = Omit<Matrimonio, "id" | "created_at" | "updated_at">

export const matrimonioService = {
  // Obtener todos los matrimonios sin filtro de mes
  async getAll(): Promise<Matrimonio[]> {
    const { data, error } = await supabase.from("matrimonios").select("*").order("numero", { ascending: false })

    if (error) throw error
    return data || []
  },

  // Buscar matrimonios por rango de fechas o nombres
  async search(searchTerm?: string, fechaDesde?: string, fechaHasta?: string): Promise<Matrimonio[]> {
    let query = supabase.from("matrimonios").select("*")

    if (searchTerm) {
      query = query.or(
        `nombres_esposos.ilike.%${searchTerm}%,cedula_esposo.ilike.%${searchTerm}%,cedula_esposa.ilike.%${searchTerm}%`,
      )
    }

    if (fechaDesde) {
      query = query.gte("fecha", fechaDesde)
    }

    if (fechaHasta) {
      query = query.lte("fecha", fechaHasta)
    }

    query = query.order("fecha", { ascending: false })

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  // Obtener todos los matrimonios de un mes
  async getByMonth(mesId: string): Promise<Matrimonio[]> {
    const { data, error } = await supabase
      .from("matrimonios")
      .select("*")
      .eq("mes_id", mesId)
      .order("numero", { ascending: true })

    if (error) throw error
    return data || []
  },

  async create(matrimonio: MatrimonioInput, audit?: AuditInfo): Promise<Matrimonio> {
    const { data, error } = await supabase.from("matrimonios").insert(matrimonio).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "matrimonio", action: "crear", description: `Matrimonio #${data.numero} - ${data.nombre_esposo} & ${data.nombre_esposa}`, details: { numero: data.numero, fecha: data.fecha, nombre_esposo: data.nombre_esposo, nombre_esposa: data.nombre_esposa, testigos: data.testigos, observacion: data.observacion } })
    return data
  },

  async update(id: number, updates: Partial<MatrimonioInput>, audit?: AuditInfo): Promise<Matrimonio> {
    const { data: antes } = audit ? await supabase.from("matrimonios").select("numero,fecha,nombre_esposo,nombre_esposa,testigos").eq("id", id).single() : { data: null }
    const { data, error } = await supabase
      .from("matrimonios")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "matrimonio", action: "editar", description: `Matrimonio #${data.numero} - ${data.nombre_esposo} & ${data.nombre_esposa}`, details: { antes, despues: { numero: data.numero, fecha: data.fecha, nombre_esposo: data.nombre_esposo, nombre_esposa: data.nombre_esposa, testigos: data.testigos } } })
    return data
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("matrimonios").select("numero,nombre_esposo,nombre_esposa,fecha").eq("id", id).single()
    const { error } = await supabase.from("matrimonios").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "matrimonio", action: "eliminar", description: `Matrimonio #${data?.numero} - ${data?.nombre_esposo} & ${data?.nombre_esposa}`, details: { id, numero: data?.numero, nombre_esposo: data?.nombre_esposo, nombre_esposa: data?.nombre_esposa, fecha: data?.fecha } })
  },

  // Obtener el siguiente número disponible globalmente
  async getNextNumber(): Promise<number> {
    const { data, error } = await supabase
      .from("matrimonios")
      .select("numero")
      .order("numero", { ascending: false })
      .limit(1)

    if (error) throw error
    return data && data.length > 0 ? data[0].numero + 1 : 1
  },
}
