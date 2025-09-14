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
import { attendanceService, type AttendanceDetail, type AttendanceColumn } from "@/lib/mod/attendance-service"

interface AttendanceDataMap {
  [detalleId: number]: { [columnaId: number]: number }
}
import { useMonth } from "@/contexts/month-context";
export default function AsistenciaPage() {
  const router = useRouter()

  const { currentMonth, updateConfigurations } = useMonth();// Mock month for now
  const [details, setDetails] = useState<AttendanceDetail[]>([])
  const [columns, setColumns] = useState<AttendanceColumn[]>([])
  const [attendanceData, setAttendanceData] = useState<AttendanceDataMap>({})
  const [loading, setLoading] = useState(true)

  // Estados para modales
  const [showAddDetail, setShowAddDetail] = useState(false)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [showEditDetail, setShowEditDetail] = useState(false)
  const [showEditColumn, setShowEditColumn] = useState(false)

  // Estados para formularios
  const [newDetail, setNewDetail] = useState("")
  const [newColumnName, setNewColumnName] = useState("")
  const [editingDetail, setEditingDetail] = useState<{ id: number; nombre: string } | null>(null)
  const [editingColumn, setEditingColumn] = useState<{ id: number; nombre: string } | null>(null)


  const [saving, setSaving] = useState(false)


  useEffect(() => {
    loadAttendanceData()
  }, [currentMonth])

  const loadAttendanceData = async () => {
    if (!currentMonth?.id) return

    try {
      setLoading(true)

      // Initialize default details if needed
      await attendanceService.initializeDefaultDetails(currentMonth.id)

      // Load all data
      const [detailsData, columnsData, attendanceDataRaw] = await Promise.all([
        attendanceService.getDetails(currentMonth.id),
        attendanceService.getColumns(currentMonth.id),
        attendanceService.getAttendanceData(currentMonth.id),
      ])

      setDetails(detailsData)
      setColumns(columnsData)

      const dataMap: AttendanceDataMap = {}
      attendanceDataRaw.forEach((item) => {
        if (!dataMap[item.detalle_id]) dataMap[item.detalle_id] = {}
        dataMap[item.detalle_id][item.columna_id] = item.cantidad
      })
      setAttendanceData(dataMap)
    } catch (error) {
      console.error("Error loading attendance data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddColumn = async () => {
    if (!newColumnName.trim() || !currentMonth?.id) return
    setSaving(true)
    try {
      const newColumn = await attendanceService.createColumn(currentMonth.id, newColumnName.trim())
      setColumns((prev) => [...prev, newColumn])
      setNewColumnName("")
      setShowAddColumn(false)

      // Initialize data for new column
      const newData = { ...attendanceData }
      details.forEach((detail) => {
        if (!newData[detail.id]) newData[detail.id] = {}
        newData[detail.id][newColumn.id] = 0
      })
      setAttendanceData(newData)
    } catch (error) {
      console.error("Error adding column:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddDetail = async () => {
    if (!newDetail.trim() || !currentMonth?.id) return
        setSaving(true)

    try {
      const newDetailRecord = await attendanceService.createDetail(currentMonth.id, newDetail.trim())
      setDetails((prev) => [...prev, newDetailRecord])
      setNewDetail("")
      setShowAddDetail(false)

      // Initialize data for new detail
      const newData = { ...attendanceData }
      newData[newDetailRecord.id] = {}
      columns.forEach((col) => {
        newData[newDetailRecord.id][col.id] = 0
      })
      setAttendanceData(newData)
    } catch (error) {
      console.error("Error adding detail:", error)
    }finally {
      setSaving(false)
    }
  }

  const handleEditDetail = async () => {
    if (!editingDetail?.nombre.trim()) return
setSaving(true)
    try {
      await attendanceService.updateDetail(editingDetail.id, editingDetail.nombre.trim())
      setDetails((prev) =>
        prev.map((detail) =>
          detail.id === editingDetail.id ? { ...detail, nombre: editingDetail.nombre.trim() } : detail,
        ),
      )
      setShowEditDetail(false)
      setEditingDetail(null)
    } catch (error) {
      console.error("Error editing detail:", error)
    }finally {
      setSaving(false)
    }
  }

  const handleDeleteDetail = async (detailId: number) => {
    try {
      await attendanceService.deleteDetail(detailId)
      setDetails((prev) => prev.filter((detail) => detail.id !== detailId))

      const newData = { ...attendanceData }
      delete newData[detailId]
      setAttendanceData(newData)
    } catch (error) {
      console.error("Error deleting detail:", error)
    }
  }

  const handleEditColumn = async () => {
    if (!editingColumn?.nombre.trim()) return
setSaving(true)
    try {
      await attendanceService.updateColumn(editingColumn.id, editingColumn.nombre.trim())
      setColumns((prev) =>
        prev.map((col) => (col.id === editingColumn.id ? { ...col, nombre: editingColumn.nombre.trim() } : col)),
      )
      setShowEditColumn(false)
      setEditingColumn(null)
    } catch (error) {
      console.error("Error editing column:", error)
    }finally {
      setSaving(false)
    }
  }

  const handleDeleteColumn = async (columnId: number) => {
    try {
      await attendanceService.deleteColumn(columnId)
      setColumns((prev) => prev.filter((col) => col.id !== columnId))

      const newData = { ...attendanceData }
      Object.keys(newData).forEach((detailId) => {
        if (newData[Number.parseInt(detailId)]) {
          delete newData[Number.parseInt(detailId)][columnId]
        }
      })
      setAttendanceData(newData)
    } catch (error) {
      console.error("Error deleting column:", error)
    }
  }

  const handleCellChange = async (detailId: number, columnId: number, value: string) => {
    const cantidad = Number.parseInt(value) || 0

    // Update local state immediately
    const newData = { ...attendanceData }
    if (!newData[detailId]) newData[detailId] = {}
    newData[detailId][columnId] = cantidad
    setAttendanceData(newData)

    // Debounced save to database
    try {
      await attendanceService.upsertAttendanceData(currentMonth!.id, detailId, columnId, cantidad)
    } catch (error) {
      console.error("Error saving attendance data:", error)
    }
  }

  const calculateColumnTotal = (columnId: number) => {
    return details.reduce((total, detail) => {
      const value = attendanceData[detail.id]?.[columnId] || 0
      return total + value
    }, 0)
  }

  const calculateGrandTotal = () => {
    return columns.reduce((grandTotal, column) => {
      return grandTotal + calculateColumnTotal(column.id)
    }, 0)
  }

  if (loading) {
    return (

                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de asistencia...</p>
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
                <h1 className="text-xl font-semibold text-gray-900">Estadísticas de Asistencia</h1>
                <p className="text-sm text-gray-600">Mes: {currentMonth?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Dialog open={showAddColumn} onOpenChange={setShowAddColumn}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Agregar Fecha</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agregar Nueva Fecha/Columna</DialogTitle>
                    <DialogDescription>
                      Ingrese el nombre para la nueva columna (ej: "Dom 15/12", "Miércoles", etc.)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="columnName">Nombre de la columna</Label>
                      <Input
                        id="columnName"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Ej: Dom 15/12"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddColumn(false)}>
                      Cancelar
                    </Button>
                
                          <Button onClick={handleAddColumn} disabled={saving}>
                                        {saving ? "Guardando..." : "Agregar"}
                                      </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showAddDetail} onOpenChange={setShowAddDetail}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center space-x-2 bg-transparent">
                    <Plus className="w-4 h-4" />
                    <span>Agregar Detalle</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agregar Nuevo Detalle</DialogTitle>
                    <DialogDescription>Ingrese el nombre del nuevo detalle de asistencia</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="detailName">Nombre del detalle</Label>
                      <Input
                        id="detailName"
                        value={newDetail}
                        onChange={(e) => setNewDetail(e.target.value)}
                        placeholder="Ej: ADULTOS MAYORES"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDetail(false)}>
                      Cancelar
                    </Button>
               
                          <Button onClick={handleAddDetail} disabled={saving}>
                    {saving ? "Guardando..." : "Agregar"}
                  </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Tabla de Asistencia</span>
              <div className="text-sm text-gray-600">
                {details.length} detalles • {columns.length} fechas
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[250px]">Detalle</th>
                    {columns.map((column) => (
                      <th
                        key={column.id}
                        className="border border-gray-300 px-4 py-3 text-center font-semibold min-w-[120px]"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <span>{column.nombre}</span>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingColumn({ id: column.id, nombre: column.nombre })
                                setShowEditColumn(true)
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar columna?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará la columna "{column.nombre}" y todos sus datos. Esta acción no se puede
                                    deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteColumn(column.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {details.map((detail) => (
                    <tr key={detail.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 font-medium bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span>{detail.nombre}</span>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingDetail({ id: detail.id, nombre: detail.nombre })
                                setShowEditDetail(true)
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar detalle?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará "{detail.nombre}" y todos sus datos. Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteDetail(detail.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </td>
                      {columns.map((column) => (
                        <td key={column.id} className="border border-gray-300 px-2 py-1">
                          <Input
                            type="number"
                            min="0"
                            value={attendanceData[detail.id]?.[column.id] || ""}
                            onChange={(e) => handleCellChange(detail.id, column.id, e.target.value)}
                            className="border-0 text-center h-8 focus:ring-1 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {columns.length > 0 && (
                    <tr className="bg-blue-50 font-semibold">
                      <td className="border border-gray-300 px-4 py-2 font-bold bg-blue-100">TOTAL</td>
                      {columns.map((column) => (
                        <td key={column.id} className="border border-gray-300 px-2 py-2 text-center bg-blue-100">
                          {calculateColumnTotal(column.id)}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {columns.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No hay fechas/columnas configuradas.</p>
                <p className="text-sm">Agregue una fecha para comenzar a registrar asistencia.</p>
              </div>
            )}

            {columns.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Total de registros: {details.length} detalles × {columns.length} fechas
                  </span>
                  <span className="text-lg font-semibold text-blue-600">Total General: {calculateGrandTotal()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal para editar detalle */}
        <Dialog open={showEditDetail} onOpenChange={setShowEditDetail}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Detalle</DialogTitle>
              <DialogDescription>Modifique el nombre del detalle de asistencia</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editDetailName">Nombre del detalle</Label>
                <Input
                  id="editDetailName"
                  value={editingDetail?.nombre || ""}
                  onChange={(e) => setEditingDetail((prev) => (prev ? { ...prev, nombre: e.target.value } : null))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDetail(false)}>
                Cancelar
              </Button>
             
                    <Button onClick={handleEditDetail} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal para editar columna */}
        <Dialog open={showEditColumn} onOpenChange={setShowEditColumn}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Fecha/Columna</DialogTitle>
              <DialogDescription>Modifique el nombre de la fecha/columna</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editColumnName">Nombre de la columna</Label>
                <Input
                  id="editColumnName"
                  value={editingColumn?.nombre || ""}
                  onChange={(e) => setEditingColumn((prev) => (prev ? { ...prev, nombre: e.target.value } : null))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditColumn(false)}>
                Cancelar
              </Button>
                    <Button onClick={handleEditColumn} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
