"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Pencil, Trash2, Plus, Search, Download, Users, FileSpreadsheet, FilterX } from "lucide-react"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import {
  eventoParticipantesService,
  type EventoParticipante,
  type EventoParticipanteInput,
  type EventoTab,
  type Genero,
  type Contextura,
  type MetodoPago,
  EQUIPOS,
} from "@/lib/mod/eventos-service"
import { ExportEventosDialog } from "./ExportEventosDialog"
import { ColumnFilter } from "@/components/ColumnFilter"


interface EventoTabContentProps {
  evento: EventoTab
  allTabs: EventoTab[]
  canEdit: boolean
  userId: string
  userName: string
  onDataChanged: () => void
}

const emptyForm: Omit<EventoParticipanteInput, "evento_id"> = {
  nombre: "",
  edad: 0,
  telefono: "",
  genero: "masculino",
  contextura: "media",
  limitacion_fisica: false,
  ministerio: "",
  valor: 0,
  abono: 0,
  metodo_pago: "Efectivo",
}

/** Etiqueta de estado de pago (misma lógica que la columna Status). */
function statusLabel(p: EventoParticipante): string {
  if (p.valor <= 0) return "Sin costo"
  if (p.abono >= p.valor) return "Cancelado"
  return "Pendiente"
}

/** Columnas con filtro estilo Excel: id lógico, etiqueta y cómo sacar el valor de cada fila. */
type ColKey = "genero" | "contextura" | "limitacion" | "ministerio" | "metodo" | "status" | "equipo"

const FILTER_COLUMNS: { key: ColKey; label: string; getValue: (p: EventoParticipante) => string }[] = [
  { key: "genero", label: "Género", getValue: (p) => (p.genero === "masculino" ? "Masculino" : "Femenino") },
  { key: "contextura", label: "Contextura", getValue: (p) => p.contextura.charAt(0).toUpperCase() + p.contextura.slice(1) },
  { key: "limitacion", label: "Limitación física", getValue: (p) => (p.limitacion_fisica ? "Sí" : "No") },
  { key: "ministerio", label: "Ministerio", getValue: (p) => p.ministerio?.trim() || "(Sin ministerio)" },
  { key: "metodo", label: "Método de pago", getValue: (p) => (p.abono > 0 ? p.metodo_pago : "(Sin pago)") },
  { key: "status", label: "Status", getValue: statusLabel },
  { key: "equipo", label: "Equipo", getValue: (p) => EQUIPOS.find(e => e.id === p.equipo)?.label || "(Sin equipo)" },
]

export function EventoTabContent({ evento, allTabs, canEdit, userId, userName, onDataChanged }: EventoTabContentProps) {
  const [participantes, setParticipantes] = useState<EventoParticipante[]>([])
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState("")
  // Filtros por columna estilo Excel: para cada columna, un set de valores incluidos.
  // Set vacío = columna sin filtrar (muestra todo).
  const [columnFilters, setColumnFilters] = useState<Record<ColKey, Set<string>>>({
    genero: new Set(), contextura: new Set(), limitacion: new Set(),
    ministerio: new Set(), metodo: new Set(), status: new Set(), equipo: new Set(),
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Omit<EventoParticipanteInput, "evento_id">>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EventoParticipante | null>(null)

  // Importar modal
  const [showImportModal, setShowImportModal] = useState(false)
  const [importEventoId, setImportEventoId] = useState<string>("")
  const [importUsarValorDefault, setImportUsarValorDefault] = useState(true)
  const [importing, setImporting] = useState(false)

  // Exportar modal
  const [showExportDialog, setShowExportDialog] = useState(false)


  useEffect(() => {
    loadData()
    // Sync de catch-up/reconciliación una sola vez al abrir/cambiar de evento.
    // Reconcilia ingresos cross-month (crea faltantes, corrige montos, elimina
    // duplicados y huérfanos). SOLO para usuarios con permiso de edición: el
    // endpoint escribe/borra con service_role, así que un usuario de solo
    // lectura NO debe poder dispararlo con solo abrir la pestaña.
    if (canEdit) {
      eventoParticipantesService.syncMissingIngresos(evento.id)
        .then((r) => { if (r.creados || r.actualizados || r.eliminados) loadData() })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento.id, canEdit])

  // Realtime acotado SOLO a este evento (evita recargar por cambios de otros
  // eventos, que era lo que multiplicaba el sync durante una importacion).
  useRealtimeMultiple(["evento_participantes"], loadData, `evento_id=eq.${evento.id}`)

  async function loadData() {
    try {
      const data = await eventoParticipantesService.getByEvento(evento.id)
      setParticipantes(data)
    } catch (error) {
      console.error("Error cargando participantes:", error)
      toast.error("Error al cargar participantes")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setForm({ ...emptyForm, valor: evento.valor_default })
    setIsEditing(false)
    setEditingId(null)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (p: EventoParticipante) => {
    setForm({
      nombre: p.nombre,
      edad: p.edad,
      telefono: p.telefono || "",
      genero: p.genero,
      contextura: p.contextura,
      limitacion_fisica: p.limitacion_fisica,
      ministerio: p.ministerio || "",
      valor: p.valor,
      abono: p.abono,
      metodo_pago: p.metodo_pago || "Efectivo",
    })
    setIsEditing(true)
    setEditingId(p.id)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nombre || !form.edad) {
      toast.error("Nombre y edad son requeridos")
      return
    }
    setSaving(true)
    try {
      const audit = { userId, userName }
      if (isEditing && editingId) {
        await eventoParticipantesService.update(editingId, { ...form, evento_id: evento.id }, audit)
        toast.success("Participante actualizado")
      } else {
        await eventoParticipantesService.create({ ...form, evento_id: evento.id }, audit)
        toast.success("Participante registrado")
      }
      setIsDialogOpen(false)
      onDataChanged()
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }


  const handleDelete = (p: EventoParticipante) => setDeleteTarget(p)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await eventoParticipantesService.delete(deleteTarget.id, { userId, userName, nombre: deleteTarget.nombre })
      toast.success("Participante eliminado")
      setDeleteTarget(null)
      onDataChanged()
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar")
    }
  }

  const handleImport = async () => {
    if (!importEventoId) {
      toast.error("Seleccione un evento de origen")
      return
    }
    setImporting(true)
    try {
      const result = await eventoParticipantesService.importarDesdeEvento(
        parseInt(importEventoId),
        evento.id,
        {
          usarValorDefault: importUsarValorDefault,
          valorDefault: evento.valor_default,
        },
        { userId, userName }
      )
      toast.success(`Importados ${result.importados} participantes${result.duplicados > 0 ? ` (${result.duplicados} duplicados omitidos)` : ""}`)
      setShowImportModal(false)
      setImportEventoId("")
      onDataChanged()
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Error al importar")
    } finally {
      setImporting(false)
    }
  }

  const getStatus = (p: EventoParticipante): { label: string; variant: "default" | "destructive" | "secondary" } => {
    if (p.valor <= 0) return { label: "Sin costo", variant: "secondary" }
    if (p.abono >= p.valor) return { label: "Cancelado", variant: "default" }
    return { label: `Debe $${(p.valor - p.abono).toFixed(2)}`, variant: "destructive" }
  }

  const getEquipoBadge = (equipo: string | null) => {
    if (!equipo) return null
    const eq = EQUIPOS.find(e => e.id === equipo)
    if (!eq) return null
    return (
      <Badge className={`${eq.bgClass} ${eq.textClass} border ${eq.borderClass}`}>
        {eq.label}
      </Badge>
    )
  }

  const filtered = participantes.filter(p => {
    // Filtro de búsqueda de texto
    if (searchFilter) {
      const q = searchFilter.toLowerCase()
      const matchSearch = p.nombre.toLowerCase().includes(q) || (p.telefono || "").includes(q) || (p.ministerio || "").toLowerCase().includes(q)
      if (!matchSearch) return false
    }
    // Filtros por columna (AND entre columnas, OR dentro de cada una)
    for (const col of FILTER_COLUMNS) {
      const sel = columnFilters[col.key]
      if (sel.size > 0 && !sel.has(col.getValue(p))) return false
    }
    return true
  })

  // Valores únicos por columna (sobre TODOS los participantes, ordenados)
  const columnOptions: Record<ColKey, string[]> = FILTER_COLUMNS.reduce((acc, col) => {
    const vals = Array.from(new Set(participantes.map(col.getValue))).sort((a, b) => a.localeCompare(b, "es"))
    acc[col.key] = vals
    return acc
  }, {} as Record<ColKey, string[]>)

  const hayFiltrosActivos = FILTER_COLUMNS.some(col => columnFilters[col.key].size > 0)

  const setColFilter = (key: ColKey, next: Set<string>) => {
    setColumnFilters(prev => ({ ...prev, [key]: next }))
  }

  const limpiarFiltros = () => {
    setColumnFilters({
      genero: new Set(), contextura: new Set(), limitacion: new Set(),
      ministerio: new Set(), metodo: new Set(), status: new Set(), equipo: new Set(),
    })
  }

  // Helper para renderizar el filtro de una columna en el encabezado
  const colFilter = (key: ColKey, align: "left" | "right" = "left") => {
    const col = FILTER_COLUMNS.find(c => c.key === key)!
    return (
      <ColumnFilter
        label={col.label}
        options={columnOptions[key]}
        selected={columnFilters[key]}
        onChange={(next) => setColFilter(key, next)}
        align={align}
      />
    )
  }

  const otrosEventos = allTabs.filter(t => t.id !== evento.id)
  const tieneEquipos = participantes.some(p => p.equipo)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle>{evento.nombre}</CardTitle>
              <CardDescription>
                Total: {participantes.length} personas registradas
                {evento.descripcion && ` · ${evento.descripcion}`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {otrosEventos.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)} disabled={!canEdit}>
                  <Download className="w-4 h-4 mr-1" /> Importar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportDialog(true)}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
              </Button>
              <Button size="sm" onClick={handleOpenCreate} disabled={!canEdit}>
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, teléfono o ministerio..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              {(hayFiltrosActivos || searchFilter) && (
                <span className="text-xs text-gray-500 normal-case">
                  {filtered.length} de {participantes.length}
                </span>
              )}
              {hayFiltrosActivos && (
                <Button variant="outline" size="sm" onClick={limpiarFiltros} className="text-xs">
                  <FilterX className="w-3.5 h-3.5 mr-1" /> Limpiar filtros
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-center">Edad</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-center">
                    <span className="inline-flex items-center gap-1">Género {colFilter("genero")}</span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="inline-flex items-center gap-1">Contextura {colFilter("contextura")}</span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="inline-flex items-center gap-1">Lim. Física {colFilter("limitacion")}</span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">Ministerio {colFilter("ministerio")}</span>
                  </TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Abono</TableHead>
                  <TableHead className="text-center">
                    <span className="inline-flex items-center gap-1">Método {colFilter("metodo")}</span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="inline-flex items-center gap-1">Status {colFilter("status")}</span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="inline-flex items-center gap-1">Equipo {colFilter("equipo", "right")}</span>
                  </TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-gray-400 py-8">
                      {searchFilter || hayFiltrosActivos ? "No se encontraron resultados con los filtros aplicados" : "No hay participantes registrados"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p, idx) => {
                    const status = getStatus(p)
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-gray-500 font-mono text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell className="text-center">{p.edad}</TableCell>
                        <TableCell>{p.telefono || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {p.genero === "masculino" ? "M" : "F"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center capitalize text-xs">{p.contextura}</TableCell>
                        <TableCell className="text-center">
                          {p.limitacion_fisica ? (
                            <Badge variant="destructive" className="text-xs">Sí</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">No</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{p.ministerio || "—"}</TableCell>
                        <TableCell className="text-right font-mono">${Number(p.valor).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${Number(p.abono).toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {p.abono > 0 ? (p.metodo_pago === "Transferencia" ? "Transf." : "Efect.") : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={status.variant} className={status.variant === "default" ? "bg-green-600" : ""}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{getEquipoBadge(p.equipo)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(p)} disabled={!canEdit}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} disabled={!canEdit}>
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>


          {/* Resumen de pagos (refleja los filtros aplicados) */}
          {participantes.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              {(hayFiltrosActivos || searchFilter) && (
                <p className="text-xs text-gray-500 normal-case mb-2">
                  Resumen sobre {filtered.length} resultado(s) filtrado(s)
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">{(hayFiltrosActivos || searchFilter) ? "Mostrados" : "Total Participantes"}</p>
                  <p className="text-lg font-bold">{filtered.length}</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600">Cancelados</p>
                  <p className="text-lg font-bold text-green-700">
                    {filtered.filter(p => p.valor > 0 && p.abono >= p.valor).length}
                  </p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600">Pendientes</p>
                  <p className="text-lg font-bold text-red-700">
                    {filtered.filter(p => p.valor > 0 && p.abono < p.valor).length}
                  </p>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">Total Recaudado</p>
                  <p className="text-lg font-bold text-blue-700">
                    ${filtered.reduce((s, p) => s + Number(p.abono), 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Equipos visualización rápida */}
          {tieneEquipos && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Users className="w-4 h-4" /> Equipos asignados
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EQUIPOS.map(eq => {
                  const count = participantes.filter(p => p.equipo === eq.id).length
                  return (
                    <div key={eq.id} className={`text-center p-2 rounded-lg border ${eq.borderClass} ${eq.bgClass}`}>
                      <p className={`text-xs ${eq.textClass}`}>{eq.label}</p>
                      <p className={`text-lg font-bold ${eq.textClass}`}>{count}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Dialog crear/editar participante */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Participante" : "Registrar Participante"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Modifique los datos del participante" : "Complete los datos para registrar un nuevo participante"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre Completo *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Edad *</Label>
                <Input
                  type="number"
                  value={form.edad || ""}
                  onChange={(e) => setForm({ ...form, edad: parseInt(e.target.value) || 0 })}
                  placeholder="25"
                />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input
                  value={form.telefono || ""}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="0999999999"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Género *</Label>
                <Select value={form.genero} onValueChange={(v) => setForm({ ...form, genero: v as Genero })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="femenino">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Contextura *</Label>
                <Select value={form.contextura} onValueChange={(v) => setForm({ ...form, contextura: v as Contextura })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delgada">Delgada</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="robusta">Robusta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Ministerio</Label>
                <Input
                  value={form.ministerio || ""}
                  onChange={(e) => setForm({ ...form, ministerio: e.target.value })}
                  placeholder="Alabanza, Intercesión..."
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id={`limitacion-${evento.id}`}
                  checked={form.limitacion_fisica}
                  onCheckedChange={(checked) => setForm({ ...form, limitacion_fisica: checked as boolean })}
                />
                <Label htmlFor={`limitacion-${evento.id}`}>Tiene limitación física</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor || ""}
                  onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                  placeholder="50.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Abono ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.abono || ""}
                  onChange={(e) => setForm({ ...form, abono: parseFloat(e.target.value) || 0 })}
                  placeholder="25.00"
                />
              </div>
            </div>
            {form.abono > 0 && (
              <div className="grid gap-2">
                <Label>Método de Pago *</Label>
                <Select value={form.metodo_pago} onValueChange={(v) => setForm({ ...form, metodo_pago: v as MetodoPago })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Se registrará automáticamente como ingreso en Ingresos y Egresos</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : isEditing ? "Guardar Cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Modal confirmar eliminación */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Participante</DialogTitle>
            <DialogDescription>
              ¿Está seguro de eliminar a <strong>{deleteTarget?.nombre}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal importar participantes */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Participantes</DialogTitle>
            <DialogDescription>
              Traer participantes de otro evento. Se copian los datos personales, se resetea el abono a $0 y se quita la información de cuánto abonó en el evento anterior.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid gap-2">
              <Label>Evento de origen</Label>
              <Select value={importEventoId} onValueChange={setImportEventoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar evento..." /></SelectTrigger>
                <SelectContent>
                  {otrosEventos.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="usar-valor-default"
                checked={importUsarValorDefault}
                onCheckedChange={(checked) => setImportUsarValorDefault(checked as boolean)}
              />
              <Label htmlFor="usar-valor-default" className="text-sm">
                Usar valor por defecto de este evento (${evento.valor_default.toFixed(2)})
              </Label>
            </div>
            {!importUsarValorDefault && (
              <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                Se usará el mismo valor que tenían en el evento original.
              </p>
            )}
            <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
              <p className="font-medium">Al importar:</p>
              <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                <li>Se copian: nombre, edad, teléfono, género, contextura, limitación, ministerio</li>
                <li>Abono se resetea a <strong>$0.00</strong></li>
                <li>No se importa cuánto abonó en el evento anterior</li>
                <li>Se omiten personas que ya existen en este evento (por nombre)</li>
                <li>Equipos no se importan</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportModal(false)} disabled={importing}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing || !importEventoId}>
              {importing ? "Importando..." : "Importar Participantes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de exportación a Excel */}
      <ExportEventosDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        allTabs={allTabs}
        defaultEventoId={evento.id}
      />

    </>
  )
}
