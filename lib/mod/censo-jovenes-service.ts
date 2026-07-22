import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "@/lib/mod/audit-service"
import type { CensoRecord, CatalogOption, HijoData, ConfiguracionesGlobales } from "@/lib/mod/censo-service"
import { calcularEdadDesdeNacimiento } from "@/lib/mod/censo-ninos-service"

// Re-export types
export type { CensoRecord, CatalogOption, HijoData, ConfiguracionesGlobales }

function cleanRecordForInsert(record: Partial<CensoRecord>): Record<string, any> {
  const { id, created_at, updated_at, fecha_nacimiento_display, fecha_bautizo_display, fecha_matrimonio_display, fecha_primera_vez_display, ...rest } = record as any
  const cleaned: Record<string, any> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue
    if (key.endsWith("_display")) continue
    if (value === "") { cleaned[key] = null } else { cleaned[key] = value }
  }
  if (cleaned.edad === 0) cleaned.edad = null
  if (cleaned.porcentaje === 0) cleaned.porcentaje = null
  return cleaned
}

export const censoJovenesService = {
  async getAll(): Promise<CensoRecord[]> {
    const { data, error } = await supabase.from("censo_jovenes").select("*").order("apellidos_nombres", { ascending: true })
    if (error) throw error
    if (data) {
      for (const r of data) {
        if (r.fecha_nacimiento) r.edad = calcularEdadDesdeNacimiento(r.fecha_nacimiento)
      }
    }
    return data || []
  },

  async getById(id: number): Promise<CensoRecord | null> {
    const { data, error } = await supabase.from("censo_jovenes").select("*").eq("id", id).single()
    if (error) throw error
    if (data && data.fecha_nacimiento) data.edad = calcularEdadDesdeNacimiento(data.fecha_nacimiento)
    return data
  },

  async create(record: CensoRecord, audit?: AuditInfo): Promise<CensoRecord> {
    const cleaned = cleanRecordForInsert(record)
    const { data, error } = await supabase.from("censo_jovenes").insert([{ ...cleaned, updated_at: new Date().toISOString() }]).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo-jovenes", action: "crear", description: `Censo Jóvenes - ${data.apellidos_nombres}`, details: { cedula: record.cedula, nombre: record.apellidos_nombres } })
    return data
  },

  async update(id: number, record: Partial<CensoRecord>, audit?: AuditInfo): Promise<CensoRecord> {
    const cleaned = cleanRecordForInsert(record)
    const { data, error } = await supabase.from("censo_jovenes").update({ ...cleaned, updated_at: new Date().toISOString() }).eq("id", id).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo-jovenes", action: "editar", description: `Censo Jóvenes - ${data.apellidos_nombres}`, details: { id } })
    return data
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("censo_jovenes").select("apellidos_nombres,cedula").eq("id", id).single()
    const { error } = await supabase.from("censo_jovenes").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo-jovenes", action: "eliminar", description: `Censo Jóvenes - ${data?.apellidos_nombres}`, details: { id, cedula: data?.cedula } })
  },

  async search(query: string): Promise<CensoRecord[]> {
    const { data, error } = await supabase.from("censo_jovenes").select("*").or(`cedula.ilike.%${query}%,apellidos_nombres.ilike.%${query}%`).order("apellidos_nombres", { ascending: true })
    if (error) throw error
    return data || []
  },

  async getCatalogOptions(tipo: string): Promise<CatalogOption[]> {
    const { data, error } = await supabase.from("censo_catalogos").select("*").eq("tipo", tipo).eq("activo", true).order("valor", { ascending: true })
    if (error) throw error
    return data || []
  },

  async getAllCatalogOptions(): Promise<CatalogOption[]> {
    const { data, error } = await supabase.from("censo_catalogos").select("*").eq("activo", true).order("tipo, valor", { ascending: true })
    if (error) throw error
    return data || []
  },

  async getConfiguraciones(): Promise<ConfiguracionesGlobales | null> {
    const { data, error } = await supabase.from("configuraciones_globales").select("*").limit(1).single()
    if (error) throw error
    return data
  },
}
