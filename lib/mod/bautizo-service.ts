import { supabase } from "@/lib/supabase"

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

  // Crear un nuevo bautizo
  async create(bautizo: BautizoInput): Promise<Bautizo> {
    const { data, error } = await supabase.from("bautizos").insert(bautizo).select().single()

    if (error) throw error
    return data
  },

  // Actualizar un bautizo
  async update(id: number, updates: Partial<BautizoInput>): Promise<Bautizo> {
    const { data, error } = await supabase
      .from("bautizos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Eliminar un bautizo
  async delete(id: number): Promise<void> {
    const { error } = await supabase.from("bautizos").delete().eq("id", id)

    if (error) throw error
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
