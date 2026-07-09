"use server"

import { supabaseServer as supabase } from "./supabase-server"

export interface SecurityKey {
  id: string
  key_code: string
  is_used: boolean
  used_at?: string
  used_by?: string
  created_at: string
}

// Generar código aleatorio de 6 caracteres
function generateKeyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Sin caracteres confusos
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Obtener las 3 claves activas
export async function getSecurityKeys() {
  try {
    const { data, error } = await supabase
      .from("security_keys")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3)

    if (error) throw error

    // Si no hay 3 claves, generar las faltantes
    if (!data || data.length < 3) {
      await initializeSecurityKeys()
      return getSecurityKeys()
    }

    return { success: true, keys: data }
  } catch (error) {
    console.error("Error obteniendo claves:", error)
    return { success: false, error: "Error al obtener claves", keys: [] }
  }
}

// Inicializar las 3 claves por primera vez
export async function initializeSecurityKeys() {
  try {
    const keys = [
      { key_code: generateKeyCode(), is_used: false },
      { key_code: generateKeyCode(), is_used: false },
      { key_code: generateKeyCode(), is_used: false },
    ]

    const { error } = await supabase.from("security_keys").insert(keys)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error inicializando claves:", error)
    return { success: false, error: "Error al inicializar claves" }
  }
}

// Validar una clave
export async function validateSecurityKey(keyCode: string, userId: string) {
  try {
    // Buscar la clave
    const { data: key, error: findError } = await supabase
      .from("security_keys")
      .select("*")
      .eq("key_code", keyCode.toUpperCase())
      .eq("is_used", false)
      .single()

    if (findError || !key) {
      return { success: false, error: "Clave inválida o ya utilizada" }
    }

    // Marcar como usada
    const { error: updateError } = await supabase
      .from("security_keys")
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        used_by: userId,
      })
      .eq("id", key.id)

    if (updateError) throw updateError

    // Generar una nueva clave para reemplazar la usada
    const newKey = {
      key_code: generateKeyCode(),
      is_used: false,
    }

    const { error: insertError } = await supabase.from("security_keys").insert(newKey)

    if (insertError) throw insertError

    return { success: true }
  } catch (error) {
    console.error("Error validando clave:", error)
    return { success: false, error: "Error al validar clave" }
  }
}

// Regenerar todas las claves (solo admin)
export async function regenerateAllKeys() {
  try {
    // Marcar todas las claves actuales como usadas
    await supabase.from("security_keys").update({ is_used: true }).eq("is_used", false)

    // Generar 3 nuevas claves
    await initializeSecurityKeys()

    return { success: true }
  } catch (error) {
    console.error("Error regenerando claves:", error)
    return { success: false, error: "Error al regenerar claves" }
  }
}
