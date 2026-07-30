"use server"

import bcrypt from "bcryptjs"
import { supabaseServer as supabase } from "./supabase-server"

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
  canAdmin?: boolean
  grantedBy: string
}

export async function createUser(userData: CreateUserData) {
  try {
    const { data: existing } = await supabase.from("users").select("id").eq("username", userData.username).single()

    if (existing) {
      return { success: false, error: "El nombre de usuario ya existe" }
    }

    const passwordHash = await bcrypt.hash(userData.password, 10)

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

export async function getAllModules() {
  try {
    const { data, error } = await supabase
      .from("system_modules")
      .select(`
        *,
        group:module_groups(*)
      `)
      .order("sort_order", { ascending: true })

    if (error) throw error

    return { success: true, modules: data }
  } catch (error) {
    console.error("Error obteniendo módulos:", error)
    return { success: false, error: "Error al obtener módulos", modules: [] }
  }
}

export async function getAllModuleGroups() {
  try {
    const { data, error } = await supabase
      .from("module_groups")
      .select("*")
      .order("sort_order", { ascending: true })

    if (error) throw error

    return { success: true, groups: data }
  } catch (error) {
    console.error("Error obteniendo grupos:", error)
    return { success: false, error: "Error al obtener grupos", groups: [] }
  }
}

export async function getModulesGrouped() {
  try {
    const { data: groups, error: groupsError } = await supabase
      .from("module_groups")
      .select("*")
      .order("sort_order", { ascending: true })

    if (groupsError) throw groupsError

    const { data: modules, error: modulesError } = await supabase
      .from("system_modules")
      .select(`
        *,
        group:module_groups(*)
      `)
      .order("sort_order", { ascending: true })

    if (modulesError) throw modulesError

    const ungrouped = modules.filter((m: any) => !m.group_id)
    const grouped = groups.map((group: any) => ({
      ...group,
      modules: modules.filter((m: any) => m.group_id === group.id),
    }))

    return { success: true, ungrouped, grouped }
  } catch (error) {
    console.error("Error obteniendo módulos agrupados:", error)
    return { success: false, error: "Error al obtener módulos agrupados", ungrouped: [], grouped: [] }
  }
}

export async function setGroupPermissions(
  userId: string,
  groupId: string,
  canView: boolean,
  canEdit: boolean,
  grantedBy: string
) {
  try {
    const { data: modules, error: modulesError } = await supabase
      .from("system_modules")
      .select("id")
      .eq("group_id", groupId)

    if (modulesError) throw modulesError
    if (!modules || modules.length === 0) return { success: true }

    const moduleIds = modules.map((m: any) => m.id)

    if (!canView) {
      const { error } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId)
        .in("module_id", moduleIds)

      if (error) throw error
    } else {
      const permissionsData = moduleIds.map((moduleId: string) => ({
        user_id: userId,
        module_id: moduleId,
        can_view: true,
        can_edit: canEdit,
        granted_by: grantedBy,
      }))

      const { error } = await supabase
        .from("user_permissions")
        .upsert(permissionsData, { onConflict: "user_id,module_id" })

      if (error) throw error
    }

    return { success: true }
  } catch (error) {
    console.error("Error asignando permisos de grupo:", error)
    return { success: false, error: "Error al asignar permisos de grupo" }
  }
}

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

export async function setUserPermission(permissionData: UserPermissionData) {
  try {
    if (!permissionData.canView) {
      const { error } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", permissionData.userId)
        .eq("module_id", permissionData.moduleId)

      if (error) throw error
      return { success: true, permission: null }
    }

    const { data, error } = await supabase
      .from("user_permissions")
      .upsert(
        {
          user_id: permissionData.userId,
          module_id: permissionData.moduleId,
          can_view: true,
          can_edit: permissionData.canEdit,
          can_admin: permissionData.canAdmin || false,
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


export async function getUserGroupLeaders(userId: string) {
  try {
    const { data, error } = await supabase
      .from("user_group_leaders")
      .select("group_id")
      .eq("user_id", userId)

    if (error) throw error

    return { success: true, groupIds: (data || []).map((r: any) => r.group_id) }
  } catch (error) {
    console.error("Error obteniendo líderes de grupo:", error)
    return { success: false, error: "Error al obtener líderes de grupo", groupIds: [] }
  }
}

export async function getAllGroupLeaders() {
  try {
    const { data, error } = await supabase
      .from("user_group_leaders")
      .select("user_id, group_id")

    if (error) throw error

    const leadersMap: Record<string, string[]> = {}
    for (const row of data || []) {
      if (!leadersMap[row.user_id]) {
        leadersMap[row.user_id] = []
      }
      leadersMap[row.user_id].push(row.group_id)
    }

    return { success: true, leadersMap }
  } catch (error) {
    console.error("Error obteniendo todos los líderes:", error)
    return { success: false, error: "Error al obtener líderes", leadersMap: {} }
  }
}

export async function getAdminPanelData() {
  try {
    const [usersRes, groupsRes, modulesRes, leadersRes] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("module_groups").select("*").order("sort_order", { ascending: true }),
      supabase.from("system_modules").select("*, group:module_groups(*)").order("sort_order", { ascending: true }),
      supabase.from("user_group_leaders").select("user_id, group_id"),
    ])

    if (usersRes.error) throw usersRes.error
    if (groupsRes.error) throw groupsRes.error
    if (modulesRes.error) throw modulesRes.error
    if (leadersRes.error) throw leadersRes.error

    const users = usersRes.data || []
    const groups = groupsRes.data || []
    const modules = modulesRes.data || []

    const ungrouped = modules.filter((m: any) => !m.group_id)
    const grouped = groups.map((group: any) => ({
      ...group,
      modules: modules.filter((m: any) => m.group_id === group.id),
    }))

    const leadersMap: Record<string, string[]> = {}
    for (const row of leadersRes.data || []) {
      if (!leadersMap[row.user_id]) {
        leadersMap[row.user_id] = []
      }
      leadersMap[row.user_id].push(row.group_id)
    }

    return {
      success: true,
      users,
      modules,
      ungrouped,
      grouped,
      leadersMap,
    }
  } catch (error) {
    console.error("Error cargando datos del panel de administración:", error)
    return { success: false, error: "Error al cargar datos", users: [], modules: [], ungrouped: [], grouped: [], leadersMap: {} }
  }
}

export async function setGroupLeader(userId: string, groupId: string, isLeader: boolean, grantedBy: string) {
  try {
    if (isLeader) {
      const { error } = await supabase
        .from("user_group_leaders")
        .upsert(
          { user_id: userId, group_id: groupId, granted_by: grantedBy },
          { onConflict: "user_id,group_id" }
        )
      if (error) throw error
    } else {
      const { error } = await supabase
        .from("user_group_leaders")
        .delete()
        .eq("user_id", userId)
        .eq("group_id", groupId)
      if (error) throw error
    }

    return { success: true }
  } catch (error) {
    console.error("Error asignando líder de grupo:", error)
    return { success: false, error: "Error al asignar líder de grupo" }
  }
}
