"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useMonth } from "@/contexts/month-context"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { todayEcuador } from "@/lib/timezone"

interface CloseMonthModalProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export function CloseMonthModal({ open, setOpen }: CloseMonthModalProps) {
  const { currentMonth, closeCurrentMonth } = useMonth()
  const [isClosing, setIsClosing] = useState(false)

  const handleClose = async () => {
    setIsClosing(true)
    try {
      const endDate = todayEcuador()
      await closeCurrentMonth(endDate)
      toast.success("Mes cerrado correctamente")
      setOpen(false)
    } catch (error) {
      toast.error("Error al cerrar el mes")
    } finally {
      setIsClosing(false)
    }
  }

  if (!currentMonth) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar Mes</DialogTitle>
          <DialogDescription>
            Se cerrará el mes <strong>{currentMonth.name}</strong> con fecha de cierre de hoy.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 text-center">
          <p className="text-sm text-gray-600">Fecha de cierre:</p>
          <p className="text-lg font-semibold text-red-600">{todayEcuador()}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isClosing}>Cancelar</Button>
          <Button onClick={handleClose} disabled={isClosing} className="bg-red-600 text-white hover:bg-red-700">
            {isClosing ? "Cerrando..." : "Cerrar Mes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
