"use server"

import bcrypt from "bcryptjs"
import { supabase } from "./supabase"

export interface CreateUserData {
  accountType: "personal" | "ministerio"
  username: string
  password: string
  displayName: string
  email?: string
  phone?: string
  cedula?: string
  ministerioName?: string
  createdBy: string
}

export interface UpdateUserData {
  displayName?: string
  email?: string
  phone?: string
  isActive?: boolean
}

export interface UserPermissionData {
  userId: string
  moduleId: string
  canView: boolean
  canEdit: boolean
  grantedBy: string
}

// Crear nuevo usuario
export async function createUser(userData: CreateUserData) {
  try {
    // Verificar si el username ya existe
    const { data: existing } = await supabase.from("users").select("id").eq("username", userData.username).single()

    if (existing) {
      return { success: false, error: "El nombre de usuario ya existe" }
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(userData.password, 10)

    // Crear usuario
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        account_type: userData.accountType,
        username: userData.username,
        password_hash: passwordHash,
        displayName: userData.displayName,
        email: userData.email,
        phone: userData.phone,
        cedula: userData.cedula,
        ministerio_name: userData.ministerioName,
        created_by: userData.createdBy,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, user: newUser }
  } catch (error) {
    console.error("Error creando usuario:", error)
    return { success: false, error: "Error al crear usuario" }
  }
}

// Obtener todos los usuarios
export async function getAllUsers() {
  try {
    const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, users: data }
  } catch (error) {
    console.error("Error obteniendo usuarios:", error)
    return { success: false, error: "Error al obtener usuarios", users: [] }
  }
}

// Actualizar usuario
export async function updateUser(userId: string, userData: UpdateUserData) {
  try {
    const { data, error } = await supabase.from("users").update(userData).eq("id", userId).select().single()

    if (error) throw error

    return { success: true, user: data }
  } catch (error) {
    console.error("Error actualizando usuario:", error)
    return { success: false, error: "Error al actualizar usuario" }
  }
}

// Eliminar usuario
export async function deleteUser(userId: string) {
  try {
    const { error } = await supabase.from("users").delete().eq("id", userId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error eliminando usuario:", error)
    return { success: false, error: "Error al eliminar usuario" }
  }
}

// Obtener todos los módulos
export async function getAllModules() {
  try {
    const { data, error } = await supabase.from("system_modules").select("*").order("sort_order", { ascending: true })

    if (error) throw error

    return { success: true, modules: data }
  } catch (error) {
    console.error("Error obteniendo módulos:", error)
    return { success: false, error: "Error al obtener módulos", modules: [] }
  }
}

// Obtener permisos de un usuario (incluye can_edit)
export async function getUserPermissions(userId: string) {
  try {
    const { data, error } = await supabase
      .from("user_permissions")
      .select(`
        *,
        module:system_modules(*)
      `)
      .eq("user_id", userId)

    if (error) throw error

    return { success: true, permissions: data }
  } catch (error) {
    console.error("Error obteniendo permisos:", error)
    return { success: false, error: "Error al obtener permisos", permissions: [] }
  }
}

// Asignar o actualizar permiso (con can_view y can_edit separados)
export async function setUserPermission(permissionData: UserPermissionData) {
  try {
    // Si canView es false, eliminar el permiso completamente
    if (!permissionData.canView) {
      const { error } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", permissionData.userId)
        .eq("module_id", permissionData.moduleId)

      if (error) throw error
      return { success: true, permission: null }
    }

    // Crear o actualizar el permiso con can_view y can_edit
    const { data, error } = await supabase
      .from("user_permissions")
      .upsert(
        {
          user_id: permissionData.userId,
          module_id: permissionData.moduleId,
          can_view: true,
          can_edit: permissionData.canEdit,
          granted_by: permissionData.grantedBy,
        },
        {
          onConflict: "user_id,module_id",
        },
      )
      .select()

    if (error) throw error

    return { success: true, permission: data }
  } catch (error) {
    console.error("Error asignando permiso:", error)
    return { success: false, error: error }
  }
}

// Eliminar permiso
export async function removeUserPermission(userId: string, moduleId: string) {
  try {
    const { error } = await supabase.from("user_permissions").delete().eq("user_id", userId).eq("module_id", moduleId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error eliminando permiso:", error)
    return { success: false, error: "Error al eliminar permiso" }
  }
}

// Cambiar contraseña
export async function changePassword(userId: string, newPassword: string) {
  try {
    const passwordHash = await bcrypt.hash(newPassword, 10)

    const { error } = await supabase.from("users").update({ password_hash: passwordHash }).eq("id", userId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error cambiando contraseña:", error)
    return { success: false, error: "Error al cambiar contraseña" }
  }
}
