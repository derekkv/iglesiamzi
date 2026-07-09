import { supabase } from "@/lib/secure-db"

export interface AuditInfo {
  user_id: string
  user_name: string
  is_ai?: boolean
  ai_authorized_by?: string | null
}

export interface AuditLog {
  id: string
  timestamp: string
  user_id: string
  user_name: string
  module: string
  action: "crear" | "editar" | "eliminar"
  description: string
  details: Record<string, any> | null
  is_ai: boolean
  ai_authorized_by: string | null
}

export interface AuditLogInput {
  user_id: string
  user_name: string
  module: string
  action: "crear" | "editar" | "eliminar"
  description: string
  details?: Record<string, any> | null
  is_ai?: boolean
  ai_authorized_by?: string | null
}

export interface AuditQueryParams {
  page?: number
  limit?: number
  module?: string
  action?: string
  user_name?: string
  from_date?: string
  to_date?: string
}

export const auditService = {
  async log(input: AuditLogInput) {
    try {
      await supabase.from("audit_logs").insert({
        user_id: input.user_id,
        user_name: input.user_name,
        module: input.module,
        action: input.action,
        description: input.description,
        details: input.details || null,
        is_ai: input.is_ai || false,
        ai_authorized_by: input.ai_authorized_by || null,
      })
    } catch (error) {
      console.error("Error logging audit:", error)
    }
  },

  async getLogs(params: AuditQueryParams = {}): Promise<{ data: AuditLog[]; count: number }> {
    const { page = 1, limit = 50, module, action, user_name, from_date, to_date } = params

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("timestamp", { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (module) query = query.eq("module", module)
    if (action) query = query.eq("action", action)
    if (user_name) query = query.ilike("user_name", `%${user_name}%`)
    if (from_date) query = query.gte("timestamp", from_date)
    if (to_date) query = query.lte("timestamp", to_date + "T23:59:59")

    const { data, count, error } = await query
    if (error) throw error
    return { data: data || [], count: count || 0 }
  },
}
