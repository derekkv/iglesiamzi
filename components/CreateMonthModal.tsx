"use client"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { toast } from "sonner"
import { useMonth } from "@/contexts/month-context"
import { todayEcuador, currentMonthNameEcuador } from "@/lib/timezone"

interface CreateMonthModalProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export function CreateMonthModal({ open, setOpen }: CreateMonthModalProps) {
  const { startNewMonth } = useMonth()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const startDate = todayEcuador()
      await startNewMonth(startDate, null)
      toast.success("Nuevo mes creado correctamente")
      setOpen(false)
    } catch (error) {
      toast.error("Error al crear el mes")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear nuevo mes</DialogTitle>
          <DialogDescription>
            Se creará el mes <strong>{currentMonthNameEcuador()}</strong> con fecha de inicio de hoy.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 text-center">
          <p className="text-sm text-gray-600">Fecha de inicio:</p>
          <p className="text-lg font-semibold text-blue-700">{todayEcuador()}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isCreating}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creando..." : "Crear Mes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
