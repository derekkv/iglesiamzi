"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/secure-db"
import { useRealtime } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Users, UserPlus, Lock, Eye, ClipboardCheck, History, DollarSign, Trash2, Pencil } from "lucide-react"
import { toast } from "sonner"
import {
  registrarGestion,
  editarGestion,
  eliminarGestion,
  getHistorialGestiones,
  getGestionesSemanaActual,
  getLunesSemanaActual,
  type GestionCelula,
} from "@/lib/mod/gestion-celulas-service"
import {
  getJuevesDelMes,
  getMesOfrendaActual,
  getOfrendasCelula,
  upsertOfrenda,
  eliminarOfrenda,
  getHistorialOfrendas,
  type OfrendaCelula,
} from "@/lib/mod/ofrenda-celulas-service"
import { Input } from "@/components/ui/input"


const CELULAS = [
  "Carlos y Ruth", "Sarita y Lady", "Jessy Mendoza", "Líder y Angela",
  "Juan Pablo y Angie", "Alina y Anita", "Neyda y Carmen", "Yadira y Tania",
  "Luis y Ariana", "Layla Salem", "Estuardo y Catalina", "Gabriela López",
]

const CELULA_IMAGES: Record<string, string> = {
  "Carlos y Ruth": "/celulas/CARLOS Y RUTH nombre.png",
  "Sarita y Lady": "/celulas/SARITA Y LADY nombre.png",
  "Jessy Mendoza": "/celulas/Jessica Mendoza.PNG",
  "Líder y Angela": "/celulas/LÍDER Y ÁNGELA nombre.png",
  "Juan Pablo y Angie": "/celulas/JUAN ÁNGEL Y ANGIE nombre.png",
  "Alina y Anita": "/celulas/ALINA Y ANITA nombre.png",
  "Neyda y Carmen": "/celulas/NEYDA Y CARMEN nombre.png",
  "Yadira y Tania": "/celulas/YADIRA Y TANIA nombre.png",
  "Luis y Ariana": "/celulas/LUIS Y ARIANNA nombre.png",
  "Layla Salem": "/celulas/Laila Salem .PNG",
  "Estuardo y Catalina": "/celulas/ESTUARDO Y CATALINA nombre.png",
  "Gabriela López": "/celulas/GABRIELA LÓPEZ nombre.png",
}

interface MiembroCelula {
  id: number
  apellidos_nombres: string
  celular?: string
  convencional?: string
  conyuge?: string
  hijos?: { nombre: string; edad: string }[]
  celula_asiste: boolean
  celula_nombre: string
  fuente: "protocolo" | "mdg"
  // Campos extra del censo para el detalle
  cedula?: string
  fecha_nacimiento?: string
  edad?: number
  estado_civil?: string
  sexo?: string
  direccion?: string
  correo?: string
}


function SomosUnoContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()
  const [miembros, setMiembros] = useState<MiembroCelula[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCelula, setSelectedCelula] = useState<string | null>(null)

  // Modales
  const [detailMember, setDetailMember] = useState<MiembroCelula | null>(null)
  const [gestionMember, setGestionMember] = useState<MiembroCelula | null>(null)
  const [historialMember, setHistorialMember] = useState<MiembroCelula | null>(null)
  const [historial, setHistorial] = useState<GestionCelula[]>([])
  const [gestionesSemana, setGestionesSemana] = useState<GestionCelula[]>([])

  // Form gestión
  const [gestionRespuesta, setGestionRespuesta] = useState("")
  const [gestionValue, setGestionValue] = useState<boolean | null>(null)
  const [gestionAsistio, setGestionAsistio] = useState<boolean | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Editar gestión
  const [editingGestion, setEditingGestion] = useState<GestionCelula | null>(null)
  const [editRespuesta, setEditRespuesta] = useState("")
  const [editValue, setEditValue] = useState<boolean>(false)
  const [editAsistio, setEditAsistio] = useState<boolean>(false)

  // Ver gestión (solo lectura)
  const [viewingGestion, setViewingGestion] = useState<GestionCelula | null>(null)

  // CRUD miembros manuales
  const [showAddMember, setShowAddMember] = useState(false)
  const [addMemberForm, setAddMemberForm] = useState({ nombre: "", celular: "" })
  const [editingMember, setEditingMember] = useState<MiembroCelula | null>(null)
  const [editMemberForm, setEditMemberForm] = useState({ nombre: "", celular: "" })
  const [savingMember, setSavingMember] = useState(false)

  // Ofrendas
  const [ofrendas, setOfrendas] = useState<OfrendaCelula[]>([])
  const [ofrendaHistorial, setOfrendaHistorial] = useState<OfrendaCelula[]>([])
  const [showOfrendaHistorial, setShowOfrendaHistorial] = useState(false)

  const loadMiembros = useCallback(async () => {
    try {
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase.from("censo")
          .select("id, apellidos_nombres, celular, convencional, conyuge, hijos, celula_asiste, celula_nombre, cedula, fecha_nacimiento, edad, estado_civil, sexo, direccion, correo")
          .not("celula_nombre", "is", null),
        supabase.from("censo_mdg")
          .select("id, apellidos_nombres, celular, convencional, conyuge, hijos, celula_asiste, celula_nombre, cedula, fecha_nacimiento, edad, estado_civil, sexo, direccion, correo")
          .not("celula_nombre", "is", null),
      ])
      const all: MiembroCelula[] = [
        ...(protocolo || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
        ...(mdg || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
      ]
      setMiembros(all)
    } catch (error) {
      console.error("Error cargando miembros:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMiembros() }, [loadMiembros])
  useRealtime({ table: "censo", onChange: () => loadMiembros() })
  useRealtime({ table: "censo_mdg", onChange: () => loadMiembros() })
  useRealtime({ table: "gestion_celulas", onChange: () => { if (selectedCelula) loadGestionesSemana(selectedCelula) } })
  useRealtime({ table: "ofrendas_celulas", onChange: () => { if (selectedCelula) loadOfrendas(selectedCelula) } })


  const loadGestionesSemana = async (celula: string) => {
    const data = await getGestionesSemanaActual(celula)
    setGestionesSemana(data)
  }

  useEffect(() => {
    if (selectedCelula) {
      loadGestionesSemana(selectedCelula)
      loadOfrendas(selectedCelula)
    }
  }, [selectedCelula])

  const loadOfrendas = async (celula: string) => {
    const { mes, anio } = getMesOfrendaActual()
    const data = await getOfrendasCelula(celula, mes, anio)
    setOfrendas(data)
  }

  const handleSaveOfrenda = async (celula: string, fecha: string, valor: string) => {
    if (!user || !valor) return
    const { mes, anio } = getMesOfrendaActual()
    const result = await upsertOfrenda({
      celula, fecha, mes, anio,
      valor: parseFloat(valor),
      userId: user.id,
      userName: user.username,
    })
    if (result.success) {
      toast.success("Ofrenda guardada")
      loadOfrendas(celula)
    } else {
      toast.error(result.error || "Error")
    }
  }

  const handleDeleteOfrenda = async (id: number, celula: string) => {
    const result = await eliminarOfrenda(id)
    if (result.success) {
      toast.success("Ofrenda eliminada")
      loadOfrendas(celula)
    } else {
      toast.error(result.error || "Error")
    }
  }

  const handleShowOfrendaHistorial = async (celula: string) => {
    const data = await getHistorialOfrendas(celula)
    setOfrendaHistorial(data)
    setShowOfrendaHistorial(true)
  }

  const miembrosActivos = miembros.filter((m) => m.celula_asiste)
  const posiblesMiembros = miembros.filter((m) => !m.celula_asiste)
  const activosPorCelula = (celula: string) => miembrosActivos.filter((m) => m.celula_nombre === celula)
  const posiblesPorCelula = (celula: string) => posiblesMiembros.filter((m) => m.celula_nombre === celula)

  const isGestionadoEstaSemana = (m: MiembroCelula) => {
    const g = gestionesSemana.find((g) => g.miembro_id === m.id && g.fuente === m.fuente)
    return g?.gestionado === true
  }

  const tieneRegistroSemana = (m: MiembroCelula) => {
    return gestionesSemana.some((g) => g.miembro_id === m.id && g.fuente === m.fuente)
  }

  const handleGestionar = (m: MiembroCelula) => {
    if (isGestionadoEstaSemana(m)) {
      toast.error("Este miembro ya fue gestionado esta semana")
      return
    }
    setGestionMember(m)
    setGestionValue(null)
    setGestionAsistio(null)
    setGestionRespuesta("")
  }

  const handleSaveGestion = async () => {
    if (!gestionMember || gestionValue === null || !user) return
    setIsSaving(true)

    // Si ya tiene registro de asistencia, actualizar con la gestión
    const existente = gestionesSemana.find((g) => g.miembro_id === gestionMember.id && g.fuente === gestionMember.fuente)
    let result
    if (existente) {
      result = await editarGestion(existente.id, {
        gestionado: gestionValue,
        respuesta: gestionRespuesta,
        asistio: gestionAsistio ?? existente.asistio ?? false,
      })
    } else {
      result = await registrarGestion({
        miembroId: gestionMember.id,
        fuente: gestionMember.fuente,
        celulaNombre: gestionMember.celula_nombre,
        gestionado: gestionValue,
        respuesta: gestionRespuesta,
        asistio: gestionAsistio ?? false,
        userId: user.id,
        userName: user.username,
      })
    }
    setIsSaving(false)
    if (result.success) {
      toast.success("Gestión registrada")
      setGestionMember(null)
      if (selectedCelula) loadGestionesSemana(selectedCelula)
    } else {
      toast.error(result.error || "Error al registrar")
    }
  }

  const handleOpenHistorial = async (m: MiembroCelula) => {
    setHistorialMember(m)
    const data = await getHistorialGestiones(m.id, m.fuente)
    setHistorial(data)
  }

  const handleEditGestion = (g: GestionCelula) => {
    checkAndExecute(g.created_at, () => {
      setEditingGestion(g)
      setEditValue(g.gestionado)
      setEditRespuesta(g.respuesta || "")
      setEditAsistio(g.asistio ?? false)
    })
  }

  const handleSaveEditGestion = async () => {
    if (!editingGestion) return
    setIsSaving(true)
    const result = await editarGestion(editingGestion.id, { gestionado: editValue, respuesta: editRespuesta, asistio: editAsistio })
    setIsSaving(false)
    if (result.success) {
      toast.success("Gestión actualizada")
      setEditingGestion(null)
      if (historialMember) {
        const data = await getHistorialGestiones(historialMember.id, historialMember.fuente)
        setHistorial(data)
      }
      if (selectedCelula) loadGestionesSemana(selectedCelula)
    } else {
      toast.error(result.error || "Error al actualizar")
    }
  }

  const handleDeleteGestion = (g: GestionCelula) => {
    checkAndExecute(g.created_at, async () => {
      if (!user) return
      const result = await eliminarGestion(g.id, { userId: user.id, userName: user.username })
      if (result.success) {
        toast.success("Gestión eliminada")
        if (historialMember) {
          const data = await getHistorialGestiones(historialMember.id, historialMember.fuente)
          setHistorial(data)
        }
        if (selectedCelula) loadGestionesSemana(selectedCelula)
      } else {
        toast.error(result.error || "Error al eliminar")
      }
    })
  }


  // ========== CRUD MIEMBROS MANUALES ==========
  const handleAddMember = async () => {
    if (!addMemberForm.nombre.trim() || !selectedCelula) return
    setSavingMember(true)
    try {
      const { error } = await supabase.from("censo").insert({
        apellidos_nombres: addMemberForm.nombre.trim(),
        celular: addMemberForm.celular.trim() || null,
        celula_nombre: selectedCelula,
        celula_asiste: true,
      })
      if (error) throw error
      toast.success("Persona agregada")
      setShowAddMember(false)
      setAddMemberForm({ nombre: "", celular: "" })
      loadMiembros()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Error al agregar persona")
    } finally { setSavingMember(false) }
  }

  const handleOpenEditMember = (m: MiembroCelula) => {
    setEditingMember(m)
    setEditMemberForm({ nombre: m.apellidos_nombres, celular: m.celular || "" })
  }

  const handleSaveEditMember = async () => {
    if (!editingMember || !editMemberForm.nombre.trim()) return
    setSavingMember(true)
    try {
      const tabla = editingMember.fuente === "protocolo" ? "censo" : "censo_mdg"
      const { error } = await supabase.from(tabla).update({
        apellidos_nombres: editMemberForm.nombre.trim(),
        celular: editMemberForm.celular.trim() || null,
      }).eq("id", editingMember.id)
      if (error) throw error
      toast.success("Persona actualizada")
      setEditingMember(null)
      loadMiembros()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Error al actualizar")
    } finally { setSavingMember(false) }
  }

  const handleDeleteMember = async (m: MiembroCelula) => {
    if (!confirm(`¿Eliminar a "${m.apellidos_nombres}" de la célula?`)) return
    try {
      const tabla = m.fuente === "protocolo" ? "censo" : "censo_mdg"
      const { error } = await supabase.from(tabla).update({ celula_nombre: null, celula_asiste: false }).eq("id", m.id)
      if (error) throw error
      toast.success("Persona eliminada de la célula")
      loadMiembros()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Error al eliminar")
    }
  }

  const handleHideMember = async (m: MiembroCelula) => {
    try {
      const tabla = m.fuente === "protocolo" ? "censo" : "censo_mdg"
      const { error } = await supabase.from(tabla).update({ celula_asiste: false }).eq("id", m.id)
      if (error) throw error
      toast.success(`${m.apellidos_nombres} pasó a posibles`)
      loadMiembros()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Error al ocultar")
    }
  }

  const handleInlineGestion = async (m: MiembroCelula, asistio: boolean, gestionado: boolean) => {
    if (!user || tieneRegistroSemana(m)) return
    setIsSaving(true)
    const result = await registrarGestion({
      miembroId: m.id,
      fuente: m.fuente,
      celulaNombre: m.celula_nombre,
      gestionado: asistio ? true : gestionado, // Si asistió, se marca automáticamente como gestionado
      respuesta: asistio ? "Asistió" : "",
      asistio,
      userId: user.id,
      userName: user.username,
    })
    setIsSaving(false)
    if (result.success) {
      toast.success("Registrado")

      // Si un "posible" asistió → pasarlo a activo
      if (asistio && !m.celula_asiste) {
        const tabla = m.fuente === "protocolo" ? "censo" : "censo_mdg"
        await supabase.from(tabla).update({ celula_asiste: true }).eq("id", m.id)
        toast.success(`${m.apellidos_nombres} ahora es miembro activo`)
        loadMiembros()
      }

      // Verificar si un activo tiene 3+ faltas → pasarlo a posible
      if (!asistio && m.celula_asiste) {
        const historial = await getHistorialGestiones(m.id, m.fuente)
        const ultimasFaltas = historial.filter((g) => !g.asistio).length
        if (ultimasFaltas >= 3) {
          const tabla = m.fuente === "protocolo" ? "censo" : "censo_mdg"
          await supabase.from(tabla).update({ celula_asiste: false }).eq("id", m.id)
          toast.info(`${m.apellidos_nombres} pasó a posibles (3+ faltas)`)
          loadMiembros()
        }
      }

      if (selectedCelula) loadGestionesSemana(selectedCelula)
    } else {
      toast.error(result.error || "Error")
    }
  }

  const renderMiembrosTable = (lista: MiembroCelula[], emptyMsg: string) => {
    if (lista.length === 0) {
      return <p className="text-center text-gray-500 py-6 text-sm">{emptyMsg}</p>
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">#</TableHead>
              <TableHead className="text-xs">Nombre</TableHead>
              <TableHead className="text-xs">Celular</TableHead>
              <TableHead className="text-xs">Asistió</TableHead>
              <TableHead className="text-xs">Gestionado</TableHead>
              <TableHead className="text-xs text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((m, idx) => {
              const yaGestionado = isGestionadoEstaSemana(m)
              const tieneRegistro = tieneRegistroSemana(m)
              const gestionSemana = gestionesSemana.find((g) => g.miembro_id === m.id && g.fuente === m.fuente)
              return (
                <TableRow key={`${m.fuente}-${m.id}`}>
                  <TableCell className="text-xs">{idx + 1}</TableCell>
                  <TableCell className="text-xs font-medium">{m.apellidos_nombres}</TableCell>
                  <TableCell className="text-xs">{m.celular || "-"}</TableCell>
                  <TableCell className="text-xs">
                    {tieneRegistro ? (
                      <Badge className={gestionSemana?.asistio ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {gestionSemana?.asistio ? "Asistió" : "Faltó"}
                      </Badge>
                    ) : canEdit ? (
                      <select
                        className="text-xs border rounded px-1 py-0.5 bg-white"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            const asistio = e.target.value === "si"
                            handleInlineGestion(m, asistio, false)
                          }
                        }}
                        disabled={isSaving}
                      >
                        <option value="">-</option>
                        <option value="si">Asistió</option>
                        <option value="no">Faltó</option>
                      </select>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {yaGestionado ? (
                      <Badge className="bg-blue-100 text-blue-700">Gestionado</Badge>
                    ) : gestionSemana?.asistio ? (
                      <Badge className="bg-green-100 text-green-700">✓ Asistió</Badge>
                    ) : tieneRegistro && !gestionSemana?.asistio ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">Pendiente</Badge>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Botón Gestionar: solo para los que faltaron y no están gestionados */}
                      {tieneRegistro && !gestionSemana?.asistio && !yaGestionado && canEdit && (
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleGestionar(m)}
                          className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <ClipboardCheck className="w-3 h-3 mr-1" /> Gestionar
                        </Button>
                      )}
                      {/* Ver gestión: solo si fue gestionado esta semana */}
                      {yaGestionado && gestionSemana && (
                        <Button variant="outline" size="sm" className="text-xs text-green-600 border-green-200 hover:bg-green-50" onClick={() => {
                          setViewingGestion(gestionSemana)
                        }}>
                          <Eye className="w-3 h-3 mr-1" /> Ver gestión
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" title="Ver datos" onClick={() => setDetailMember(m)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => handleOpenHistorial(m)}>
                        <History className="w-3 h-3 mr-1" /> Ver historial
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-blue-600" title="Editar" onClick={() => handleOpenEditMember(m)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-amber-600" title="Ocultar (pasar a posibles)" onClick={() => handleHideMember(m)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-red-600" title="Eliminar de célula" onClick={() => handleDeleteMember(m)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }


  if (loading) {
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
              <Button variant="ghost" size="sm" onClick={() => selectedCelula ? setSelectedCelula(null) : router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {selectedCelula ? `Célula: ${selectedCelula}` : "Somos Uno - Células"}
                </h1>
                <p className="text-xs text-gray-500">
                  {miembrosActivos.length} activos | {posiblesMiembros.length} posibles | Semana: {getLunesSemanaActual()}
                </p>
              </div>
            </div>
            {!canEdit && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Solo lectura
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!selectedCelula ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CELULAS.map((celula) => {
              const activos = activosPorCelula(celula).length
              const posibles = posiblesPorCelula(celula).length
              const image = CELULA_IMAGES[celula]
              return (
                <Card key={celula} className="cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-200 overflow-hidden border-0 rounded-xl group p-0" onClick={() => setSelectedCelula(celula)}>
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600">
                    {image ? (
                      <img src={image} alt={celula} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Users className="w-16 h-16 text-white/40" /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4"><h3 className="text-lg font-bold text-white drop-shadow-md">{celula}</h3></div>
                    <div className="absolute top-3 right-3"><Badge className="bg-white/90 text-gray-800 text-xs font-semibold shadow">{activos + posibles}</Badge></div>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex gap-3 text-sm">
                        <span className="text-green-600 flex items-center gap-1 font-medium"><Users className="w-3.5 h-3.5" /> {activos} activos</span>
                        {posibles > 0 && <span className="text-amber-600 flex items-center gap-1 font-medium"><UserPlus className="w-3.5 h-3.5" /> {posibles} posibles</span>}
                      </div>
                      <Button size="sm" variant="outline" className="text-xs">Ver</Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>


        ) : (
          <Tabs defaultValue="activos" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="activos"><Users className="w-4 h-4 mr-2" /> Activos ({activosPorCelula(selectedCelula).length})</TabsTrigger>
              <TabsTrigger value="posibles"><UserPlus className="w-4 h-4 mr-2" /> Posibles ({posiblesPorCelula(selectedCelula).length})</TabsTrigger>
              <TabsTrigger value="ofrenda"><DollarSign className="w-4 h-4 mr-2" /> Ofrenda</TabsTrigger>
            </TabsList>
            <TabsContent value="activos">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Miembros que asisten a esta célula</CardTitle>
                    {canEdit && (
                      <Button size="sm" onClick={() => setShowAddMember(true)} className="flex items-center gap-1">
                        <UserPlus className="w-4 h-4" /> Agregar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>{renderMiembrosTable(activosPorCelula(selectedCelula), "No hay miembros activos en esta célula")}</CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="posibles">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Posibles miembros (célula asignada pero no asisten)</CardTitle></CardHeader>
                <CardContent>{renderMiembrosTable(posiblesPorCelula(selectedCelula), "No hay posibles miembros para esta célula")}</CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="ofrenda">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Ofrenda Semanal (Jueves)</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => handleShowOfrendaHistorial(selectedCelula)}>
                      <History className="w-3.5 h-3.5 mr-1" /> Historial
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Mes: {getMesOfrendaActual().mes}/{getMesOfrendaActual().anio} — Registre el valor recolectado cada jueves
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Jueves</TableHead>
                          <TableHead className="text-xs">Valor ($)</TableHead>
                          <TableHead className="text-xs">Registrado por</TableHead>
                          <TableHead className="text-xs text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getJuevesDelMes(getMesOfrendaActual().anio, getMesOfrendaActual().mes).map((jueves) => {
                          const ofrenda = ofrendas.find((o) => o.fecha === jueves)
                          return (
                            <TableRow key={jueves}>
                              <TableCell className="text-xs font-medium">{new Date(jueves + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}</TableCell>
                              <TableCell className="text-xs">
                                {ofrenda ? (
                                  <span className="font-semibold text-green-700">${ofrenda.valor.toFixed(2)}</span>
                                ) : canEdit ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="h-7 w-24 text-xs"
                                    onBlur={(e) => {
                                      if (e.target.value && parseFloat(e.target.value) > 0) {
                                        handleSaveOfrenda(selectedCelula, jueves, e.target.value)
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const val = (e.target as HTMLInputElement).value
                                        if (val && parseFloat(val) > 0) handleSaveOfrenda(selectedCelula, jueves, val)
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-gray-500">{ofrenda?.registrado_por_nombre || "—"}</TableCell>
                              <TableCell className="text-xs text-right">
                                {ofrenda && canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500"
                                    onClick={() => {
                                      checkAndExecute(ofrenda.created_at, () => handleDeleteOfrenda(ofrenda.id, selectedCelula))
                                    }}
                                  >Eliminar</Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-3 p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-sm text-gray-600">Total del mes:</p>
                    <p className="text-xl font-bold text-green-700">${ofrendas.reduce((s, o) => s + Number(o.valor), 0).toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Modal: Ver Datos Completos */}
      <Dialog open={!!detailMember} onOpenChange={() => setDetailMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Datos de {detailMember?.apellidos_nombres}</DialogTitle>
          </DialogHeader>
          {detailMember && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">Cédula:</span> <span className="font-medium">{detailMember.cedula || "-"}</span></div>
                <div><span className="text-gray-500">Edad:</span> <span className="font-medium">{detailMember.edad || "-"}</span></div>
                <div><span className="text-gray-500">Sexo:</span> <span className="font-medium">{detailMember.sexo || "-"}</span></div>
                <div><span className="text-gray-500">Estado Civil:</span> <span className="font-medium">{detailMember.estado_civil || "-"}</span></div>
                <div><span className="text-gray-500">Celular:</span> <span className="font-medium">{detailMember.celular || "-"}</span></div>
                <div><span className="text-gray-500">Tel. Convencional:</span> <span className="font-medium">{detailMember.convencional || "-"}</span></div>
                <div><span className="text-gray-500">Correo:</span> <span className="font-medium">{detailMember.correo || "-"}</span></div>
                <div><span className="text-gray-500">Cónyuge:</span> <span className="font-medium">{detailMember.conyuge || "-"}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Dirección:</span> <span className="font-medium">{detailMember.direccion || "-"}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Célula:</span> <span className="font-medium">{detailMember.celula_nombre}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Asiste:</span> <Badge className={detailMember.celula_asiste ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{detailMember.celula_asiste ? "Sí" : "No"}</Badge></div>
              </div>
              {detailMember.hijos && detailMember.hijos.length > 0 && (
                <div>
                  <span className="text-gray-500">Hijos:</span>
                  <ul className="list-disc ml-5 mt-1">{detailMember.hijos.map((h, i) => <li key={i}>{h.nombre} ({h.edad})</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Modal: Gestionar */}
      <Dialog open={!!gestionMember} onOpenChange={() => setGestionMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar: {gestionMember?.apellidos_nombres}</DialogTitle>
            <DialogDescription>Semana del {getLunesSemanaActual()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">¿Se pudo gestionar?</Label>
              <div className="flex gap-3 mt-2">
                <Button
                  variant={gestionValue === true ? "default" : "outline"}
                  className={gestionValue === true ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setGestionValue(true)}
                >Sí</Button>
                <Button
                  variant={gestionValue === false ? "default" : "outline"}
                  className={gestionValue === false ? "bg-red-600 hover:bg-red-700" : ""}
                  onClick={() => setGestionValue(false)}
                >No</Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Observación / Respuesta</Label>
              <Textarea
                value={gestionRespuesta}
                onChange={(e) => setGestionRespuesta(e.target.value)}
                placeholder="Notas sobre la gestión..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGestionMember(null)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSaveGestion} disabled={isSaving || gestionValue === null}>
              {isSaving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Historial */}
      <Dialog open={!!historialMember} onOpenChange={() => setHistorialMember(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Historial de Gestiones: {historialMember?.apellidos_nombres}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {historial.length === 0 ? (
              <p className="text-center text-gray-500 py-6">No hay gestiones registradas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Semana</TableHead>
                    <TableHead className="text-xs">Asistió</TableHead>
                    <TableHead className="text-xs">Gestionado</TableHead>
                    <TableHead className="text-xs">Observación</TableHead>
                    <TableHead className="text-xs">Por</TableHead>
                    <TableHead className="text-xs text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="text-xs">{g.semana_inicio}</TableCell>
                      <TableCell className="text-xs">
                        <Badge className={g.asistio ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                          {g.asistio ? "Asistió" : "Faltó"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge className={g.gestionado ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}>
                          {g.gestionado ? "Sí" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{g.respuesta || "-"}</TableCell>
                      <TableCell className="text-xs">{g.gestionado_por_nombre || "-"}</TableCell>
                      <TableCell className="text-xs text-right">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600" onClick={() => handleEditGestion(g)}>
                              <Pencil className="w-3 h-3 mr-1" /> Editar
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => handleDeleteGestion(g)}>
                              <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* Modal: Editar Gestión */}
      <Dialog open={!!editingGestion} onOpenChange={() => setEditingGestion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Gestión</DialogTitle>
            <DialogDescription>Semana del {editingGestion?.semana_inicio}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">¿Asistió?</Label>
              <div className="flex gap-3 mt-2">
                <Button
                  variant={editAsistio === true ? "default" : "outline"}
                  className={editAsistio === true ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setEditAsistio(true)}
                >Sí</Button>
                <Button
                  variant={editAsistio === false ? "default" : "outline"}
                  className={editAsistio === false ? "bg-red-600 hover:bg-red-700" : ""}
                  onClick={() => setEditAsistio(false)}
                >No</Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">¿Se pudo gestionar?</Label>
              <div className="flex gap-3 mt-2">
                <Button
                  variant={editValue === true ? "default" : "outline"}
                  className={editValue === true ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setEditValue(true)}
                >Sí</Button>
                <Button
                  variant={editValue === false ? "default" : "outline"}
                  className={editValue === false ? "bg-red-600 hover:bg-red-700" : ""}
                  onClick={() => setEditValue(false)}
                >No</Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Observación / Respuesta</Label>
              <Textarea
                value={editRespuesta}
                onChange={(e) => setEditRespuesta(e.target.value)}
                placeholder="Notas sobre la gestión..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGestion(null)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSaveEditGestion} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal: Ver Gestión (solo lectura) */}
      <Dialog open={!!viewingGestion} onOpenChange={() => setViewingGestion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de Gestión</DialogTitle>
            <DialogDescription>Semana del {viewingGestion?.semana_inicio}</DialogDescription>
          </DialogHeader>
          {viewingGestion && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-gray-500">Asistió:</span>
                  <Badge className={`ml-2 ${viewingGestion.asistio ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {viewingGestion.asistio ? "Sí" : "No"}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Gestionado:</span>
                  <Badge className={`ml-2 ${viewingGestion.gestionado ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {viewingGestion.gestionado ? "Sí" : "No"}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Observación:</span>
                <p className="mt-1 text-sm bg-gray-50 rounded p-2">{viewingGestion.respuesta || "Sin observación"}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Registrado por:</span>
                <span className="ml-2 text-sm font-medium">{viewingGestion.gestionado_por_nombre || "-"}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingGestion(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Historial Ofrendas */}
      <Dialog open={showOfrendaHistorial} onOpenChange={setShowOfrendaHistorial}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Historial de Ofrendas: {selectedCelula}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {ofrendaHistorial.length === 0 ? (
              <p className="text-center text-gray-500 py-6">No hay ofrendas registradas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Valor</TableHead>
                    <TableHead className="text-xs">Registrado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ofrendaHistorial.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-xs">{new Date(o.fecha + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                      <TableCell className="text-xs font-semibold text-green-700">${Number(o.valor).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-gray-500">{o.registrado_por_nombre || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Agregar Miembro Manual */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Persona a {selectedCelula}</DialogTitle>
            <DialogDescription>Se agregará como miembro activo de esta célula.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre completo *</Label>
              <Input
                value={addMemberForm.nombre}
                onChange={(e) => setAddMemberForm({ ...addMemberForm, nombre: e.target.value })}
                placeholder="Nombres y apellidos"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Celular</Label>
              <Input
                value={addMemberForm.celular}
                onChange={(e) => setAddMemberForm({ ...addMemberForm, celular: e.target.value })}
                placeholder="0999999999"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMember(false)} disabled={savingMember}>Cancelar</Button>
            <Button onClick={handleAddMember} disabled={savingMember || !addMemberForm.nombre.trim()}>
              {savingMember ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Miembro */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Persona</DialogTitle>
            <DialogDescription>Modifique los datos de {editingMember?.apellidos_nombres}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre completo *</Label>
              <Input
                value={editMemberForm.nombre}
                onChange={(e) => setEditMemberForm({ ...editMemberForm, nombre: e.target.value })}
                placeholder="Nombres y apellidos"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Celular</Label>
              <Input
                value={editMemberForm.celular}
                onChange={(e) => setEditMemberForm({ ...editMemberForm, celular: e.target.value })}
                placeholder="0999999999"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)} disabled={savingMember}>Cancelar</Button>
            <Button onClick={handleSaveEditMember} disabled={savingMember || !editMemberForm.nombre.trim()}>
              {savingMember ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SomosUnoPage() {
  return (
    <PermissionsGuard moduleName="celulas">
      {(canEdit) => <SomosUnoContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
