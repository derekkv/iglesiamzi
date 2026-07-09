"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, FileText, ThumbsUp, ThumbsDown, Pause, Info } from "lucide-react"
import { useNotificaciones, type BuzonMensaje } from "@/hooks/use-notificaciones"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/contexts/auth-context"

function getIconByTipo(tipo: BuzonMensaje["tipo"]) {
  switch (tipo) {
    case "requerimiento":
      return <FileText className="h-4 w-4 text-blue-500" />
    case "aprobado":
      return <ThumbsUp className="h-4 w-4 text-green-500" />
    case "negado":
      return <ThumbsDown className="h-4 w-4 text-red-500" />
    case "suspenso":
      return <Pause className="h-4 w-4 text-yellow-500" />
    default:
      return <Info className="h-4 w-4 text-gray-500" />
  }
}

function getBgByTipo(tipo: BuzonMensaje["tipo"], leido: boolean) {
  if (leido) return "bg-white"
  switch (tipo) {
    case "aprobado":
      return "bg-green-50"
    case "negado":
      return "bg-red-50"
    case "suspenso":
      return "bg-yellow-50"
    case "requerimiento":
      return "bg-blue-50"
    default:
      return "bg-gray-50"
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return "Ahora"
  if (mins < 60) return `Hace ${mins} min`
  if (hours < 24) return `Hace ${hours}h`
  if (days < 7) return `Hace ${days}d`
  return date.toLocaleDateString("es")
}

/**
 * Determina la ruta de navegación según el tipo de notificación.
 */
function getRouteForNotification(msg: BuzonMensaje): string | null {
  switch (msg.referencia_tipo) {
    case "cronograma":
      return "/dashboard"
    case "requerimiento":
      // Si es notificación de respuesta (aprobado/negado/suspenso) va a requerimientos del usuario
      // Si es tipo "requerimiento" (nueva solicitud) va al admin
      if (msg.tipo === "requerimiento") {
        return "/dashboard/requerimientos-admin"
      }
      return "/dashboard"
    default:
      return null
  }
}

export function BuzonNotificaciones() {
  const { user } = useAuth()
  const { mensajes, noLeidos, loading, marcarLeido, marcarTodosLeidos } = useNotificaciones()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Cerrar panel al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  if (!user) return null

  return (
    <div className="relative" ref={panelRef}>
      {/* Botón campana */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className={`h-5 w-5 ${noLeidos > 0 ? "text-blue-600" : "text-gray-600"}`} />
        {noLeidos > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px] bg-red-500 text-white border-2 border-white"
          >
            {noLeidos > 99 ? "99+" : noLeidos}
          </Badge>
        )}
      </button>

      {/* Panel desplegable */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border z-50 animate-in slide-in-from-top-2 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm text-gray-800">
              Notificaciones
              {noLeidos > 0 && (
                <span className="ml-2 text-xs text-blue-600 font-normal">
                  ({noLeidos} sin leer)
                </span>
              )}
            </h3>
            {noLeidos > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 text-blue-600 hover:text-blue-700"
                onClick={marcarTodosLeidos}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Leer todo
              </Button>
            )}
          </div>

          {/* Lista de mensajes */}
          <ScrollArea className="max-h-[400px]">
            {loading ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                Cargando...
              </div>
            ) : mensajes.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No hay notificaciones
              </div>
            ) : (
              <div className="divide-y">
                {mensajes.map((msg) => (
                  <div
                    key={msg.id}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${getBgByTipo(msg.tipo, msg.leido)}`}
                    onClick={() => {
                      if (!msg.leido) marcarLeido(msg.id)
                      const route = getRouteForNotification(msg)
                      if (route) {
                        setIsOpen(false)
                        router.push(route)
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {getIconByTipo(msg.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${!msg.leido ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                            {msg.titulo}
                          </p>
                          {!msg.leido && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {msg.mensaje}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatTimeAgo(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {mensajes.length > 0 && (
            <div className="border-t px-4 py-2 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
