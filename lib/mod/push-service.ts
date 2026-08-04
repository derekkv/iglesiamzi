import { supabase } from "@/lib/secure-db"

export interface PushSubscriptionData {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

export const pushService = {
  // Guardar suscripción
  async saveSubscription(sub: PushSubscriptionData): Promise<void> {
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(sub, { onConflict: "user_id,endpoint" })

    if (error) throw error
  },

  // Eliminar suscripción
  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint)

    if (error) throw error
  },

  // Obtener suscripciones de un usuario
  async getSubscriptions(userId: string): Promise<PushSubscriptionData[]> {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)

    if (error) throw error
    return data || []
  },

  // Obtener todas las suscripciones (para cron)
  async getAllSubscriptions(): Promise<(PushSubscriptionData & { id: number })[]> {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("*")

    if (error) throw error
    return data || []
  },
}
