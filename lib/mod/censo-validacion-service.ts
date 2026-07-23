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
 * @param excluirTabla - Tabla a excluir de la búsqueda (ej: "censo" cuando se edita en censo protocolo)
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
  if (excluirTabla !== "censo") {
    const { data } = await supabase
      .from("censo")
      .select("id, cedula, apellidos_nombres")
      .eq("cedula", cedulaLimpia)
      .limit(1)
    if (data && data.length > 0) {
      return { existe: true, tabla: "Censo Protocolo", nombre: data[0].apellidos_nombres }
    }
  } else if (excluirId) {
    // Buscar en la misma tabla pero excluyendo el registro actual
    const { data } = await supabase
      .from("censo")
      .select("id, cedula, apellidos_nombres")
      .eq("cedula", cedulaLimpia)
      .neq("id", excluirId)
      .limit(1)
    if (data && data.length > 0) {
      return { existe: true, tabla: "Censo Protocolo", nombre: data[0].apellidos_nombres }
    }
  }

  // Buscar en censo MDG
  if (excluirTabla !== "censo_mdg") {
    const { data } = await supabase
      .from("censo_mdg")
      .select("id, cedula, apellidos_nombres")
      .eq("cedula", cedulaLimpia)
      .limit(1)
    if (data && data.length > 0) {
      return { existe: true, tabla: "Censo MDG", nombre: data[0].apellidos_nombres }
    }
  } else if (excluirId) {
    const { data } = await supabase
      .from("censo_mdg")
      .select("id, cedula, apellidos_nombres")
      .eq("cedula", cedulaLimpia)
      .neq("id", excluirId)
      .limit(1)
    if (data && data.length > 0) {
      return { existe: true, tabla: "Censo MDG", nombre: data[0].apellidos_nombres }
    }
  }

  // Buscar en censo jóvenes
  if (excluirTabla !== "censo_jovenes") {
    const { data } = await supabase
      .from("censo_jovenes")
      .select("id, cedula, apellidos_nombres")
      .eq("cedula", cedulaLimpia)
      .limit(1)
    if (data && data.length > 0) {
      return { existe: true, tabla: "Censo Jóvenes", nombre: data[0].apellidos_nombres }
    }
  } else if (excluirId) {
    const { data } = await supabase
      .from("censo_jovenes")
      .select("id, cedula, apellidos_nombres")
      .eq("cedula", cedulaLimpia)
      .neq("id", excluirId)
      .limit(1)
    if (data && data.length > 0) {
      return { existe: true, tabla: "Censo Jóvenes", nombre: data[0].apellidos_nombres }
    }
  }

  return { existe: false, tabla: null, nombre: null }
}
