"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionsGuard } from "@/lib/permissions-guard"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

import { ArrowLeft, Plus, Trash2, Edit2, Search, Lock } from "lucide-react"
import { diezmosService, type DiezmoRecord, type DiezmoWithMonth } from "@/lib/mod/diezmos-service"
import { useMonth } from "@/contexts/month-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { toast } from "sonner"

function DiezmosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { checkAndExecute } = useSecurityCheck()
  const [activeMonth, setActiveMonth] = useState<{ id: string; name: string } | null>(null)
  const [records, setRecords] = useState<DiezmoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { currentMonth } = useMonth()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DiezmoRecord | null>(null)
  const [editingRecord, setEditingRecord] = useState<DiezmoRecord | null>(null)

  const [searchResults, setSearchResults] = useState<DiezmoWithMonth[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchFilters, setSearchFilters] = useState({
    donador: "",
    fechaDesde: "",
    fechaHasta: "",
  })

  // Estados para formulario
  const [formData, setFormData] = useState({
    fecha: "",
    donador: "",
    valor: "",
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        if (!currentMonth) return

        setActiveMonth(currentMonth)

        const data = await diezmosService.getDiezmosByMonth(currentMonth.id)
        setRecords(data)
      } catch (error) {
        console.error("Error cargando datos:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [currentMonth])

  const handleSearch = async () => {
    try {
      setSearchLoading(true)
      const results = await diezmosService.searchDiezmos(searchFilters)
      setSearchResults(results)
    } catch (error) {
      console.error("Error buscando diezmos:", error)
      alert("Error al buscar los diezmos")
    } finally {
      setSearchLoading(false)
    }
  }

  const getNextNumber = async (): Promise<number> => {
    try {
      if (!activeMonth) return 1
      return await diezmosService.getNextNumber(activeMonth.id)
    } catch (error) {
      console.error("Error getting next number:", error)
      return 1
    }
  }

  const handleAdd = async () => {
    if (!formData.fecha || !formData.donador || !formData.valor) {
      alert("Por favor complete todos los campos")
      return
    }
    if (!activeMonth) {
      alert("No hay mes activo")
      return
    }

    try {
      setSaving(true)
      const nextNumber = await getNextNumber()

      const newRecord = await diezmosService.createDiezmo({
        mes_id: activeMonth.id,
        numero: nextNumber,
        fecha: formData.fecha,
        donador: formData.donador.trim(),
        valor: Number.parseFloat(formData.valor),
      })

      setRecords((prev) => [...prev, newRecord])
      setFormData({ fecha: "", donador: "", valor: "" })
      setShowAddModal(false)
    } catch (error) {
      console.error("Error adding diezmo:", error)
      alert("Error al agregar el diezmo")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editingRecord || !formData.fecha || !formData.donador || !formData.valor) {
      alert("Por favor complete todos los campos")
      return
    }

    try {
      setSaving(true)
      const updatedRecord = await diezmosService.updateDiezmo(editingRecord.id, {
        fecha: formData.fecha,
        donador: formData.donador.trim(),
        valor: Number.parseFloat(formData.valor),
      })

      setRecords((prev) => prev.map((record) => (record.id === editingRecord.id ? updatedRecord : record)))
      setShowEditModal(false)
      setEditingRecord(null)
      setFormData({ fecha: "", donador: "", valor: "" })
    } catch (error) {
      console.error("Error updating diezmo:", error)
      alert("Error al actualizar el diezmo")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRequest = (record: DiezmoRecord) => {
    checkAndExecute(record.created_at || new Date().toISOString(), () => {
      setDeleteTarget(record)
    })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await diezmosService.deleteDiezmo(deleteTarget.id)
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      toast.success("Diezmo eliminado")
    } catch (error) {
      console.error("Error deleting diezmo:", error)
      toast.error("Error al eliminar el diezmo")
    } finally {
      setDeleteTarget(null)
    }
  }

  const openEditModal = (record: DiezmoRecord) => {
    checkAndExecute(record.created_at || new Date().toISOString(), () => {
      setEditingRecord(record)
      setFormData({
        fecha: record.fecha,
        donador: record.donador,
        valor: record.valor.toString(),
      })
      setShowEditModal(true)
    })
  }

  const resetForm = () => {
    setFormData({ fecha: "", donador: "", valor: "" })
    setEditingRecord(null)
  }

  const totalDiezmos = records.reduce((sum, record) => sum + Number(record.valor), 0)
  const totalSearchResults = searchResults.reduce((sum, record) => sum + Number(record.valor), 0)

  function formatDateForTable(dateString: string) {
    if (!dateString) return ""
    const date = new Date(dateString)
    const day = String(date.getUTCDate()).padStart(2, "0")
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const year = date.getUTCFullYear()
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Listado de Diezmos</h1>
                <p className="text-sm text-gray-600">Mes activo: {activeMonth?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {!canEdit && (
                <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  <Lock className="w-3 h-3" /> Solo lectura
                </span>
              )}
              {canEdit && (
                <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Agregar Diezmo</span>
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agregar Nuevo Diezmo</DialogTitle>
                    <DialogDescription>
                      Complete la información del diezmo. El número se asignará automáticamente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="fecha">Fecha</Label>
                      <Input
                        id="fecha"
                        type="date"
                        value={formData.fecha}
                        onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="donador">Donador</Label>
                      <Input
                        id="donador"
                        value={formData.donador}
                        onChange={(e) => setFormData({ ...formData, donador: e.target.value })}
                        placeholder="Nombre del donador"
                      />
                    </div>
                    <div>
                      <Label htmlFor="valor">Valor</Label>
                      <Input
                        id="valor"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddModal(false)
                        resetForm()
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleAdd} disabled={saving}>
                      {saving ? "Guardando..." : "Agregar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs defaultValue="mes" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="mes">Diezmos del Mes</TabsTrigger>
              <TabsTrigger value="buscar">Buscar Diezmos</TabsTrigger>
            </TabsList>

            {/* Tab: Diezmos del mes actual */}
            <TabsContent value="mes" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Registros</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{records.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Diezmos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      ${totalDiezmos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Registros de Diezmos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Número</th>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Fecha</th>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Donador</th>
                          <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Valor</th>
                          {canEdit && <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-3 font-medium">{record.numero}</td>
                            <td className="border border-gray-300 px-4 py-3">{formatDateForTable(record.fecha)}</td>
                            <td className="border border-gray-300 px-4 py-3">{record.donador}</td>
                            <td className="border border-gray-300 px-4 py-3 text-right font-medium">
                              ${Number(record.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                            </td>
                            {canEdit && (
                              <td className="border border-gray-300 px-4 py-3">
                                <div className="flex items-center justify-center space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditModal(record)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-600"
                                    onClick={() => handleDeleteRequest(record)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {records.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No hay registros de diezmos.</p>
                      <p className="text-sm">Agregue el primer diezmo para comenzar.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="buscar" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Buscar Diezmos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="searchDonador">Donador</Label>
                      <Input
                        id="searchDonador"
                        placeholder="Nombre del donador"
                        value={searchFilters.donador}
                        onChange={(e) => setSearchFilters({ ...searchFilters, donador: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="searchFechaDesde">Fecha Desde</Label>
                      <Input
                        id="searchFechaDesde"
                        type="date"
                        value={searchFilters.fechaDesde}
                        onChange={(e) => setSearchFilters({ ...searchFilters, fechaDesde: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="searchFechaHasta">Fecha Hasta</Label>
                      <Input
                        id="searchFechaHasta"
                        type="date"
                        value={searchFilters.fechaHasta}
                        onChange={(e) => setSearchFilters({ ...searchFilters, fechaHasta: e.target.value })}
                      />
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Resultados Encontrados</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{searchResults.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          ${totalSearchResults.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Resultados de Búsqueda</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Mes</th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Número</th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Fecha</th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Donador</th>
                              <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchResults.map((record) => (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-4 py-3 font-medium">{record.mes_name}</td>
                                <td className="border border-gray-300 px-4 py-3">{record.numero}</td>
                                <td className="border border-gray-300 px-4 py-3">{formatDateForTable(record.fecha)}</td>
                                <td className="border border-gray-300 px-4 py-3">{record.donador}</td>
                                <td className="border border-gray-300 px-4 py-3 text-right font-medium">
                                  ${Number(record.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                                </td>
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
                      <p>No se encontraron resultados</p>
                      <p className="text-sm">Intente con otros criterios de búsqueda</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Modal para editar */}
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Diezmo</DialogTitle>
                <DialogDescription>Modifique la información del diezmo #{editingRecord?.numero}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editFecha">Fecha</Label>
                  <Input
                    id="editFecha"
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="editDonador">Donador</Label>
                  <Input
                    id="editDonador"
                    value={formData.donador}
                    onChange={(e) => setFormData({ ...formData, donador: e.target.value })}
                    placeholder="Nombre del donador"
                  />
                </div>
                <div>
                  <Label htmlFor="editValor">Valor</Label>
                  <Input
                    id="editValor"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false)
                    resetForm()
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleEdit} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar diezmo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará el diezmo #{deleteTarget?.numero} de {deleteTarget?.donador}. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                  Eliminar
                </AlertDialogAction>
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
