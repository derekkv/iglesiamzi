import { supabase } from "@/lib/secure-db"
import { auditService } from "./audit-service"

export interface CensoNinoRecord {
  id?: number
  nombre: string
  fecha_nacimiento?: string | null
  edad?: number | null
  grupo?: string | null
  nombre_madre?: string | null
  telefono_madre?: string | null
  nombre_padre?: string | null
  telefono_padre?: string | null
  alergias?: string | null
  observaciones?: string | null
  created_at?: string
  updated_at?: string
}

export interface CensoNinoInput {
  nombre: string
  fecha_nacimiento?: string | null
  edad?: number | null
  grupo?: string | null
  nombre_madre?: string | null
  telefono_madre?: string | null
  nombre_padre?: string | null
  telefono_padre?: string | null
  alergias?: string | null
  observaciones?: string | null
}

/**
 * Calcula la edad a partir de una fecha de nacimiento (formato YYYY-MM-DD).
 */
export function calcularEdadDesdeNacimiento(fechaNacimiento: string): number | null {
  if (!fechaNacimiento) return null
  const birth = new Date(fechaNacimiento + "T12:00:00")
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 ? age : null
}

/**
 * Limpia el objeto antes de enviarlo a Supabase.
 */
function cleanRecordForInsert(record: Partial<CensoNinoRecord>): Record<string, any> {
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

  return cleaned
}

export const censoNinosService = {
  async getAll(): Promise<CensoNinoRecord[]> {
    const { data, error } = await supabase
      .from("censo_ninos")
      .select("*")
      .order("nombre", { ascending: true })

    if (error) throw error
    return data || []
  },

  async getById(id: number): Promise<CensoNinoRecord | null> {
    const { data, error } = await supabase
      .from("censo_ninos")
      .select("*")
      .eq("id", id)
      .single()

    if (error) throw error
    return data
  },

  async create(
    input: CensoNinoInput,
    audit?: { userId: string; userName: string }
  ): Promise<CensoNinoRecord> {
    const cleaned = cleanRecordForInsert(input)

    // Recalcular edad si hay fecha de nacimiento
    if (cleaned.fecha_nacimiento) {
      cleaned.edad = calcularEdadDesdeNacimiento(cleaned.fecha_nacimiento)
    }

    const { data, error } = await supabase
      .from("censo_ninos")
      .insert({ ...cleaned, updated_at: new Date().toISOString() })
      .select()
      .single()

    if (error) throw error

    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "censo-ninos",
        action: "crear",
        description: `Censo Niños - ${data.nombre}`,
        details: {
          nombre: data.nombre,
          grupo: data.grupo,
          madre: data.nombre_madre,
          padre: data.nombre_padre,
        },
      })
    }

    return data
  },

  async update(
    id: number,
    input: Partial<CensoNinoInput>,
    audit?: { userId: string; userName: string }
  ): Promise<CensoNinoRecord> {
    const cleaned = cleanRecordForInsert(input)

    // Recalcular edad si hay fecha de nacimiento
    if (cleaned.fecha_nacimiento) {
      cleaned.edad = calcularEdadDesdeNacimiento(cleaned.fecha_nacimiento)
    }

    cleaned.updated_at = new Date().toISOString()

    // Obtener datos antes de la edición para audit completo
    const { data: antes } = audit
      ? await supabase.from("censo_ninos").select("nombre, fecha_nacimiento, edad, grupo, nombre_madre, telefono_madre, nombre_padre, telefono_padre, alergias, observaciones").eq("id", id).single()
      : { data: null }

    const { data, error } = await supabase
      .from("censo_ninos")
      .update(cleaned)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "censo-ninos",
        action: "editar",
        description: `Censo Niños editado - ${data.nombre}`,
        details: {
          id,
          antes: antes || {},
          despues: {
            nombre: data.nombre,
            fecha_nacimiento: data.fecha_nacimiento,
            edad: data.edad,
            grupo: data.grupo,
            nombre_madre: data.nombre_madre,
            telefono_madre: data.telefono_madre,
            nombre_padre: data.nombre_padre,
            telefono_padre: data.telefono_padre,
            alergias: data.alergias,
            observaciones: data.observaciones,
          },
        },
      })
    }

    return data
  },

  async delete(
    id: number,
    audit?: { userId: string; userName: string }
  ): Promise<void> {
    const { data: antes } = await supabase
      .from("censo_ninos")
      .select("nombre, grupo")
      .eq("id", id)
      .single()

    const { error } = await supabase
      .from("censo_ninos")
      .delete()
      .eq("id", id)

    if (error) throw error

    if (audit && antes) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "censo-ninos",
        action: "eliminar",
        description: `Censo Niños eliminado - ${antes.nombre}`,
        details: { id, nombre: antes.nombre, grupo: antes.grupo },
      })
    }
  },
}
