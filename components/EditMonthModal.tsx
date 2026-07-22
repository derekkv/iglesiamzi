import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useMonth } from "@/contexts/month-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SmartDateInput } from "@/components/ui/smart-date-input"
import { toast } from "sonner"

interface EditMonthModalProps {
  month: any
  open: boolean
  setOpen: (open: boolean) => void
}

export function EditMonthModal({ month, open, setOpen }: EditMonthModalProps) {
  const { editMonthDates } = useMonth()


  const [startDate, setStartDate] = useState(month.start_date.split("T")[0])
  const [endDate, setEndDate] = useState(month.end_date?.split("T")[0] || "")

  const handleSave = async () => {
    await editMonthDates(month.id, startDate, endDate || null)
    toast("✔ Fechas actualizadas correctamente")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Fechas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label>Fecha inicio</label>
            <SmartDateInput value={startDate} onChange={(v) => setStartDate(v)} />
          </div>

          <div>
            <label>Fecha cierre</label>
            <SmartDateInput value={endDate} onChange={(v) => setEndDate(v)} />
          </div>
        </div>

  <DialogFooter>
  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
  <Button onClick={handleSave}>Guardar</Button>
</DialogFooter>

      </DialogContent>
    </Dialog>
  )
}
