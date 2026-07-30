"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import type { CatalogOption } from "@/lib/mod/censo-service"

interface CatalogManagerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  catalogType: string
  catalogLabel: string
  options: CatalogOption[]
  onAddOption: (value: string) => Promise<void>
  onDeleteOption: (id: number) => Promise<void>
}

export function CatalogManager({
  isOpen,
  onOpenChange,
  catalogType,
  catalogLabel,
  options,
  onAddOption,
  onDeleteOption,
}: CatalogManagerProps) {
  const [newOptionValue, setNewOptionValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleAdd = async () => {
    if (!newOptionValue.trim()) return
    setIsSaving(true)
    try {
      await onAddOption(newOptionValue.trim())
      setNewOptionValue("")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestionar Opciones de {catalogLabel}</DialogTitle>
          <DialogDescription>Agregue o elimine opciones para este catálogo</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nueva opción..."
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isSaving && handleAdd()}
              disabled={isSaving}
            />
            <Button onClick={handleAdd} disabled={isSaving || !newOptionValue.trim()}>
              {isSaving ? "Agregando..." : "Agregar"}
            </Button>
          </div>
          
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {options.length === 0 ? (
              <p className="text-center py-4 text-sm text-gray-500">No hay opciones registradas</p>
            ) : (
              options.map((option) => (
                <div key={option.id} className="flex items-center justify-between p-2 border rounded border-gray-100 dark:border-gray-800">
                  <span className="text-sm">{option.valor}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => option.id && onDeleteOption(option.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
