import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "@/lib/mod/audit-service"

export interface HijoData {
  nombre: string
  edad: string
}

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
  tiene_discapacidad?: boolean
  porcentaje?: number
  tipo_discapacidad?: string
  celular?: string
  convencional?: string
  familiar?: string
  familiar_nombre?: string
  conyuge?: string
  cedula_conyugue?: string
  correo?: string
  nivel_estudio?: string
  curso?: string
  direccion?: string
  ciudad?: string
  parroquia?: string
  barrio?: string
  // Hijos
  tiene_hijos?: boolean
  hijos?: HijoData[]
  // Datos Iglesia / Trabajo
  jornada_trabajo?: string
  cargo?: string
  lugar_trabajo?: string
  // Discipulado
  discipulado_irdd?: boolean
  primeros_pasos?: boolean
  seguimos_avanzando?: boolean
  siendo_iglesia?: boolean
  // Bautizo IRDD
  bautizo_irdd?: boolean
  fecha_bautizo?: string
  // Matrimonio IRDD
  matrimonio_irdd?: boolean
  fecha_matrimonio?: string
  hora_matrimonio?: string
  oficio_matrimonio?: string
  padrino1_matrimonio?: string
  padrino2_matrimonio?: string
  // Membresía
  miembro?: boolean
  miembro_activo?: boolean
  // Servicio
  sirve_iglesia?: boolean
  ministerio?: string
  ministerios_list?: string[]
  cargo_ministerio?: string
  // Seminarios
  seminarios?: string[]
  // Proyecto Mario
  proyecto_mario?: boolean
  proyecto_mario_detalle?: string
  // Célula
  celula_asiste?: boolean
  celula_nombre?: string
  // Nuevo creyente (usado en censo MDG)
  nuevo_creyente?: boolean
  // Timestamps
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

export interface ConfiguracionesGlobales {
  id: number
  ministerios: string[]
  cargos_ministerio: string[]
  ubicaciones: string[]
  estados: string[]
  categorias_principales: string[]
  detalles: string[]
}

/**
 * Limpia el objeto de datos antes de enviarlo a Supabase:
 * - Elimina campos internos (id, created_at)
 * - Convierte strings vacíos a null
 * - Elimina campos con valor undefined
 * - Convierte 0 a null en campos numéricos opcionales
 */
function cleanRecordForInsert(record: Partial<CensoRecord>): Record<string, any> {
  const { id, created_at, updated_at, fecha_nacimiento_display, fecha_bautizo_display, fecha_matrimonio_display, ...rest } = record as any
  const cleaned: Record<string, any> = {}

  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue
    if (value === "") {
      cleaned[key] = null
    } else {
      cleaned[key] = value
    }
  }

  // Campos numéricos opcionales: si son 0 y no fueron llenados, dejar null
  if (cleaned.edad === 0) cleaned.edad = null
  if (cleaned.porcentaje === 0) cleaned.porcentaje = null

  return cleaned
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
    const cleaned = cleanRecordForInsert(record)
    const { data, error } = await supabase
      .from("censo")
      .insert([{ ...cleaned, updated_at: new Date().toISOString() }])
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo", action: "crear", description: `Censo - ${data.apellidos_nombres}`, details: { cedula: record.cedula, nombre: record.apellidos_nombres, cargo: record.cargo, celular: record.celular, estado_civil: record.estado_civil } })
    return data
  },

  async update(id: number, record: Partial<CensoRecord>, audit?: AuditInfo): Promise<CensoRecord> {
    const cleaned = cleanRecordForInsert(record)
    const { data: antes } = audit ? await supabase.from("censo").select("apellidos_nombres,cedula,cargo,celular,estado_civil").eq("id", id).single() : { data: null }
    const { data, error } = await supabase
      .from("censo")
      .update({ ...cleaned, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo", action: "editar", description: `Censo - ${data.apellidos_nombres}`, details: { antes, despues: { apellidos_nombres: data.apellidos_nombres, cedula: data.cedula, cargo: data.cargo, celular: data.celular, estado_civil: data.estado_civil } } })
    return data
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("censo").select("apellidos_nombres,cedula,cargo").eq("id", id).single()
    const { error } = await supabase.from("censo").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "censo", action: "eliminar", description: `Censo - ${data?.apellidos_nombres} (${data?.cedula})`, details: { id, cedula: data?.cedula, nombre: data?.apellidos_nombres, cargo: data?.cargo } })
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

  // Configuraciones globales (ministerios, cargos, etc.)
  async getConfiguraciones(): Promise<ConfiguracionesGlobales | null> {
    const { data, error } = await supabase
      .from("configuraciones_globales")
      .select("*")
      .limit(1)
      .single()

    if (error) throw error
    return data
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
