import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "@/lib/mod/audit-service"

export interface Bautizo {
  id: number
  numero: number
  fecha: string
  nombre_bautizado: string
  nombre_padre: string
  nombre_madre: string
  padrinos?: string
  observacion?: string
  created_at: string
  updated_at: string
}

export type BautizoInput = Omit<Bautizo, "id" | "created_at" | "updated_at">

export const bautizoService = {
  async getAll(): Promise<Bautizo[]> {
    const { data, error } = await supabase.from("bautizos").select("*").order("numero", { ascending: false })

    if (error) throw error
    return data || []
  },

  async search(searchTerm?: string, fechaDesde?: string, fechaHasta?: string): Promise<Bautizo[]> {
    let query = supabase.from("bautizos").select("*")

    if (searchTerm) {
      query = query.or(
        `nombre_bautizado.ilike.%${searchTerm}%,nombre_padre.ilike.%${searchTerm}%,nombre_madre.ilike.%${searchTerm}%`,
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

  // Obtener todos los bautizos de un mes
  async getByMonth(mesId: string): Promise<Bautizo[]> {
    const { data, error } = await supabase
      .from("bautizos")
      .select("*")
      .eq("mes_id", mesId)
      .order("numero", { ascending: true })

    if (error) throw error
    return data || []
  },

  async create(bautizo: BautizoInput, audit?: AuditInfo): Promise<Bautizo> {
    const { data, error } = await supabase.from("bautizos").insert(bautizo).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "bautizo", action: "crear", description: `Bautizo #${data.numero} - ${data.nombre_bautizado}`, details: { numero: data.numero, fecha: data.fecha, nombre_bautizado: data.nombre_bautizado, nombre_padre: data.nombre_padre, nombre_madre: data.nombre_madre, padrinos: data.padrinos, observacion: data.observacion } })
    return data
  },

  async update(id: number, updates: Partial<BautizoInput>, audit?: AuditInfo): Promise<Bautizo> {
    const { data: antes } = audit ? await supabase.from("bautizos").select("numero,fecha,nombre_bautizado,nombre_padre,nombre_madre,padrinos").eq("id", id).single() : { data: null }
    const { data, error } = await supabase
      .from("bautizos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "bautizo", action: "editar", description: `Bautizo #${data.numero} - ${data.nombre_bautizado}`, details: { antes, despues: { numero: data.numero, fecha: data.fecha, nombre_bautizado: data.nombre_bautizado, nombre_padre: data.nombre_padre, nombre_madre: data.nombre_madre, padrinos: data.padrinos } } })
    return data
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("bautizos").select("numero,nombre_bautizado,nombre_padre,nombre_madre,fecha").eq("id", id).single()
    const { error } = await supabase.from("bautizos").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "bautizo", action: "eliminar", description: `Bautizo #${data?.numero} - ${data?.nombre_bautizado}`, details: { id, numero: data?.numero, nombre_bautizado: data?.nombre_bautizado, nombre_padre: data?.nombre_padre, nombre_madre: data?.nombre_madre, fecha: data?.fecha } })
  },

  async getNextNumber(): Promise<number> {
    const { data, error } = await supabase
      .from("bautizos")
      .select("numero")
      .order("numero", { ascending: false })
      .limit(1)

    if (error) throw error
    return data && data.length > 0 ? data[0].numero + 1 : 1
  },
}
