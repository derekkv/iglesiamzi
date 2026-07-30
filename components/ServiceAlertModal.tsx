"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { cronogramaService, type CronogramaEntry } from "@/lib/mod/cronograma-service"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CalendarDays, MapPin, Clock } from "lucide-react"

export function ServiceAlertModal() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [services, setServices] = useState<CronogramaEntry[]>([])

  useEffect(() => {
    if (!user) return

    const checkServices = async () => {
      try {
        const upcoming = await cronogramaService.getUpcomingForUser(user.id)
        if (upcoming.length > 0) {
          setServices(upcoming)
          setOpen(true)
        }
      } catch (error) {
        console.error("Error checking upcoming services:", error)
      }
    }

    // Pequeño delay para no bloquear la carga inicial
    const timeout = setTimeout(checkServices, 1500)
    return () => clearTimeout(timeout)
  }, [user])

  if (services.length === 0) return null

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`
  }

  const getDaysUntil = (dateStr: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(dateStr + "T12:00:00")
    target.setHours(0, 0, 0, 0)
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return "Hoy"
    if (diff === 1) return "Mañana"
    return `En ${diff} días`
  }

  const getModuleLabel = (modulo: string) => {
    const labels: Record<string, string> = {
      protocolo: "Protocolo",
      administracion: "Administración",
      discipulado: "Discipulado",
    }
    return labels[modulo] || modulo
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg">Tienes servicios próximos</p>
              <p className="text-sm font-normal text-gray-500">Esta semana</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
          {services.map((service) => {
            const daysUntil = getDaysUntil(service.fecha)
            const isToday = daysUntil === "Hoy"
            const isTomorrow = daysUntil === "Mañana"

            return (
              <div
                key={service.id}
                className={`p-4 rounded-xl border ${
                  isToday
                    ? "bg-red-50 border-red-200"
                    : isTomorrow
                      ? "bg-amber-50 border-amber-200"
                      : "bg-blue-50 border-blue-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">{formatDate(service.fecha)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{service.asignacion}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500">{getModuleLabel(service.modulo)}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    isToday
                      ? "bg-red-200 text-red-800"
                      : isTomorrow
                        ? "bg-amber-200 text-amber-800"
                        : "bg-blue-200 text-blue-800"
                  }`}>
                    {daysUntil}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} className="w-full">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
