import { supabase } from "@/lib/supabase"

export interface PushSubscriptionData {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export const VAPID_PUBLIC_KEY = "BKHW7uYkfEBfrPirumVyRqNj_eiWBLpEQuV1Q6NsGImX7wJYA4oB1q_w5iGCZ7xcoO3Jgs41VczB3a7Y2FeIoYY"

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
