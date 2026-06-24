import { supabase } from "@/lib/supabase"
import { auditService, type AuditInfo } from "@/lib/mod/audit-service"

export interface CensoRecord {
  id?: number
  // Datos Personales
  cedula: string
  apellidos_nombres: string
  fecha_nacimiento?: string
  edad?: number
  si_a_cristo?: string
  bautizo?: string
  tipo_sangre?: string
  estado_civil?: string
  sexo?: string
  capacidad_esp?: string
  porcentaje?: number
  tipo_discapacidad?: string
  celular?: string
  convencional?: string
  familiar?: string
  conyuge?: string
  correo?: string
  nivel_estudio?: string
  curso?: string
  acumula_decimos?: string
  hoja_vida?: string
  estado?: string
  fecha_registro_saite?: string
  fecha_registro_iess?: string
  direccion?: string
  ciudad?: string
  parroquia?: string
  barrio?: string
  // Datos Iglesia
  jornada_trabajo?: string
  cargo?: string
  local?: string
  fecha_ingreso?: string
  fecha_reingreso?: string
  fecha_salida?: string
  dias_por_mes?: number
  horas_diarias?: number
  horas_semanal?: number
  sueldo?: number
  pagos?: string
  banco?: string
  numero_cuenta?: string
  interseccion?: string
  redil?: string
  ninos?: string
  otros?: string
  created_at?: string
  updated_at?: string
}

export interface CatalogOption {
  id?: number
  tipo: string
  valor: string
  activo?: boolean
  created_at?: string
  updated_at?: string
}

export const censoService = {
  // CRUD para registros de censo
  async getAll(): Promise<CensoRecord[]> {
    const { data, error } = await supabase.from("censo").select("*").order("apellidos_nombres", { ascending: true })

    if (error) throw error
    return data || []
  },

  async getById(id: number): Promise<CensoRecord | null> {
    const { data, error } = await supabase.from("censo").select("*").eq("id", id).single()

    if (error) throw error
    return data
  },

  async create(record: CensoRecord, audit?: AuditInfo): Promise<CensoRecord> {
    const { data, error } = await supabase
      .from("censo")
      .insert([{ ...record, updated_at: new Date().toISOString() }])
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo", action: "crear", description: `Censo - ${data.apellidos_nombres}`, details: { cedula: record.cedula, nombre: record.apellidos_nombres, cargo: record.cargo, local: record.local, celular: record.celular, estado_civil: record.estado_civil } })
    return data
  },

  async update(id: number, record: Partial<CensoRecord>, audit?: AuditInfo): Promise<CensoRecord> {
    const { data: antes } = audit ? await supabase.from("censo").select("apellidos_nombres,cedula,cargo,local,celular,estado_civil").eq("id", id).single() : { data: null }
    const { data, error } = await supabase
      .from("censo")
      .update({ ...record, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo", action: "editar", description: `Censo - ${data.apellidos_nombres}`, details: { antes, despues: { apellidos_nombres: data.apellidos_nombres, cedula: data.cedula, cargo: data.cargo, local: data.local, celular: data.celular, estado_civil: data.estado_civil } } })
    return data
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("censo").select("apellidos_nombres,cedula,cargo,local").eq("id", id).single()
    const { error } = await supabase.from("censo").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo", action: "eliminar", description: `Censo - ${data?.apellidos_nombres} (${data?.cedula})`, details: { id, cedula: data?.cedula, nombre: data?.apellidos_nombres, cargo: data?.cargo, local: data?.local } })
  },

  async search(query: string): Promise<CensoRecord[]> {
    const { data, error } = await supabase
      .from("censo")
      .select("*")
      .or(
        `cedula.ilike.%${query}%,apellidos_nombres.ilike.%${query}%,parroquia.ilike.%${query}%,barrio.ilike.%${query}%`,
      )
      .order("apellidos_nombres", { ascending: true })

    if (error) throw error
    return data || []
  },

  // CRUD para catálogos (opciones de selects)
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

  async createCatalogOption(option: CatalogOption): Promise<CatalogOption> {
    const { data, error } = await supabase.from("censo_catalogos").insert([option]).select().single()

    if (error) throw error
    return data
  },

  async updateCatalogOption(id: number, option: Partial<CatalogOption>): Promise<CatalogOption> {
    const { data, error } = await supabase
      .from("censo_catalogos")
      .update({ ...option, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteCatalogOption(id: number): Promise<void> {
    const { error } = await supabase.from("censo_catalogos").update({ activo: false }).eq("id", id)

    if (error) throw error
  },
}
