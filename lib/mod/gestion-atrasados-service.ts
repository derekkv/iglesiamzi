import { supabase } from "@/lib/secure-db"
import { todayEcuador } from "../timezone"
import { getInternalHeaders } from "../auth-fetch"
import { auditService } from "./audit-service"

export interface GestionAtrasado {
  id: number
  modulo: string
  user_id: string
  user_name: string
  fecha: string
  gestionado: boolean
  respuesta_gestion: boolean | null
  acuerdo: string | null
  gestionado_por: string | null
  gestionado_por_nombre: string | null
  fecha_gestion: string | null
  notificado: boolean
  registrado_por: string | null
  registrado_por_nombre: string | null
  created_at: string
}

/**
 * Registrar un atraso (se llama cuando marcan "atrasado" en asistencia)
 */
export async function registrarAtraso(params: {
  modulo: string
  userId: string
  userName: string
  fecha: string
  registradoPor: string
  registradoPorNombre: string
}): Promise<{ success: boolean; id?: number; error?: string }> {
  const { data, error } = await supabase
    .from("gestion_atrasados")
    .upsert({
      modulo: params.modulo,
      user_id: params.userId,
      user_name: params.userName,
      fecha: params.fecha,
      registrado_por: params.registradoPor,
      registrado_por_nombre: params.registradoPorNombre,
    }, { onConflict: "modulo,user_id,fecha" })
    .select("id")
    .single()

  if (error) return { success: false, error: error.message }

  // Audit log
  auditService.log({
    user_id: params.registradoPor,
    user_name: params.registradoPorNombre,
    module: "gestion-atrasados",
    action: "crear",
    description: `Atraso registrado - ${params.userName} en ${params.modulo}`,
    details: {
      id: data?.id,
      modulo: params.modulo,
      servidor: params.userName,
      fecha: params.fecha,
    },
  })

  return { success: true, id: data?.id }
}


/**
 * Eliminar un registro de atraso (si cambian el estado de vuelta)
 */
export async function eliminarAtraso(modulo: string, userId: string, fecha: string): Promise<void> {
  await supabase
    .from("gestion_atrasados")
    .delete()
    .eq("modulo", modulo)
    .eq("user_id", userId)
    .eq("fecha", fecha)
}

/**
 * Gestionar un atraso (el líder registra si gestionó o no + acuerdo)
 */
export async function gestionarAtraso(params: {
  id: number
  respuestaGestion: boolean
  acuerdo: string
  gestionadoPor: string
  gestionadoPorNombre: string
}): Promise<{ success: boolean; error?: string }> {
  // Obtener datos antes de la gestión
  const { data: antes } = await supabase
    .from("gestion_atrasados")
    .select("user_name, modulo, fecha, gestionado, respuesta_gestion, acuerdo")
    .eq("id", params.id)
    .single()

  const { error } = await supabase
    .from("gestion_atrasados")
    .update({
      gestionado: true,
      respuesta_gestion: params.respuestaGestion,
      acuerdo: (params.acuerdo || "").slice(0, 240),
      gestionado_por: params.gestionadoPor,
      gestionado_por_nombre: params.gestionadoPorNombre,
      fecha_gestion: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)

  if (error) return { success: false, error: error.message }

  // Audit log
  auditService.log({
    user_id: params.gestionadoPor,
    user_name: params.gestionadoPorNombre,
    module: "gestion-atrasados",
    action: "editar",
    description: `Atraso gestionado - ${antes?.user_name || "?"} en ${antes?.modulo || "?"}`,
    details: {
      id: params.id,
      antes: {
        gestionado: antes?.gestionado ?? false,
        respuesta_gestion: antes?.respuesta_gestion,
        acuerdo: antes?.acuerdo,
      },
      despues: {
        gestionado: true,
        respuesta_gestion: params.respuestaGestion,
        acuerdo: params.acuerdo,
      },
    },
  })

  return { success: true }
}

/**
 * Obtener atrasados pendientes de gestión por módulo
 */
export async function getAtrasadosPorModulo(modulo: string): Promise<GestionAtrasado[]> {
  const { data, error } = await supabase
    .from("gestion_atrasados")
    .select("*")
    .eq("modulo", modulo)
    .order("fecha", { ascending: false })

  if (error) return []
  return data || []
}

/**
 * Obtener todos los atrasados (para vista pastoral)
 */
export async function getTodosLosAtrasados(): Promise<GestionAtrasado[]> {
  const { data, error } = await supabase
    .from("gestion_atrasados")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return []
  return data || []
}

/**
 * Marcar como notificado
 */
export async function marcarNotificado(id: number): Promise<void> {
  await supabase
    .from("gestion_atrasados")
    .update({ notificado: true, notificado_at: new Date().toISOString() })
    .eq("id", id)
}


/**
 * Notificar al líder del grupo sobre un atraso.
 * Envía: push notification, email y WhatsApp.
 */
export async function notificarLiderAtraso(params: {
  modulo: string
  userName: string
  fecha: string
  atrasoId: number
}): Promise<void> {
  try {
    // 1. Buscar el group_id del módulo
    const { data: moduleData } = await supabase
      .from("system_modules")
      .select("group_id")
      .eq("name", `cronograma-${params.modulo}`)
      .single()

    if (!moduleData?.group_id) return

    // 2. Buscar líderes del grupo
    const { data: leaders } = await supabase
      .from("user_group_leaders")
      .select("user_id")
      .eq("group_id", moduleData.group_id)

    if (!leaders || leaders.length === 0) return

    const leaderIds = leaders.map((l: any) => l.user_id)

    // 3. Obtener datos de los líderes (email, phone)
    const { data: leaderUsers } = await supabase
      .from("users")
      .select("id, email, phone, displayName")
      .in("id", leaderIds)

    if (!leaderUsers) return

    const mensaje = `Alerta de Atraso: ${params.userName} fue marcado como ATRASADO en ${params.modulo} el ${params.fecha}. Ingrese al sistema para gestionar.`

    for (const leader of leaderUsers) {
      // Push notification
      try {
        await fetch("/api/send-notification", {
          method: "POST",
          headers: getInternalHeaders(),
          body: JSON.stringify({
            user_id: leader.id,
            title: `Atraso en ${params.modulo}`,
            body: `${params.userName} llegó atrasado/a. Gestione la situación.`,
            url: "/dashboard",
          }),
        })
      } catch (e) { console.error("Error push:", e) }

      // Email
      if (leader.email) {
        try {
          await fetch("/api/send-email", {
            method: "POST",
            headers: getInternalHeaders(),
            body: JSON.stringify({
              to: leader.email,
              subject: `Alerta de Atraso - ${params.modulo}`,
              html: `<p>Hola ${leader.displayName},</p><p>${mensaje}</p><p>Por favor ingrese al sistema para gestionar esta situación.</p>`,
            }),
          })
        } catch (e) { console.error("Error email:", e) }
      }

      // WhatsApp
      if (leader.phone) {
        try {
          const WA_URL = process.env.NEXT_PUBLIC_WA_SERVER_URL || process.env.WA_SERVER_URL || "http://localhost:3100"
          await fetch(`${WA_URL}/api/whatsapp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: leader.phone,
              message: mensaje,
            }),
          })
        } catch (e) { console.error("Error WhatsApp:", e) }
      }
    }

    // 4. Marcar como notificado
    await marcarNotificado(params.atrasoId)
  } catch (error) {
    console.error("Error notificando líder:", error)
  }
}
