import { supabase } from "@/lib/supabase"
import { auditService, type AuditInfo } from "@/lib/mod/audit-service"

export interface CronogramaEntry {
  id?: number
  user_id: string
  user_name: string
  asignacion: string
  fecha: string
  modulo: string
  ministerio?: string
  evento?: string
  hora_entrada?: string
  hora_llegada?: string
  atraso?: boolean | null
  // Acuses y alertas
  acuse_asignacion?: boolean
  acuse_asignacion_at?: string
  alerta2_enviada?: boolean
  alerta2_enviada_at?: string
  acuse_alerta2?: boolean
  acuse_alerta2_at?: string
  alerta1_enviada?: boolean
  alerta1_enviada_at?: string
  acuse_alerta1?: boolean
  acuse_alerta1_at?: string
  email_asignacion_enviado?: boolean
  email_alerta2_enviado?: boolean
  email_alerta1_enviado?: boolean
  whatsapp_asignacion_enviado?: boolean
  whatsapp_alerta2_enviado?: boolean
  whatsapp_alerta1_enviado?: boolean
  created_at?: string
  updated_at?: string
}

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

  async getAllGlobal(): Promise<CronogramaEntry[]> {
    const { data, error } = await supabase
      .from("cronograma_servicio")
      .select("*")
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
    // Validar que la persona no esté asignada el mismo día en ningún módulo
    const { data: existing, error: checkError } = await supabase
      .from("cronograma_servicio")
      .select("id, modulo")
      .eq("user_id", entry.user_id)
      .eq("fecha", entry.fecha)
      .limit(1)

    if (checkError) throw checkError

    if (existing && existing.length > 0) {
      throw new Error(`${entry.user_name} ya está asignado/a el ${entry.fecha} en el módulo "${existing[0].modulo}"`)
    }

    const { data, error } = await supabase
      .from("cronograma_servicio")
      .insert([{ ...entry, updated_at: new Date().toISOString() }])
      .select()
      .single()

    if (error) throw error
    if (audit) {
      auditService.log({
        ...audit,
        module: entry.modulo || "cronograma",
        action: "crear",
        description: `Cronograma - ${entry.user_name} | ${entry.asignacion} | ${entry.fecha}`,
        details: { user_name: entry.user_name, asignacion: entry.asignacion, fecha: entry.fecha, modulo: entry.modulo },
      })
    }

    // === NOTIFICACIONES MULTICANAL ===
    const date = new Date(entry.fecha + "T12:00:00")
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const fechaDisplay = `${days[date.getDay()]} ${day}/${month}`
    const fechaLarga = `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`

    const moduleLabels: Record<string, string> = {
      protocolo: "Protocolo",
      administracion: "Administración",
      discipulado: "Discipulado",
      mdg: "MDG",
    }
    const moduloLabel = moduleLabels[entry.modulo] || entry.modulo

    // 1. Buzón interno
    try {
      await supabase.from("buzon_mensajes").insert({
        user_id: entry.user_id,
        titulo: "📋 Nuevo Servicio Asignado",
        mensaje: `Se te asignó: ${entry.asignacion} — ${fechaLarga}${entry.hora_entrada ? ` a las ${entry.hora_entrada}` : ""} (${moduloLabel})`,
        tipo: "info",
        referencia_tipo: "cronograma",
        referencia_id: data.id,
      })
    } catch (e) {
      console.warn("Error enviando al buzón:", e)
    }

    // 2. Push notification
    try {
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: entry.user_id,
          title: "📋 Nuevo servicio asignado",
          body: `Te asignaron: ${entry.asignacion} - ${fechaDisplay}${entry.hora_entrada ? ` (${entry.hora_entrada})` : ""}`,
          url: "/dashboard",
        }),
      }).catch(() => {})
    } catch (e) {}

    // 3. Email (si el usuario tiene correo)
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("email, phone")
        .eq("id", entry.user_id)
        .single()

      if (userData?.email) {
        fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: userData.email,
            type: "asignacion",
            data: {
              userName: entry.user_name,
              asignacion: entry.asignacion,
              fecha: entry.fecha,
              horaEntrada: entry.hora_entrada,
              modulo: entry.modulo,
              ministerio: entry.ministerio,
              evento: entry.evento,
            },
          }),
        }).then(() => {
          // Marcar flag de email enviado
          supabase.from("cronograma_servicio").update({ email_asignacion_enviado: true }).eq("id", data.id).then(() => {})
        }).catch(() => {})
      }

      // 4. WhatsApp (si el usuario tiene teléfono)
      if (userData?.phone) {
        const waMessage = `📋 *Nuevo Servicio Asignado*\n\nHola ${entry.user_name}, se te ha asignado un servicio:\n\n📅 *Fecha:* ${fechaLarga}\n📍 *Asignación:* ${entry.asignacion}${entry.hora_entrada ? `\n🕐 *Hora:* ${entry.hora_entrada}` : ""}\n🏛️ *Módulo:* ${moduloLabel}${entry.ministerio ? `\n⛪ *Ministerio:* ${entry.ministerio}` : ""}${entry.evento ? `\n🎯 *Evento:* ${entry.evento}` : ""}\n\nPor favor ingresa a la app y confirma que recibiste esta notificación.`

        fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: userData.phone, message: waMessage }),
        }).then(() => {
          supabase.from("cronograma_servicio").update({ whatsapp_asignacion_enviado: true }).eq("id", data.id).then(() => {})
        }).catch(() => {})
      }
    } catch (e) {
      console.warn("Error enviando email/whatsapp:", e)
    }

    return data
  },

  async updateField(id: number, fields: Partial<Pick<CronogramaEntry, "hora_entrada" | "hora_llegada" | "atraso">>): Promise<void> {
    const { error } = await supabase
      .from("cronograma_servicio")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) throw error
  },

  // Actualizar campos generales (para edición completa)
  async update(id: number, fields: Partial<CronogramaEntry>, audit?: AuditInfo): Promise<CronogramaEntry> {
    const { data: before } = await supabase
      .from("cronograma_servicio")
      .select("user_name, asignacion, fecha, modulo")
      .eq("id", id)
      .single()

    const { data, error } = await supabase
      .from("cronograma_servicio")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: before?.modulo || "cronograma",
        action: "editar",
        description: `Cronograma editado - ${before?.user_name} | ${before?.asignacion} | ${before?.fecha}`,
        details: { id, antes: before, despues: fields },
      })
    }

    return data
  },

  // Marcar acuse de recibo
  async markAcknowledgment(id: number, tipo: "asignacion" | "alerta2" | "alerta1"): Promise<void> {
    const fieldMap = {
      asignacion: { acuse_asignacion: true, acuse_asignacion_at: new Date().toISOString() },
      alerta2: { acuse_alerta2: true, acuse_alerta2_at: new Date().toISOString() },
      alerta1: { acuse_alerta1: true, acuse_alerta1_at: new Date().toISOString() },
    }

    const { error } = await supabase
      .from("cronograma_servicio")
      .update({ ...fieldMap[tipo], updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error
  },

  // Obtener servicios pendientes de acuse para un usuario
  async getPendingAcknowledgments(userId: string): Promise<CronogramaEntry[]> {
    const today = new Date().toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("cronograma_servicio")
      .select("*")
      .eq("user_id", userId)
      .gte("fecha", today)
      .or("acuse_asignacion.eq.false,and(alerta2_enviada.eq.true,acuse_alerta2.eq.false),and(alerta1_enviada.eq.true,acuse_alerta1.eq.false)")
      .order("fecha", { ascending: true })

    if (error) throw error
    return data || []
  },

  // Marcar flags de envío de alertas
  async markAlertSent(id: number, tipo: "alerta2" | "alerta1", canales: { email?: boolean; whatsapp?: boolean }): Promise<void> {
    const fields: any = {
      [`${tipo}_enviada`]: true,
      [`${tipo}_enviada_at`]: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (canales.email) fields[`email_${tipo}_enviado`] = true
    if (canales.whatsapp) fields[`whatsapp_${tipo}_enviado`] = true

    const { error } = await supabase
      .from("cronograma_servicio")
      .update(fields)
      .eq("id", id)

    if (error) throw error
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("cronograma_servicio").select("user_name, asignacion, fecha").eq("id", id).single()
    const { error } = await supabase.from("cronograma_servicio").delete().eq("id", id)
    if (error) throw error
    if (audit) {
      auditService.log({
        ...audit,
        module: "cronograma-protocolo",
        action: "eliminar",
        description: `Cronograma - ${data?.user_name} | ${data?.asignacion} | ${data?.fecha}`,
        details: { id, ...data },
      })
    }
  },

  // Obtener 10 usuarios activos aleatorios (para super assigners)
  async getRandomActiveUsers(): Promise<{ id: string; username: string; displayName: string }[]> {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, displayName")
      .eq("is_active", true)
      .limit(10)

    if (error) return []
    return data || []
  },

  // Buscar todos los usuarios activos sin filtro de permisos
  async searchAllActiveUsers(query: string): Promise<{ id: string; username: string; displayName: string }[]> {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, displayName")
      .eq("is_active", true)
      .or(`username.ilike.%${query}%,displayName.ilike.%${query}%`)
      .limit(10)

    if (error) return []
    return data || []
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
