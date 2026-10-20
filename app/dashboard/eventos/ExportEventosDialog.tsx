"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileSpreadsheet, CheckSquare, Square } from "lucide-react"
import { toast } from "sonner"
import { eventoParticipantesService, type EventoTab, type EventoParticipante } from "@/lib/mod/eventos-service"

// ─── Definición de columnas disponibles ───────────────────────────────────────

interface ColDef {
  key: string
  label: string
  group: "personal" | "logistica" | "finanzas" | "equipo"
}

const COLUMN_GROUPS: Record<string, string> = {
  personal: "📋 Datos Personales",
  logistica: "🎒 Logística",
  finanzas: "💰 Finanzas",
  equipo: "🏅 Equipos",
}

const ALL_COLUMNS: ColDef[] = [
  // Personal
  { key: "nombre",            label: "Nombre",              group: "personal" },
  { key: "edad",              label: "Edad",                group: "personal" },
  { key: "telefono",          label: "Teléfono",            group: "personal" },
  { key: "genero",            label: "Género",              group: "personal" },
  { key: "ministerio",        label: "Ministerio",          group: "personal" },
  // Logística
  { key: "contextura",        label: "Contextura",          group: "logistica" },
  { key: "limitacion_fisica", label: "Limitación Física",   group: "logistica" },
  // Finanzas
  { key: "valor",             label: "Valor ($)",           group: "finanzas" },
  { key: "abono",             label: "Abono ($)",           group: "finanzas" },
  { key: "saldo",             label: "Saldo Pendiente ($)", group: "finanzas" },
  { key: "metodo_pago",       label: "Método de Pago",      group: "finanzas" },
  { key: "status_pago",       label: "Estado de Pago",      group: "finanzas" },
  // Equipo
  { key: "equipo",            label: "Equipo",              group: "equipo" },
  { key: "equipo_razon",      label: "Razón de Equipo",     group: "equipo" },
]

const DEFAULT_COLUMNS = new Set<string>([
  "nombre", "edad", "telefono", "genero", "ministerio",
  "contextura", "limitacion_fisica",
  "valor", "abono", "status_pago",
  "equipo",
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

function getStatusPago(p: EventoParticipante): string {
  if (p.valor <= 0) return "Sin costo"
  if (p.abono >= p.valor) return "Cancelado"
  return `Debe $${(p.valor - p.abono).toFixed(2)}`
}

function buildCell(p: EventoParticipante, key: string): string | number {
  switch (key) {
    case "nombre":            return p.nombre
    case "edad":              return p.edad
    case "telefono":          return p.telefono || ""
    case "genero":            return p.genero === "masculino" ? "Masculino" : "Femenino"
    case "ministerio":        return p.ministerio || ""
    case "contextura":        return p.contextura.charAt(0).toUpperCase() + p.contextura.slice(1)
    case "limitacion_fisica": return p.limitacion_fisica ? "Sí" : "No"
    case "valor":             return Number(p.valor)
    case "abono":             return Number(p.abono)
    case "saldo":             return p.valor > 0 ? Math.max(0, Number(p.valor) - Number(p.abono)) : 0
    case "metodo_pago":       return p.abono > 0 ? (p.metodo_pago || "") : ""
    case "status_pago":       return getStatusPago(p)
    case "equipo":            return p.equipo ? p.equipo.charAt(0).toUpperCase() + p.equipo.slice(1) : ""
    case "equipo_razon":      return p.equipo_razon || ""
    default:                  return ""
  }
}

function buildExcel(
  sheets: { name: string; headers: string[]; rows: (string | number)[][] }[]
): Blob {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx")
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows])
    // Ancho de columnas automático
    ws["!cols"] = sheet.headers.map((h) => ({
      wch: Math.min(Math.max(String(h).length + 4, 12), 40),
    }))
    // Autofiltro en la fila de encabezado
    if (sheet.headers.length > 0) {
      ws["!autofilter"] = {
        ref: `A1:${XLSX.utils.encode_col(sheet.headers.length - 1)}1`,
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)) // Excel limita a 31 chars
  }

  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  return new Blob([wbOut], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExportEventosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Todos los eventos disponibles (activos e inactivos) */
  allTabs: EventoTab[]
  /** Evento pre-seleccionado al abrir (tab activo en pantalla) */
  defaultEventoId?: number
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ExportEventosDialog({
  open,
  onOpenChange,
  allTabs,
  defaultEventoId,
}: ExportEventosDialogProps) {
  const [selectedEventos, setSelectedEventos] = useState<Set<number>>(new Set())
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS))
  const [sheetMode, setSheetMode] = useState<"one" | "separate">("separate")
  const [exporting, setExporting] = useState(false)

  // Pre-seleccionar el evento activo cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      setSelectedEventos(
        defaultEventoId != null ? new Set([defaultEventoId]) : new Set()
      )
      setSelectedColumns(new Set(DEFAULT_COLUMNS))
      setSheetMode("separate")
    }
  }, [open, defaultEventoId])

  // ── Toggles ──

  function toggleEvento(id: number) {
    setSelectedEventos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function selectAllEventos() {
    setSelectedEventos(new Set(allTabs.map((t) => t.id)))
  }

  function clearAllEventos() {
    setSelectedEventos(new Set())
  }

  function selectAllColumns() {
    setSelectedColumns(new Set(ALL_COLUMNS.map((c) => c.key)))
  }

  function clearAllColumns() {
    setSelectedColumns(new Set())
  }

  function selectGroupColumns(group: string) {
    const groupKeys = ALL_COLUMNS.filter((c) => c.group === group).map((c) => c.key)
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      // Si todos ya están, desmarcar; si no, marcar todos
      const allSelected = groupKeys.every((k) => next.has(k))
      if (allSelected) {
        groupKeys.forEach((k) => next.delete(k))
      } else {
        groupKeys.forEach((k) => next.add(k))
      }
      return next
    })
  }

  // ── Exportar ──

  async function handleExport() {
    if (selectedEventos.size === 0) {
      toast.error("Seleccione al menos un evento")
      return
    }
    if (selectedColumns.size === 0) {
      toast.error("Seleccione al menos una columna")
      return
    }

    setExporting(true)
    try {
      const orderedCols = ALL_COLUMNS.filter((c) => selectedColumns.has(c.key))
      const headers = orderedCols.map((c) => c.label)

      // Cargar participantes de cada evento seleccionado
      const eventosData: { evento: EventoTab; participantes: EventoParticipante[] }[] = []
      for (const eventoId of selectedEventos) {
        const evento = allTabs.find((t) => t.id === eventoId)
        if (!evento) continue
        const participantes = await eventoParticipantesService.getByEvento(eventoId)
        eventosData.push({ evento, participantes })
      }

      const totalParticipantes = eventosData.reduce(
        (s, e) => s + e.participantes.length, 0
      )
      if (totalParticipantes === 0) {
        toast.error("Los eventos seleccionados no tienen participantes")
        setExporting(false)
        return
      }

      let sheets: { name: string; headers: string[]; rows: (string | number)[][] }[]

      if (sheetMode === "separate") {
        // Una hoja por evento
        sheets = eventosData.map(({ evento, participantes }) => ({
          name: evento.nombre,
          headers,
          rows: participantes.map((p, idx) => {
            const row = orderedCols.map((c) => buildCell(p, c.key))
            // Si "nombre" está incluido, agregar # al inicio
            return row
          }),
        }))
      } else {
        // Todo en una hoja, con columna "Evento" al inicio
        const allRows: (string | number)[][] = []
        for (const { evento, participantes } of eventosData) {
          for (const p of participantes) {
            allRows.push([evento.nombre, ...orderedCols.map((c) => buildCell(p, c.key))])
          }
        }
        sheets = [
          {
            name: "Participantes",
            headers: ["Evento", ...headers],
            rows: allRows,
          },
        ]
      }

      // Si hay más de un evento y modo separado: agregar hoja de resumen
      if (sheetMode === "separate" && eventosData.length > 1) {
        const resumenRows: (string | number)[][] = eventosData.map(({ evento, participantes }) => {
          const totalRecaudado = participantes.reduce((s, p) => s + Number(p.abono), 0)
          const cancelados = participantes.filter((p) => p.valor > 0 && p.abono >= p.valor).length
          const pendientes = participantes.filter((p) => p.valor > 0 && p.abono < p.valor).length
          const sinCosto = participantes.filter((p) => p.valor <= 0).length
          return [
            evento.nombre,
            participantes.length,
            cancelados,
            pendientes,
            sinCosto,
            totalRecaudado,
          ]
        })
        sheets.unshift({
          name: "Resumen",
          headers: ["Evento", "Total", "Cancelados", "Pendientes", "Sin costo", "Recaudado ($)"],
          rows: resumenRows,
        })
      }

      const blob = buildExcel(sheets)
      const eventosNombres =
        eventosData.length === 1
          ? eventosData[0].evento.nombre.replace(/\s+/g, "_")
          : "Multievento"
      downloadBlob(blob, `Eventos_${eventosNombres}_${todayStr()}.xlsx`)

      toast.success(
        `Excel generado: ${totalParticipantes} participante${totalParticipantes !== 1 ? "s" : ""} en ${sheets.length} hoja${sheets.length !== 1 ? "s" : ""}`
      )
      onOpenChange(false)
    } catch (error) {
      console.error("Error al exportar:", error)
      toast.error("Error al generar el Excel")
    } finally {
      setExporting(false)
    }
  }

  // ── Render ──

  const groups = (["personal", "logistica", "finanzas", "equipo"] as const)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Exportar a Excel
          </DialogTitle>
          <DialogDescription>
            Seleccione los eventos, las columnas que desea exportar y el formato de las hojas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* ── SECCIÓN: Eventos ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Eventos <Badge variant="secondary" className="ml-1">{selectedEventos.size}/{allTabs.length}</Badge>
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllEventos}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <CheckSquare className="w-3 h-3" /> Todos
                </button>
                <button
                  type="button"
                  onClick={clearAllEventos}
                  className="text-xs text-gray-400 hover:underline flex items-center gap-0.5"
                >
                  <Square className="w-3 h-3" /> Ninguno
                </button>
              </div>
            </div>

            {allTabs.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No hay eventos disponibles.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allTabs.map((tab) => (
                  <label
                    key={tab.id}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedEventos.has(tab.id)
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedEventos.has(tab.id)}
                      onCheckedChange={() => toggleEvento(tab.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{tab.nombre}</p>
                      {!tab.is_active && (
                        <span className="text-[10px] text-gray-400">inactivo</span>
                      )}
                      {tab.descripcion && (
                        <p className="text-xs text-gray-400 truncate">{tab.descripcion}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* ── SECCIÓN: Columnas ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Columnas <Badge variant="secondary" className="ml-1">{selectedColumns.size}/{ALL_COLUMNS.length}</Badge>
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllColumns}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <CheckSquare className="w-3 h-3" /> Todas
                </button>
                <button
                  type="button"
                  onClick={clearAllColumns}
                  className="text-xs text-gray-400 hover:underline flex items-center gap-0.5"
                >
                  <Square className="w-3 h-3" /> Ninguna
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {groups.map((group) => {
                const groupCols = ALL_COLUMNS.filter((c) => c.group === group)
                const allGroupSelected = groupCols.every((c) => selectedColumns.has(c.key))
                return (
                  <div key={group}>
                    {/* Encabezado de grupo con toggle de grupo */}
                    <button
                      type="button"
                      onClick={() => selectGroupColumns(group)}
                      className="flex items-center gap-1.5 mb-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                          allGroupSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {allGroupSelected && (
                          <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white">
                            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {COLUMN_GROUPS[group]}
                    </button>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 pl-1">
                      {groupCols.map((col) => (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedColumns.has(col.key)}
                            onCheckedChange={() => toggleColumn(col.key)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs text-gray-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── SECCIÓN: Formato de hojas ── */}
          {selectedEventos.size > 1 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Formato de hojas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    sheetMode === "separate"
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="sheetMode"
                    value="separate"
                    checked={sheetMode === "separate"}
                    onChange={() => setSheetMode("separate")}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">Una hoja por evento</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Cada evento en su propia pestaña + hoja de resumen
                    </p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    sheetMode === "one"
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="sheetMode"
                    value="one"
                    checked={sheetMode === "one"}
                    onChange={() => setSheetMode("one")}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">Todo en una hoja</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Todos los eventos combinados con columna "Evento"
                    </p>
                  </div>
                </label>
              </div>
            </section>
          )}

          {/* ── Vista previa de lo que se exportará ── */}
          {selectedEventos.size > 0 && selectedColumns.size > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-700">Vista previa:</p>
              <p>
                📅 {selectedEventos.size} evento{selectedEventos.size !== 1 ? "s" : ""}:{" "}
                {allTabs
                  .filter((t) => selectedEventos.has(t.id))
                  .map((t) => t.nombre)
                  .join(", ")}
              </p>
              <p>
                📊 {selectedColumns.size} columna{selectedColumns.size !== 1 ? "s" : ""}:{" "}
                {ALL_COLUMNS.filter((c) => selectedColumns.has(c.key))
                  .map((c) => c.label)
                  .join(", ")}
              </p>
              {selectedEventos.size > 1 && (
                <p>
                  📄 Formato:{" "}
                  {sheetMode === "separate"
                    ? `${selectedEventos.size + 1} hojas (${selectedEventos.size} eventos + resumen)`
                    : "1 hoja combinada"}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || selectedEventos.size === 0 || selectedColumns.size === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
