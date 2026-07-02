"use server"

import bcrypt from "bcryptjs"
import { supabase } from "./supabase"

export interface AuthUser {
  id: string
  username: string
  displayName: string
  accountType: "personal" | "ministerio"
  email?: string
  ministerioName?: string
  cedula?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

// Función para hacer login
export async function login(
  credentials: LoginCredentials,
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    // Buscar usuario por username
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", credentials.username)
      .eq("is_active", true)
      .single()

    if (error || !user) {
      return { success: false, error: "Usuario o contraseña incorrectos" }
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash)

    if (!passwordMatch) {
      return { success: false, error: "Usuario o contraseña incorrectos" }
    }

    // Registrar sesión
    await supabase.from("user_sessions").insert({
      user_id: user.id,
      login_at: new Date().toISOString(),
    })

    // Retornar datos del usuario
    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      accountType: user.account_type,
      email: user.email,
      ministerioName: user.ministerio_name,
      cedula: user.cedula,
    }

    return { success: true, user: authUser }
  } catch (error) {
    console.error("Error en login:", error)
    return { success: false, error: "Error al iniciar sesión" }
  }
}

// Función para obtener permisos del usuario con información del módulo y grupo
export async function getUserPermissions(userId: string) {
  try {
    const { data, error } = await supabase
      .from("user_permissions")
      .select(`
        can_view,
        can_edit,
        module:system_modules(
          id,
          name,
          display_name,
          description,
          icon,
          route,
          requires_active_month,
          is_active,
          group_id,
          group:module_groups(
            id,
            name,
            display_name,
            icon,
            image,
            sort_order
          )
        )
      `)
      .eq("user_id", userId)
      .eq("can_view", true)

    if (error) throw error

    return data || []
  } catch (error) {
    console.error("Error obteniendo permisos:", error)
    return []
  }
}

// Función para verificar si un usuario tiene acceso de vista a un módulo
export async function hasModuleAccess(userId: string, moduleName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_permissions")
      .select(`
        can_view,
        module:system_modules!inner(name)
      `)
      .eq("user_id", userId)
      .eq("system_modules.name", moduleName)
      .single()

    if (error || !data) return false

    return data.can_view
  } catch (error) {
    console.error("Error verificando acceso:", error)
    return false
  }
}

// Verificar permiso de vista (acceso al módulo)
export async function checkUserPermission(
  userId: string,
  moduleName: string,
): Promise<{ success: boolean; hasPermission: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("user_permissions")
      .select(
        `
        can_view,
        module:system_modules!inner(name)
      `,
      )
      .eq("user_id", userId)
      .eq("system_modules.name", moduleName)
      .single()

    if (error) {
      console.log("No se encontró permiso para", moduleName, "error:", error.message)
      return { success: true, hasPermission: false }
    }

    return { success: true, hasPermission: data?.can_view || false }
  } catch (error) {
    console.error("Error verificando permiso:", error)
    return { success: false, hasPermission: false, error: "Error al verificar permisos" }
  }
}

// Verificar permiso completo (vista Y edición) de un módulo
export async function checkUserEditPermission(
  userId: string,
  moduleName: string,
): Promise<{ success: boolean; canView: boolean; canEdit: boolean; canAdmin: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("user_permissions")
      .select(
        `
        can_view,
        can_edit,
        can_admin,
        module:system_modules!inner(name)
      `,
      )
      .eq("user_id", userId)
      .eq("system_modules.name", moduleName)
      .single()

    if (error) {
      console.log("No se encontró permiso para", moduleName, "error:", error.message)
      return { success: true, canView: false, canEdit: false, canAdmin: false }
    }

    return {
      success: true,
      canView: data?.can_view || false,
      canEdit: data?.can_edit || false,
      canAdmin: data?.can_admin || false,
    }
  } catch (error) {
    console.error("Error verificando permiso de edición:", error)
    return { success: false, canView: false, canEdit: false, canAdmin: false, error: "Error al verificar permisos" }
  }
}