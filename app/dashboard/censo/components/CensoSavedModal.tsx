"use client"

import type { CensoRecord } from "@/lib/mod/censo-service"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Check } from "lucide-react"

interface CensoSavedModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  record: CensoRecord | null
}

export function CensoSavedModal({ isOpen, onOpenChange, record }: CensoSavedModalProps) {
  if (!record) return null

  const fields: { label: string; value: string | number | undefined | null }[] = [
    { label: "Cédula", value: record.cedula },
    { label: "Apellidos y Nombres", value: record.apellidos_nombres },
    { label: "Fecha de Nacimiento", value: record.fecha_nacimiento },
    { label: "Edad", value: record.edad },
    { label: "Sexo", value: record.sexo },
    { label: "Estado Civil", value: record.estado_civil },
    { label: "Celular", value: record.celular },
    { label: "Correo", value: record.correo },
    { label: "Dirección", value: record.direccion },
    { label: "Ciudad", value: record.ciudad },
    { label: "Cargo", value: record.cargo },
    { label: "Lugar de Trabajo", value: record.lugar_trabajo },
    { label: "Ministerio", value: record.ministerio },
  ]

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-green-700">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            Guardado
          </AlertDialogTitle>
          <AlertDialogDescription>
            El registro se guardó correctamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          <div className="space-y-2">
            {fields.map(({ label, value }) =>
              value ? (
                <div key={label} className="flex justify-between items-start text-sm border-b border-gray-100 pb-1.5">
                  <span className="text-gray-500 shrink-0">{label}</span>
                  <span className="text-gray-900 font-medium text-right ml-4">{value}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction className="bg-green-600 hover:bg-green-700">
            Aceptar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
