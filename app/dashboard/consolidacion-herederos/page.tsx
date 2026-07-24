"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Lock, ClipboardCheck, Pencil, Trash2, Users, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import {
  getConsolidacionMes,
  sincronizarConsolidacion,
  gestionarNino,
  editarGestionConsolidacion,
  eliminarConsolidacion,
  type ConsolidacionHeredero,
} from "@/lib/mod/consolidacion-herederos-service"
import { currentMonthEcuador, currentYearEcuador } from "@/lib/timezone"

const SALON_LABELS: Record<string, string> = {
  herederos_baby: "Herederos Baby",
  herederos_kids: "Herederos Kids",
  herederos_explores: "Herederos Explores",
  herederos_champions: "Herederos Champions",
}

function ConsolidacionContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()

  const [registros, setRegistros] = useState<ConsolidacionHeredero[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSalon, setFilterSalon] = useState<string>("todos")
  const [filterEstado, setFilterEstado] = useState<string>("todos")

  // Modal gestionar
  const [gestionandoRegistro, setGestionandoRegistro] = useState<ConsolidacionHeredero | null>(null)
  const [gestionRespuesta, setGestionRespuesta] = useState("")
  const [gestionValue, setGestionValue] = useState<boolean | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Modal editar
  const [editandoRegistro, setEditandoRegistro] = useState<ConsolidacionHeredero | null>(null)
  const [editRespuesta, setEditRespuesta] = useState("")
  const [editValue, setEditValue] = useState<boolean>(false)

  useEffect(() => {
    initData()
  }, [])

  const initData = async () => {
    try {
      // Sincronizar automáticamente al cargar
      await sincronizarConsolidacion()
      // Luego cargar los datos actualizados
      const data = await getConsolidacionMes()
      setRegistros(data)
    } catch (error) {
      console.error("Error cargando consolidación:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      const data = await getConsolidacionMes()
      setRegistros(data)
    } catch (error) {
      console.error("Error cargando consolidación:", error)
    }
  }

  const handleGestionar = (registro: ConsolidacionHeredero) => {
    setGestionandoRegistro(registro)
    setGestionValue(null)
    setGestionRespuesta("")
  }

  const handleSaveGestion = async () => {
    if (!gestionandoRegistro || gestionValue === null || !user) return
    setIsSaving(true)
    try {
      await gestionarNino(
        gestionandoRegistro.id,
        { gestionado: gestionValue, respuesta: gestionRespuesta },
        { user_id: user.id, user_name: user.username }
      )
      toast.success("Gestión registrada")
      setGestionandoRegistro(null)
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Error al registrar gestión")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditar = (registro: ConsolidacionHeredero) => {
    checkAndExecute(registro.created_at, () => {
      setEditandoRegistro(registro)
      setEditValue(registro.gestionado)
      setEditRespuesta(registro.respuesta || "")
    })
  }

  const handleSaveEdit = async () => {
    if (!editandoRegistro || !user) return
    setIsSaving(true)
    try {
      await editarGestionConsolidacion(
        editandoRegistro.id,
        { gestionado: editValue, respuesta: editRespuesta },
        { user_id: user.id, user_name: user.username }
      )
      toast.success("Gestión actualizada")
      setEditandoRegistro(null)
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEliminar = (registro: ConsolidacionHeredero) => {
    checkAndExecute(registro.created_at, async () => {
      if (!user) return
      try {
        await eliminarConsolidacion(registro.id, { user_id: user.id, user_name: user.username })
        toast.success("Registro eliminado")
        await loadData()
      } catch (error: any) {
        toast.error(error.message || "Error al eliminar")
      }
    })
  }

  // Filtrar registros
  const registrosFiltrados = registros.filter((r) => {
    if (filterSalon !== "todos" && r.salon !== filterSalon) return false
    if (filterEstado === "pendientes" && r.gestionado) return false
    if (filterEstado === "gestionados" && !r.gestionado) return false
    return true
  })

  const salones = [...new Set(registros.map((r) => r.salon))].sort()
  const pendientes = registros.filter((r) => !r.gestionado).length
  const gestionados = registros.filter((r) => r.gestionado).length

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
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Consolidación - Herederos</h1>
                <p className="text-xs text-gray-500">Niños con 3+ faltas en el mes · {currentMonthEcuador()}/{currentYearEcuador()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4 pb-3 text-center">
              <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-800">{registros.length}</p>
              <p className="text-[10px] text-blue-600">Total en listado</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4 pb-3 text-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-800">{pendientes}</p>
              <p className="text-[10px] text-amber-600">Pendientes</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-4 pb-3 text-center">
              <ClipboardCheck className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-800">{gestionados}</p>
              <p className="text-[10px] text-green-600">Gestionados</p>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-purple-800">{registros.length > 0 ? Math.round((gestionados / registros.length) * 100) : 0}%</p>
              <p className="text-[10px] text-purple-600">Avance gestión</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterSalon}
            onChange={(e) => setFilterSalon(e.target.value)}
            className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white"
          >
            <option value="todos">Todos los salones</option>
            {salones.map((s) => (
              <option key={s} value={s}>{SALON_LABELS[s] || s}</option>
            ))}
          </select>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white"
          >
            <option value="todos">Todos</option>
            <option value="pendientes">Pendientes</option>
            <option value="gestionados">Gestionados</option>
          </select>
          {(filterSalon !== "todos" || filterEstado !== "todos") && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFilterSalon("todos"); setFilterEstado("todos") }}>
              Limpiar
            </Button>
          )}
        </div>

        {/* Tabla */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Listado de Consolidación ({registrosFiltrados.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {registrosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">No hay registros</p>
                <p className="text-xs text-gray-400">No se detectaron niños con 3+ faltas este mes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs">Salón</TableHead>
                      <TableHead className="text-xs">Representante</TableHead>
                      <TableHead className="text-xs">Celular</TableHead>
                      <TableHead className="text-xs text-center">Faltas</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs">Respuesta</TableHead>
                      <TableHead className="text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrosFiltrados.map((r, idx) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{r.participante_nombre}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">{SALON_LABELS[r.salon] || r.salon}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.nombre_representante || "-"}</TableCell>
                        <TableCell className="text-xs">{r.celular_representante || "-"}</TableCell>
                        <TableCell className="text-xs text-center">
                          <Badge className="bg-red-100 text-red-700">{r.total_faltas}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.gestionado ? (
                            <Badge className="bg-green-100 text-green-700">Gestionado</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{r.respuesta || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!r.gestionado && canEdit && (
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handleGestionar(r)}
                                className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                <ClipboardCheck className="w-3 h-3 mr-1" /> Gestionar
                              </Button>
                            )}
                            {r.gestionado && canEdit && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600" onClick={() => handleEditar(r)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => handleEliminar(r)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modal: Gestionar */}
      <Dialog open={!!gestionandoRegistro} onOpenChange={() => setGestionandoRegistro(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar: {gestionandoRegistro?.participante_nombre}</DialogTitle>
            <DialogDescription>
              Salón: {SALON_LABELS[gestionandoRegistro?.salon || ""] || gestionandoRegistro?.salon} · {gestionandoRegistro?.total_faltas} faltas
            </DialogDescription>
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
                placeholder="Notas sobre la gestión realizada..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGestionandoRegistro(null)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSaveGestion} disabled={isSaving || gestionValue === null}>
              {isSaving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Gestión */}
      <Dialog open={!!editandoRegistro} onOpenChange={() => setEditandoRegistro(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Gestión: {editandoRegistro?.participante_nombre}</DialogTitle>
            <DialogDescription>Modificar la gestión registrada</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
            <Button variant="outline" onClick={() => setEditandoRegistro(null)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ConsolidacionHerederosPage() {
  return (
    <PermissionsGuard moduleName="consolidacion_herederos">
      {(canEdit) => <ConsolidacionContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
