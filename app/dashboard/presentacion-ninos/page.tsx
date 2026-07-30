"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SmartDateInput } from "@/components/ui/smart-date-input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft, Search, FileText, Plus, Pencil, Trash2, Lock, Loader2, Download, Files,
} from "lucide-react"
import { toast } from "sonner"
import { useSortOrder, sortByDate } from "@/hooks/use-sort-order"
import { SortToggleButton } from "@/components/SortToggleButton"
import {
  presentacionNinosService,
  type PresentacionNino,
  type PresentacionNinoInput,
} from "@/lib/mod/presentacion-ninos-service"
import { generatePresentacionNinoPDF, generatePresentacionNinosBulkPDF } from "@/lib/generate-presentacion-ninos-pdf"
import { Checkbox } from "@/components/ui/checkbox"


function PresentacionNinosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()

  const [records, setRecords] = useState<PresentacionNino[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const { ascending: sortAsc, toggle: toggleSort } = useSortOrder(true)

  // Modal crear/editar
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PresentacionNino | null>(null)
  const [formData, setFormData] = useState<PresentacionNinoInput>({
    nombre_presentado: "",
    nombre_padre: "",
    nombre_madre: "",
    fecha: "",
    nombre_pastor: "",
    testigo1: "",
    testigo2: "",
  })
  const [saving, setSaving] = useState(false)

  // Modal eliminar
  const [deletingRecord, setDeletingRecord] = useState<PresentacionNino | null>(null)

  // PDF bulk
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const data = await presentacionNinosService.getAll()
      setRecords(data)
    } catch (error) {
      console.error("Error cargando presentaciones:", error)
      toast.error("Error al cargar registros")
    } finally {
      setIsLoading(false)
    }
  }

  useRealtime({ table: "presentacion_ninos", onChange: () => loadRecords(true) })

  // === Filtro de búsqueda ===
  const filtered = records.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      r.nombre_presentado.toLowerCase().includes(q) ||
      r.nombre_padre.toLowerCase().includes(q) ||
      r.nombre_madre.toLowerCase().includes(q)
    )
  })
  const sortedFiltered = sortByDate(filtered, "fecha", sortAsc)

  // === CREAR / EDITAR ===
  const openCreateModal = () => {
    setEditingRecord(null)
    setFormData({ nombre_presentado: "", nombre_padre: "", nombre_madre: "", fecha: "", nombre_pastor: "", testigo1: "", testigo2: "" })
    setShowFormModal(true)
  }

  const openEditModal = (record: PresentacionNino) => {
    checkAndExecute(record.created_at, () => {
      setEditingRecord(record)
      setFormData({
        nombre_presentado: record.nombre_presentado,
        nombre_padre: record.nombre_padre,
        nombre_madre: record.nombre_madre,
        fecha: record.fecha || "",
        nombre_pastor: record.nombre_pastor || "",
        testigo1: record.testigo1 || "",
        testigo2: record.testigo2 || "",
      })
      setShowFormModal(true)
    })
  }

  const handleSave = async () => {
    if (!formData.nombre_presentado.trim()) {
      toast.error("El nombre del presentado es requerido")
      return
    }
    if (!user) return

    setSaving(true)
    try {
      const audit = { userId: user.id, userName: user.username }
      if (editingRecord) {
        await presentacionNinosService.update(editingRecord.id, formData, audit)
        toast.success("Registro actualizado")
      } else {
        await presentacionNinosService.create(formData, audit)
        toast.success("Presentación registrada")
      }
      setShowFormModal(false)
      await loadRecords(true)
    } catch (error) {
      console.error("Error guardando:", error)
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  // === ELIMINAR ===
  const handleDeleteClick = (record: PresentacionNino) => {
    checkAndExecute(record.created_at, () => {
      setDeletingRecord(record)
    })
  }

  const handleConfirmDelete = async () => {
    if (!deletingRecord || !user) return
    try {
      await presentacionNinosService.delete(deletingRecord.id, { userId: user.id, userName: user.username })
      toast.success("Registro eliminado")
      setDeletingRecord(null)
      await loadRecords(true)
    } catch (error) {
      console.error("Error eliminando:", error)
      toast.error("Error al eliminar")
    }
  }

  // === PDF Individual ===
  const handleGeneratePDF = async (record: PresentacionNino) => {
    setGeneratingPdf(true)
    try {
      const pdfBytes = await generatePresentacionNinoPDF({
        nombre_presentado: record.nombre_presentado,
        nombre_padre: record.nombre_padre,
        nombre_madre: record.nombre_madre,
        fecha: record.fecha,
        nombre_pastor: record.nombre_pastor || "Pastor",
        testigo1: record.testigo1 || "",
        testigo2: record.testigo2 || "",
      })
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Presentacion_${record.nombre_presentado.replace(/\s+/g, "_")}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("PDF generado")
    } catch (error) {
      console.error("Error generando PDF:", error)
      toast.error("Error al generar PDF")
    } finally {
      setGeneratingPdf(false)
    }
  }

  // === PDF Masivo ===
  const openBulkModal = () => {
    setBulkSelected(new Set(filtered.map((r) => r.id)))
    setShowBulkModal(true)
  }

  const toggleBulkItem = (id: number) => {
    const next = new Set(bulkSelected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setBulkSelected(next)
  }

  const handleGenerateBulkPDF = async () => {
    if (bulkSelected.size === 0) {
      toast.error("Selecciona al menos un registro")
      return
    }
    setGeneratingPdf(true)
    try {
      const selectedRecords = records.filter((r) => bulkSelected.has(r.id))
      const pdfBytes = await generatePresentacionNinosBulkPDF(
        selectedRecords.map((r) => ({
          nombre_presentado: r.nombre_presentado,
          nombre_padre: r.nombre_padre,
          nombre_madre: r.nombre_madre,
          fecha: r.fecha,
          nombre_pastor: r.nombre_pastor || "Pastor",
          testigo1: r.testigo1 || "",
          testigo2: r.testigo2 || "",
        }))
      )
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Presentacion_Ninos_Todos.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`PDF generado con ${bulkSelected.size} certificado(s)`)
      setShowBulkModal(false)
    } catch (error) {
      console.error("Error generando PDF masivo:", error)
      toast.error("Error al generar PDF")
    } finally {
      setGeneratingPdf(false)
    }
  }

  // === Formatear fecha ===
  const formatDate = (fecha: string) => {
    if (!fecha) return "-"
    const [y, m, d] = fecha.split("-")
    return `${d}/${m}/${y}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Presentación de Niños</h1>
                <p className="text-xs text-gray-500">{records.length} registro(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base">Registros de Presentación</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 w-48"
                  />
                </div>
                {filtered.length > 0 && (
                  <Button variant="outline" size="sm" onClick={openBulkModal} disabled={generatingPdf}>
                    <Files className="w-4 h-4 mr-1" /> Generar Todos PDF
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" onClick={openCreateModal}>
                    <Plus className="w-4 h-4 mr-1" /> Nuevo
                  </Button>
                )}
                <SortToggleButton ascending={sortAsc} onToggle={toggleSort} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                {searchQuery ? "No se encontraron resultados" : "No hay presentaciones registradas"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">Nombre Presentado</TableHead>
                      <TableHead className="text-xs">Nombre Padre</TableHead>
                      <TableHead className="text-xs">Nombre Madre</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFiltered.map((record, idx) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{record.nombre_presentado}</TableCell>
                        <TableCell className="text-xs">{record.nombre_padre}</TableCell>
                        <TableCell className="text-xs">{record.nombre_madre}</TableCell>
                        <TableCell className="text-xs">{formatDate(record.fecha)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleGeneratePDF(record)}
                              disabled={generatingPdf}
                            >
                              <Download className="w-3 h-3 mr-1" /> PDF
                            </Button>
                            {canEdit && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => openEditModal(record)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => handleDeleteClick(record)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modal: Crear/Editar */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Editar Presentación" : "Nueva Presentación"}</DialogTitle>
            <DialogDescription>
              {editingRecord ? "Modifique los datos del registro" : "Complete los datos para registrar una presentación de niño"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre del Presentado *</Label>
              <Input
                value={formData.nombre_presentado}
                onChange={(e) => setFormData({ ...formData, nombre_presentado: e.target.value })}
                placeholder="Nombre completo del niño(a)"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre del Padre</Label>
              <Input
                value={formData.nombre_padre}
                onChange={(e) => setFormData({ ...formData, nombre_padre: e.target.value })}
                placeholder="Nombre completo del padre"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre de la Madre</Label>
              <Input
                value={formData.nombre_madre}
                onChange={(e) => setFormData({ ...formData, nombre_madre: e.target.value })}
                placeholder="Nombre completo de la madre"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Fecha de Presentación</Label>
              <SmartDateInput
                value={formData.fecha}
                onChange={(v) => setFormData({ ...formData, fecha: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre del Pastor</Label>
              <Input
                value={formData.nombre_pastor}
                onChange={(e) => setFormData({ ...formData, nombre_pastor: e.target.value })}
                placeholder="Ej: David Koop"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Testigo 1</Label>
                <Input
                  value={formData.testigo1}
                  onChange={(e) => setFormData({ ...formData, testigo1: e.target.value })}
                  placeholder="Nombre del testigo"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Testigo 2</Label>
                <Input
                  value={formData.testigo2}
                  onChange={(e) => setFormData({ ...formData, testigo2: e.target.value })}
                  placeholder="Nombre del testigo"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormModal(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando...</> : editingRecord ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar eliminación */}
      <Dialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar el registro de <strong>{deletingRecord?.nombre_presentado}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRecord(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Generar PDF masivo */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Generar PDF de todos los certificados</DialogTitle>
            <DialogDescription>
              Seleccione los registros que desea incluir en el PDF ({bulkSelected.size} seleccionados)
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 pb-2 border-b">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkSelected(new Set(filtered.map((r) => r.id)))}
            >
              Seleccionar todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkSelected(new Set())}
            >
              Deseleccionar todos
            </Button>
          </div>
          <div className="overflow-y-auto flex-1 space-y-1 py-2">
            {filtered.map((record) => (
              <div
                key={record.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleBulkItem(record.id)}
              >
                <Checkbox checked={bulkSelected.has(record.id)} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{record.nombre_presentado}</p>
                  <p className="text-xs text-gray-500">{formatDate(record.fecha)} — Padres: {record.nombre_padre} / {record.nombre_madre}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkModal(false)} disabled={generatingPdf}>Cancelar</Button>
            <Button onClick={handleGenerateBulkPDF} disabled={generatingPdf || bulkSelected.size === 0}>
              {generatingPdf ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generando...</> : <><FileText className="w-4 h-4 mr-1" /> Generar PDF ({bulkSelected.size})</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PresentacionNinosPage() {
  return (
    <PermissionsGuard moduleName="presentacion-ninos">
      {(canEdit) => <PresentacionNinosContent canEdit={!!canEdit} />}
    </PermissionsGuard>
  )
}
