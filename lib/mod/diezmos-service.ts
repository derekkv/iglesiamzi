import { supabase } from "../supabase"

export interface DiezmoRecord {
  id: number
  mes_id: string
  numero: number
  fecha: string
  donador: string
  valor: number
  created_at?: string
  updated_at?: string
}

export type DiezmoWithMonth = DiezmoRecord & {
  mes_name?: string
}


export class DiezmosService {
  // Ensure month exists before creating diezmos
  private async ensureMonthExists(mesId: string): Promise<void> {

    const { data: existingMonth } = await supabase.from("meses").select("id").eq("id", mesId).single()

    if (!existingMonth) {
      // Parse mesId to get year and month (format: "YYYY-MM")
      const [yearStr, monthStr] = mesId.split("-")
      const year = Number.parseInt(yearStr)
      const month = Number.parseInt(monthStr)

      // Calculate start and end dates for the month
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0) // Last day of the month

      const { error } = await supabase.from("meses").insert({
        id: mesId,
        name: mesId,
        year,
        month,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: "active",
      })

      if (error) {
        throw error
      }
    } else {
    }
  }

  // Get all diezmos for a specific month
  async getDiezmosByMonth(mesId: string): Promise<DiezmoRecord[]> {

    const { data, error } = await supabase
      .from("diezmos")
      .select("*")
      .eq("mes_id", mesId)
      .order("numero", { ascending: true })

    if (error) {
      throw error
    }

    return data || []
  }

  async searchDiezmos(filters: {
    donador?: string
    fechaDesde?: string
    fechaHasta?: string
  }): Promise<DiezmoWithMonth[]> {
    let query = supabase
      .from("diezmos")
      .select(`
        *,
        meses:mes_id (
          name
        )
      `)
      .order("fecha", { ascending: false })

    // Filtrar por donador si se proporciona
    if (filters.donador && filters.donador.trim()) {
      query = query.ilike("donador", `%${filters.donador.trim()}%`)
    }

    // Filtrar por rango de fechas
    if (filters.fechaDesde) {
      query = query.gte("fecha", filters.fechaDesde)
    }
    if (filters.fechaHasta) {
      query = query.lte("fecha", filters.fechaHasta)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error searching diezmos:", error)
      throw new Error("Error al buscar los diezmos")
    }

    // Mapear los resultados para incluir el nombre del mes
    return (data || []).map((item: any) => ({
      ...item,
      mes_name: item.meses?.name || "Sin mes",
    }))
  }
  // Get next available number for a month
  async getNextNumber(mesId: string): Promise<number> {
    const { data, error } = await supabase
      .from("diezmos")
      .select("numero")
      .eq("mes_id", mesId)
      .order("numero", { ascending: false })
      .limit(1)

    if (error) {
      throw error
    }

    return data && data.length > 0 ? data[0].numero + 1 : 1
  }

  // Create a new diezmo
  async createDiezmo(diezmo: Omit<DiezmoRecord, "id" | "created_at" | "updated_at">): Promise<DiezmoRecord> {

    // Ensure month exists
    await this.ensureMonthExists(diezmo.mes_id)

    const { data, error } = await supabase
      .from("diezmos")
      .insert({
        mes_id: diezmo.mes_id,
        numero: diezmo.numero,
        fecha: diezmo.fecha,
        donador: diezmo.donador,
        valor: diezmo.valor,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }

  // Update an existing diezmo
  async updateDiezmo(
    id: number,
    updates: Partial<Omit<DiezmoRecord, "id" | "created_at" | "updated_at">>,
  ): Promise<DiezmoRecord> {

    const { data, error } = await supabase
      .from("diezmos")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  }

  // Delete a diezmo
  async deleteDiezmo(id: number): Promise<void> {

    const { error } = await supabase.from("diezmos").delete().eq("id", id)

    if (error) {
      throw error
    }

  }

  // Get total value of diezmos for a month
  async getTotalByMonth(mesId: string): Promise<number> {
    const { data, error } = await supabase.from("diezmos").select("valor").eq("mes_id", mesId)

    if (error) {
      throw error
    }

    return data?.reduce((sum, record) => sum + Number(record.valor), 0) || 0
  }
}

export const diezmosService = new DiezmosService()
