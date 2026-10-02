import { supabase } from "@/lib/secure-db"
import { authFetch } from "@/lib/auth-fetch"
import { type AuditInfo } from "./audit-service"

export interface DiezmoRecord {
  id: number
  mes_id: string
  numero: number
  fecha: string
  donador: string
  valor: number
  tipo_ofrenda: "diezmo" | "primicia" | "diezmo_especial"
  transaccion: "efectivo" | "transferencia"
  created_at?: string
  updated_at?: string
}

export type DiezmoWithMonth = DiezmoRecord & {
  mes_name?: string
}


export class DiezmosService {
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

  /**
   * Crea un diezmo + su ingreso vinculado (si es transferencia) de forma
   * ATÓMICA en el servidor (/api/finanzas/diezmos con service_role).
   * Esto evita el fallo silencioso que ocurría cuando la escritura a `ingresos`
   * desde el cliente era rechazada por permisos y causaba descuadres.
   */
  async createDiezmo(diezmo: Omit<DiezmoRecord, "id" | "created_at" | "updated_at">, audit?: AuditInfo): Promise<DiezmoRecord> {
    const res = await authFetch("/api/finanzas/diezmos", {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        diezmo,
        usuario: audit ? { id: audit.user_id, nombre: audit.user_name } : undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json.error || "Error creando el diezmo")
    }
    return json.data as DiezmoRecord
  }

  async updateDiezmo(id: number, updates: Partial<Omit<DiezmoRecord, "id" | "created_at" | "updated_at">>, audit?: AuditInfo): Promise<DiezmoRecord> {
    const res = await authFetch("/api/finanzas/diezmos", {
      method: "POST",
      body: JSON.stringify({
        action: "update",
        id,
        updates,
        usuario: audit ? { id: audit.user_id, nombre: audit.user_name } : undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json.error || "Error actualizando el diezmo")
    }
    return json.data as DiezmoRecord
  }

  async deleteDiezmo(id: number, audit?: AuditInfo): Promise<void> {
    const res = await authFetch("/api/finanzas/diezmos", {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        id,
        usuario: audit ? { id: audit.user_id, nombre: audit.user_name } : undefined,
      }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || "Error eliminando el diezmo")
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
