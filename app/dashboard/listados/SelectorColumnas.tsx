"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileSpreadsheet, Filter, ShieldAlert } from "lucide-react"

import type { ColumnaReporte } from "@/lib/reportes/types"

interface Props {
  abierto: boolean
  onCambiarAbierto: (abierto: boolean) => void
  titulo: string
  columnas: ColumnaReporte<any>[]
  seleccionadas: string[]
  onCambiarSeleccion: (claves: string[]) => void
  onConfirmar: () => void
  exportando: boolean
}

/**
 * Selector de columnas del reporte. La selección vive en el componente padre y
 * se pasa explícitamente al exportador, de modo que lo que se marca aquí es
 * exactamente lo que termina en el archivo.
 */
export function SelectorColumnas({
  abierto,
  onCambiarAbierto,
  titulo,
  columnas,
  seleccionadas,
  onCambiarSeleccion,
  onConfirmar,
  exportando,
}: Props) {
  const marcadas = new Set(seleccionadas)

  function alternar(clave: string, marcada: boolean) {
    const siguiente = new Set(marcadas)
    if (marcada) siguiente.add(clave)
    else siguiente.delete(clave)
    // Se conserva el orden de declaración de las columnas.
    onCambiarSeleccion(columnas.filter((c) => siguiente.has(c.key)).map((c) => c.key))
  }

  const haySensibles = columnas.some((c) => c.sensible)

  return (
    <Dialog open={abierto} onOpenChange={onCambiarAbierto}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-green-600" />
            Columnas — {titulo}
          </DialogTitle>
          <DialogDescription>
            Marque las columnas que debe incluir el archivo. Salen en el orden en que aparecen aquí.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between border-b pb-3">
          <span className="text-sm text-gray-500">
            {marcadas.size} de {columnas.length} seleccionadas
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onCambiarSeleccion(columnas.map((c) => c.key))}>
              Todas
            </Button>
            <Button variant="outline" size="sm" onClick={() => onCambiarSeleccion([])}>
              Ninguna
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[50vh] space-y-1 py-2">
          {columnas.map((col) => (
            <label
              key={col.key}
              className="flex items-start gap-3 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
            >
              <Checkbox
                className="mt-0.5"
                checked={marcadas.has(col.key)}
                onCheckedChange={(marcada) => alternar(col.key, marcada === true)}
              />
              <span className="flex-1">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  {col.label}
                  {col.sensible && <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />}
                </span>
                {col.ayuda && <span className="block text-xs text-gray-500">{col.ayuda}</span>}
              </span>
              <span className="text-xs text-gray-400 shrink-0">{col.key}</span>
            </label>
          ))}
        </div>

        {haySensibles && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            Las columnas con el escudo contienen datos de salud, de menores o de contacto familiar.
            Van incluidas: desmárquelas si el reporte no las necesita.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onCambiarAbierto(false)}>
            Cerrar
          </Button>
          <Button onClick={onConfirmar} disabled={marcadas.size === 0 || exportando}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar ({marcadas.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
