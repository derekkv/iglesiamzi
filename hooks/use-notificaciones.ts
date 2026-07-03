"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useRealtime } from "./use-realtime"

export interface BuzonMensaje {
  id: number
  user_id: string
  titulo: string
  mensaje: string
  tipo: "info" | "requerimiento" | "aprobado" | "negado" | "suspenso"
  leido: boolean
  referencia_tipo?: string
  referencia_id?: number
  created_at: string
}

export function useNotificaciones() {
  const { user } = useAuth()
  const [mensajes, setMensajes] = useState<BuzonMensaje[]>([])
  const [noLeidos, setNoLeidos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAlert, setShowAlert] = useState(false)
  const lastCountRef = useRef(0)

  const loadMensajes = useCallback(async (silent = false) => {
    if (!user) return

    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from("buzon_mensajes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error

      const msgs = (data || []) as BuzonMensaje[]
      setMensajes(msgs)

      const count = msgs.filter((m) => !m.leido).length
      // Mostrar alerta si hay nuevos no leídos
      if (count > lastCountRef.current && lastCountRef.current >= 0) {
        setShowAlert(true)
      }
      lastCountRef.current = count
      setNoLeidos(count)
    } catch (error) {
      console.error("Error cargando mensajes del buzón:", error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Cargar mensajes al montar
  useEffect(() => {
    if (user) {
      lastCountRef.current = -1 // No mostrar alerta en carga inicial
      loadMensajes()
    }
  }, [user, loadMensajes])

  // Suscripción Realtime: escuchar nuevos mensajes para este usuario
  useRealtime({
    table: "buzon_mensajes",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => loadMensajes(true),
  })

  // Marcar un mensaje como leído
  const marcarLeido = useCallback(async (mensajeId: number) => {
    const { error } = await supabase
      .from("buzon_mensajes")
      .update({ leido: true })
      .eq("id", mensajeId)

    if (!error) {
      setMensajes((prev) =>
        prev.map((m) => (m.id === mensajeId ? { ...m, leido: true } : m))
      )
      setNoLeidos((prev) => Math.max(0, prev - 1))
    }
  }, [])

  // Marcar todos como leídos
  const marcarTodosLeidos = useCallback(async () => {
    if (!user) return

    const { error } = await supabase
      .from("buzon_mensajes")
      .update({ leido: true })
      .eq("user_id", user.id)
      .eq("leido", false)

    if (!error) {
      setMensajes((prev) => prev.map((m) => ({ ...m, leido: true })))
      setNoLeidos(0)
    }
  }, [user])

  // Enviar notificación a un usuario (y push)
  const enviarNotificacion = useCallback(async (params: {
    userId: string
    titulo: string
    mensaje: string
    tipo?: BuzonMensaje["tipo"]
    referenciaTipo?: string
    referenciaId?: number
  }) => {
    const { userId, titulo, mensaje, tipo = "info", referenciaTipo, referenciaId } = params

    // Insertar en buzón
    const { error } = await supabase.from("buzon_mensajes").insert({
      user_id: userId,
      titulo,
      mensaje,
      tipo,
      referencia_tipo: referenciaTipo,
      referencia_id: referenciaId,
    })

    if (error) {
      console.error("Error enviando notificación al buzón:", error)
      return false
    }

    // Enviar push notification también
    try {
      await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          title: titulo,
          body: mensaje,
          url: "/dashboard",
        }),
      })
    } catch (e) {
      // Push es best-effort, no bloquear si falla
      console.warn("Push notification falló:", e)
    }

    return true
  }, [])

  // Enviar notificación a todos los admins
  const notificarAdmins = useCallback(async (params: {
    titulo: string
    mensaje: string
    tipo?: BuzonMensaje["tipo"]
    referenciaTipo?: string
    referenciaId?: number
  }) => {
    const { titulo, mensaje, tipo = "requerimiento", referenciaTipo, referenciaId } = params

    // Obtener usuarios con permiso can_admin en módulo administracion
    const { data: adminPerms, error: permError } = await supabase
      .from("user_permissions")
      .select(`
        user_id,
        module:system_modules!inner(name)
      `)
      .eq("can_admin", true)
      .eq("system_modules.name", "administracion")

    if (permError || !adminPerms) {
      console.error("Error obteniendo admins:", permError)
      return
    }

    // Enviar a cada admin
    for (const perm of adminPerms) {
      await enviarNotificacion({
        userId: perm.user_id,
        titulo,
        mensaje,
        tipo,
        referenciaTipo,
        referenciaId,
      })
    }
  }, [enviarNotificacion])

  const dismissAlert = useCallback(() => {
    setShowAlert(false)
  }, [])

  return {
    mensajes,
    noLeidos,
    loading,
    showAlert,
    dismissAlert,
    marcarLeido,
    marcarTodosLeidos,
    enviarNotificacion,
    notificarAdmins,
    refresh: loadMensajes,
  }
}
