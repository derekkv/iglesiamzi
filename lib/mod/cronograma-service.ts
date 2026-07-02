import { supabase } from "@/lib/supabase"
import { auditService, type AuditInfo } from "@/lib/mod/audit-service"

export interface CronogramaEntry {
  id?: number
  user_id: string
  user_name: string
  lugar: string
  fecha: string
  modulo: string // "protocolo", "administracion", "discipulado", etc.
  created_at?: string
  updated_at?: string
}

export const LUGARES = [
  "Salón / Auditorio / Acomodación",
  "Puerta / Recibidor / Promesas",
]

export const cronogramaService = {
  async getAll(modulo: string): Promise<CronogramaEntry[]> {
    const { data, error } = await supabase
      .from("cronograma_servicio")
      .select("*")
      .eq("modulo", modulo)
      .order("fecha", { ascending: true })

    if (error) throw error
    return data || []
  },

  async getUpcoming(modulo: string): Promise<CronogramaEntry[]> {
    const today = new Date().toISOString().split("T")[0]
    const { data, error } = await supabase
      .from("cronograma_servicio")
      .select("*")
      .eq("modulo", modulo)
      .gte("fecha", today)
      .order("fecha", { ascending: true })

    if (error) throw error
    return data || []
  },

  // Obtener servicios próximos para un usuario específico (próxima semana)
  async getUpcomingForUser(userId: string): Promise<CronogramaEntry[]> {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const todayStr = today.toISOString().split("T")[0]
    const nextWeekStr = nextWeek.toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("cronograma_servicio")
      .select("*")
      .eq("user_id", userId)
      .gte("fecha", todayStr)
      .lte("fecha", nextWeekStr)
      .order("fecha", { ascending: true })

    if (error) throw error
    return data || []
  },

  async create(entry: Omit<CronogramaEntry, "id" | "created_at" | "updated_at">, audit?: AuditInfo): Promise<CronogramaEntry> {
    const { data, error } = await supabase
      .from("cronograma_servicio")
      .insert([{ ...entry, updated_at: new Date().toISOString() }])
      .select()
      .single()

    if (error) throw error
    if (audit) {
      auditService.log({
        ...audit,
        module: "cronograma-protocolo",
        action: "crear",
        description: `Cronograma - ${entry.user_name} | ${entry.lugar} | ${entry.fecha}`,
        details: { user_name: entry.user_name, lugar: entry.lugar, fecha: entry.fecha, modulo: entry.modulo },
      })
    }

    // Enviar notificación push al usuario asignado
    try {
      const date = new Date(entry.fecha + "T12:00:00")
      const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
      const day = String(date.getDate()).padStart(2, "0")
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const fechaDisplay = `${days[date.getDay()]} ${day}/${month}`

      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: entry.user_id,
          title: "Nuevo servicio asignado",
          body: `Te asignaron servicio en ${entry.lugar} el ${fechaDisplay}`,
          url: "/dashboard/cronograma-protocolo",
        }),
      }).catch(() => {})
    } catch (e) {
      // No bloquear si falla la notificación
    }

    return data
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("cronograma_servicio").select("user_name, lugar, fecha").eq("id", id).single()
    const { error } = await supabase.from("cronograma_servicio").delete().eq("id", id)
    if (error) throw error
    if (audit) {
      auditService.log({
        ...audit,
        module: "cronograma-protocolo",
        action: "eliminar",
        description: `Cronograma - ${data?.user_name} | ${data?.lugar} | ${data?.fecha}`,
        details: { id, ...data },
      })
    }
  },

  // Buscar usuarios que tengan permiso en el módulo dado
  async searchUsersWithModuleAccess(query: string, moduleName: string): Promise<{ id: string; username: string; displayName: string }[]> {
    // Primero obtenemos los user_ids con permiso al módulo
    const { data: permissions, error: permError } = await supabase
      .from("user_permissions")
      .select(`
        user_id,
        module:system_modules!inner(name)
      `)
      .eq("can_view", true)
      .eq("system_modules.name", moduleName)

    if (permError || !permissions) return []

    const userIds = permissions.map((p: any) => p.user_id)
    if (userIds.length === 0) return []

    // Buscar usuarios que coincidan con la query
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, username, displayName")
      .eq("is_active", true)
      .in("id", userIds)
      .or(`username.ilike.%${query}%,displayName.ilike.%${query}%`)
      .limit(10)

    if (userError) return []
    return users || []
  },
}
