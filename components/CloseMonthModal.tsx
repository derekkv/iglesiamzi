"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useMonth } from "@/contexts/month-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface CloseMonthModalProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export function CloseMonthModal({ open, setOpen }: CloseMonthModalProps) {
  const { currentMonth, closeCurrentMonth } = useMonth()
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])

  const handleSave = async () => {
    await closeCurrentMonth(endDate)
    toast("Mes cerrado correctamente ✔️")
    setOpen(false)
  }

  if (!currentMonth) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar Mes</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label>Fecha de cierre</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-red-600 text-white hover:bg-red-700">
            Cerrar Mes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
