"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { useRealtime } from "@/hooks/use-realtime"
import { useToast } from "@/hooks/use-toast"
import { reporteIncidenciasHerederosService, type ReporteIncidencia } from "@/lib/mod/reporte-incidencias-herederos-service"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { ArrowLeft, Plus, Pencil, Trash2, Search, AlertTriangle, Clock, CalendarDays, User, BookOpen } from "lucide-react"

function ReporteIncidenciasContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()
  const { toast } = useToast()

  const [records, setRecords] = useState<ReporteIncidencia[]>([])
  const [filteredRecords, setFilteredRecords] = useState<ReporteIncidencia[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Filtros
  const [searchQuery, setSearchQuery] = useState("")
  const [filterFechaDesde, setFilterFechaDesde] = useState("")
  const [filterFechaHasta, setFilterFechaHasta] = useState("")

  // Modales
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<ReporteIncidencia | null>(null)

  // Form
  const getDefaultForm = (): Omit<ReporteIncidencia, "id" | "created_at" | "updated_at"> => ({
    fecha: new Date().toISOString().split("T")[0],
    hora: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false }),
    nombre_nino: "",
    detalle_incidencia: "",
    maestro_presente: "",
  })

  const [formData, setFormData] = useState(getDefaultForm())

  useEffect(() => {
    loadRecords()
  }, [])

  useEffect(() => {
    let filtered = records
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.nombre_nino.toLowerCase().includes(q) ||
          r.maestro_presente.toLowerCase().includes(q) ||
          r.detalle_incidencia.toLowerCase().includes(q)
      )
    }
    if (filterFechaDesde) {
      filtered = filtered.filter((r) => r.fecha >= filterFechaDesde)
    }
    if (filterFechaHasta) {
      filtered = filtered.filter((r) => r.fecha <= filterFechaHasta)
    }
    setFilteredRecords(filtered)
  }, [searchQuery, filterFechaDesde, filterFechaHasta, records])

  useRealtime({ table: "reporte_incidencias_herederos", onChange: () => loadRecords(true) })

  const loadRecords = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const data = await reporteIncidenciasHerederosService.getAll()
      setRecords(data)
      setFilteredRecords(data)
    } catch (error) {
      console.error("Error loading records:", error)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.nombre_nino.trim() || !formData.detalle_incidencia.trim() || !formData.maestro_presente.trim()) {
      toast({ title: "Error", description: "Nombre del niño, detalle y maestro presente son obligatorios", variant: "destructive" })
      return
    }
    try {
      setIsSaving(true)
      await reporteIncidenciasHerederosService.create(formData, { user_id: user!.id, user_name: user!.username })
      toast({ title: "Registrado", description: "Incidencia registrada correctamente" })
      setIsCreateDialogOpen(false)
      setFormData(getDefaultForm())
      loadRecords()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo registrar", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenEdit = (record: ReporteIncidencia) => {
    checkAndExecute(record.created_at || "", () => {
      setCurrentRecord(record)
      setFormData({
        fecha: record.fecha,
        hora: record.hora,
        nombre_nino: record.nombre_nino,
        detalle_incidencia: record.detalle_incidencia,
        maestro_presente: record.maestro_presente,
      })
      setIsEditDialogOpen(true)
    })
  }

  const handleUpdate = async () => {
    if (!currentRecord?.id || !formData.nombre_nino.trim() || !formData.detalle_incidencia.trim() || !formData.maestro_presente.trim()) {
      toast({ title: "Error", description: "Nombre del niño, detalle y maestro presente son obligatorios", variant: "destructive" })
      return
    }
    try {
      setIsSaving(true)
      await reporteIncidenciasHerederosService.update(currentRecord.id, formData, { user_id: user!.id, user_name: user!.username })
      toast({ title: "Actualizado", description: "Incidencia actualizada correctamente" })
      setIsEditDialogOpen(false)
      setCurrentRecord(null)
      setFormData(getDefaultForm())
      loadRecords()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo actualizar", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenDelete = (record: ReporteIncidencia) => {
    checkAndExecute(record.created_at || "", () => {
      setCurrentRecord(record)
      setIsDeleteDialogOpen(true)
    })
  }

  const handleDelete = async () => {
    if (!currentRecord?.id) return
    try {
      setIsSaving(true)
      await reporteIncidenciasHerederosService.delete(currentRecord.id, { user_id: user!.id, user_name: user!.username })
      toast({ title: "Eliminado", description: "Incidencia eliminada correctamente" })
      setIsDeleteDialogOpen(false)
      setCurrentRecord(null)
      loadRecords()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo eliminar", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery("")
    setFilterFechaDesde("")
    setFilterFechaHasta("")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 sm:h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Reporte de Incidencias</h1>
                <p className="text-xs text-gray-500">Herederos del Reino</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && <Badge variant="secondary" className="text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Solo lectura</Badge>}
              {canEdit && (
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => { setFormData(getDefaultForm()); setIsCreateDialogOpen(true) }}>
                  <Plus className="w-4 h-4 mr-1" />Registrar Incidencia
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Incidencias</p>
                  <p className="text-2xl font-bold">{records.length}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Este Mes</p>
                  <p className="text-2xl font-bold">
                    {records.filter((r) => r.fecha.startsWith(new Date().toISOString().slice(0, 7))).length}
                  </p>
                </div>
                <CalendarDays className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Hoy</p>
                  <p className="text-2xl font-bold">
                    {records.filter((r) => r.fecha === new Date().toISOString().split("T")[0]).length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Buscar</label>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nombre del niño, maestro o detalle..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Desde</label>
                <Input type="date" value={filterFechaDesde} onChange={(e) => setFilterFechaDesde(e.target.value)} className="w-[150px]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
                <Input type="date" value={filterFechaHasta} onChange={(e) => setFilterFechaHasta(e.target.value)} className="w-[150px]" />
              </div>
              <Button variant="outline" size="sm" onClick={clearFilters}>Limpiar</Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Registro de Incidencias
              <Badge variant="secondary" className="ml-2">{filteredRecords.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Cargando registros...</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead className="font-semibold w-[100px]">Fecha</TableHead>
                      <TableHead className="font-semibold w-[70px]">Hora</TableHead>
                      <TableHead className="font-semibold">Nombre del Niño(a)</TableHead>
                      <TableHead className="font-semibold max-w-[300px]">Detalle de Incidencia</TableHead>
                      <TableHead className="font-semibold">Maestro Presente</TableHead>
                      {canEdit && <TableHead className="font-semibold text-right w-[100px]">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8 text-gray-500">
                          No hay incidencias registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow key={record.id} className="hover:bg-gray-50/50">
                          <TableCell className="text-sm font-medium">{new Date(record.fecha + "T12:00:00").toLocaleDateString("es-EC")}</TableCell>
                          <TableCell className="text-sm">{record.hora}</TableCell>
                          <TableCell className="font-medium">{record.nombre_nino}</TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm text-gray-700 line-clamp-2" title={record.detalle_incidencia}>{record.detalle_incidencia}</p>
                          </TableCell>
                          <TableCell className="text-sm">{record.maestro_presente}</TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50" onClick={() => handleOpenEdit(record)} title="Editar">
                                  <Pencil className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => handleOpenDelete(record)} title="Eliminar">
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Crear */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="w-[calc(100%-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Incidencia</DialogTitle>
              <DialogDescription>Complete todos los campos. Sea lo más detallado posible en la descripción.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha *</label>
                  <Input type="date" value={formData.fecha} onChange={(e) => setFormData({ ...formData, fecha: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hora *</label>
                  <Input type="time" value={formData.hora} onChange={(e) => setFormData({ ...formData, hora: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre del Niño(a) *</label>
                <Input placeholder="Nombre completo del niño(a)" value={formData.nombre_nino} onChange={(e) => setFormData({ ...formData, nombre_nino: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Detalle de la Incidencia *</label>
                <Textarea placeholder="Describa con el mayor detalle posible lo ocurrido: qué pasó, cómo, cuándo exactamente, quiénes estuvieron involucrados, acciones tomadas, estado del niño(a), etc." value={formData.detalle_incidencia} onChange={(e) => setFormData({ ...formData, detalle_incidencia: e.target.value })} rows={8} className="resize-y min-h-[150px]" />
                <p className="text-xs text-gray-500">Sea lo más detallado posible. Incluya toda la información relevante.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Profesor/Maestro Presente *</label>
                <Input placeholder="Nombre del profesor o maestro presente durante la incidencia" value={formData.maestro_presente} onChange={(e) => setFormData({ ...formData, maestro_presente: e.target.value })} />
              </div>
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">{isSaving ? "Guardando..." : "Registrar"}</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Editar */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="w-[calc(100%-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Incidencia</DialogTitle>
              <DialogDescription>Modifique los datos de la incidencia.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha *</label>
                  <Input type="date" value={formData.fecha} onChange={(e) => setFormData({ ...formData, fecha: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hora *</label>
                  <Input type="time" value={formData.hora} onChange={(e) => setFormData({ ...formData, hora: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre del Niño(a) *</label>
                <Input placeholder="Nombre completo del niño(a)" value={formData.nombre_nino} onChange={(e) => setFormData({ ...formData, nombre_nino: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Detalle de la Incidencia *</label>
                <Textarea placeholder="Describa con el mayor detalle posible lo ocurrido..." value={formData.detalle_incidencia} onChange={(e) => setFormData({ ...formData, detalle_incidencia: e.target.value })} rows={8} className="resize-y min-h-[150px]" />
                <p className="text-xs text-gray-500">Sea lo más detallado posible. Incluya toda la información relevante.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Profesor/Maestro Presente *</label>
                <Input placeholder="Nombre del profesor o maestro presente durante la incidencia" value={formData.maestro_presente} onChange={(e) => setFormData({ ...formData, maestro_presente: e.target.value })} />
              </div>
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleUpdate} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">{isSaving ? "Guardando..." : "Actualizar"}</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Eliminar */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar esta incidencia?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará permanentemente el reporte de incidencia de <strong>{currentRecord?.nombre_nino}</strong> del {currentRecord?.fecha ? new Date(currentRecord.fecha + "T12:00:00").toLocaleDateString("es-EC") : ""}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isSaving} className="bg-red-600 hover:bg-red-700">
                {isSaving ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

export default function ReporteIncidenciasHerederosPage() {
  return (
    <PermissionsGuard moduleName="reporte_incidencias_herederos" alternateModules={["herederos_baby", "herederos_kids", "herederos_explores", "herederos_champions"]}>
      {(canEdit) => <ReporteIncidenciasContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
