"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRealtime } from "@/hooks/use-realtime"
import { cronogramaService, type CronogramaEntry } from "@/lib/mod/cronograma-service"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, MapPin, Clock, CheckCircle2, Bell, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

// Intervalo de re-aparición si no ha aceptado (5 minutos)
const RECHECK_INTERVAL_MS = 5 * 60 * 1000

export function ServiceAcknowledgeModal() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [pendingServices, setPendingServices] = useState<CronogramaEntry[]>([])
  const [acknowledging, setAcknowledging] = useState<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const checkPending = useCallback(async () => {
    if (!user) return

    try {
      const pending = await cronogramaService.getPendingAcknowledgments(user.id)
      if (pending.length > 0) {
        setPendingServices(pending)
        setOpen(true)
      } else {
        setPendingServices([])
        setOpen(false)
      }
    } catch (error) {
      console.error("Error checking pending acknowledgments:", error)
    }
  }, [user])

  // Verificar al montar y cada 5 minutos
  useEffect(() => {
    if (!user) return

    // Primer check con delay para no bloquear carga inicial
    const timeout = setTimeout(checkPending, 2500)

    // Re-check cada 5 minutos
    intervalRef.current = setInterval(checkPending, RECHECK_INTERVAL_MS)

    return () => {
      clearTimeout(timeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [user, checkPending])

  // Realtime: reaccionar cuando cambia cronograma_servicio (ej: cron marca alerta como enviada)
  useRealtime({
    table: "cronograma_servicio",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => checkPending(),
  })

  const handleAcknowledge = async (entry: CronogramaEntry, tipo: "asignacion" | "alerta2" | "alerta1") => {
    if (!entry.id) return

    setAcknowledging(entry.id)
    try {
      await cronogramaService.markAcknowledgment(entry.id, tipo)
      toast.success("¡Confirmado! Gracias por tu respuesta.")

      // Actualizar la lista local
      setPendingServices((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== entry.id) return s
          if (tipo === "asignacion") return { ...s, acuse_asignacion: true }
          if (tipo === "alerta2") return { ...s, acuse_alerta2: true }
          if (tipo === "alerta1") return { ...s, acuse_alerta1: true }
          return s
        })
        // Filtrar los que ya no tienen pendientes
        return updated.filter((s) => {
          if (!s.acuse_asignacion) return true
          if (s.alerta2_enviada && !s.acuse_alerta2) return true
          if (s.alerta1_enviada && !s.acuse_alerta1) return true
          return false
        })
      })
    } catch (error) {
      toast.error("Error al confirmar. Intente de nuevo.")
    } finally {
      setAcknowledging(null)
    }
  }

  // Cerrar si ya no hay pendientes
  useEffect(() => {
    if (pendingServices.length === 0 && open) {
      setOpen(false)
    }
  }, [pendingServices, open])

  // Determinar qué tipo de acuse necesita cada servicio
  const getPendingType = (entry: CronogramaEntry): "asignacion" | "alerta2" | "alerta1" => {
    // Prioridad: alerta1 > alerta2 > asignacion
    if (entry.alerta1_enviada && !entry.acuse_alerta1) return "alerta1"
    if (entry.alerta2_enviada && !entry.acuse_alerta2) return "alerta2"
    return "asignacion"
  }

  const getTypeConfig = (tipo: "asignacion" | "alerta2" | "alerta1") => {
    switch (tipo) {
      case "asignacion":
        return {
          label: "Nueva Asignación",
          color: "bg-blue-100 text-blue-800 border-blue-200",
          cardBg: "bg-blue-50 border-blue-200",
          icon: <CalendarDays className="w-5 h-5 text-blue-600" />,
          headerColor: "text-blue-700",
          buttonText: "Confirmo que Recibí",
        }
      case "alerta2":
        return {
          label: "Recordatorio (5 días)",
          color: "bg-amber-100 text-amber-800 border-amber-200",
          cardBg: "bg-amber-50 border-amber-200",
          icon: <Bell className="w-5 h-5 text-amber-600" />,
          headerColor: "text-amber-700",
          buttonText: "Enterado, Asistiré",
        }
      case "alerta1":
        return {
          label: "¡Mañana!",
          color: "bg-red-100 text-red-800 border-red-200",
          cardBg: "bg-red-50 border-red-200",
          icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
          headerColor: "text-red-700",
          buttonText: "Listo, Estaré Ahí",
        }
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`
  }

  const getModuleLabel = (modulo: string) => {
    const labels: Record<string, string> = {
      protocolo: "Protocolo",
      administracion: "Administración",
      discipulado: "Discipulado",
      mdg: "MDG",
    }
    return labels[modulo] || modulo
  }

  if (pendingServices.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { /* No permitir cerrar si hay pendientes */ if (!v && pendingServices.length > 0) return; setOpen(v) }}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p>Confirma tus servicios</p>
              <p className="text-sm font-normal text-gray-500">
                {pendingServices.length} servicio{pendingServices.length !== 1 ? "s" : ""} pendiente{pendingServices.length !== 1 ? "s" : ""} de confirmación
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          {pendingServices.map((service) => {
            const tipo = getPendingType(service)
            const config = getTypeConfig(tipo)

            return (
              <div
                key={`${service.id}-${tipo}`}
                className={`p-4 rounded-xl border ${config.cardBg}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <Badge className={config.color}>{config.label}</Badge>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">{formatDate(service.fecha)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{service.asignacion}</span>
                  </div>
                  {service.hora_entrada && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{service.hora_entrada}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 ml-6">{getModuleLabel(service.modulo)}{service.ministerio ? ` • ${service.ministerio}` : ""}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleAcknowledge(service, tipo)}
                  disabled={acknowledging === service.id}
                >
                  {acknowledging === service.id ? (
                    "Confirmando..."
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {config.buttonText}
                    </>
                  )}
                </Button>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <p className="text-xs text-gray-400 text-center w-full">
            Este mensaje aparecerá cada 5 minutos hasta que confirmes todos tus servicios.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
