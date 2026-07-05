import { supabase } from "../supabase"
import { nowEcuador, currentMonthEcuador, currentYearEcuador } from "../timezone"

export interface OfrendaCelula {
  id: number
  celula_nombre: string
  fecha: string
  mes: number
  anio: number
  valor: number
  recibido: boolean
  recibido_por: string | null
  recibido_por_nombre: string | null
  recibido_at: string | null
  registrado_por: string | null
  registrado_por_nombre: string | null
  created_at: string
  updated_at: string
}

/**
 * Obtiene todos los jueves de un mes/año dado.
 */
export function getJuevesDelMes(year: number, month: number): string[] {
  const jueves: string[] = []
  const date = new Date(year, month - 1, 1)

  // Avanzar al primer jueves
  while (date.getDay() !== 4) {
    date.setDate(date.getDate() + 1)
  }

  // Recoger todos los jueves del mes
  while (date.getMonth() === month - 1) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    jueves.push(`${y}-${m}-${d}`)
    date.setDate(date.getDate() + 7)
  }

  return jueves
}

/**
 * Determina el mes/año actual para ofrendas.
 * Si es sábado de la última semana del mes, avanza al siguiente mes.
 */
export function getMesOfrendaActual(): { mes: number; anio: number } {
  const now = nowEcuador()
  let mes = now.getMonth() + 1
  let anio = now.getFullYear()

  // Verificar si es sábado de la última semana
  if (now.getDay() === 6) { // Sábado
    const lastDay = new Date(anio, mes, 0).getDate()
    if (now.getDate() > lastDay - 7) {
      // Última semana del mes → avanzar
      mes++
      if (mes > 12) { mes = 1; anio++ }
    }
  }

  return { mes, anio }
}


/**
 * Obtener ofrendas de una célula para un mes/año
 */
export async function getOfrendasCelula(celula: string, mes: number, anio: number): Promise<OfrendaCelula[]> {
  const { data, error } = await supabase
    .from("ofrendas_celulas")
    .select("*")
    .eq("celula_nombre", celula)
    .eq("mes", mes)
    .eq("anio", anio)
    .order("fecha", { ascending: true })

  if (error) return []
  return data || []
}

/**
 * Obtener ofrendas de TODAS las células para un mes/año (resumen)
 */
export async function getTodasOfrendasMes(mes: number, anio: number): Promise<OfrendaCelula[]> {
  const { data, error } = await supabase
    .from("ofrendas_celulas")
    .select("*")
    .eq("mes", mes)
    .eq("anio", anio)
    .order("celula_nombre", { ascending: true })

  if (error) return []
  return data || []
}

/**
 * Registrar o actualizar ofrenda de un jueves
 */
export async function upsertOfrenda(params: {
  celula: string
  fecha: string
  mes: number
  anio: number
  valor: number
  userId: string
  userName: string
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("ofrendas_celulas")
    .upsert({
      celula_nombre: params.celula,
      fecha: params.fecha,
      mes: params.mes,
      anio: params.anio,
      valor: params.valor,
      registrado_por: params.userId,
      registrado_por_nombre: params.userName,
      updated_at: new Date().toISOString(),
    }, { onConflict: "celula_nombre,fecha" })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Eliminar una ofrenda
 */
export async function eliminarOfrenda(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("ofrendas_celulas")
    .delete()
    .eq("id", id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Obtener historial de ofrendas de una célula (últimos 6 meses)
 */
export async function getHistorialOfrendas(celula: string): Promise<OfrendaCelula[]> {
  const { data, error } = await supabase
    .from("ofrendas_celulas")
    .select("*")
    .eq("celula_nombre", celula)
    .order("fecha", { ascending: false })
    .limit(30)

  if (error) return []
  return data || []
}



/**
 * Marcar/desmarcar una ofrenda como recibida
 */
export async function toggleRecibido(params: {
  id: number
  recibido: boolean
  userId: string
  userName: string
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("ofrendas_celulas")
    .update({
      recibido: params.recibido,
      recibido_por: params.recibido ? params.userId : null,
      recibido_por_nombre: params.recibido ? params.userName : null,
      recibido_at: params.recibido ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
