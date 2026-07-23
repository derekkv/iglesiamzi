"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
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
  herederosCiclosService, HEREDEROS_CICLO_CONFIG,
  type HerederosCicloTipo, type HerederosCicloCompleto,
  type HerederosParticipante, type HerederosFecha, type HerederosParticipanteInput,
} from "@/lib/mod/herederos-ciclos-service"
import { calcularEdadDesdeNacimiento, censoNinosService } from "@/lib/mod/censo-ninos-service"
import { Trash2, Plus, ArrowLeft, Edit, Lock, Play, CalendarDays } from "lucide-react"
import { useSecurityCheck } from "@/contexts/security-context"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"


const ATTENDANCE_OPTIONS = [
  { value: "A", label: "A", color: "bg-green-100 text-green-800" },
  { value: "J", label: "J", color: "bg-blue-100 text-blue-800" },
  { value: "F", label: "F", color: "bg-red-100 text-red-800" },
  { value: "AT", label: "AT", color: "bg-yellow-100 text-yellow-800" },
]

const getAttendanceColor = (status: string) => {
  const option = ATTENDANCE_OPTIONS.find((o) => o.value === status)
  return option ? option.color : ""
}

interface HerederosCicloViewProps {
  tipo: HerederosCicloTipo
  canEdit: boolean
}

export function HerederosCicloView({ tipo, canEdit }: HerederosCicloViewProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()
  const config = HEREDEROS_CICLO_CONFIG[tipo]

  const [data, setData] = useState<HerederosCicloCompleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modals
  const [showIniciar, setShowIniciar] = useState(false)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [showEditParticipant, setShowEditParticipant] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<HerederosParticipante | null>(null)
  const [showEditFecha, setShowEditFecha] = useState(false)
  const [editingFecha, setEditingFecha] = useState<HerederosFecha | null>(null)
  const [nuevaFechaEdit, setNuevaFechaEdit] = useState("")


  // Form data for new/edit participant
  const [formData, setFormData] = useState<HerederosParticipanteInput & { nombre_madre?: string; telefono_madre?: string; nombre_padre?: string; telefono_padre?: string }>({
    nombre: "", fecha_nacimiento: "", edad: null, salon: "",
    nuevo: false, nombre_representante: "", celular: "",
    fecha_registro: "", alergias: "", observaciones: "",
    nombre_madre: "", telefono_madre: "", nombre_padre: "", telefono_padre: "",
  })
  const [fechaNacDisplay, setFechaNacDisplay] = useState("")

  const audit = user ? { user_id: user.id, user_name: user.username } : undefined

  const loadData = useCallback(async (syncCenso = false) => {
    try {
      const result = await herederosCiclosService.getCicloActivoCompleto(tipo)
      if (result && syncCenso) {
        // Auto-importar niños desde censo_ninos al cargar (solo una vez)
        try {
          const { importados } = await herederosCiclosService.importarDesdeCensoNinos(result.ciclo.id, tipo)
          if (importados > 0) {
            const updated = await herederosCiclosService.getCicloActivoCompleto(tipo)
            setData(updated)
            return
          }
        } catch { /* silencioso */ }
      }
      setData(result)
    } catch (error) {
      console.error("Error loading herederos ciclo:", error)
    } finally {
      setLoading(false)
    }
  }, [tipo])

  useEffect(() => { loadData(true) }, [loadData])

  useRealtimeMultiple(
    ["herederos_ciclos", "herederos_ciclo_participantes", "herederos_ciclo_fechas", "herederos_ciclo_asistencia", "censo_ninos"],
    () => loadData(false)
  )

  const cicloTerminado = data ? herederosCiclosService.cicloTerminado(data.fechas) : false

  const resetForm = () => {
    setFormData({ nombre: "", fecha_nacimiento: "", edad: null, salon: "", nuevo: false, nombre_representante: "", celular: "", fecha_registro: "", alergias: "", observaciones: "", nombre_madre: "", telefono_madre: "", nombre_padre: "", telefono_padre: "" })
    setFechaNacDisplay("")
  }


  const handleFechaNacChange = (raw: string) => {
    setFechaNacDisplay(raw)
    const cleaned = raw.replace(/[/,\-]/g, " ").replace(/\s+/g, " ").trim()
    const parts = cleaned.split(" ")
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const year = parseInt(parts[2], 10)
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        setFormData((prev) => ({ ...prev, fecha_nacimiento: dateStr, edad: calcularEdadDesdeNacimiento(dateStr) }))
        return
      }
    }
    if (!raw.trim()) {
      setFormData((prev) => ({ ...prev, fecha_nacimiento: null, edad: null }))
    }
  }

  const handleIniciarCiclo = async () => {
    setSaving(true)
    try {
      await herederosCiclosService.iniciarCiclo(tipo, audit)
      toast.success(`${config.label} iniciado — domingos del mes registrados`)
      setShowIniciar(false)
      await loadData()
    } catch (error: any) {
      toast.error("Error al iniciar ciclo: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddParticipant = async () => {
    if (!formData.nombre.trim() || !data) return
    setSaving(true)
    try {
      // Registrar en censo_ninos también
      await censoNinosService.create({
        nombre: formData.nombre.trim(),
        fecha_nacimiento: formData.fecha_nacimiento || null,
        edad: formData.edad ?? null,
        grupo: config.label,
        nombre_madre: formData.nombre_madre?.trim() || null,
        telefono_madre: formData.telefono_madre?.trim() || null,
        nombre_padre: formData.nombre_padre?.trim() || null,
        telefono_padre: formData.telefono_padre?.trim() || null,
        alergias: formData.alergias?.trim() || null,
        observaciones: formData.observaciones?.trim() || null,
      }, audit ? { userId: audit.user_id, userName: audit.user_name } : undefined)

      // Agregar al ciclo herederos
      const participanteInput: HerederosParticipanteInput = {
        nombre: formData.nombre,
        fecha_nacimiento: formData.fecha_nacimiento,
        edad: formData.edad,
        salon: config.label,
        nuevo: formData.nuevo,
        nombre_representante: formData.nombre_madre?.trim() || formData.nombre_padre?.trim() || null,
        celular: formData.telefono_madre?.trim() || formData.telefono_padre?.trim() || null,
        alergias: formData.alergias,
        observaciones: formData.observaciones,
      }
      await herederosCiclosService.addParticipante(data.ciclo.id, participanteInput, audit)
      toast.success("Niño(a) agregado(a)")
      resetForm()
      setShowAddParticipant(false)
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    } finally {
      setSaving(false)
    }
  }


  const openEditModal = (p: HerederosParticipante) => {
    checkAndExecute(p.created_at, () => {
      setEditingParticipant(p)
      let display = ""
      if (p.fecha_nacimiento) {
        const parts = p.fecha_nacimiento.split("-")
        if (parts.length === 3) display = `${parts[2]}/${parts[1]}/${parts[0]}`
      }
      setFechaNacDisplay(display)
      setFormData({
        nombre: p.nombre, fecha_nacimiento: p.fecha_nacimiento || "",
        edad: p.edad, salon: p.salon || "", nuevo: p.nuevo,
        nombre_representante: p.nombre_representante || "",
        celular: p.celular || "", fecha_registro: p.fecha_registro || "",
        alergias: p.alergias || "", observaciones: p.observaciones || "",
        nombre_madre: p.nombre_representante || "", telefono_madre: p.celular || "",
        nombre_padre: "", telefono_padre: "",
      })
      setShowEditParticipant(true)
    })
  }

  const handleEditParticipant = async () => {
    if (!editingParticipant || !formData.nombre.trim()) return
    setSaving(true)
    try {
      const updateInput: Partial<HerederosParticipanteInput> = {
        ...formData,
        nombre_representante: formData.nombre_madre?.trim() || formData.nombre_padre?.trim() || formData.nombre_representante || null,
        celular: formData.telefono_madre?.trim() || formData.telefono_padre?.trim() || formData.celular || null,
        salon: config.label,
      }
      await herederosCiclosService.updateParticipante(editingParticipant.id, updateInput, audit)
      toast.success("Datos actualizados")
      setShowEditParticipant(false)
      setEditingParticipant(null)
      resetForm()
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteParticipant = async (id: number) => {
    try {
      await herederosCiclosService.deleteParticipante(id, audit)
      toast.success("Eliminado")
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    }
  }

  const handleAttendanceChange = async (participanteId: number, fechaId: number, status: string) => {
    if (!data) return
    try {
      await herederosCiclosService.upsertAsistencia(data.ciclo.id, participanteId, fechaId, status as any)
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    }
  }

  const handleCambiarFecha = async () => {
    if (!editingFecha || !nuevaFechaEdit || !data) return
    setSaving(true)
    try {
      await herederosCiclosService.cambiarFecha(data.ciclo.id, editingFecha.id, nuevaFechaEdit, audit)
      toast.success("Fecha actualizada")
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

  const formatDateShort = (fecha: string) => {
    const d = new Date(fecha + "T00:00:00")
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" })
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
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                  <ArrowLeft className="w-4 h-4" /><span>Volver</span>
                </Button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{config.label}</h1>
                  <p className="text-xs text-gray-500">{config.edadRango}</p>
                </div>
              </div>
              {!canEdit && <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1"><Lock className="w-3 h-3" /> Solo lectura</Badge>}
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-4">
            <CalendarDays className="w-16 h-16 mx-auto text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700">No hay ciclo activo</h3>
            <p className="text-gray-500">{config.label} ({config.edadRango}) — Se registrarán los domingos del mes actual automáticamente</p>
            {canEdit && (
              <AlertDialog open={showIniciar} onOpenChange={setShowIniciar}>
                <AlertDialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700"><Play className="w-4 h-4 mr-2" /> Iniciar mes</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Iniciar {config.label}</AlertDialogTitle>
                    <AlertDialogDescription>Se registrarán automáticamente todos los domingos del mes actual como clases. ¿Desea continuar?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleIniciarCiclo} disabled={saving}>{saving ? "Iniciando..." : "Iniciar"}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </main>
      </div>
    )
  }


  // === CICLO ACTIVO ===
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{config.label} <span className="text-sm font-normal text-gray-500">({config.edadRango})</span></h1>
                <p className="text-xs text-gray-600">{data.fechas.length} domingos | {data.participantes.length} niños</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1"><Lock className="w-3 h-3" /> Solo lectura</Badge>}
              {!cicloTerminado && <Badge className="bg-blue-100 text-blue-800">En curso</Badge>}
              {cicloTerminado && <Badge className="bg-green-100 text-green-800">Completado</Badge>}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-4 space-y-3">
        {/* Acciones superiores */}
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => { resetForm(); setShowAddParticipant(true) }} title="Agregar niño(a)">
              <Plus className="w-4 h-4" />
            </Button>
          )}
          {canEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50 text-xs h-8">Cerrar ciclo</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cerrar este ciclo?</AlertDialogTitle>
                  <AlertDialogDescription>Se marcará como cerrado. Podrás iniciar uno nuevo después.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-orange-600 hover:bg-orange-700" onClick={async () => { try { await herederosCiclosService.cerrarCiclo(data.ciclo.id, audit); toast.success("Ciclo cerrado"); await loadData() } catch (e: any) { toast.error(e.message) } }}>Cerrar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canEdit && data.fechas.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 text-xs h-8"><Trash2 className="w-3 h-3 mr-1" />Fechas</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar todas las fechas?</AlertDialogTitle>
                  <AlertDialogDescription>Se eliminarán las {data.fechas.length} fechas y asistencia. Los participantes se mantienen.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => { try { await herederosCiclosService.deleteAllFechas(data.ciclo.id, audit); toast.success("Fechas eliminadas"); await loadData() } catch (e: any) { toast.error(e.message) } }}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {/* Leyenda */}
          <div className="flex gap-1.5 ml-auto">
            {ATTENDANCE_OPTIONS.map((opt) => <Badge key={opt.value} className={opt.color + " text-[10px] px-1.5 py-0"}>{opt.value}</Badge>)}
          </div>
        </div>


        {/* TABLA PRINCIPAL - full width */}
        <Card className="w-full">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-2 py-2 text-center font-medium w-8">N°</th>
                    <th className="border border-gray-200 px-2 py-2 text-left font-medium min-w-[150px]">Nombre y Apellido</th>
                    <th className="border border-gray-200 px-2 py-2 text-center font-medium w-12">Edad</th>
                    <th className="border border-gray-200 px-2 py-2 text-left font-medium min-w-[90px]">Alergias</th>
                    <th className="border border-gray-200 px-2 py-2 text-left font-medium min-w-[100px]">Observaciones</th>
                    {/* Columnas de clases (fechas) */}
                    {data.fechas.map((f) => (
                      <th key={f.id} className="border border-gray-200 px-1 py-1 text-center font-medium min-w-[60px]">
                        <div className="flex flex-col items-center">
                          <span className="font-semibold">C{f.numero_clase}</span>
                          <span className="text-[9px] text-gray-500">{formatDateShort(f.fecha)}</span>
                          {canEdit && (
                            <button className="text-blue-500 hover:text-blue-700 mt-0.5" onClick={() => { setEditingFecha(f); setNuevaFechaEdit(f.fecha); setShowEditFecha(true) }}>
                              <Edit className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="border border-gray-200 px-2 py-2 text-center font-medium min-w-[70px]">Salón</th>
                    <th className="border border-gray-200 px-2 py-2 text-center font-medium w-12">Nuevo</th>
                    <th className="border border-gray-200 px-2 py-2 text-left font-medium min-w-[130px]">Representante</th>
                    <th className="border border-gray-200 px-2 py-2 text-center font-medium min-w-[90px]">Celular</th>
                    {canEdit && <th className="border border-gray-200 px-1 py-2 text-center font-medium w-16">Acc.</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.participantes.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-2 py-1 text-center">{idx + 1}</td>
                      <td className="border border-gray-200 px-2 py-1 font-medium">{p.nombre}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center">{p.edad ?? "-"}</td>
                      <td className="border border-gray-200 px-2 py-1 whitespace-normal break-words">{p.alergias || "-"}</td>
                      <td className="border border-gray-200 px-2 py-1 whitespace-normal break-words">{p.observaciones || "-"}</td>
                      {data.fechas.map((f) => {
                        const status = getAttendanceStatus(p.id, f.id)
                        return (
                          <td key={f.id} className="border border-gray-200 px-0.5 py-0.5 text-center">
                            <Select value={status} onValueChange={(v) => handleAttendanceChange(p.id, f.id, v)} disabled={!canEdit}>
                              <SelectTrigger className={`w-full h-6 text-[10px] px-1 ${getAttendanceColor(status)}`}>
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-</SelectItem>
                                {ATTENDANCE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.value}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                        )
                      })}
                      <td className="border border-gray-200 px-2 py-1 text-center">{p.salon || config.label}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center">{p.nuevo ? "✓" : ""}</td>
                      <td className="border border-gray-200 px-2 py-1">{p.nombre_representante || "-"}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center">{p.celular || "-"}</td>
                      {canEdit && (
                        <td className="border border-gray-200 px-1 py-1 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button className="text-blue-500 hover:text-blue-700 p-0.5" onClick={() => openEditModal(p)}><Edit className="w-3 h-3" /></button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="text-red-500 hover:text-red-700 p-0.5"><Trash2 className="w-3 h-3" /></button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar a {p.nombre}?</AlertDialogTitle>
                                  <AlertDialogDescription>Se eliminará al participante y toda su asistencia.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => checkAndExecute(p.created_at, () => handleDeleteParticipant(p.id))}>Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {data.participantes.length === 0 && (
          <p className="text-center py-6 text-gray-500 text-sm">No hay niños registrados. Presione + para agregar.</p>
        )}


        {/* Modal: Agregar participante */}
        <Dialog open={showAddParticipant} onOpenChange={setShowAddParticipant}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Niño(a)</DialogTitle>
              <DialogDescription>{config.label} ({config.edadRango})</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nombre y Apellido *</Label><Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Nombre completo" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Fecha Nacimiento</Label><Input value={fechaNacDisplay} onChange={(e) => handleFechaNacChange(e.target.value)} placeholder="dd/mm/aaaa" /><p className="text-[9px] text-gray-400 mt-0.5">Se calcula la edad</p></div>
                <div><Label className="text-xs">Edad</Label><Input type="number" value={formData.edad ?? ""} readOnly className="bg-gray-50" placeholder="Auto" /></div>
              </div>
              <div><Label className="text-xs">Alergias</Label><Input value={formData.alergias || ""} onChange={(e) => setFormData({ ...formData, alergias: e.target.value })} placeholder="Alergias conocidas..." /></div>
              <div><Label className="text-xs">Observaciones</Label><Textarea value={formData.observaciones || ""} onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} rows={2} placeholder="Notas adicionales..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nombre de la Madre</Label><Input value={formData.nombre_madre || ""} onChange={(e) => setFormData({ ...formData, nombre_madre: e.target.value })} placeholder="Nombre completo" /></div>
                <div><Label className="text-xs">Teléfono Madre</Label><Input value={formData.telefono_madre || ""} onChange={(e) => setFormData({ ...formData, telefono_madre: e.target.value })} placeholder="0999999999" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nombre del Padre</Label><Input value={formData.nombre_padre || ""} onChange={(e) => setFormData({ ...formData, nombre_padre: e.target.value })} placeholder="Nombre completo" /></div>
                <div><Label className="text-xs">Teléfono Padre</Label><Input value={formData.telefono_padre || ""} onChange={(e) => setFormData({ ...formData, telefono_padre: e.target.value })} placeholder="0999999999" /></div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="nuevo-check" checked={formData.nuevo} onCheckedChange={(v) => setFormData({ ...formData, nuevo: !!v })} className="h-5 w-5" />
                <Label htmlFor="nuevo-check" className="text-sm cursor-pointer">Nuevo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddParticipant(false)}>Cancelar</Button>
              <Button onClick={handleAddParticipant} disabled={saving || !formData.nombre.trim()}>{saving ? "Guardando..." : "Agregar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Editar participante */}
        <Dialog open={showEditParticipant} onOpenChange={setShowEditParticipant}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Niño(a)</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nombre y Apellido *</Label><Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Fecha Nacimiento</Label><Input value={fechaNacDisplay} onChange={(e) => handleFechaNacChange(e.target.value)} placeholder="dd/mm/aaaa" /></div>
                <div><Label className="text-xs">Edad</Label><Input type="number" value={formData.edad ?? ""} readOnly className="bg-gray-50" /></div>
              </div>
              <div><Label className="text-xs">Alergias</Label><Input value={formData.alergias || ""} onChange={(e) => setFormData({ ...formData, alergias: e.target.value })} placeholder="Alergias conocidas..." /></div>
              <div><Label className="text-xs">Observaciones</Label><Textarea value={formData.observaciones || ""} onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nombre de la Madre</Label><Input value={formData.nombre_madre || ""} onChange={(e) => setFormData({ ...formData, nombre_madre: e.target.value })} /></div>
                <div><Label className="text-xs">Teléfono Madre</Label><Input value={formData.telefono_madre || ""} onChange={(e) => setFormData({ ...formData, telefono_madre: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nombre del Padre</Label><Input value={formData.nombre_padre || ""} onChange={(e) => setFormData({ ...formData, nombre_padre: e.target.value })} /></div>
                <div><Label className="text-xs">Teléfono Padre</Label><Input value={formData.telefono_padre || ""} onChange={(e) => setFormData({ ...formData, telefono_padre: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="nuevo-edit" checked={formData.nuevo} onCheckedChange={(v) => setFormData({ ...formData, nuevo: !!v })} className="h-5 w-5" />
                <Label htmlFor="nuevo-edit" className="text-sm cursor-pointer">Nuevo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditParticipant(false)}>Cancelar</Button>
              <Button onClick={handleEditParticipant} disabled={saving || !formData.nombre.trim()}>{saving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Editar fecha */}
        <Dialog open={showEditFecha} onOpenChange={setShowEditFecha}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cambiar fecha - Clase {editingFecha?.numero_clase}</DialogTitle>
              <DialogDescription>Las clases posteriores se recalcularán como domingos consecutivos.</DialogDescription>
            </DialogHeader>
            <div><Label>Nueva fecha</Label><Input type="date" value={nuevaFechaEdit} onChange={(e) => setNuevaFechaEdit(e.target.value)} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditFecha(false)}>Cancelar</Button>
              <Button onClick={handleCambiarFecha} disabled={saving || !nuevaFechaEdit}>{saving ? "Guardando..." : "Cambiar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
