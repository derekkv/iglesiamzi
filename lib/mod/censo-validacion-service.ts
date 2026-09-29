import { supabase } from "@/lib/secure-db"

export interface CoincidenciaCedula {
  tablaKey: "censo" | "censo_mdg" | "censo_jovenes"
  tabla: string
  nombre: string
}

export interface ValidacionCedulaResult {
  existe: boolean
  tabla: string | null
  nombre: string | null
  /** Todas las tablas donde se encontró la cédula (respetando la exclusión). */
  coincidencias: CoincidenciaCedula[]
}

/**
 * Valida si una cédula ya existe en alguno de los censos (protocolo, MDG, jóvenes).
 * Permite excluir un registro específico (para edición).
 *
 * Devuelve TODAS las coincidencias en `coincidencias` (con su tabla), para que el
 * llamador decida: bloquear solo si es la MISMA tabla (duplicado real) o solo
 * informar si está en otro censo. Mantiene `existe/tabla/nombre` (primera
 * coincidencia) por compatibilidad con llamadores previos.
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
  const vacio: ValidacionCedulaResult = { existe: false, tabla: null, nombre: null, coincidencias: [] }
  if (!cedula || cedula.trim().length === 0) return vacio

  const cedulaLimpia = cedula.trim()
  const coincidencias: CoincidenciaCedula[] = []

  const fuentes: { key: CoincidenciaCedula["tablaKey"]; label: string }[] = [
    { key: "censo", label: "Censo Protocolo" },
    { key: "censo_mdg", label: "Nuevos creyentes" },
    { key: "censo_jovenes", label: "Censo Jóvenes" },
  ]

  for (const { key, label } of fuentes) {
    let query = supabase.from(key).select("id, cedula, apellidos_nombres").eq("cedula", cedulaLimpia)
    if (excluirTabla === key && excluirId) query = query.neq("id", excluirId)
    const { data } = await query.limit(1)
    if (data && data.length > 0) {
      coincidencias.push({ tablaKey: key, tabla: label, nombre: data[0].apellidos_nombres })
    }
  }

  if (coincidencias.length === 0) return vacio
  return { existe: true, tabla: coincidencias[0].tabla, nombre: coincidencias[0].nombre, coincidencias }
}
