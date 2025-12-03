import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { toast } from "sonner"
import { useMonth } from "@/contexts/month-context"

interface CreateMonthModalProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export function CreateMonthModal({ open, setOpen }: CreateMonthModalProps) {
  const { startNewMonth } = useMonth()

  const today = new Date().toISOString().split("T")[0]
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState("")

  const handleCreate = async () => {
    await startNewMonth(startDate, endDate || null)
    toast.success("📅 Nuevo mes creado correctamente")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear nuevo mes</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label>Fecha de inicio</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          <div>
            <label>Fecha de cierre (opcional)</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreate}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
