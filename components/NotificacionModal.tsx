"use client"

import { useEffect, useState } from "react"
import { useNotificaciones, type BuzonMensaje } from "@/hooks/use-notificaciones"
import { useAuth } from "@/contexts/auth-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Bell, FileText, ThumbsUp, ThumbsDown, Pause, Info } from "lucide-react"

function getIconByTipo(tipo: BuzonMensaje["tipo"]) {
  switch (tipo) {
    case "requerimiento":
      return <FileText className="h-6 w-6 text-blue-500" />
    case "aprobado":
      return <ThumbsUp className="h-6 w-6 text-green-500" />
    case "negado":
      return <ThumbsDown className="h-6 w-6 text-red-500" />
    case "suspenso":
      return <Pause className="h-6 w-6 text-yellow-500" />
    default:
      return <Info className="h-6 w-6 text-gray-500" />
  }
}

function getBgColor(tipo: BuzonMensaje["tipo"]) {
  switch (tipo) {
    case "aprobado": return "bg-green-50 border-green-200"
    case "negado": return "bg-red-50 border-red-200"
    case "suspenso": return "bg-yellow-50 border-yellow-200"
    case "requerimiento": return "bg-blue-50 border-blue-200"
    default: return "bg-gray-50 border-gray-200"
  }
}

/**
 * Modal que aparece automáticamente cuando llega una nueva notificación.
 * Se muestra sobre todo el contenido y requiere interacción del usuario para cerrarse.
 */
export function NotificacionModal() {
  const { user } = useAuth()
  const { mensajes, showAlert, dismissAlert, marcarLeido } = useNotificaciones()
  const [isOpen, setIsOpen] = useState(false)
  const [currentMsg, setCurrentMsg] = useState<BuzonMensaje | null>(null)

  // Cuando showAlert se activa, buscar el mensaje más reciente no leído y mostrar modal
  useEffect(() => {
    if (showAlert && mensajes.length > 0) {
      const lastUnread = mensajes.find((m) => !m.leido)
      if (lastUnread) {
        setCurrentMsg(lastUnread)
        setIsOpen(true)
      }
    }
  }, [showAlert, mensajes])

  const handleClose = () => {
    if (currentMsg) {
      marcarLeido(currentMsg.id)
    }
    setIsOpen(false)
    setCurrentMsg(null)
    dismissAlert()
  }

  const handleDismissOnly = () => {
    setIsOpen(false)
    setCurrentMsg(null)
    dismissAlert()
  }

  if (!user || !currentMsg) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDismissOnly() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle className="text-base">Nueva Notificación</DialogTitle>
          </div>
        </DialogHeader>

        <div className={`p-4 rounded-lg border ${getBgColor(currentMsg.tipo)}`}>
          <div className="flex items-start gap-3">
            {getIconByTipo(currentMsg.tipo)}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">{currentMsg.titulo}</p>
              <p className="text-sm text-gray-600 mt-1">{currentMsg.mensaje}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(currentMsg.created_at).toLocaleString("es")}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleDismissOnly}>
            Cerrar
          </Button>
          <Button size="sm" onClick={handleClose}>
            Marcar como leído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
