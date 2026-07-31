"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { auditService } from "@/lib/mod/audit-service"
import { toast } from "sonner"
import {
  ArrowLeft, ClipboardCheck, Search, UserX, CheckCircle2, XCircle,
  MessageSquare, Trash2, Clock, Users, AlertTriangle, Lock, Plus,
} from "lucide-react"

import {
  type PersonaCulto,
  type RegistroAsistencia,
  type SeguimientoCulto,
  getDomingosDelMes,
  cargarPersonasCensos,
  getAsistenciaMes,
  getSeguimientoMes,
  registrarAsistencia,
  gestionarSeguimiento,
  eliminarSeguimiento,
  moverASeguimientoSiCorresponde,
} from "@/lib/mod/asistencia-culto-service"

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

function AsistenciaCultoContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { currentMonth } = useMonth()
  const { checkAndExecute } = useSecurityCheck()


  // Data
  const [personas, setPersonas] = useState<PersonaCulto[]>([])
  const [registros, setRegistros] = useState<RegistroAsistencia[]>([])
  const [seguimiento, setSeguimiento] = useState<SeguimientoCulto[]>([])
  const [domingos, setDomingos] = useState<string[]>([])

  // UI
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchSeg, setSearchSeg] = useState("")
  const [tab, setTab] = useState("asistencia")

  // Modal gestión
  const [gestionModal, setGestionModal] = useState<SeguimientoCulto | null>(null)
  const [gestionRespuesta, setGestionRespuesta] = useState("")
  const [gestionExitosa, setGestionExitosa] = useState<boolean | null>(null)
  const [gestionando, setGestionando] = useState(false)

  // Modal historial gestión
  const [historialModal, setHistorialModal] = useState<SeguimientoCulto | null>(null)

  // Confirm eliminar
  const [eliminarTarget, setEliminarTarget] = useState<SeguimientoCulto | null>(null)


  // ------ Carga de datos ------
  const loadData = useCallback(async (silent = false) => {
    if (!currentMonth?.id) return
    if (!silent) setLoading(true)
    try {
      const [personasData, registrosData, segData] = await Promise.all([
        cargarPersonasCensos(),
        getAsistenciaMes(currentMonth.id),
        getSeguimientoMes(currentMonth.id),
      ])
      setPersonas(personasData)
      setRegistros(registrosData)
      setSeguimiento(segData)
      setDomingos(getDomingosDelMes(currentMonth.year, currentMonth.month))
    } catch (err: any) {
      console.error("[asistencia-culto] Error:", err)
      toast.error("Error al cargar datos")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => { loadData() }, [loadData])

  // Realtime
  useRealtimeMultiple(["asistencia_culto", "asistencia_culto_seguimiento"], () => loadData(true))


  // ------ Helpers ------
  const getRegistro = (personaId: number, fuente: string, fechaDomingo: string) =>
    registros.find((r) => r.persona_id === personaId && r.fuente === fuente && r.fecha_domingo === fechaDomingo)

  const contarFaltas = (personaId: number, fuente: string) =>
    registros.filter((r) => r.persona_id === personaId && r.fuente === fuente && r.asistio === false).length

  const enSeguimiento = (personaId: number, fuente: string) =>
    seguimiento.some((s) => s.persona_id === personaId && s.fuente === fuente)

  // ------ Acciones ------
  const handleMarcar = async (persona: PersonaCulto, fechaDomingo: string, asistio: boolean) => {
    if (!canEdit || !currentMonth?.id) return

    // Actualizar state local inmediatamente (optimistic update)
    const key = `${persona.id}-${persona.fuente}-${fechaDomingo}`
    setRegistros((prev) => {
      const existing = prev.findIndex((r) => r.persona_id === persona.id && r.fuente === persona.fuente && r.fecha_domingo === fechaDomingo)
      const newReg: RegistroAsistencia = {
        mes_id: currentMonth.id,
        persona_id: persona.id,
        fuente: persona.fuente,
        nombre: persona.nombre,
        apellido: persona.apellido,
        celular: persona.celular,
        fecha_domingo: fechaDomingo,
        asistio,
      }
      if (existing >= 0) {
        const copy = [...prev]
        copy[existing] = { ...copy[existing], asistio }
        return copy
      }
      return [...prev, newReg]
    })

    const result = await registrarAsistencia({
      mes_id: currentMonth.id,
      persona_id: persona.id,
      fuente: persona.fuente,
      nombre: persona.nombre,
      apellido: persona.apellido,
      celular: persona.celular,
      fecha_domingo: fechaDomingo,
      asistio,
      registrado_por: user?.id,
      registrado_por_nombre: user?.displayName,
    })

    if (!result.success) {
      toast.error(result.error || "Error al registrar")
      loadData(true) // Revertir
      return
    }

    // Si es falta, verificar si ya tiene 2+ y mover a seguimiento
    if (!asistio) {
      const segResult = await moverASeguimientoSiCorresponde({
        mes_id: currentMonth.id,
        persona_id: persona.id,
        fuente: persona.fuente,
        nombre: persona.nombre,
        apellido: persona.apellido,
        celular: persona.celular,
      })
      if (segResult.movido) {
        toast.info(`${persona.apellido}, ${persona.nombre} pasó a Seguimiento (2+ faltas)`)
        loadData(true) // Refrescar seguimiento
      }
    }
  }


  const handleGestionar = async () => {
    if (!gestionModal || !user || gestionExitosa === null) return
    setGestionando(true)

    const respuestaFinal = `${gestionExitosa ? "✅ Sí se pudo gestionar" : "❌ No se pudo gestionar"}${gestionRespuesta.trim() ? ` — ${gestionRespuesta.trim()}` : ""}`

    const result = await gestionarSeguimiento({
      id: gestionModal.id,
      respuesta: respuestaFinal,
      gestionado_por: user.id,
      gestionado_por_nombre: user.displayName || user.username,
    })
    if (result.success) {
      toast.success("Gestión registrada")
      // Optimistic update
      setSeguimiento((prev) => prev.map((s) => s.id === gestionModal.id ? { ...s, gestionado: true, respuesta_gestion: respuestaFinal, gestionado_por_nombre: user.displayName || user.username, fecha_gestion: new Date().toISOString() } : s))
      auditService.log({
        user_id: user.id,
        user_name: user.username,
        module: "asistencia_culto",
        action: "editar",
        description: `Seguimiento gestionado: ${gestionModal.apellido}, ${gestionModal.nombre}`,
        details: { persona_id: gestionModal.persona_id, fuente: gestionModal.fuente, exitosa: gestionExitosa, respuesta: gestionRespuesta.trim() },
      })
      setGestionModal(null)
      setGestionRespuesta("")
      setGestionExitosa(null)
    } else {
      toast.error(result.error || "Error al gestionar")
    }
    setGestionando(false)
  }

  const handleEliminar = async () => {
    if (!eliminarTarget || !user) return
    checkAndExecute(eliminarTarget.created_at, async () => {
      const result = await eliminarSeguimiento(eliminarTarget.id)
      if (result.success) {
        toast.success("Registro eliminado de seguimiento")
        // Optimistic update
        setSeguimiento((prev) => prev.filter((s) => s.id !== eliminarTarget.id))
        auditService.log({
          user_id: user.id,
          user_name: user.username,
          module: "asistencia_culto",
          action: "eliminar",
          description: `Eliminado de seguimiento: ${eliminarTarget.apellido}, ${eliminarTarget.nombre}`,
          details: { persona_id: eliminarTarget.persona_id, fuente: eliminarTarget.fuente },
        })
      } else {
        toast.error(result.error || "Error al eliminar")
      }
      setEliminarTarget(null)
    })
  }


  // ------ Filtrado ------
  const personasFiltradas = personas.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.apellido.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q) || (p.celular || "").includes(q)
  })

  const seguimientoFiltrado = seguimiento.filter((s) => {
    if (!searchSeg) return true
    const q = searchSeg.toLowerCase()
    return s.apellido.toLowerCase().includes(q) || s.nombre.toLowerCase().includes(q) || (s.celular || "").includes(q)
  })

  // ------ Stats ------
  const totalPersonas = personas.length
  const personasConAsistencia = new Set(registros.filter((r) => r.asistio === true).map((r) => `${r.persona_id}-${r.fuente}`)).size
  const personasConFalta = new Set(registros.filter((r) => r.asistio === false).map((r) => `${r.persona_id}-${r.fuente}`)).size
  const enSeguimientoCount = seguimiento.length
  const sinGestionar = seguimiento.filter((s) => !s.gestionado).length

  // ------ Formato de fecha ------
  const formatDomingo = (fecha: string) => {
    const [, , dd] = fecha.split("-")
    return `Dom ${parseInt(dd)}`
  }

  if (loading) {
    return (<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>)
  }
  if (!currentMonth) {
    return (<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">No hay un mes activo configurado.</p></div>)
  }


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 sm:h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" /> Asistencia al Culto
                </h1>
                <p className="text-sm text-gray-600">Mes: {currentMonth.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Card><CardContent className="p-4 text-center"><Users className="h-5 w-5 mx-auto text-gray-500" /><p className="text-2xl font-bold mt-1">{totalPersonas}</p><p className="text-xs text-gray-500">Total censo</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-green-600" /><p className="text-2xl font-bold mt-1 text-green-700">{personasConAsistencia}</p><p className="text-xs text-gray-500">Asistieron</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><XCircle className="h-5 w-5 mx-auto text-red-600" /><p className="text-2xl font-bold mt-1 text-red-700">{personasConFalta}</p><p className="text-xs text-gray-500">Faltaron</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><AlertTriangle className="h-5 w-5 mx-auto text-amber-600" /><p className="text-2xl font-bold mt-1 text-amber-700">{enSeguimientoCount}</p><p className="text-xs text-gray-500">Seguimiento</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Clock className="h-5 w-5 mx-auto text-orange-600" /><p className="text-2xl font-bold mt-1 text-orange-700">{sinGestionar}</p><p className="text-xs text-gray-500">Sin gestionar</p></CardContent></Card>
        </div>


        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="asistencia" className="gap-2">
              <ClipboardCheck className="h-4 w-4" /> Asistencia
            </TabsTrigger>
            <TabsTrigger value="seguimiento" className="gap-2">
              <UserX className="h-4 w-4" /> Seguimiento
              {sinGestionar > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1.5">{sinGestionar}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ============= TAB ASISTENCIA ============= */}
          <TabsContent value="asistencia">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-lg">Registro dominical</CardTitle>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Buscar por nombre o apellido..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-gray-50 z-10 min-w-[200px]">Apellido, Nombre</th>
                        <th className="text-left px-3 py-3 font-semibold min-w-[110px]">Celular</th>
                        <th className="text-center px-2 py-3 font-semibold min-w-[60px]">Fuente</th>
                        {domingos.map((d) => (<th key={d} className="text-center px-2 py-3 font-semibold min-w-[90px]">{formatDomingo(d)}</th>))}
                        <th className="text-center px-3 py-3 font-semibold min-w-[60px]">Faltas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {personasFiltradas.map((persona) => {
                        const faltas = contarFaltas(persona.id, persona.fuente)
                        const estaEnSeg = enSeguimiento(persona.id, persona.fuente)
                        return (
                          <tr key={`${persona.id}-${persona.fuente}`} className={estaEnSeg ? "bg-amber-50/60" : "hover:bg-gray-50"}>
                            <td className="px-4 py-2.5 sticky left-0 bg-white z-10">
                              <div className="font-medium text-gray-900">{persona.apellido}, {persona.nombre}</div>
                              {estaEnSeg && <Badge variant="outline" className="text-[10px] mt-0.5 border-amber-500 text-amber-700">En seguimiento</Badge>}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">{persona.celular || "—"}</td>
                            <td className="px-2 py-2.5 text-center">
                              <Badge variant="secondary" className="text-[10px]">{persona.fuente === "protocolo" ? "P" : persona.fuente === "mdg" ? "M" : "J"}</Badge>
                            </td>

                            {domingos.map((fechaDomingo) => {
                              const reg = getRegistro(persona.id, persona.fuente, fechaDomingo)
                              const value = reg?.asistio === true ? "asistio" : reg?.asistio === false ? "falto" : ""
                              return (
                                <td key={fechaDomingo} className="px-1 py-2.5 text-center">
                                  <Select value={value} onValueChange={(v) => { if (canEdit) handleMarcar(persona, fechaDomingo, v === "asistio") }} disabled={!canEdit}>
                                    <SelectTrigger className="h-8 w-[80px] mx-auto text-xs">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="asistio"><span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3 w-3" /> Asistió</span></SelectItem>
                                      <SelectItem value="falto"><span className="flex items-center gap-1 text-red-700"><XCircle className="h-3 w-3" /> Faltó</span></SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                              )
                            })}
                            <td className="px-3 py-2.5 text-center">
                              <span className={`font-bold ${faltas >= 2 ? "text-red-600" : faltas === 1 ? "text-amber-600" : "text-green-600"}`}>{faltas}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {personasFiltradas.length === 0 && (
                    <div className="text-center py-10 text-gray-500">{search ? "No se encontraron personas con ese nombre" : "No hay personas registradas en los censos"}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ============= TAB SEGUIMIENTO ============= */}
          <TabsContent value="seguimiento">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-lg">Seguimiento — Personas con 2+ faltas</CardTitle>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Buscar..." value={searchSeg} onChange={(e) => setSearchSeg(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Apellido, Nombre</th>
                        <th className="text-left px-3 py-3 font-semibold">Celular</th>
                        <th className="text-center px-3 py-3 font-semibold">Fuente</th>
                        <th className="text-center px-3 py-3 font-semibold">Faltas</th>
                        <th className="text-center px-3 py-3 font-semibold">Estado</th>
                        <th className="text-center px-3 py-3 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {seguimientoFiltrado.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><div className="font-medium text-gray-900">{s.apellido}, {s.nombre}</div></td>
                          <td className="px-3 py-3 text-gray-500">{s.celular || "—"}</td>
                          <td className="px-3 py-3 text-center"><Badge variant="secondary" className="text-[10px]">{s.fuente === "protocolo" ? "Protocolo" : s.fuente === "mdg" ? "MDG" : "Jóvenes"}</Badge></td>
                          <td className="px-3 py-3 text-center"><span className="font-bold text-red-600">{s.total_faltas}</span></td>
                          <td className="px-3 py-3 text-center">
                            {s.gestionado ? <Badge className="bg-blue-100 text-blue-800 border-blue-200">Gestionado</Badge> : <Badge variant="destructive">Pendiente</Badge>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {!s.gestionado && canEdit && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setGestionModal(s); setGestionRespuesta(""); setGestionExitosa(null) }}>
                                  <MessageSquare className="h-3 w-3" /> Gestionar
                                </Button>
                              )}
                              {s.gestionado && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setHistorialModal(s)}>Ver gestión</Button>
                              )}
                              {canEdit && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => setEliminarTarget(s)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {seguimientoFiltrado.length === 0 && (
                    <div className="text-center py-10 text-gray-500">{searchSeg ? "No se encontraron resultados" : "No hay personas en seguimiento este mes"}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>


        {/* ============= MODAL GESTIONAR ============= */}
        <Dialog open={!!gestionModal} onOpenChange={() => { setGestionModal(null); setGestionExitosa(null); setGestionRespuesta("") }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gestionar: {gestionModal?.apellido}, {gestionModal?.nombre}</DialogTitle>
              <DialogDescription>{gestionModal?.total_faltas} falta(s) este mes</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-gray-700">¿Se pudo gestionar?</label>
                <div className="flex gap-3 mt-2">
                  <Button
                    variant={gestionExitosa === true ? "default" : "outline"}
                    className={gestionExitosa === true ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => setGestionExitosa(true)}
                  >Sí</Button>
                  <Button
                    variant={gestionExitosa === false ? "default" : "outline"}
                    className={gestionExitosa === false ? "bg-red-600 hover:bg-red-700" : ""}
                    onClick={() => setGestionExitosa(false)}
                  >No</Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Observación / Respuesta</label>
                <textarea
                  className="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notas sobre la gestión..."
                  value={gestionRespuesta}
                  onChange={(e) => setGestionRespuesta(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setGestionModal(null); setGestionExitosa(null); setGestionRespuesta("") }}>Cancelar</Button>
              <Button onClick={handleGestionar} disabled={gestionando || gestionExitosa === null}>
                {gestionando ? "Guardando..." : "Registrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============= MODAL HISTORIAL GESTIÓN ============= */}
        <Dialog open={!!historialModal} onOpenChange={() => setHistorialModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalle de gestión</DialogTitle>
              <DialogDescription>{historialModal?.apellido}, {historialModal?.nombre}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-sm">
              <div><span className="font-medium text-gray-700">Total faltas:</span> {historialModal?.total_faltas}</div>
              <div><span className="font-medium text-gray-700">Observación:</span> {historialModal?.respuesta_gestion || "Sin observación"}</div>
              <div><span className="font-medium text-gray-700">Gestionado por:</span> {historialModal?.gestionado_por_nombre || "—"}</div>
              <div><span className="font-medium text-gray-700">Fecha:</span> {historialModal?.fecha_gestion ? new Date(historialModal.fecha_gestion).toLocaleString("es-EC") : "—"}</div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============= CONFIRM ELIMINAR ============= */}
        <Dialog open={!!eliminarTarget} onOpenChange={() => setEliminarTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar de seguimiento?</DialogTitle>
              <DialogDescription>
                Se quitará a {eliminarTarget?.apellido}, {eliminarTarget?.nombre} de la lista de seguimiento.
                Si vuelve a acumular faltas, volverá a aparecer automáticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEliminarTarget(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleEliminar}>Eliminar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Export con guard de permisos
// ---------------------------------------------------------------------------

export default function AsistenciaCultoPage() {
  return (
    <PermissionsGuard moduleName="asistencia_culto">
      {(canEdit) => <AsistenciaCultoContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
