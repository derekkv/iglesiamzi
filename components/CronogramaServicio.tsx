"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { cronogramaService, type CronogramaEntry } from "@/lib/mod/cronograma-service"
import { censoService } from "@/lib/mod/censo-service"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { ArrowLeft, Plus, Trash2, Search, X, Pencil } from "lucide-react"
import { toast } from "sonner"
import { getAtrasadosPorModulo, gestionarAtraso, type GestionAtrasado } from "@/lib/mod/gestion-atrasados-service"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

interface CronogramaServicioProps {
  canEdit: boolean
  moduloKey: string
  moduleName: string
  title: string
  isAdmin?: boolean
  canLeader?: boolean
}

export function CronogramaServicio({ canEdit, moduloKey, moduleName, title, isAdmin = false, canLeader = false }: CronogramaServicioProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()

  const [entries, setEntries] = useState<CronogramaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Atrasados (solo líder)
  const [atrasados, setAtrasados] = useState<GestionAtrasado[]>([])
  const [activeMainTab, setActiveMainTab] = useState<"cronograma" | "atrasados">("cronograma")
  const [gestionandoId, setGestionandoId] = useState<number | null>(null)
  const [gestionRespuesta, setGestionRespuesta] = useState<boolean | null>(null)
  const [gestionAcuerdo, setGestionAcuerdo] = useState("")
  const [savingGestion, setSavingGestion] = useState(false)

  // Form
  const [showForm, setShowForm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string; displayName: string } | null>(null)
  const [asignacion, setAsignacion] = useState("")
  const [evento, setEvento] = useState("")
  const [fecha, setFecha] = useState("")
  const [horaEntrada, setHoraEntrada] = useState("")
  const [ministerio, setMinisterio] = useState("")
  const [ministerios, setMinisterios] = useState<string[]>([])

  // User search
  const [userQuery, setUserQuery] = useState("")
  const [userResults, setUserResults] = useState<{ id: string; username: string; displayName: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Delete
  const [pendingDelete, setPendingDelete] = useState<CronogramaEntry | null>(null)

  // Edit
  const [editEntry, setEditEntry] = useState<CronogramaEntry | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    asignacion: "",
    fecha: "",
    horaEntrada: "",
    ministerio: "",
    evento: "",
  })
  const [isUpdating, setIsUpdating] = useState(false)

  // Modal de conflicto
  const [conflictMessage, setConflictMessage] = useState("")

  useEffect(() => {
    loadEntries()
    loadMinisterios()
    if (canLeader) loadAtrasados()
  }, [])

  useRealtime({ table: "cronograma_servicio", onChange: () => loadEntries(true) })
  useRealtime({ table: "gestion_atrasados", enabled: canLeader, onChange: () => loadAtrasados() })

  const loadAtrasados = async () => {
    const data = await getAtrasadosPorModulo(moduloKey)
    setAtrasados(data)
  }

  const handleGestionarAtrasado = async () => {
    if (gestionandoId === null || gestionRespuesta === null || !user) return
    setSavingGestion(true)
    const result = await gestionarAtraso({
      id: gestionandoId,
      respuestaGestion: gestionRespuesta,
      acuerdo: gestionAcuerdo,
      gestionadoPor: user.id,
      gestionadoPorNombre: user.username,
    })
    setSavingGestion(false)
    if (result.success) {
      toast.success("Gestión registrada")
      setGestionandoId(null)
      setGestionRespuesta(null)
      setGestionAcuerdo("")
      loadAtrasados()
    } else {
      toast.error(result.error || "Error al gestionar")
    }
  }

  const loadEntries = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await cronogramaService.getAll(moduloKey)
      // Si no tiene canEdit, solo mostrar sus propios registros
      if (!canEdit && user) {
        setEntries(data.filter((e) => e.user_id === user.id))
      } else {
        setEntries(data)
      }
    } catch (error) {
      console.error("Error loading cronograma:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const loadMinisterios = async () => {
    try {
      const config = await censoService.getConfiguraciones()
      if (config?.ministerios) setMinisterios(config.ministerios)
    } catch (error) {
      console.error("Error loading ministerios:", error)
    }
  }

  // IDs de usuarios que pueden asignar a cualquier persona sin filtro de permisos
  const SUPER_ASSIGNERS = [
    "8a799e01-11bb-4ea4-8a95-9f7033e90fb1",
    "83cb032c-38ef-4b47-85f1-84d4ae7d531e",
    "4eb62d12-4701-4cfc-8c3c-8dd56f9315ad",
  ]

  const isSuperAssigner = user ? SUPER_ASSIGNERS.includes(user.id) : false

  const loadInitialUsers = async () => {
    if (!isSuperAssigner) return
    try {
      const results = await cronogramaService.getRandomActiveUsers()
      setUserResults(results)
      setShowResults(true)
    } catch (error) {
      console.error("Error loading initial users:", error)
    }
  }

  const handleSearchUsers = async (query: string) => {
    setUserQuery(query)
    if (query.trim().length < 2) {
      if (isSuperAssigner) {
        loadInitialUsers()
      } else {
        setUserResults([])
        setShowResults(false)
      }
      return
    }
    setSearching(true)
    try {
      let results
      if (isSuperAssigner) {
        results = await cronogramaService.searchAllActiveUsers(query)
      } else {
        results = await cronogramaService.searchUsersWithModuleAccess(query, moduleName)
      }
      setUserResults(results)
      setShowResults(true)
    } catch (error) {
      console.error("Error searching users:", error)
    } finally {
      setSearching(false)
    }
  }

  const handleSelectUser = (u: { id: string; username: string; displayName: string }) => {
    setSelectedUser(u)
    setUserQuery(u.displayName)
    setShowResults(false)
  }

  const handleSave = async () => {
    if (!selectedUser || !asignacion || !fecha || !ministerio) return
    setSaving(true)
    try {
      await cronogramaService.create(
        {
          user_id: selectedUser.id,
          user_name: selectedUser.displayName,
          asignacion,
          fecha,
          modulo: moduloKey,
          ministerio,
          evento: evento || undefined,
          hora_entrada: horaEntrada || undefined,
        },
        { user_id: user!.id, user_name: user!.username }
      )
      setSelectedUser(null)
      setUserQuery("")
      setAsignacion("")
      setEvento("")
      setFecha("")
      setHoraEntrada("")
      setMinisterio("")
      setShowForm(false)
      loadEntries()
    } catch (error: any) {
      setConflictMessage(error.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (entry: CronogramaEntry) => {
    checkAndExecute(entry.created_at || new Date().toISOString(), () => {
      setPendingDelete(entry)
    })
  }

  const confirmDelete = async () => {
    if (!pendingDelete?.id) return
    try {
      await cronogramaService.delete(pendingDelete.id, { user_id: user!.id, user_name: user!.username })
      setPendingDelete(null)
      loadEntries()
    } catch (error) {
      console.error("Error deleting:", error)
    }
  }

  const handleEdit = (entry: CronogramaEntry) => {
    checkAndExecute(entry.created_at || new Date().toISOString(), () => {
      setEditEntry(entry)
      setEditForm({
        asignacion: entry.asignacion || "",
        fecha: entry.fecha || "",
        horaEntrada: entry.hora_entrada || "",
        ministerio: entry.ministerio || "",
        evento: entry.evento || "",
      })
      setIsEditDialogOpen(true)
    })
  }

  const handleSaveEdit = async () => {
    if (!editEntry?.id || !editForm.asignacion || !editForm.fecha || !editForm.ministerio) {
      toast.error("Complete los campos requeridos")
      return
    }

    setIsUpdating(true)
    try {
      await cronogramaService.update(
        editEntry.id,
        {
          asignacion: editForm.asignacion,
          fecha: editForm.fecha,
          hora_entrada: editForm.horaEntrada || undefined,
          ministerio: editForm.ministerio,
          evento: editForm.evento || undefined,
        },
        { user_id: user!.id, user_name: user!.username }
      )
      toast.success("Servicio actualizado")
      setIsEditDialogOpen(false)
      setEditEntry(null)
      loadEntries()
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleInlineUpdate = async (entryId: number, field: "hora_llegada" | "atraso", value: any) => {
    try {
      await cronogramaService.updateField(entryId, { [field]: value })
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, [field]: value } : e))
      )
    } catch (error) {
      console.error("Error updating field:", error)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${days[date.getDay()]} ${day}/${month}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando cronograma...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 sm:h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Cronograma de Servicio</h1>
                <p className="text-sm text-gray-600">{title}</p>
              </div>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setShowForm(!showForm)} className="flex items-center space-x-2">
                <Plus className="w-4 h-4" /><span>Asignar</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Tab de líder para atrasados */}
        {canLeader && (
          <div className="flex gap-2 mb-2">
            <Button variant={activeMainTab === "cronograma" ? "default" : "outline"} size="sm" onClick={() => setActiveMainTab("cronograma")}>Cronograma</Button>
            <Button variant={activeMainTab === "atrasados" ? "default" : "outline"} size="sm" onClick={() => setActiveMainTab("atrasados")} className={activeMainTab === "atrasados" ? "bg-amber-600 hover:bg-amber-700" : ""}>
              Atrasados ({atrasados.filter(a => !a.gestionado).length})
            </Button>
          </div>
        )}

        {canLeader && activeMainTab === "atrasados" ? (
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><span className="text-amber-600">Gestión de Atrasados</span></CardTitle>
              <CardDescription>Registre si gestionó la situación y el acuerdo al que llegaron (máx. 240 caracteres)</CardDescription>
            </CardHeader>
            <CardContent>
              {atrasados.length === 0 ? (
                <p className="text-center text-gray-500 py-6">No hay atrasados registrados</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Persona</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acuerdo</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atrasados.map((a) => (
                        <TableRow key={a.id} className={a.gestionado ? "opacity-60" : ""}>
                          <TableCell className="font-medium">{a.user_name}</TableCell>
                          <TableCell className="text-xs">{a.fecha}</TableCell>
                          <TableCell>
                            {a.gestionado ? (
                              <Badge className={a.respuesta_gestion ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                {a.respuesta_gestion ? "Gestionado" : "No gestionado"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">Pendiente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{a.acuerdo || "-"}</TableCell>
                          <TableCell className="text-right">
                            {!a.gestionado && (
                              <Button size="sm" variant="outline" onClick={() => { setGestionandoId(a.id); setGestionRespuesta(null); setGestionAcuerdo("") }}>Gestionar</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {gestionandoId !== null && (
                <div className="mt-4 p-4 border border-amber-200 rounded-lg bg-amber-50/50 space-y-3">
                  <p className="font-medium text-sm">Registrar gestión:</p>
                  <div className="flex gap-3">
                    <Button size="sm" variant={gestionRespuesta === true ? "default" : "outline"} className={gestionRespuesta === true ? "bg-green-600" : ""} onClick={() => setGestionRespuesta(true)}>Sí</Button>
                    <Button size="sm" variant={gestionRespuesta === false ? "default" : "outline"} className={gestionRespuesta === false ? "bg-red-600" : ""} onClick={() => setGestionRespuesta(false)}>No</Button>
                  </div>
                  <div>
                    <Label className="text-xs">Acuerdo al que llegaron (máx. 240 caracteres)</Label>
                    <Textarea value={gestionAcuerdo} onChange={(e) => setGestionAcuerdo(e.target.value.slice(0, 240))} placeholder="Describir el acuerdo..." className="mt-1" maxLength={240} />
                    <p className="text-xs text-gray-400 text-right">{gestionAcuerdo.length}/240</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setGestionandoId(null)}>Cancelar</Button>
                    <Button size="sm" onClick={handleGestionarAtrasado} disabled={savingGestion || gestionRespuesta === null}>{savingGestion ? "Guardando..." : "Guardar"}</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
        <>
        {showForm && canEdit && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-lg">Asignar Nuevo Servicio</CardTitle>
              <CardDescription>Seleccione la persona, asignación y fecha</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label>Ministerio</Label>
                  <Select value={ministerio} onValueChange={setMinisterio}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ministerio" />
                    </SelectTrigger>
                    <SelectContent>
                      {ministerios.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 relative">
                  <Label>Persona</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={userQuery}
                      onChange={(e) => handleSearchUsers(e.target.value)}
                      onFocus={() => { if (isSuperAssigner && userResults.length === 0 && !userQuery) loadInitialUsers() }}
                      placeholder="Buscar por nombre..."
                      className="pl-9"
                    />
                    {selectedUser && (
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        onClick={() => { setSelectedUser(null); setUserQuery(""); setUserResults([]) }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {showResults && userResults.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                          onClick={() => handleSelectUser(u)}
                        >
                          <span className="font-medium">{u.displayName}</span>
                          <span className="text-gray-400 ml-2">@{u.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showResults && userResults.length === 0 && userQuery.length >= 2 && !searching && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
                      No se encontraron usuarios
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Asignación</Label>
                  <Input
                    value={asignacion}
                    onChange={(e) => setAsignacion(e.target.value)}
                    placeholder="Ej: Salón / Auditorio / Puerta..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Hora de Entrada</Label>
                    <Input type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fecha</Label>
                    <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Evento <span className="text-gray-400 font-normal">(opcional)</span></Label>
                  <Input
                    value={evento}
                    onChange={(e) => setEvento(e.target.value)}
                    placeholder="Ej: Culto dominical, Conferencia..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || !selectedUser || !asignacion || !fecha || !ministerio}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Servicios Asignados</CardTitle>
            <CardDescription>{entries.length} servicio{entries.length !== 1 ? "s" : ""} registrado{entries.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No hay servicios asignados aún.</p>
                {canEdit && <p className="text-sm mt-1">Usa el botón "Asignar" para agregar.</p>}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ministerio</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Asignación</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>H. Entrada</TableHead>
                      {isAdmin && <TableHead>H. Llegada</TableHead>}
                      {isAdmin && <TableHead>Atraso</TableHead>}
                      {!isAdmin && <TableHead className="text-center">Puntualidad</TableHead>}
                      <TableHead>Evento</TableHead>
                      {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const isPast = new Date(entry.fecha + "T23:59:59") < new Date()
                      return (
                        <TableRow key={entry.id} className={isPast ? "opacity-50" : ""}>
                          <TableCell className="text-xs text-gray-500">{entry.ministerio || "-"}</TableCell>
                          <TableCell className="font-medium">{entry.user_name}</TableCell>
                          <TableCell>{entry.asignacion}</TableCell>
                          <TableCell className="text-xs">{formatDate(entry.fecha)}</TableCell>
                          <TableCell className="text-xs">{entry.hora_entrada || "-"}</TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Input
                                type="time"
                                className="h-7 w-24 text-xs"
                                value={entry.hora_llegada || ""}
                                onChange={(e) => handleInlineUpdate(entry.id!, "hora_llegada", e.target.value || null)}
                              />
                            </TableCell>
                          )}
                          {isAdmin && (
                            <TableCell>
                              <select
                                className="h-7 text-xs border rounded px-1 bg-white"
                                value={entry.atraso === true ? "si" : entry.atraso === false ? "no" : ""}
                                onChange={(e) => {
                                  const val = e.target.value === "si" ? true : e.target.value === "no" ? false : null
                                  handleInlineUpdate(entry.id!, "atraso", val)
                                }}
                              >
                                <option value="">-</option>
                                <option value="si">Sí</option>
                                <option value="no">No</option>
                              </select>
                            </TableCell>
                          )}
                          {!isAdmin && (
                            <TableCell className="text-center">
                              {entry.atraso === false ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-green-500" title="Puntual" />
                              ) : entry.atraso === true ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-red-500" title="Llegó tarde" />
                              ) : (
                                <span className="text-gray-300 text-xs">-</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-gray-500">{entry.evento || "-"}</TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
                                  <Pencil className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(entry)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        </>
        )}
      </main>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la asignación de {pendingDelete?.user_name} ({pendingDelete?.asignacion}) del {pendingDelete?.fecha ? formatDate(pendingDelete.fecha) : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de conflicto de horario */}
      <AlertDialog open={!!conflictMessage} onOpenChange={(open) => { if (!open) setConflictMessage("") }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl">No se puede asignar</AlertDialogTitle>
              <AlertDialogDescription className="text-base text-gray-700">
                {conflictMessage}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction className="px-8" onClick={() => setConflictMessage("")}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Servicio</DialogTitle>
            <DialogDescription>
              Modifique los datos del servicio de {editEntry?.user_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Ministerio *</Label>
              <Select value={editForm.ministerio} onValueChange={(v) => setEditForm({ ...editForm, ministerio: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ministerio" />
                </SelectTrigger>
                <SelectContent>
                  {ministerios.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Asignación *</Label>
              <Input
                value={editForm.asignacion}
                onChange={(e) => setEditForm({ ...editForm, asignacion: e.target.value })}
                placeholder="Ej: Salón / Auditorio / Puerta..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={editForm.fecha}
                  onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Hora de Entrada</Label>
                <Input
                  type="time"
                  value={editForm.horaEntrada}
                  onChange={(e) => setEditForm({ ...editForm, horaEntrada: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Evento <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input
                value={editForm.evento}
                onChange={(e) => setEditForm({ ...editForm, evento: e.target.value })}
                placeholder="Ej: Culto dominical, Conferencia..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isUpdating}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isUpdating || !editForm.asignacion || !editForm.fecha || !editForm.ministerio}>
              {isUpdating ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
