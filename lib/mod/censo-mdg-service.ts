import { supabase } from "@/lib/supabase"
import { auditService, type AuditInfo } from "@/lib/mod/audit-service"
import type { CensoRecord, CatalogOption, HijoData, ConfiguracionesGlobales } from "@/lib/mod/censo-service"

// Re-export types
export type { CensoRecord, CatalogOption, HijoData, ConfiguracionesGlobales }

/**
 * Limpia el objeto de datos antes de enviarlo a Supabase
 */
function cleanRecordForInsert(record: Partial<CensoRecord>): Record<string, any> {
  const { id, created_at, updated_at, ...rest } = record as any
  const cleaned: Record<string, any> = {}

  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue
    if (value === "") {
      cleaned[key] = null
    } else {
      cleaned[key] = value
    }
  }

  if (cleaned.edad === 0) cleaned.edad = null
  if (cleaned.porcentaje === 0) cleaned.porcentaje = null

  return cleaned
}

export const censoMdgService = {
  async getAll(): Promise<CensoRecord[]> {
    const { data, error } = await supabase.from("censo_mdg").select("*").order("apellidos_nombres", { ascending: true })
    if (error) throw error
    return data || []
  },

  async getById(id: number): Promise<CensoRecord | null> {
    const { data, error } = await supabase.from("censo_mdg").select("*").eq("id", id).single()
    if (error) throw error
    return data
  },

  async create(record: CensoRecord, audit?: AuditInfo): Promise<CensoRecord> {
    const cleaned = cleanRecordForInsert(record)
    const { data, error } = await supabase
      .from("censo_mdg")
      .insert([{ ...cleaned, updated_at: new Date().toISOString() }])
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo-mdg", action: "crear", description: `Censo MDG - ${data.apellidos_nombres}`, details: { cedula: record.cedula, nombre: record.apellidos_nombres } })
    return data
  },

  async update(id: number, record: Partial<CensoRecord>, audit?: AuditInfo): Promise<CensoRecord> {
    const cleaned = cleanRecordForInsert(record)
    const { data, error } = await supabase
      .from("censo_mdg")
      .update({ ...cleaned, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo-mdg", action: "editar", description: `Censo MDG - ${data.apellidos_nombres}`, details: { id } })
    return data
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("censo_mdg").select("apellidos_nombres,cedula").eq("id", id).single()
    const { error } = await supabase.from("censo_mdg").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo-mdg", action: "eliminar", description: `Censo MDG - ${data?.apellidos_nombres}`, details: { id, cedula: data?.cedula } })
  },

  async search(query: string): Promise<CensoRecord[]> {
    const { data, error } = await supabase
      .from("censo_mdg")
      .select("*")
      .or(`cedula.ilike.%${query}%,apellidos_nombres.ilike.%${query}%`)
      .order("apellidos_nombres", { ascending: true })
    if (error) throw error
    return data || []
  },

  // Usa los mismos catálogos que el censo principal
  async getCatalogOptions(tipo: string): Promise<CatalogOption[]> {
    const { data, error } = await supabase
      .from("censo_catalogos")
      .select("*")
      .eq("tipo", tipo)
      .eq("activo", true)
      .order("valor", { ascending: true })
    if (error) throw error
    return data || []
  },

  async getAllCatalogOptions(): Promise<CatalogOption[]> {
    const { data, error } = await supabase
      .from("censo_catalogos")
      .select("*")
      .eq("activo", true)
      .order("tipo, valor", { ascending: true })
    if (error) throw error
    return data || []
  },

  async getConfiguraciones(): Promise<ConfiguracionesGlobales | null> {
    const { data, error } = await supabase
      .from("configuraciones_globales")
      .select("*")
      .limit(1)
      .single()
    if (error) throw error
    return data
  },
}
