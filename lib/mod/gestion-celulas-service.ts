import { supabase } from "@/lib/secure-db"
import { nowEcuador } from "../timezone"

export interface GestionCelula {
  id: number
  miembro_id: number
  fuente: "protocolo" | "mdg"
  celula_nombre: string
  semana_inicio: string
  gestionado: boolean
  respuesta: string | null
  asistio: boolean | null
  gestionado_por: string | null
  gestionado_por_nombre: string | null
  created_at: string
  updated_at: string
}

/**
 * Obtiene el lunes de la semana actual (zona Ecuador).
 * La semana de gestión va de lunes a domingo.
 */
export function getLunesSemanaActual(): string {
  const now = nowEcuador()
  const day = now.getDay() // 0=dom, 1=lun, ...
  const diff = day === 0 ? -6 : 1 - day // si es domingo, retroceder 6 días
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, "0")
  const d = String(monday.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Verifica si ya se gestionó a un miembro esta semana
 */
export async function yaGestionadoEstaSemana(
  miembroId: number,
  fuente: "protocolo" | "mdg"
): Promise<boolean> {
  const semana = getLunesSemanaActual()
  const { data } = await supabase
    .from("gestion_celulas")
    .select("id")
    .eq("miembro_id", miembroId)
    .eq("fuente", fuente)
    .eq("semana_inicio", semana)
    .maybeSingle()
  return !!data
}

/**
 * Registra gestión de un miembro para la semana actual
 */
export async function registrarGestion(params: {
  miembroId: number
  fuente: "protocolo" | "mdg"
  celulaNombre: string
  gestionado: boolean
  respuesta: string
  asistio: boolean
  userId: string
  userName: string
}): Promise<{ success: boolean; error?: string }> {
  const semana = getLunesSemanaActual()

  // Verificar si ya existe
  const yaExiste = await yaGestionadoEstaSemana(params.miembroId, params.fuente)
  if (yaExiste) {
    return { success: false, error: "Este miembro ya fue gestionado esta semana" }
  }

  const { error } = await supabase.from("gestion_celulas").insert({
    miembro_id: params.miembroId,
    fuente: params.fuente,
    celula_nombre: params.celulaNombre,
    semana_inicio: semana,
    gestionado: params.gestionado,
    respuesta: params.respuesta || null,
    asistio: params.asistio,
    gestionado_por: params.userId,
    gestionado_por_nombre: params.userName,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Editar una gestión existente
 */
export async function editarGestion(
  id: number,
  updates: { gestionado: boolean; respuesta: string; asistio: boolean }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("gestion_celulas")
    .update({
      gestionado: updates.gestionado,
      respuesta: updates.respuesta,
      asistio: updates.asistio,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Obtener historial de gestiones de un miembro
 */
export async function getHistorialGestiones(
  miembroId: number,
  fuente: "protocolo" | "mdg"
): Promise<GestionCelula[]> {
  const { data, error } = await supabase
    .from("gestion_celulas")
    .select("*")
    .eq("miembro_id", miembroId)
    .eq("fuente", fuente)
    .order("semana_inicio", { ascending: false })
    .limit(20)

  if (error) return []
  return data || []
}

/**
 * Obtener estado de gestión de la semana actual para múltiples miembros
 */
export async function getGestionesSemanaActual(
  celulaNombre: string
): Promise<GestionCelula[]> {
  const semana = getLunesSemanaActual()
  const { data, error } = await supabase
    .from("gestion_celulas")
    .select("*")
    .eq("celula_nombre", celulaNombre)
    .eq("semana_inicio", semana)

  if (error) return []
  return data || []
}
