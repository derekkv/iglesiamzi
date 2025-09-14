"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import {
  discipuladoService,
  type Participant,
  type DiscipuladoDate,
  type AttendanceRecord,
} from "@/lib/mod/discipulado-service"
import { Trash2, Plus, ArrowLeft, Edit } from "lucide-react"
import { useMonth } from "@/contexts/month-context";

interface DiscipuladoData {
  participants: Participant[]
  dates: DiscipuladoDate[]
  attendance: AttendanceRecord[]
}

const ATTENDANCE_OPTIONS = [
  { value: "A", label: "A - Asistió", color: "bg-green-100 text-green-800" },
  { value: "J", label: "J - Justificó", color: "bg-blue-100 text-blue-800" },
  { value: "F", label: "F - Falta", color: "bg-red-100 text-red-800" },
  { value: "AT", label: "AT - Atraso +30min", color: "bg-yellow-100 text-yellow-800" },
]

const getAttendanceColor = (status: string) => {
  const option = ATTENDANCE_OPTIONS.find((o) => o.value === status)
  return option ? option.color : ""
}

export default function DiscipuladoPage() {
  const router = useRouter()
  const { currentMonth } = useMonth();
  const [data, setData] = useState<DiscipuladoData>({
    participants: [],
    dates: [],
    attendance: [],
  })
  const [loading, setLoading] = useState(true)

  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [showAddDate, setShowAddDate] = useState(false)
  const [showEditParticipant, setShowEditParticipant] = useState(false)
  const [newParticipantName, setNewParticipantName] = useState("")
  const [newDate, setNewDate] = useState("")
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
    const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!currentMonth) return
        const mesId = currentMonth?.id
        const discipuladoData = await discipuladoService.getDiscipuladoData(mesId)
        setData(discipuladoData)
      } catch (error) {
        console.error("Error loading discipulado data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentMonth])

  const refreshData = async () => {
    if (!currentMonth) return

    try {
      const discipuladoData = await discipuladoService.getDiscipuladoData(currentMonth.id)
      setData(discipuladoData)
    } catch (error) {
      console.error("Error refreshing data:", error)
    }
  }

  const handleAddParticipant = async () => {
    if (!newParticipantName.trim() || !currentMonth) return
    setSaving(true)

    try {
      await discipuladoService.addParticipant(currentMonth.id, newParticipantName.trim())
      await refreshData()
      setNewParticipantName("")
      setShowAddParticipant(false)
    } catch (error) {
      console.error("Error adding participant:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleEditParticipant = async () => {
    if (!editingParticipant || !editingParticipant.name.trim()) return
    setSaving(true)
    try {
      await discipuladoService.updateParticipant(editingParticipant.id, editingParticipant.name.trim())
      await refreshData()
      setEditingParticipant(null)
      setShowEditParticipant(false)
    } catch (error) {
      console.error("Error updating participant:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteParticipant = async (participantId: number) => {
    try {
      await discipuladoService.deleteParticipant(participantId)
      await refreshData()
    } catch (error) {
      console.error("Error deleting participant:", error)
    }
  }

  const handleAddDate = async () => {
    if (!newDate || !currentMonth) return
    setSaving(true)
    const dateExists = data.dates.some((d) => d.fecha === newDate)
    if (dateExists) return

    try {
      await discipuladoService.addDate(currentMonth.id, newDate)
      await refreshData()
      setNewDate("")
      setShowAddDate(false)
    } catch (error) {
      console.error("Error adding date:", error)
    }finally {
      setSaving(false)
    }
  }

  const handleDeleteDate = async (dateId: number) => {
    try {
      await discipuladoService.deleteDate(dateId)
      await refreshData()
    } catch (error) {
      console.error("Error deleting date:", error)
    }
  }

  const handleAttendanceChange = async (participantId: number, dateId: number, status: string) => {
    if (!currentMonth) return

    try {
      await discipuladoService.upsertAttendance(
        currentMonth.id,
        participantId,
        dateId,
        status as "A" | "J" | "F" | "AT" | "none",
      )
      await refreshData()
    } catch (error) {
      console.error("Error updating attendance:", error)
    }
  }     

  const getDateStats = (dateId: number) => {
    const records = data.attendance.filter((a) => a.fecha_id === dateId)
    return {
      A: records.filter((r) => r.status === "A").length,
      J: records.filter((r) => r.status === "J").length,
      F: records.filter((r) => r.status === "F").length,
      AT: records.filter((r) => r.status === "AT").length,
      none: records.filter((r) => r.status === "none").length,
    }
  }

  const getParticipantStats = (participantId: number) => {
    const records = data.attendance.filter((a) => a.participante_id === participantId)
    return {
      A: records.filter((r) => r.status === "A").length,
      J: records.filter((r) => r.status === "J").length,
      F: records.filter((r) => r.status === "F").length,
      AT: records.filter((r) => r.status === "AT").length,
      none: records.filter((r) => r.status === "none").length,
    }
  }

  const getAttendanceStatus = (participantId: number, dateId: number) => {
    const record = data.attendance.find((a) => a.participante_id === participantId && a.fecha_id === dateId)
    return record?.status || "none"
  }

  if (loading) {
    return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de discipulado...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="back-button flex items-center px-3 py-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span>Volver</span>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Asistencia o Discipulado</h1>
                <p className="text-sm text-gray-600">
                  {currentMonth?.name} - {data.participants.length} participantes
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              {currentMonth?.name}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Códigos de Asistencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {ATTENDANCE_OPTIONS.map((option) => (
                <Badge key={option.value} className={option.color}>
                  {option.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-4 mb-6">
          <Dialog open={showAddParticipant} onOpenChange={setShowAddParticipant}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Participante
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar Participante</DialogTitle>
                <DialogDescription>Ingrese el nombre del nuevo participante</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="participantName">Nombre del Participante</Label>
                  <Input
                    id="participantName"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    placeholder="Nombre completo"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddParticipant(false)}>
                  Cancelar
                </Button>
             
                    <Button onClick={handleAddParticipant} disabled={saving || !newParticipantName.trim()}>
                    {saving ? "Guardando..." : "Agregar"}
                  </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddDate} onOpenChange={setShowAddDate}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Fecha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar Fecha</DialogTitle>
                <DialogDescription>Seleccione una fecha para registrar asistencia</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="newDate">Fecha</Label>
                  <Input id="newDate" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDate(false)}>
                  Cancelar
                </Button>
          
                 <Button onClick={handleAddDate} disabled={saving || !newDate || data.dates.some((d) => d.fecha === newDate)}>
                    {saving ? "Guardando..." : "Agregar"}
                  </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registro de Asistencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table key={currentMonth?.id} className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left font-medium">#</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-medium min-w-[200px]">
                      Participantes
                    </th>
                    {data.dates.map((dateObj) => (
                      <th
                        key={dateObj.id}
                        className="border border-gray-300 px-2 py-2 text-center font-medium min-w-[100px]"
                      >
                        <div className="flex flex-col items-center space-y-1">
                          <span className="text-xs">
                            {new Date(dateObj.fecha + "T00:00:00").toLocaleDateString("es-EC", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar fecha?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminará la fecha {dateObj.fecha} y todos los registros de asistencia asociados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDate(dateObj.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </th>
                    ))}
                    <th className="border border-gray-300 px-4 py-2 text-center font-medium">Estadísticas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.participants.map((participant, index) => {
                    const stats = getParticipantStats(participant.id)
                    return (
                      <tr key={participant.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 text-center">{index + 1}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <div className="flex items-center justify-between">
                            <span>{participant.name}</span>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingParticipant(participant)
                                  setShowEditParticipant(true)
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar participante?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará a {participant.name} y todos sus registros de asistencia.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteParticipant(participant.id)}
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
                        {data.dates.map((dateObj) => {
                          const status = getAttendanceStatus(participant.id, dateObj.id)
                          return (
                            <td key={dateObj.id} className="border border-gray-300 px-2 py-2 text-center">
                              <Select
                                value={status}
                                onValueChange={(value) => handleAttendanceChange(participant.id, dateObj.id, value)}
                              >
                                <SelectTrigger className={`w-full h-8 ${getAttendanceColor(status)}`}>
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">-</SelectItem>
                                  {ATTENDANCE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          )
                        })}
                        <td className="border border-gray-300 px-2 py-2 text-center">
                          <div className="text-xs space-y-1">
                            <div>A: {stats.A}</div>
                            <div>J: {stats.J}</div>
                            <div>F: {stats.F}</div>
                            <div>AT: {stats.AT}</div>
                            <div>None: {stats.none}</div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {data.dates.length > 0 && (
                    <tr className="bg-blue-50 font-medium">
                      <td className="border border-gray-300 px-4 py-2 text-center">-</td>
                      <td className="border border-gray-300 px-4 py-2 font-semibold">TOTALES POR FECHA</td>
                      {data.dates.map((dateObj) => {
                        const stats = getDateStats(dateObj.id)
                        return (
                          <td key={dateObj.id} className="border border-gray-300 px-2 py-2 text-center">
                            <div className="text-xs space-y-1">
                              <div>A: {stats.A}</div>
                              <div>J: {stats.J}</div>
                              <div>F: {stats.F}</div>
                              <div>AT: {stats.AT}</div>
                              <div>None: {stats.none}</div>
                            </div>
                          </td>
                        )
                      })}
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        <div className="text-xs space-y-1">
                          <div>Total: {data.participants.length}</div>
                          <div>Fechas: {data.dates.length}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showEditParticipant} onOpenChange={setShowEditParticipant}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Participante</DialogTitle>
              <DialogDescription>Modifique el nombre del participante</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editParticipantName">Nombre del Participante</Label>
                <Input
                  id="editParticipantName"
                  value={editingParticipant?.name || ""}
                  onChange={(e) => setEditingParticipant((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                  placeholder="Nombre completo"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditParticipant(false)}>
                Cancelar
              </Button>
         
                  <Button onClick={handleEditParticipant} disabled={saving || !editingParticipant?.name.trim()}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
