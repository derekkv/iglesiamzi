"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { ArrowLeft, Plus, Trash2, Edit2, Lock } from "lucide-react"
import { attendanceService, type AttendanceDetail, type AttendanceColumn } from "@/lib/mod/attendance-service"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { useMonth } from "@/contexts/month-context"
import { useSecurityCheck } from "@/contexts/security-context"

interface AttendanceDataMap {
  [detalleId: number]: { [columnaId: number]: number }
}


function AsistenciaContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { currentMonth, updateConfigurations } = useMonth()
  const { checkAndExecute } = useSecurityCheck()
  const [details, setDetails] = useState<AttendanceDetail[]>([])
  const [columns, setColumns] = useState<AttendanceColumn[]>([])
  const [attendanceData, setAttendanceData] = useState<AttendanceDataMap>({})
  const [loading, setLoading] = useState(true)

  const [showAddDetail, setShowAddDetail] = useState(false)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [showEditDetail, setShowEditDetail] = useState(false)
  const [showEditColumn, setShowEditColumn] = useState(false)

  const [newDetail, setNewDetail] = useState("")
  const [newColumnName, setNewColumnName] = useState("")
  const [editingDetail, setEditingDetail] = useState<{ id: number; nombre: string } | null>(null)
  const [editingColumn, setEditingColumn] = useState<{ id: number; nombre: string } | null>(null)

  const [saving, setSaving] = useState(false)
  const [unlockedCells, setUnlockedCells] = useState<Set<string>>(new Set())
  const [pendingDeleteColumn, setPendingDeleteColumn] = useState<AttendanceColumn | null>(null)
  const [pendingDeleteDetail, setPendingDeleteDetail] = useState<AttendanceDetail | null>(null)
  const [activeTab, setActiveTab] = useState("tabla")

  useEffect(() => { loadAttendanceData() }, [currentMonth])

  const loadAttendanceData = async () => {
    if (!currentMonth?.id) return
    try {
      setLoading(true)
      await attendanceService.initializeDefaultDetails(currentMonth.id)
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
      const newData = { ...attendanceData }
      details.forEach((detail) => {
        if (!newData[detail.id]) newData[detail.id] = {}
        newData[detail.id][newColumn.id] = 0
      })
      setAttendanceData(newData)
    } catch (error) {
      console.error("Error adding column:", error)
    } finally { setSaving(false) }
  }

  const handleAddDetail = async () => {
    if (!newDetail.trim() || !currentMonth?.id) return
    setSaving(true)
    try {
      const newDetailRecord = await attendanceService.createDetail(currentMonth.id, newDetail.trim())
      setDetails((prev) => [...prev, newDetailRecord])
      setNewDetail("")
      setShowAddDetail(false)
      const newData = { ...attendanceData }
      newData[newDetailRecord.id] = {}
      columns.forEach((col) => { newData[newDetailRecord.id][col.id] = 0 })
      setAttendanceData(newData)
    } catch (error) {
      console.error("Error adding detail:", error)
    } finally { setSaving(false) }
  }

  const handleEditDetail = async () => {
    if (!editingDetail?.nombre.trim()) return
    setSaving(true)
    try {
      await attendanceService.updateDetail(editingDetail.id, editingDetail.nombre.trim())
      setDetails((prev) => prev.map((d) => d.id === editingDetail.id ? { ...d, nombre: editingDetail.nombre.trim() } : d))
      setShowEditDetail(false)
      setEditingDetail(null)
    } catch (error) { console.error("Error editing detail:", error) }
    finally { setSaving(false) }
  }

  const handleDeleteDetail = async (detailId: number) => {
    try {
      await attendanceService.deleteDetail(detailId)
      setDetails((prev) => prev.filter((d) => d.id !== detailId))
      const newData = { ...attendanceData }
      delete newData[detailId]
      setAttendanceData(newData)
    } catch (error) { console.error("Error deleting detail:", error) }
  }

  const handleEditColumn = async () => {
    if (!editingColumn?.nombre.trim()) return
    setSaving(true)
    try {
      await attendanceService.updateColumn(editingColumn.id, editingColumn.nombre.trim())
      setColumns((prev) => prev.map((c) => c.id === editingColumn.id ? { ...c, nombre: editingColumn.nombre.trim() } : c))
      setShowEditColumn(false)
      setEditingColumn(null)
    } catch (error) { console.error("Error editing column:", error) }
    finally { setSaving(false) }
  }

  const handleDeleteColumn = async (columnId: number) => {
    try {
      await attendanceService.deleteColumn(columnId)
      setColumns((prev) => prev.filter((c) => c.id !== columnId))
      const newData = { ...attendanceData }
      Object.keys(newData).forEach((detailId) => {
        if (newData[Number.parseInt(detailId)]) delete newData[Number.parseInt(detailId)][columnId]
      })
      setAttendanceData(newData)
    } catch (error) { console.error("Error deleting column:", error) }
  }


  const handleCellChange = async (detailId: number, columnId: number, value: string) => {
    const cantidad = Number.parseInt(value) || 0
    const newData = { ...attendanceData }
    if (!newData[detailId]) newData[detailId] = {}
    newData[detailId][columnId] = cantidad
    setAttendanceData(newData)
    try {
      await attendanceService.upsertAttendanceData(currentMonth!.id, detailId, columnId, cantidad)
    } catch (error) { console.error("Error saving attendance data:", error) }
  }

  const calculateColumnTotal = (columnId: number) => details.reduce((t, d) => t + (attendanceData[d.id]?.[columnId] || 0), 0)
  const calculateRowTotal = (detailId: number) => columns.reduce((t, c) => t + (attendanceData[detailId]?.[c.id] || 0), 0)
  const calculateGrandTotal = () => columns.reduce((gt, c) => gt + calculateColumnTotal(c.id), 0)

  const getCategoryChartData = () => details.map((d) => ({ name: d.nombre, total: calculateRowTotal(d.id) }))
  const getDateChartData = () => columns.map((column) => {
    const dataPoint: any = { name: column.nombre }
    details.forEach((d) => { dataPoint[d.nombre] = attendanceData[d.id]?.[column.id] || 0 })
    return dataPoint
  })
  const getColors = () => ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"]

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
    )
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Estadísticas de Asistencia</h1>
                <p className="text-sm text-gray-600">Mes: {currentMonth?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!canEdit && (
                <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  <Lock className="w-3 h-3" /> Solo lectura
                </span>
              )}
              {canEdit && (
                <Dialog open={showAddColumn} onOpenChange={setShowAddColumn}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="flex items-center space-x-2">
                      <Plus className="w-4 h-4" /><span>Agregar Fecha</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Agregar Nueva Fecha/Columna</DialogTitle>
                      <DialogDescription>Ingrese el nombre para la nueva columna (ej: "Dom 15/12", "Miércoles", etc.)</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="columnName">Nombre de la columna</Label>
                        <Input id="columnName" value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="Ej: Dom 15/12" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddColumn(false)}>Cancelar</Button>
                      <Button onClick={handleAddColumn} disabled={saving}>{saving ? "Guardando..." : "Agregar"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              {canEdit && (
                <Dialog open={showAddDetail} onOpenChange={setShowAddDetail}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center space-x-2 bg-transparent">
                      <Plus className="w-4 h-4" /><span>Agregar Detalle</span>
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
                        <Input id="detailName" value={newDetail} onChange={(e) => setNewDetail(e.target.value)} placeholder="Ej: ADULTOS MAYORES" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddDetail(false)}>Cancelar</Button>
                      <Button onClick={handleAddDetail} disabled={saving}>{saving ? "Guardando..." : "Agregar"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </header>


      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Tabla de Asistencia</span>
              <div className="text-sm text-gray-600">{details.length} detalles &bull; {columns.length} fechas</div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="tabla">Tabla</TabsTrigger>
                <TabsTrigger value="graficos">Gráficos</TabsTrigger>
              </TabsList>

              <TabsContent value="tabla">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[250px]">Detalle</th>
                        {columns.map((column) => (
                          <th key={column.id} className="border border-gray-300 px-4 py-3 text-center font-semibold min-w-[120px]">
                            <div className="flex items-center justify-center space-x-2">
                              <span>{column.nombre}</span>
                              {canEdit && (
                                <div className="flex space-x-1">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                    checkAndExecute(column.created_at || new Date().toISOString(), () => {
                                      setEditingColumn({ id: column.id, nombre: column.nombre })
                                      setShowEditColumn(true)
                                    })
                                  }}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => {
                                    checkAndExecute(column.created_at || new Date().toISOString(), () => {
                                      setPendingDeleteColumn(column)
                                    })
                                  }}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold min-w-[120px] bg-green-50">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((detail) => (
                        <tr key={detail.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2 font-medium bg-gray-50">
                            <div className="flex items-center justify-between">
                              <span>{detail.nombre}</span>
                              {canEdit && (
                                <div className="flex space-x-1">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                    checkAndExecute(detail.created_at || new Date().toISOString(), () => {
                                      setEditingDetail({ id: detail.id, nombre: detail.nombre })
                                      setShowEditDetail(true)
                                    })
                                  }}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => {
                                    checkAndExecute(detail.created_at || new Date().toISOString(), () => {
                                      setPendingDeleteDetail(detail)
                                    })
                                  }}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </td>
                          {columns.map((column) => {
                            const created = new Date(column.created_at)
                            const now = new Date()
                            const needsKey = (now.getTime() - created.getTime()) / (1000 * 60 * 60) >= 6
                            const cellKey = `${detail.id}-${column.id}`
                            return (
                              <td key={column.id} className="border border-gray-300 px-2 py-1">
                                {canEdit && needsKey && !unlockedCells.has(cellKey) ? (
                                  <div className="text-center h-8 flex items-center justify-center cursor-pointer text-gray-500 hover:text-blue-600" onClick={() => {
                                    checkAndExecute(column.created_at, () => {
                                      setUnlockedCells(prev => new Set([...prev, cellKey]))
                                    })
                                  }}>
                                    {attendanceData[detail.id]?.[column.id] || 0}
                                  </div>
                                ) : (
                                  <Input type="number" min="0" value={attendanceData[detail.id]?.[column.id] || ""} onChange={(e) => handleCellChange(detail.id, column.id, e.target.value)} className="border-0 text-center h-8 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" placeholder="0" disabled={!canEdit} />
                                )}
                              </td>
                            )
                          })}
                          <td className="border border-gray-300 px-4 py-2 text-center font-semibold bg-green-50">{calculateRowTotal(detail.id)}</td>
                        </tr>
                      ))}
                      {columns.length > 0 && (
                        <tr className="bg-blue-50 font-semibold">
                          <td className="border border-gray-300 px-4 py-2 font-bold bg-blue-100">TOTAL</td>
                          {columns.map((column) => (
                            <td key={column.id} className="border border-gray-300 px-2 py-2 text-center bg-blue-100">{calculateColumnTotal(column.id)}</td>
                          ))}
                          <td className="border border-gray-300 px-4 py-2 text-center font-bold bg-green-100">{calculateGrandTotal()}</td>
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
                      <span className="text-sm text-gray-600">Total de registros: {details.length} detalles x {columns.length} fechas</span>
                      <span className="text-lg font-semibold text-blue-600">Total General: {calculateGrandTotal()}</span>
                    </div>
                  </div>
                )}
              </TabsContent>


              <TabsContent value="graficos">
                {columns.length === 0 || details.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-lg font-medium">No hay datos para mostrar</p>
                    <p className="text-sm mt-2">Agregue fechas y detalles para visualizar los gráficos</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Asistencia Total por Categoría</h3>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={getCategoryChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="total" fill="#3b82f6" name="Total" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Asistencia por Fecha</h3>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={getDateChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {details.map((detail, index) => (
                            <Bar key={detail.id} dataKey={detail.nombre} stackId="a" fill={getColors()[index % getColors().length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Modal editar detalle */}
        <Dialog open={showEditDetail} onOpenChange={setShowEditDetail}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Detalle</DialogTitle>
              <DialogDescription>Modifique el nombre del detalle de asistencia</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editDetailName">Nombre del detalle</Label>
                <Input id="editDetailName" value={editingDetail?.nombre || ""} onChange={(e) => setEditingDetail((prev) => (prev ? { ...prev, nombre: e.target.value } : null))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDetail(false)}>Cancelar</Button>
              <Button onClick={handleEditDetail} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal editar columna */}
        <Dialog open={showEditColumn} onOpenChange={setShowEditColumn}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Fecha/Columna</DialogTitle>
              <DialogDescription>Modifique el nombre de la fecha/columna</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editColumnName">Nombre de la columna</Label>
                <Input id="editColumnName" value={editingColumn?.nombre || ""} onChange={(e) => setEditingColumn((prev) => (prev ? { ...prev, nombre: e.target.value } : null))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditColumn(false)}>Cancelar</Button>
              <Button onClick={handleEditColumn} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* AlertDialog para confirmar eliminar columna */}
        <AlertDialog open={!!pendingDeleteColumn} onOpenChange={(open) => { if (!open) setPendingDeleteColumn(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar columna?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará la columna &quot;{pendingDeleteColumn?.nombre}&quot; y todos sus datos. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDeleteColumn(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
                if (pendingDeleteColumn) handleDeleteColumn(pendingDeleteColumn.id)
                setPendingDeleteColumn(null)
              }}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* AlertDialog para confirmar eliminar detalle */}
        <AlertDialog open={!!pendingDeleteDetail} onOpenChange={(open) => { if (!open) setPendingDeleteDetail(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar detalle?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará &quot;{pendingDeleteDetail?.nombre}&quot; y todos sus datos. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDeleteDetail(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
                if (pendingDeleteDetail) handleDeleteDetail(pendingDeleteDetail.id)
                setPendingDeleteDetail(null)
              }}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

export default function AsistenciaPage() {
  return (
    <PermissionsGuard moduleName="asistencia">
      {(canEdit) => <AsistenciaContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
