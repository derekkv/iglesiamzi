"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  discipuladoCiclosService, CICLO_CONFIG,
  type CicloTipo, type CicloCompleto, type CicloParticipante, type CicloFecha,
} from "@/lib/mod/discipulado-ciclos-service"
import { Trash2, Plus, ArrowLeft, Edit, Lock, Play, CalendarDays } from "lucide-react"
import { useSecurityCheck } from "@/contexts/security-context"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"


const ATTENDANCE_OPTIONS = [
  { value: "A", label: "A - Asistio", color: "bg-green-100 text-green-800" },
  { value: "J", label: "J - Justifico", color: "bg-blue-100 text-blue-800" },
  { value: "F", label: "F - Falta", color: "bg-red-100 text-red-800" },
  { value: "AT", label: "AT - Atraso +30min", color: "bg-yellow-100 text-yellow-800" },
]

const ESTATUS_OPTIONS = [
  { value: "en_curso", label: "En curso", color: "bg-gray-100 text-gray-800" },
  { value: "aprobado", label: "Aprobado", color: "bg-green-100 text-green-800" },
  { value: "reprobado", label: "Reprobado", color: "bg-red-100 text-red-800" },
]

const getAttendanceColor = (status: string) => {
  const option = ATTENDANCE_OPTIONS.find((o) => o.value === status)
  return option ? option.color : ""
}

const getEstatusColor = (estatus: string) => {
  const option = ESTATUS_OPTIONS.find((o) => o.value === estatus)
  return option ? option.color : ""
}

interface DiscipuladoCicloViewProps {
  tipo: CicloTipo
  canEdit: boolean
}

export function DiscipuladoCicloView({ tipo, canEdit }: DiscipuladoCicloViewProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()
  const config = CICLO_CONFIG[tipo]

  const [data, setData] = useState<CicloCompleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modals
  const [showIniciar, setShowIniciar] = useState(false)
  const [fechaInicio, setFechaInicio] = useState("")
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [newParticipantName, setNewParticipantName] = useState("")
  const [showEditParticipant, setShowEditParticipant] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<CicloParticipante | null>(null)
  const [showEditFecha, setShowEditFecha] = useState(false)
  const [editingFecha, setEditingFecha] = useState<CicloFecha | null>(null)
  const [nuevaFechaEdit, setNuevaFechaEdit] = useState("")

  const audit = user ? { user_id: user.id, user_name: user.username } : undefined


  const loadData = useCallback(async () => {
    try {
      const result = await discipuladoCiclosService.getCicloActivoCompleto(tipo)
      setData(result)
    } catch (error) {
      console.error("Error loading ciclo data:", error)
    } finally {
      setLoading(false)
    }
  }, [tipo])

  useEffect(() => { loadData() }, [loadData])

  useRealtimeMultiple(
    ["discipulado_ciclos", "discipulado_ciclo_participantes", "discipulado_ciclo_fechas", "discipulado_ciclo_asistencia"],
    () => loadData()
  )

  const cicloTerminado = data ? discipuladoCiclosService.cicloTerminado(data.fechas) : false

  const handleIniciarCiclo = async () => {
    if (!fechaInicio) return
    setSaving(true)
    try {
      await discipuladoCiclosService.iniciarCiclo(tipo, fechaInicio, audit)
      toast.success(`${config.label} iniciado correctamente`)
      setShowIniciar(false)
      setFechaInicio("")
      await loadData()
    } catch (error: any) {
      toast.error("Error al iniciar ciclo: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddParticipant = async () => {
    if (!newParticipantName.trim() || !data) return
    setSaving(true)
    try {
      await discipuladoCiclosService.addParticipante(data.ciclo.id, newParticipantName.trim(), audit)
      setNewParticipantName("")
      setShowAddParticipant(false)
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditParticipant = async () => {
    if (!editingParticipant || !editingParticipant.nombre.trim()) return
    setSaving(true)
    try {
      await discipuladoCiclosService.updateParticipante(editingParticipant.id, editingParticipant.nombre.trim(), audit)
      setShowEditParticipant(false)
      setEditingParticipant(null)
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteParticipant = async (id: number) => {
    try {
      await discipuladoCiclosService.deleteParticipante(id, audit)
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    }
  }


  const handleEstatusChange = async (participanteId: number, estatus: string) => {
    try {
      await discipuladoCiclosService.updateEstatus(participanteId, estatus as "en_curso" | "aprobado" | "reprobado", audit)
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    }
  }

  const handleAttendanceChange = async (participanteId: number, fechaId: number, status: string) => {
    if (!data) return
    try {
      await discipuladoCiclosService.upsertAsistencia(data.ciclo.id, participanteId, fechaId, status as "A" | "J" | "F" | "AT" | "none")
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    }
  }

  const handleCambiarFecha = async () => {
    if (!editingFecha || !nuevaFechaEdit || !data) return
    setSaving(true)
    try {
      await discipuladoCiclosService.cambiarFecha(data.ciclo.id, editingFecha.id, nuevaFechaEdit, audit)
      toast.success("Fecha actualizada y siguientes recalculadas")
      setShowEditFecha(false)
      setEditingFecha(null)
      setNuevaFechaEdit("")
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const getAttendanceStatus = (participanteId: number, fechaId: number) => {
    if (!data) return "none"
    const record = data.asistencia.find((a) => a.participante_id === participanteId && a.fecha_id === fechaId)
    return record?.status || "none"
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Sin ciclo activo
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                  <ArrowLeft className="w-4 h-4" /><span>Volver</span>
                </Button>
                <h1 className="text-xl font-semibold text-gray-900">{config.label}</h1>
              </div>
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-4">
            <CalendarDays className="w-16 h-16 mx-auto text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700">No hay ciclo activo</h3>
            <p className="text-gray-500">{config.label} tiene {config.totalClases} clases (domingos consecutivos)</p>
            {canEdit && (
              <Dialog open={showIniciar} onOpenChange={setShowIniciar}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Play className="w-4 h-4 mr-2" /> Iniciar discipulado
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Iniciar {config.label}</DialogTitle>
                    <DialogDescription>Seleccione la fecha de inicio. Se calcularán {config.totalClases} domingos consecutivos.</DialogDescription>
                  </DialogHeader>
                  <div>
                    <Label>Fecha de inicio</Label>
                    <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                    <p className="text-xs text-gray-500 mt-1">Si no es domingo, se ajustará al próximo domingo.</p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowIniciar(false)}>Cancelar</Button>
                    <Button onClick={handleIniciarCiclo} disabled={saving || !fechaInicio}>{saving ? "Iniciando..." : "Iniciar"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </main>
      </div>
    )
  }


  // Ciclo activo - render completo
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
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{config.label}</h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  Inicio: {new Date(data.ciclo.fecha_inicio + "T00:00:00").toLocaleDateString("es-EC")} | {data.participantes.length} participantes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
              {!cicloTerminado && <Badge className="bg-blue-100 text-blue-800">En curso</Badge>}
              {cicloTerminado && <Badge className="bg-green-100 text-green-800">Completado</Badge>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-3">
          {canEdit && (
            <Dialog open={showAddParticipant} onOpenChange={setShowAddParticipant}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Agregar participante</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar participante</DialogTitle>
                  <DialogDescription>Ingrese el nombre del nuevo participante</DialogDescription>
                </DialogHeader>
                <div>
                  <Label>Nombre</Label>
                  <Input value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="Nombre completo" onKeyDown={(e) => e.key === "Enter" && handleAddParticipant()} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddParticipant(false)}>Cancelar</Button>
                  <Button onClick={handleAddParticipant} disabled={saving || !newParticipantName.trim()}>{saving ? "Guardando..." : "Agregar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {cicloTerminado && canEdit && (
            <Dialog open={showIniciar} onOpenChange={setShowIniciar}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700" size="sm">
                  <Play className="w-4 h-4 mr-2" /> Reiniciar ciclo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reiniciar {config.label}</DialogTitle>
                  <DialogDescription>El ciclo actual se archivará. Los participantes NO se eliminan (quedan en historial). Se creará un nuevo ciclo con {config.totalClases} domingos.</DialogDescription>
                </DialogHeader>
                <div>
                  <Label>Nueva fecha de inicio</Label>
                  <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowIniciar(false)}>Cancelar</Button>
                  <Button onClick={handleIniciarCiclo} disabled={saving || !fechaInicio}>{saving ? "Iniciando..." : "Reiniciar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Leyenda */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap gap-3">
              {ATTENDANCE_OPTIONS.map((opt) => (
                <Badge key={opt.value} className={opt.color + " text-xs"}>{opt.label}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>


        {/* Tabla */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium">#</th>
                    <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium min-w-[180px]">Participante</th>
                    {data.fechas.map((f) => (
                      <th key={f.id} className="border border-gray-200 px-2 py-2 text-center text-xs font-medium min-w-[85px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">C{f.numero_clase}</span>
                          <span>{new Date(f.fecha + "T00:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" })}</span>
                          {canEdit && (
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-blue-500 hover:text-blue-700" onClick={() => { setEditingFecha(f); setNuevaFechaEdit(f.fecha); setShowEditFecha(true) }}>
                              <Edit className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="border border-gray-200 px-3 py-2 text-center text-sm font-medium min-w-[110px]">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {data.participantes.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-3 py-2 text-center text-sm">{idx + 1}</td>
                      <td className="border border-gray-200 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>{p.nombre}</span>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => checkAndExecute(p.created_at, () => { setEditingParticipant(p); setShowEditParticipant(true) })}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminar participante?</AlertDialogTitle>
                                    <AlertDialogDescription>Se eliminará a {p.nombre} y toda su asistencia de este ciclo.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => checkAndExecute(p.created_at, () => handleDeleteParticipant(p.id))}>Eliminar</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                      </td>


                      {data.fechas.map((f) => {
                        const status = getAttendanceStatus(p.id, f.id)
                        return (
                          <td key={f.id} className="border border-gray-200 px-1 py-1 text-center">
                            <Select value={status} onValueChange={(value) => handleAttendanceChange(p.id, f.id, value)} disabled={!canEdit}>
                              <SelectTrigger className={`w-full h-7 text-xs ${getAttendanceColor(status)}`}>
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-</SelectItem>
                                {ATTENDANCE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )
                      })}
                      <td className="border border-gray-200 px-1 py-1 text-center">
                        <Select value={p.estatus} onValueChange={(value) => handleEstatusChange(p.id, value)} disabled={!canEdit}>
                          <SelectTrigger className={`w-full h-7 text-xs ${getEstatusColor(p.estatus)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ESTATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {data.participantes.length === 0 && (
          <div className="text-center py-8 text-gray-500">No hay participantes. Agregue participantes para comenzar el registro.</div>
        )}


        {/* Modal editar participante */}
        {canEdit && (
          <Dialog open={showEditParticipant} onOpenChange={setShowEditParticipant}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar participante</DialogTitle>
                <DialogDescription>Modifique el nombre del participante</DialogDescription>
              </DialogHeader>
              <div>
                <Label>Nombre</Label>
                <Input value={editingParticipant?.nombre || ""} onChange={(e) => setEditingParticipant((prev) => prev ? { ...prev, nombre: e.target.value } : null)} placeholder="Nombre completo" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditParticipant(false)}>Cancelar</Button>
                <Button onClick={handleEditParticipant} disabled={saving || !editingParticipant?.nombre.trim()}>{saving ? "Guardando..." : "Guardar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Modal editar fecha */}
        {canEdit && (
          <Dialog open={showEditFecha} onOpenChange={setShowEditFecha}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cambiar fecha - Clase {editingFecha?.numero_clase}</DialogTitle>
                <DialogDescription>Al cambiar esta fecha, las clases posteriores se recalcularán como domingos consecutivos.</DialogDescription>
              </DialogHeader>
              <div>
                <Label>Nueva fecha</Label>
                <Input type="date" value={nuevaFechaEdit} onChange={(e) => setNuevaFechaEdit(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditFecha(false)}>Cancelar</Button>
                <Button onClick={handleCambiarFecha} disabled={saving || !nuevaFechaEdit}>{saving ? "Guardando..." : "Cambiar y recalcular"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  )
}
