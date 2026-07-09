"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { VAPID_PUBLIC_KEY } from "@/lib/mod/push-service"
import { Button } from "@/components/ui/button"
import { Bell, X } from "lucide-react"

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

export function PushNotificationPrompt() {
  const { user } = useAuth()
  const [showPrompt, setShowPrompt] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    if (!user) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    // No intentar push si no hay SW controlando (dev mode sin PWA)
    // El SW solo está disponible en producción donde next-pwa lo registra
    if (!navigator.serviceWorker.controller) return

    // Solo mostrar si no ha decidido aún (o si falló antes, reintentar)
    const dismissed = localStorage.getItem("push_prompt_dismissed")
    if (dismissed === "subscribed" || dismissed === "denied") return

    // Si hubo un error previo, limpiar para reintentar
    if (dismissed === "error") {
      localStorage.removeItem("push_prompt_dismissed")
    }

    // Chequear si ya tiene permiso
    if (Notification.permission === "granted") {
      // Ya tiene permiso, registrar suscripción silenciosamente
      subscribeUser()
      return
    }

    if (Notification.permission === "denied") return

    // Mostrar prompt después de un delay
    const timeout = setTimeout(() => setShowPrompt(true), 3000)
    return () => clearTimeout(timeout)
  }, [user])

  const subscribeUser = async () => {
    if (!user) return
    setSubscribing(true)
    try {
      const registration = await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const sub = subscription.toJSON()

      // Guardar vía API route (usa service key, bypasses RLS)
      const res = await fetch("/api/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: localStorage.getItem("authToken"),
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: sub.keys?.p256dh,
          auth: sub.keys?.auth,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Error guardando suscripción en servidor")
      }

      localStorage.setItem("push_prompt_dismissed", "subscribed")
    } catch (error) {
      console.error("Error subscribing to push:", error)
      localStorage.setItem("push_prompt_dismissed", "error")
    } finally {
      setSubscribing(false)
      setShowPrompt(false)
    }
  }

  const handleAccept = async () => {
    setSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === "granted") {
        await subscribeUser()
      } else {
        setShowPrompt(false)
        setSubscribing(false)
        localStorage.setItem("push_prompt_dismissed", "denied")
      }
    } catch (error) {
      console.error("Error requesting permission:", error)
      setSubscribing(false)
      setShowPrompt(false)
      localStorage.setItem("push_prompt_dismissed", "error")
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("push_prompt_dismissed", "later")
    // Volver a preguntar en 7 días
    setTimeout(() => localStorage.removeItem("push_prompt_dismissed"), 7 * 24 * 60 * 60 * 1000)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm">Activar notificaciones</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Recibe alertas cuando te asignen un servicio y recordatorios antes de tu turno.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleAccept} disabled={subscribing} className="text-xs">
                {subscribing ? "Activando..." : "Activar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs text-gray-500">
                Ahora no
              </Button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
