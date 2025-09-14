"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { ArrowLeft, Plus, Trash2, Edit2 } from "lucide-react"
import { diezmosService, type DiezmoRecord } from "@/lib/mod/diezmos-service"
import { useMonth } from "@/contexts/month-context";
export default function DiezmosPage() {
  const router = useRouter()
  const [activeMonth, setActiveMonth] = useState<{ id: string; name: string } | null>(null)
  const [records, setRecords] = useState<DiezmoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false) // <- nuevo estado
  const { currentMonth, updateConfigurations } = useMonth();
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<DiezmoRecord | null>(null)

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
        // buscar mes activo
      if (!currentMonth) return

        setActiveMonth(currentMonth)

        // cargar diezmos de ese mes
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

  const handleDelete = async (id: number) => {
    try {
      await diezmosService.deleteDiezmo(id)
      setRecords((prev) => prev.filter((record) => record.id !== id))
    } catch (error) {
      console.error("Error deleting diezmo:", error)
      alert("Error al eliminar el diezmo")
    }
  }

  const openEditModal = (record: DiezmoRecord) => {
    setEditingRecord(record)
    setFormData({
      fecha: record.fecha,
      donador: record.donador,
      valor: record.valor.toString(),
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({ fecha: "", donador: "", valor: "" })
    setEditingRecord(null)
  }

  const totalDiezmos = records.reduce((sum, record) => sum + Number(record.valor), 0)

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
    );
  }
  
  function formatDateForTable(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`; // DD/MM/YYYY
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
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-3 font-medium">{record.numero}</td>
                      <td className="border border-gray-300 px-4 py-3">
                             {formatDateForTable(record.fecha)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3">{record.donador}</td>
                      <td className="border border-gray-300 px-4 py-3 text-right font-medium">
                        ${Number(record.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                      </td>
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminará el diezmo #{record.numero} de {record.donador}. Esta acción no se puede
                                  deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(record.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
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
      </main>
    </div>
  )
}
