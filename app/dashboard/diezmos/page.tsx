"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Plus, Trash2, Edit2, Search, Lock } from "lucide-react"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { diezmosService, type DiezmoRecord, type DiezmoWithMonth } from "@/lib/mod/diezmos-service"


function DiezmosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { currentMonth } = useMonth()
  const { checkAndExecute } = useSecurityCheck()
  const [records, setRecords] = useState<DiezmoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DiezmoRecord | null>(null)
  const [editingRecord, setEditingRecord] = useState<DiezmoRecord | null>(null)
  const [form, setForm] = useState({ fecha: "", donador: "", valor: "", transaccion: "efectivo" as "efectivo" | "transferencia" })

  // Search state
  const [searchResults, setSearchResults] = useState<DiezmoWithMonth[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchFilters, setSearchFilters] = useState({ donador: "", fechaDesde: "", fechaHasta: "" })


  const loadData = useCallback(async (silent = false) => {
    if (!currentMonth) return
    try {
      if (!silent) setLoading(true)
      const data = await diezmosService.getDiezmosByMonth(currentMonth.id)
      setRecords(data)
    } catch (error) {
      console.error("Error cargando diezmos:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => { loadData() }, [loadData])
  useRealtime({ table: "diezmos", onChange: () => loadData(true) })

  const handleCreate = async () => {
    if (!form.donador.trim() || !form.valor || !currentMonth) return
    setSaving(true)
    try {
      const numero = await diezmosService.getNextNumber(currentMonth.id)
      const today = new Date().toISOString().split("T")[0]
      await diezmosService.createDiezmo(
        { mes_id: currentMonth.id, numero, fecha: today, donador: form.donador.trim(), valor: Number(form.valor), transaccion: form.transaccion },
        { user_id: user!.id, user_name: user!.username }
      )
      setForm({ fecha: "", donador: "", valor: "", transaccion: "efectivo" })
      setShowAddDialog(false)
      await loadData(true)
    } catch (error) {
      console.error("Error creando diezmo:", error)
    } finally { setSaving(false) }
  }


  const handleEdit = async () => {
    if (!editingRecord || !form.donador.trim() || !form.valor) return
    setSaving(true)
    try {
      await diezmosService.updateDiezmo(
        editingRecord.id,
        { donador: form.donador.trim(), valor: Number(form.valor), transaccion: form.transaccion },
        { user_id: user!.id, user_name: user!.username }
      )
      setShowEditDialog(false)
      setEditingRecord(null)
      setForm({ fecha: "", donador: "", valor: "", transaccion: "efectivo" })
      await loadData(true)
    } catch (error) {
      console.error("Error editando diezmo:", error)
    } finally { setSaving(false) }
  }

  const handleDelete = async (record: DiezmoRecord) => {
    try {
      await diezmosService.deleteDiezmo(record.id, { user_id: user!.id, user_name: user!.username })
      await loadData(true)
    } catch (error) {
      console.error("Error eliminando diezmo:", error)
    }
  }

  const openEdit = (record: DiezmoRecord) => {
    setEditingRecord(record)
    setForm({ fecha: record.fecha, donador: record.donador, valor: String(record.valor), transaccion: record.transaccion || "efectivo" })
    setShowEditDialog(true)
  }


  const handleSearch = async () => {
    try {
      setSearchLoading(true)
      const results = await diezmosService.searchDiezmos(searchFilters)
      setSearchResults(results)
    } catch (error) {
      console.error("Error buscando diezmos:", error)
    } finally { setSearchLoading(false) }
  }

  // Totales
  const totalTransferencia = records.filter(r => r.transaccion === "transferencia").reduce((sum, r) => sum + Number(r.valor), 0)
  const totalEfectivo = records.filter(r => r.transaccion === "efectivo").reduce((sum, r) => sum + Number(r.valor), 0)
  const totalGeneral = totalTransferencia + totalEfectivo
  const totalSearchResults = searchResults.reduce((sum, r) => sum + Number(r.valor), 0)

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    const date = new Date(dateStr + "T12:00:00")
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de diezmos...</p>
        </div>
      </div>
    )
  }

  if (!currentMonth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirigiendo...</p>
        </div>
      </div>
    )
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
                <h1 className="text-xl font-semibold text-gray-900">Diezmos</h1>
                <p className="text-sm text-gray-600">Mes activo: {currentMonth?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => { setForm({ fecha: "", donador: "", valor: "", transaccion: "efectivo" }); setShowAddDialog(true) }}>
                  <Plus className="w-4 h-4 mr-1" /> Registrar Diezmo
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>


      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="mes" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="mes">Diezmos del Mes</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          {/* Tab: Diezmos del mes actual */}
          <TabsContent value="mes" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Diezmos (Transferencia)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">${totalTransferencia.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Diezmos (Efectivo)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">${totalEfectivo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total General</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">${totalGeneral.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-gray-500 mt-1">{records.length} registros</p>
                </CardContent>
              </Card>
            </div>


            {/* Tabla de diezmos del mes */}
            <Card>
              <CardHeader>
                <CardTitle>Registros de Diezmos — {currentMonth.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {records.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay diezmos registrados para este mes.</p>
                    {canEdit && <p className="text-sm mt-1">Haz clic en "Registrar Diezmo" para agregar uno.</p>}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">#</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Fecha</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Donante</th>
                          <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Transacción</th>
                          <th className="border border-gray-300 px-3 py-2 text-right font-semibold">Valor</th>
                          {canEdit && <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-1.5 font-medium">{record.numero}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{formatDate(record.fecha)}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{record.donador}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-center">
                              <Badge variant={record.transaccion === "transferencia" ? "default" : "secondary"} className={record.transaccion === "transferencia" ? "bg-green-100 text-green-800 border-green-200 text-xs" : "bg-amber-100 text-amber-800 border-amber-200 text-xs"}>
                                {record.transaccion === "transferencia" ? "Transferencia" : "Efectivo"}
                              </Badge>
                            </td>
                            <td className="border border-gray-300 px-3 py-1.5 text-right font-medium">${Number(record.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                            {canEdit && (
                              <td className="border border-gray-300 px-3 py-1.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => checkAndExecute(record.created_at || new Date().toISOString(), () => openEdit(record))}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => checkAndExecute(record.created_at || new Date().toISOString(), () => setPendingDelete(record))}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-green-50 font-semibold text-sm">
                          <td colSpan={3} className="border border-gray-300 px-3 py-1.5 text-right">Total Transferencia:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Transferencia</Badge></td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalTransferencia.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                        <tr className="bg-amber-50 font-semibold text-sm">
                          <td colSpan={3} className="border border-gray-300 px-3 py-1.5 text-right">Total Efectivo:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Efectivo</Badge></td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalEfectivo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                        <tr className="bg-blue-50 font-bold text-sm">
                          <td colSpan={4} className="border border-gray-300 px-3 py-1.5 text-right">TOTAL GENERAL:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalGeneral.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* Tab: Historial */}
          <TabsContent value="historial" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Buscar Diezmos (Todos los meses)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="searchDonador">Donante</Label>
                    <Input id="searchDonador" placeholder="Buscar por nombre..." value={searchFilters.donador} onChange={(e) => setSearchFilters({ ...searchFilters, donador: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="searchFechaDesde">Fecha Desde</Label>
                    <Input id="searchFechaDesde" type="date" value={searchFilters.fechaDesde} onChange={(e) => setSearchFilters({ ...searchFilters, fechaDesde: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="searchFechaHasta">Fecha Hasta</Label>
                    <Input id="searchFechaHasta" type="date" value={searchFilters.fechaHasta} onChange={(e) => setSearchFilters({ ...searchFilters, fechaHasta: e.target.value })} />
                  </div>
                </div>
                <Button onClick={handleSearch} disabled={searchLoading} className="w-full md:w-auto">
                  <Search className="w-4 h-4 mr-2" />
                  {searchLoading ? "Buscando..." : "Buscar"}
                </Button>
              </CardContent>
            </Card>


            {searchResults.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Resultados</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-blue-600">{searchResults.length}</div></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">${totalSearchResults.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</div></CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader><CardTitle>Resultados de Búsqueda</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 px-3 py-2 text-left font-semibold">#</th>
                            <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Mes</th>
                            <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Fecha</th>
                            <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Donante</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Transacción</th>
                            <th className="border border-gray-300 px-3 py-2 text-right font-semibold">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchResults.map((record, index) => (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-3 py-1.5 font-medium">{index + 1}</td>
                              <td className="border border-gray-300 px-3 py-1.5">{record.mes_name}</td>
                              <td className="border border-gray-300 px-3 py-1.5">{formatDate(record.fecha)}</td>
                              <td className="border border-gray-300 px-3 py-1.5">{record.donador}</td>
                              <td className="border border-gray-300 px-3 py-1.5 text-center">
                                <Badge variant={record.transaccion === "transferencia" ? "default" : "secondary"} className={record.transaccion === "transferencia" ? "bg-green-100 text-green-800 border-green-200 text-xs" : "bg-amber-100 text-amber-800 border-amber-200 text-xs"}>
                                  {record.transaccion === "transferencia" ? "Transferencia" : "Efectivo"}
                                </Badge>
                              </td>
                              <td className="border border-gray-300 px-3 py-1.5 text-right font-medium">${Number(record.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {searchResults.length === 0 && !searchLoading && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Usa los filtros para buscar diezmos en todos los meses</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>


        {/* Dialog: Agregar Diezmo */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Diezmo</DialogTitle>
              <DialogDescription>Ingrese los datos del diezmo</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="diezmoDonante">Donante</Label>
                <Input id="diezmoDonante" placeholder="Nombre del donante" value={form.donador} onChange={(e) => setForm({ ...form, donador: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="diezmoValor">Valor</Label>
                <Input id="diezmoValor" type="number" min="0" step="0.01" placeholder="0.00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div>
                <Label>Transacción</Label>
                <Select value={form.transaccion} onValueChange={(v) => setForm({ ...form, transaccion: v as "efectivo" | "transferencia" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !form.donador.trim() || !form.valor}>{saving ? "Guardando..." : "Registrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Dialog: Editar Diezmo */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Diezmo</DialogTitle>
              <DialogDescription>Modifique los datos del diezmo</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editDonante">Donante</Label>
                <Input id="editDonante" placeholder="Nombre del donante" value={form.donador} onChange={(e) => setForm({ ...form, donador: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="editValor">Valor</Label>
                <Input id="editValor" type="number" min="0" step="0.01" placeholder="0.00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div>
                <Label>Transacción</Label>
                <Select value={form.transaccion} onValueChange={(v) => setForm({ ...form, transaccion: v as "efectivo" | "transferencia" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving || !form.donador.trim() || !form.valor}>{saving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* AlertDialog: Confirmar eliminar */}
        <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar diezmo?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará el diezmo #{pendingDelete?.numero} de {pendingDelete?.donador} (${pendingDelete?.valor}). Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (pendingDelete) handleDelete(pendingDelete); setPendingDelete(null) }}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

export default function DiezmosPage() {
  return (
    <PermissionsGuard moduleName="diezmos">
      {(canEdit) => <DiezmosContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
