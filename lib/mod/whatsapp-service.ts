import { supabase } from "@/lib/supabase"

export interface WhatsAppMessage {
  id: string
  phone: string
  message: string
  message_id?: string
  sent_by?: string
  sent_by_name?: string
  status: "sent" | "delivered" | "failed" | "pending"
  is_bulk: boolean
  bulk_batch_id?: string
  error_message?: string
  created_at: string
}

export const whatsappService = {
  /**
   * Registrar un mensaje enviado en el historial
   */
  async logMessage(params: {
    phone: string
    message: string
    messageId?: string
    sentBy?: string
    sentByName?: string
    status?: "sent" | "failed"
    isBulk?: boolean
    bulkBatchId?: string
    errorMessage?: string
  }) {
    const { error } = await supabase.from("whatsapp_messages").insert({
      phone: params.phone,
      message: params.message,
      message_id: params.messageId || null,
      sent_by: params.sentBy || null,
      sent_by_name: params.sentByName || null,
      status: params.status || "sent",
      is_bulk: params.isBulk || false,
      bulk_batch_id: params.bulkBatchId || null,
      error_message: params.errorMessage || null,
    })

    if (error) {
      console.error("Error registrando mensaje WhatsApp:", error)
    }

    return { success: !error, error: error?.message }
  },

  /**
   * Obtener historial de mensajes con paginación
   */
  async getMessages(params?: {
    limit?: number
    offset?: number
    phone?: string
    sentBy?: string
  }) {
    const limit = params?.limit || 50
    const offset = params?.offset || 0

    let query = supabase
      .from("whatsapp_messages")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (params?.phone) {
      query = query.eq("phone", params.phone)
    }

    if (params?.sentBy) {
      query = query.eq("sent_by", params.sentBy)
    }

    const { data, error, count } = await query

    return {
      success: !error,
      messages: (data as WhatsAppMessage[]) || [],
      total: count || 0,
      error: error?.message,
    }
  },

  /**
   * Obtener estadísticas de mensajes
   */
  async getStats() {
    const { count: totalSent } = await supabase
      .from("whatsapp_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")

    const { count: totalFailed } = await supabase
      .from("whatsapp_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")

    const { count: todayCount } = await supabase
      .from("whatsapp_messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date().toISOString().split("T")[0])

    return {
      totalSent: totalSent || 0,
      totalFailed: totalFailed || 0,
      todayCount: todayCount || 0,
    }
  },
}
