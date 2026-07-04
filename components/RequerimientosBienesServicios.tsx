"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { useRealtime } from "@/hooks/use-realtime"
import { useNotificaciones } from "@/hooks/use-notificaciones"
import { auditService } from "@/lib/mod/audit-service"
import { getGlobalConfig, type GlobalConfig } from "@/lib/globalConfig"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Send, Clock, CheckCircle, XCircle, PauseCircle, Eye, Lock, Pencil, History, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export interface Requerimiento {
  id: number
  modulo: string
  ministerio: string
  persona_id: string
  persona_nombre: string
  requerimiento: string
  valor: number | null
  evento_lugar: string
  fecha_requerimiento: string
  fecha_entrega: string | null
  respuesta: "pendiente" | "aprobado" | "negado" | "suspenso"
  observaciones: string | null
  respondido_por_id: string | null
  respondido_por_nombre: string | null
  fecha_respuesta: string | null
  recibido: boolean
  fecha_recibido: string | null
  created_at: string
  updated_at: string
}

/**
 * Calcula el color del semáforo de cumplimiento.
 * Basado en la diferencia entre fecha_entrega (puesta por admin) y fecha_recibido (cuando el solicitante confirma).
 * - Verde: entregado dentro de 24h después de la fecha de entrega
 * - Amarillo: entregado entre 24h y 48h después
 * - Rojo: entregado después de 72h o más
 * - null: no aplica (no tiene fecha_entrega o no ha sido recibido)
 */
export function getSemaforoCumplimiento(req: Requerimiento): "verde" | "amarillo" | "rojo" | null {
  // Solo aplica si está aprobado, tiene fecha de entrega y fue recibido
  if (req.respuesta !== "aprobado") return null
  if (!req.fecha_entrega) return null
  if (!req.recibido || !req.fecha_recibido) return null

  const entrega = new Date(req.fecha_entrega + "T23:59:59")
  const recibido = new Date(req.fecha_recibido)

  const diffMs = recibido.getTime() - entrega.getTime()
  const diffHoras = diffMs / (1000 * 60 * 60)

  if (diffHoras <= 24) return "verde"
  if (diffHoras <= 48) return "amarillo"
  return "rojo"
}

/**
 * Para requerimientos aprobados NO recibidos, calcula el semáforo basado en la fecha actual.
 * Esto muestra el estado en tiempo real de si se está cumpliendo o no.
 */
export function getSemaforoActual(req: Requerimiento): "verde" | "amarillo" | "rojo" | null {
  if (req.respuesta !== "aprobado") return null
  if (!req.fecha_entrega) return null

  // Si ya fue recibido, usar la fecha de recepción
  if (req.recibido && req.fecha_recibido) {
    return getSemaforoCumplimiento(req)
  }

  // Si no ha sido recibido, calcular con la fecha actual
  const entrega = new Date(req.fecha_entrega + "T23:59:59")
  const ahora = new Date()

  const diffMs = ahora.getTime() - entrega.getTime()
  const diffHoras = diffMs / (1000 * 60 * 60)

  if (diffHoras <= 24) return "verde"
  if (diffHoras <= 48) return "amarillo"
  if (diffHoras > 48) return "rojo"
  return "verde" // aún no pasa la fecha
}

interface Props {
  modulo: string
  canEdit: boolean
}

function getEstadoBadge(respuesta: Requerimiento["respuesta"]) {
  switch (respuesta) {
    case "pendiente":
      return <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>
    case "aprobado":
      return <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50"><CheckCircle className="h-3 w-3 mr-1" />Aprobado</Badge>
    case "negado":
      return <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50"><XCircle className="h-3 w-3 mr-1" />Negado</Badge>
    case "suspenso":
      return <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50"><PauseCircle className="h-3 w-3 mr-1" />Suspenso</Badge>
  }
}

export function RequerimientosBienesServicios({ modulo, canEdit }: Props) {
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()
  const { notificarAdmins } = useNotificaciones()
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([])
  const [config, setConfig] = useState<GlobalConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedReq, setSelectedReq] = useState<Requerimiento | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("pendientes")

  // Form crear
  const [formData, setFormData] = useState({
    ministerio: "",
    requerimiento: "",
    valor: "",
    evento_lugar: "",
    fecha_entrega: "",
  })

  // Form editar (solo para pendientes propios)
  const [editData, setEditData] = useState({
    ministerio: "",
    requerimiento: "",
    valor: "",
    evento_lugar: "",
    fecha_entrega: "",
  })

  const loadRequerimientos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("requerimientos_bienes_servicios")
        .select("*")
        .eq("modulo", modulo)
        .order("created_at", { ascending: false })

      if (error) throw error
      setRequerimientos((data || []) as Requerimiento[])
    } catch (error) {
      console.error("Error cargando requerimientos:", error)
    } finally {
      setLoading(false)
    }
  }, [modulo])

  const loadConfig = useCallback(async () => {
    const cfg = await getGlobalConfig()
    setConfig(cfg)
  }, [])

  useEffect(() => {
    loadRequerimientos()
    loadConfig()
  }, [loadRequerimientos, loadConfig])

  // Realtime
  useRealtime({
    table: "requerimientos_bienes_servicios",
    filter: `modulo=eq.${modulo}`,
    onChange: () => loadRequerimientos(),
  })

  const resetForm = () => {
    setFormData({ ministerio: "Administración", requerimiento: "", valor: "", evento_lugar: "", fecha_entrega: "" })
  }

  const handleCreate = async () => {
    if (!user) return
    if (!formData.requerimiento || !formData.evento_lugar) {
      toast.error("Complete los campos obligatorios: Requerimiento y Evento/Lugar")
      return
    }
    if (formData.requerimiento.length > 250) {
      toast.error("El requerimiento no puede exceder 250 caracteres")
      return
    }

    setIsSaving(true)
    try {
      const newReq = {
        modulo,
        ministerio: "Administración",
        persona_id: user.id,
        persona_nombre: `${user.displayName} - ${modulo.charAt(0).toUpperCase() + modulo.slice(1)}`,
        requerimiento: formData.requerimiento,
        valor: formData.valor ? parseFloat(formData.valor) : null,
        evento_lugar: formData.evento_lugar,
        fecha_requerimiento: new Date().toISOString().split("T")[0],
        fecha_entrega: formData.fecha_entrega || null,
        respuesta: "pendiente",
      }

      const { data, error } = await supabase
        .from("requerimientos_bienes_servicios")
        .insert(newReq)
        .select()
        .single()

      if (error) throw error

      // Audit log
      await auditService.log({
        user_id: user.id,
        user_name: user.displayName,
        module: `requerimientos-${modulo}`,
        action: "crear",
        description: `Nuevo requerimiento: ${formData.requerimiento.substring(0, 80)}`,
        details: { id: data.id, ministerio: formData.ministerio, valor: formData.valor },
      })

      // Notificar a admins
      await notificarAdmins({
        titulo: "Nuevo Requerimiento",
        mensaje: `${user.displayName} solicita: ${formData.requerimiento.substring(0, 80)}...`,
        tipo: "requerimiento",
        referenciaTipo: "requerimiento",
        referenciaId: data.id,
      })

      toast.success("Requerimiento enviado correctamente")
      resetForm()
      setIsCreateOpen(false)
    } catch (error) {
      console.error("Error creando requerimiento:", error)
      toast.error("Error al enviar requerimiento")
    } finally {
      setIsSaving(false)
    }
  }

  const openEditModal = (req: Requerimiento) => {
    // Solo se puede editar si es propio y pendiente
    if (req.persona_id !== user?.id || req.respuesta !== "pendiente") {
      toast.error("Solo puede editar sus propios requerimientos pendientes")
      return
    }
    checkAndExecute(req.created_at, () => {
      setSelectedReq(req)
      setEditData({
        ministerio: req.ministerio,
        requerimiento: req.requerimiento,
        valor: req.valor?.toString() || "",
        evento_lugar: req.evento_lugar,
        fecha_entrega: req.fecha_entrega || "",
      })
      setIsEditOpen(true)
    })
  }

  const handleEdit = async () => {
    if (!user || !selectedReq) return
    if (!editData.requerimiento || !editData.evento_lugar) {
      toast.error("Complete los campos obligatorios")
      return
    }
    if (editData.requerimiento.length > 250) {
      toast.error("El requerimiento no puede exceder 250 caracteres")
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from("requerimientos_bienes_servicios")
        .update({
          ministerio: "Administración",
          requerimiento: editData.requerimiento,
          valor: editData.valor ? parseFloat(editData.valor) : null,
          evento_lugar: editData.evento_lugar,
          fecha_entrega: editData.fecha_entrega || null,
        })
        .eq("id", selectedReq.id)

      if (error) throw error

      // Audit log
      await auditService.log({
        user_id: user.id,
        user_name: user.displayName,
        module: `requerimientos-${modulo}`,
        action: "editar",
        description: `Editó requerimiento #${selectedReq.id}`,
        details: {
          id: selectedReq.id,
          cambios: {
            ministerio: editData.ministerio !== selectedReq.ministerio ? editData.ministerio : undefined,
            requerimiento: editData.requerimiento !== selectedReq.requerimiento ? editData.requerimiento : undefined,
            valor: editData.valor !== (selectedReq.valor?.toString() || "") ? editData.valor : undefined,
          },
        },
      })

      toast.success("Requerimiento actualizado")
      setIsEditOpen(false)
      setSelectedReq(null)
    } catch (error) {
      console.error("Error editando requerimiento:", error)
      toast.error("Error al editar requerimiento")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (req: Requerimiento) => {
    if (!user) return
    checkAndExecute(req.created_at, async () => {
      setIsSaving(true)
      try {
        const { error } = await supabase
          .from("requerimientos_bienes_servicios")
          .delete()
          .eq("id", req.id)

        if (error) throw error

        await auditService.log({
          user_id: user.id,
          user_name: user.displayName,
          module: `requerimientos-${modulo}`,
          action: "eliminar",
          description: `Eliminó requerimiento #${req.id}: ${req.requerimiento.substring(0, 60)}`,
          details: { id: req.id, requerimiento: req.requerimiento, ministerio: req.ministerio },
        })

        toast.success("Requerimiento eliminado")
      } catch (error) {
        console.error("Error eliminando requerimiento:", error)
        toast.error("Error al eliminar requerimiento")
      } finally {
        setIsSaving(false)
      }
    })
  }

  const handleConfirmarRecepcion = async (req: Requerimiento) => {
    if (!user) return
    checkAndExecute(req.created_at, async () => {
      try {
        const { error } = await supabase
          .from("requerimientos_bienes_servicios")
          .update({
            recibido: true,
            fecha_recibido: new Date().toISOString(),
          })
          .eq("id", req.id)

        if (error) throw error

        await auditService.log({
          user_id: user.id,
          user_name: user.displayName,
          module: `requerimientos-${modulo}`,
          action: "editar",
          description: `Confirmó recepción del requerimiento #${req.id}`,
          details: { id: req.id },
        })

        toast.success("Recepción confirmada")
      } catch (error) {
        console.error("Error confirmando recepción:", error)
        toast.error("Error al confirmar recepción")
      }
    })
  }

  // Filtrar por tabs
  const pendientes = requerimientos.filter((r) => r.respuesta === "pendiente")
  const respondidos = requerimientos.filter((r) => r.respuesta !== "pendiente")
  const editados = requerimientos.filter((r) => r.updated_at !== r.created_at && r.respuesta === "pendiente")

  const currentList = activeTab === "pendientes" ? pendientes
    : activeTab === "respondidos" ? respondidos
    : editados

  return (
    <div className="space-y-4">
      {/* Header con stats y botón crear */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />{pendientes.length} Pendientes
          </Badge>
          <Badge variant="outline" className="text-green-700 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />{respondidos.filter(r => r.respuesta === "aprobado").length} Aprobados
          </Badge>
          <Badge variant="outline" className="text-red-700 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />{respondidos.filter(r => r.respuesta === "negado").length} Negados
          </Badge>
        </div>
        {canEdit && (
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Requerimiento
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pendientes">
            <Clock className="h-3.5 w-3.5 mr-1" />Pendientes ({pendientes.length})
          </TabsTrigger>
          <TabsTrigger value="respondidos">
            <CheckCircle className="h-3.5 w-3.5 mr-1" />Respondidos ({respondidos.length})
          </TabsTrigger>
          {editados.length > 0 && (
            <TabsTrigger value="editados">
              <History className="h-3.5 w-3.5 mr-1" />Editados ({editados.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">Cargando requerimientos...</p>
            </div>
          ) : currentList.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay requerimientos en esta sección</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Ministerio</TableHead>
                      <TableHead className="text-xs">Solicitante</TableHead>
                      <TableHead className="text-xs">Requerimiento</TableHead>
                      <TableHead className="text-xs">Valor</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs text-center">Cumplimiento</TableHead>
                      <TableHead className="text-xs">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentList.map((req) => {
                      const semaforo = getSemaforoActual(req)
                      return (
                      <TableRow key={req.id} className={req.updated_at !== req.created_at ? "bg-blue-50/30" : ""}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(req.fecha_requerimiento).toLocaleDateString("es")}
                        </TableCell>
                        <TableCell className="text-xs">{req.ministerio}</TableCell>
                        <TableCell className="text-xs">{req.persona_nombre}</TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate" title={req.requerimiento}>
                          {req.requerimiento}
                        </TableCell>
                        <TableCell className="text-xs">
                          {req.valor ? `$${req.valor.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getEstadoBadge(req.respuesta)}
                            {req.recibido && (
                              <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] px-1">
                                Recibido
                              </Badge>
                            )}
                            {req.updated_at !== req.created_at && req.respuesta === "pendiente" && (
                              <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] px-1">
                                <Pencil className="h-2.5 w-2.5" />
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {semaforo ? (
                            <span
                              className={`inline-block w-4 h-4 rounded-full ${
                                semaforo === "verde" ? "bg-green-500" :
                                semaforo === "amarillo" ? "bg-yellow-400" :
                                "bg-red-500"
                              }`}
                              title={
                                semaforo === "verde" ? "Cumplido a tiempo (≤24h)" :
                                semaforo === "amarillo" ? "Entrega tardía (24-48h)" :
                                "Incumplimiento (>48h)"
                              }
                            />
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Ver detalle"
                              onClick={() => { setSelectedReq(req); setIsDetailOpen(true) }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canEdit && req.persona_id === user?.id && req.respuesta === "pendiente" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-blue-600"
                                title="Editar"
                                onClick={() => openEditModal(req)}
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {/* Confirmar recepción: solo el solicitante y solo si está aprobado y no recibido */}
                            {req.persona_id === user?.id && req.respuesta === "aprobado" && !req.recibido && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-green-600"
                                title="Confirmar recepción"
                                onClick={() => handleConfirmarRecepcion(req)}
                              >
                                Recibido
                              </Button>
                            )}
                            {/* Eliminar: solo el que lo creó o si canEdit */}
                            {canEdit && req.persona_id === user?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" title="Eliminar">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar requerimiento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará permanentemente este requerimiento. Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(req)}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Crear Requerimiento */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Requerimiento de Bienes y Servicios</DialogTitle>
            <DialogDescription>
              Complete los datos del requerimiento. Será notificado a administración.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Ministerio</Label>
                <Input value="Administración" disabled className="bg-gray-50" />
              </div>
              <div>
                <Label className="text-sm">Solicitante</Label>
                <Input value={`${user?.displayName || ""} - ${modulo.charAt(0).toUpperCase() + modulo.slice(1)}`} disabled className="bg-gray-50" />
              </div>
            </div>

            <div>
              <Label className="text-sm">Requerimiento * <span className="text-gray-400">({formData.requerimiento.length}/250)</span></Label>
              <Textarea
                value={formData.requerimiento}
                onChange={(e) => setFormData({ ...formData, requerimiento: e.target.value.slice(0, 250) })}
                placeholder="Describa el bien o servicio requerido..."
                maxLength={250}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Valor ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-sm">Fecha de Entrega</Label>
                <Input
                  type="date"
                  value={formData.fecha_entrega}
                  onChange={(e) => setFormData({ ...formData, fecha_entrega: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Evento o Lugar *</Label>
              <Input
                value={formData.evento_lugar}
                onChange={(e) => setFormData({ ...formData, evento_lugar: e.target.value })}
                placeholder="Ej: Culto dominical, Retiro de jóvenes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setIsCreateOpen(false) }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? "Enviando..." : "Enviar Requerimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Requerimiento */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Requerimiento</DialogTitle>
            <DialogDescription>
              Modifique los datos del requerimiento pendiente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Ministerio</Label>
                <Input value="Administración" disabled className="bg-gray-50" />
              </div>
              <div>
                <Label className="text-sm">Fecha de Entrega</Label>
                <Input
                  type="date"
                  value={editData.fecha_entrega}
                  onChange={(e) => setEditData({ ...editData, fecha_entrega: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm">Requerimiento * <span className="text-gray-400">({editData.requerimiento.length}/250)</span></Label>
              <Textarea
                value={editData.requerimiento}
                onChange={(e) => setEditData({ ...editData, requerimiento: e.target.value.slice(0, 250) })}
                maxLength={250}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Valor ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editData.valor}
                  onChange={(e) => setEditData({ ...editData, valor: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">Evento o Lugar *</Label>
                <Input
                  value={editData.evento_lugar}
                  onChange={(e) => setEditData({ ...editData, evento_lugar: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle Requerimiento */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del Requerimiento</DialogTitle>
          </DialogHeader>

          {selectedReq && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Ministerio</p>
                  <p className="font-medium">{selectedReq.ministerio}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Solicitante</p>
                  <p className="font-medium">{selectedReq.persona_nombre}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Fecha Requerimiento</p>
                  <p className="font-medium">{new Date(selectedReq.fecha_requerimiento).toLocaleDateString("es")}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Fecha Entrega</p>
                  <p className="font-medium">
                    {selectedReq.fecha_entrega ? new Date(selectedReq.fecha_entrega).toLocaleDateString("es") : "No especificada"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Valor</p>
                  <p className="font-medium">{selectedReq.valor ? `$${selectedReq.valor.toFixed(2)}` : "No especificado"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Estado</p>
                  {getEstadoBadge(selectedReq.respuesta)}
                </div>
              </div>

              <div>
                <p className="text-gray-500 text-xs">Requerimiento</p>
                <p className="text-sm mt-1 bg-gray-50 p-2 rounded">{selectedReq.requerimiento}</p>
              </div>

              <div>
                <p className="text-gray-500 text-xs">Evento o Lugar</p>
                <p className="text-sm mt-1">{selectedReq.evento_lugar}</p>
              </div>

              {/* Indicador de editado */}
              {selectedReq.updated_at !== selectedReq.created_at && (
                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded">
                  <Pencil className="h-3 w-3" />
                  <span>Editado el {new Date(selectedReq.updated_at).toLocaleString("es")}</span>
                </div>
              )}

              {selectedReq.respuesta !== "pendiente" && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Respuesta de Administración</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Respondido por</p>
                      <p className="font-medium">{selectedReq.respondido_por_nombre || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Fecha Respuesta</p>
                      <p className="font-medium">
                        {selectedReq.fecha_respuesta
                          ? new Date(selectedReq.fecha_respuesta).toLocaleString("es")
                          : "-"}
                      </p>
                    </div>
                  </div>
                  {selectedReq.observaciones && (
                    <div className="mt-2">
                      <p className="text-gray-500 text-xs">Observaciones</p>
                      <p className="text-sm mt-1 bg-gray-50 p-2 rounded">{selectedReq.observaciones}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
