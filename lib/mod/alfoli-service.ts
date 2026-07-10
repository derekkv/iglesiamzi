import { supabase } from "@/lib/secure-db"
import { nowEcuador } from "../timezone"
import { auditService } from "./audit-service"

export interface AlfoliRecord {
  id: number
  fecha: string
  mes: number
  anio: number
  tipo: "domingo" | "mdg"
  valor: number
  recibido: boolean
  recibido_por: string | null
  recibido_por_nombre: string | null
  recibido_at: string | null
  registrado_por: string | null
  registrado_por_nombre: string | null
  created_at: string
}

/**
 * Obtiene todos los domingos de un mes/año
 */
export function getDomingosDelMes(year: number, month: number): string[] {
  const domingos: string[] = []
  const date = new Date(year, month - 1, 1)
  while (date.getDay() !== 0) date.setDate(date.getDate() + 1)
  while (date.getMonth() === month - 1) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    domingos.push(`${y}-${m}-${d}`)
    date.setDate(date.getDate() + 7)
  }
  return domingos
}

/**
 * Obtener registros de alfolí para un mes/año
 */
export async function getAlfoliMes(mes: number, anio: number): Promise<AlfoliRecord[]> {
  const { data, error } = await supabase
    .from("alfoli")
    .select("*")
    .eq("mes", mes)
    .eq("anio", anio)
    .order("fecha", { ascending: true })
  if (error) return []
  return data || []
}


/**
 * Registrar o actualizar valor de alfolí
 */
export async function upsertAlfoli(params: {
  fecha: string
  mes: number
  anio: number
  tipo: "domingo" | "mdg"
  valor: number
  userId: string
  userName: string
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("alfoli")
    .upsert({
      fecha: params.fecha,
      mes: params.mes,
      anio: params.anio,
      tipo: params.tipo,
      valor: params.valor,
      registrado_por: params.userId,
      registrado_por_nombre: params.userName,
      updated_at: new Date().toISOString(),
    }, { onConflict: "fecha,tipo" })
  if (error) return { success: false, error: error.message }
  auditService.log({ user_id: params.userId, user_name: params.userName, module: "ofrenda-celulas", action: "crear", description: `Alfolí ${params.tipo}: $${params.valor} (${params.fecha})`, details: { fecha: params.fecha, tipo: params.tipo, valor: params.valor } })
  return { success: true }
}

/**
 * Eliminar un registro de alfolí
 */
export async function eliminarAlfoli(id: number): Promise<{ success: boolean; error?: string }> {
  const { data } = await supabase.from("alfoli").select("fecha, tipo, valor").eq("id", id).single()
  const { error } = await supabase.from("alfoli").delete().eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Toggle recibido en alfolí
 */
export async function toggleAlfoliRecibido(params: {
  id: number
  recibido: boolean
  userId: string
  userName: string
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("alfoli")
    .update({
      recibido: params.recibido,
      recibido_por: params.recibido ? params.userId : null,
      recibido_por_nombre: params.recibido ? params.userName : null,
      recibido_at: params.recibido ? new Date().toISOString() : null,
    })
    .eq("id", params.id)
  if (error) return { success: false, error: error.message }
  auditService.log({ user_id: params.userId, user_name: params.userName, module: "ofrenda-celulas", action: "editar", description: `Alfolí ${params.recibido ? "recibido" : "desmarcado"} (ID: ${params.id})`, details: { id: params.id, recibido: params.recibido } })
  return { success: true }
}

/**
 * Historial completo de alfolí (últimos 6 meses)
 */
export async function getAlfoliHistorial(): Promise<AlfoliRecord[]> {
  const { data, error } = await supabase
    .from("alfoli")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(50)
  if (error) return []
  return data || []
}
