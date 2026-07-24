import { supabase } from "@/lib/secure-db"

export interface ValidacionCedulaResult {
  existe: boolean
  tabla: string | null
  nombre: string | null
}

/**
 * Valida si una cédula ya existe en alguno de los censos (protocolo, MDG, jóvenes).
 * Permite excluir un registro específico (para edición).
 * 
 * @param cedula - Número de cédula a validar
 * @param excluirTabla - Tabla de origen (para saber cuál es "la misma tabla")
 * @param excluirId - ID del registro a excluir (para no detectarse a sí mismo al editar)
 */
export async function validarCedulaEnCensos(
  cedula: string,
  excluirTabla?: "censo" | "censo_mdg" | "censo_jovenes",
  excluirId?: number
): Promise<ValidacionCedulaResult> {
  if (!cedula || cedula.trim().length === 0) {
    return { existe: false, tabla: null, nombre: null }
  }

  const cedulaLimpia = cedula.trim()

  // Buscar en censo protocolo
  {
    let query = supabase
      .from("censo")
      .select("id, cedula, apellidos_nombres")
      .eq("cedula", cedulaLimpia)

    // Si estamos editando en esta misma tabla, excluir el registro actual
    if (excluirTabla === "censo" && excluirId) {
      query = query.neq("id", excluirId)
    }

    const { data } = await query.limit(1)
    if (data && data.length > 0) {
      return { existe: true, tabla: "Censo Protocolo", nombre: data[0].apellidos_nombres }
    }
  }

  // Buscar en censo MDG
  {
    let query = supabase
      .from("censo_mdg")
      .select("id, cedula, apellidos_nombres")
      .eq("cedula", cedulaLimpia)

    if (excluirTabla === "censo_mdg" && excluirId) {
      query = query.neq("id", excluirId)
    }

    const { data } = await query.limit(1)
    if (data && data.length > 0) {
      return { existe: true, tabla: "Nuevos creyentes", nombre: data[0].apellidos_nombres }
    }
  }

  // Buscar en censo jóvenes
  {
    let query = supabase
      .from("censo_jovenes")
      .select("id, cedula, apellidos_nombres")
      .eq("cedula", cedulaLimpia)

    if (excluirTabla === "censo_jovenes" && excluirId) {
      query = query.neq("id", excluirId)
    }

    const { data } = await query.limit(1)
    if (data && data.length > 0) {
      return { existe: true, tabla: "Censo Jóvenes", nombre: data[0].apellidos_nombres }
    }
  }

  return { existe: false, tabla: null, nombre: null }
}
