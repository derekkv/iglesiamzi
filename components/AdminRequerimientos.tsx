"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { useRealtime } from "@/hooks/use-realtime"
import { useNotificaciones } from "@/hooks/use-notificaciones"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Clock, CheckCircle, XCircle, PauseCircle, Eye, Filter,
  ClipboardList, User, Calendar, Trash2
} from "lucide-react"
import { toast } from "sonner"
import type { Requerimiento } from "./RequerimientosBienesServicios"
import { getSemaforoActual } from "./RequerimientosBienesServicios"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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

export function AdminRequerimientos() {
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()
  const { enviarNotificacion } = useNotificaciones()
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<string>("pendiente")
  const [filtroModulo, setFiltroModulo] = useState<string>("todos")
  const [isRespondOpen, setIsRespondOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedReq, setSelectedReq] = useState<Requerimiento | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form de respuesta
  const [respuestaForm, setRespuestaForm] = useState({
    respuesta: "" as "aprobado" | "negado" | "suspenso" | "",
    observaciones: "",
  })

  const loadRequerimientos = useCallback(async () => {
    try {
      let query = supabase
        .from("requerimientos_bienes_servicios")
        .select("*")
        .order("created_at", { ascending: false })

      if (filtroEstado !== "todos") {
        query = query.eq("respuesta", filtroEstado)
      }
      if (filtroModulo !== "todos") {
        query = query.eq("modulo", filtroModulo)
      }

      const { data, error } = await query

      if (error) throw error
      setRequerimientos((data || []) as Requerimiento[])
    } catch (error) {
      console.error("Error cargando requerimientos:", error)
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroModulo])

  useEffect(() => {
    loadRequerimientos()
  }, [loadRequerimientos])

  // Realtime: escuchar todos los requerimientos
  useRealtime({
    table: "requerimientos_bienes_servicios",
    onChange: () => loadRequerimientos(),
  })

  // Obtener lista de módulos únicos
  const modulosUnicos = [...new Set(requerimientos.map((r) => r.modulo))].sort()

  const handleResponder = async () => {
    if (!user || !selectedReq) return
    if (!respuestaForm.respuesta) {
      toast.error("Seleccione una respuesta (Aprobado, Negado o Suspenso)")
      return
    }
    if (!respuestaForm.observaciones.trim()) {
      toast.error("Escriba una observación explicando la decisión")
      return
    }
    if (respuestaForm.observaciones.length > 250) {
      toast.error("Las observaciones no pueden exceder 250 caracteres")
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from("requerimientos_bienes_servicios")
        .update({
          respuesta: respuestaForm.respuesta,
          observaciones: respuestaForm.observaciones,
          respondido_por_id: user.id,
          respondido_por_nombre: user.displayName,
          fecha_respuesta: new Date().toISOString(),
        })
        .eq("id", selectedReq.id)

      if (error) throw error

      // Notificar al solicitante
      const tipoNotif = respuestaForm.respuesta as "aprobado" | "negado" | "suspenso"
      const tituloNotif = respuestaForm.respuesta === "aprobado"
        ? "Requerimiento Aprobado"
        : respuestaForm.respuesta === "negado"
          ? "Requerimiento Negado"
          : "Requerimiento en Suspenso"

      await enviarNotificacion({
        userId: selectedReq.persona_id,
        titulo: tituloNotif,
        mensaje: `Su requerimiento "${selectedReq.requerimiento.substring(0, 60)}..." fue ${respuestaForm.respuesta} por ${user.displayName}. Obs: ${respuestaForm.observaciones.substring(0, 80)}`,
        tipo: tipoNotif,
        referenciaTipo: "requerimiento",
        referenciaId: selectedReq.id,
      })

      toast.success(`Requerimiento ${respuestaForm.respuesta} correctamente`)
      setIsRespondOpen(false)
      setRespuestaForm({ respuesta: "", observaciones: "" })
      setSelectedReq(null)
    } catch (error) {
      console.error("Error respondiendo requerimiento:", error)
      toast.error("Error al responder requerimiento")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteReq = async (req: Requerimiento) => {
    checkAndExecute(req.created_at, async () => {
      try {
        const { error } = await supabase
          .from("requerimientos_bienes_servicios")
          .delete()
          .eq("id", req.id)

        if (error) throw error
        toast.success("Requerimiento eliminado")
      } catch (error) {
        console.error("Error eliminando:", error)
        toast.error("Error al eliminar requerimiento")
      }
    })
  }

  const pendientes = requerimientos.filter((r) => r.respuesta === "pendiente").length
  const totalAll = requerimientos.length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pendientes}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {requerimientos.filter((r) => r.respuesta === "aprobado").length}
            </p>
            <p className="text-xs text-gray-500">Aprobados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {requerimientos.filter((r) => r.respuesta === "negado").length}
            </p>
            <p className="text-xs text-gray-500">Negados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">
              {requerimientos.filter((r) => r.respuesta === "suspenso").length}
            </p>
            <p className="text-xs text-gray-500">En Suspenso</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Filtros:</span>
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="aprobado">Aprobados</SelectItem>
            <SelectItem value="negado">Negados</SelectItem>
            <SelectItem value="suspenso">En Suspenso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroModulo} onValueChange={setFiltroModulo}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los módulos</SelectItem>
            {modulosUnicos.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">
          {totalAll} resultados
        </Badge>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-500">Cargando requerimientos...</p>
        </div>
      ) : requerimientos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay requerimientos con los filtros seleccionados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Fecha</TableHead>
                  <TableHead className="text-xs">Módulo</TableHead>
                  <TableHead className="text-xs">Solicitante</TableHead>
                  <TableHead className="text-xs">Ministerio</TableHead>
                  <TableHead className="text-xs">Requerimiento</TableHead>
                  <TableHead className="text-xs">Valor</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs text-center">Cumplimiento</TableHead>
                  <TableHead className="text-xs">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requerimientos.map((req) => {
                  const semaforo = getSemaforoActual(req)
                  return (
                  <TableRow key={req.id} className={req.respuesta === "pendiente" ? "bg-yellow-50/50" : ""}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(req.fecha_requerimiento).toLocaleDateString("es")}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary" className="text-[10px]">{req.modulo}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-gray-400" />
                        {req.persona_nombre}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{req.ministerio}</TableCell>
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
                          <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] px-1" title={`Recibido: ${new Date(req.fecha_recibido!).toLocaleString("es")}`}>
                            Recibido
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
                          onClick={() => {
                            setSelectedReq(req)
                            setIsDetailOpen(true)
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {req.respuesta === "pendiente" && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => {
                              setSelectedReq(req)
                              setRespuestaForm({ respuesta: "", observaciones: "" })
                              setIsRespondOpen(true)
                            }}
                          >
                            Responder
                          </Button>
                        )}
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
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteReq(req)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

      {/* Modal Responder Requerimiento */}
      <Dialog open={isRespondOpen} onOpenChange={setIsRespondOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Responder Requerimiento</DialogTitle>
            <DialogDescription>
              Aprobar, negar o poner en suspenso el requerimiento de {selectedReq?.persona_nombre}
            </DialogDescription>
          </DialogHeader>

          {selectedReq && (
            <div className="space-y-4">
              {/* Resumen del requerimiento */}
              <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ministerio:</span>
                  <span className="font-medium">{selectedReq.ministerio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Evento/Lugar:</span>
                  <span className="font-medium">{selectedReq.evento_lugar}</span>
                </div>
                {selectedReq.valor && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor:</span>
                    <span className="font-medium">${selectedReq.valor.toFixed(2)}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Requerimiento:</span>
                  <p className="mt-1 text-gray-800">{selectedReq.requerimiento}</p>
                </div>
              </div>

              {/* Respuesta */}
              <div>
                <Label className="text-sm font-medium">Respuesta *</Label>
                <Select
                  value={respuestaForm.respuesta}
                  onValueChange={(v) => setRespuestaForm({ ...respuestaForm, respuesta: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar decisión..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aprobado">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" /> Aprobado
                      </div>
                    </SelectItem>
                    <SelectItem value="negado">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" /> Negado
                      </div>
                    </SelectItem>
                    <SelectItem value="suspenso">
                      <div className="flex items-center gap-2">
                        <PauseCircle className="h-4 w-4 text-orange-500" /> Suspenso
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Observaciones * <span className="text-gray-400 font-normal">({respuestaForm.observaciones.length}/250)</span>
                </Label>
                <Textarea
                  value={respuestaForm.observaciones}
                  onChange={(e) => setRespuestaForm({ ...respuestaForm, observaciones: e.target.value.slice(0, 250) })}
                  placeholder="Explique el motivo de la decisión..."
                  maxLength={250}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRespondOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResponder} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Confirmar Respuesta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del Requerimiento</DialogTitle>
          </DialogHeader>

          {selectedReq && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Módulo</p>
                  <Badge variant="secondary">{selectedReq.modulo}</Badge>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Ministerio</p>
                  <p className="font-medium">{selectedReq.ministerio}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Solicitante</p>
                  <p className="font-medium">{selectedReq.persona_nombre}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Valor</p>
                  <p className="font-medium">{selectedReq.valor ? `$${selectedReq.valor.toFixed(2)}` : "No especificado"}</p>
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
                  <p className="text-gray-500 text-xs">Evento o Lugar</p>
                  <p className="font-medium">{selectedReq.evento_lugar}</p>
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

              {selectedReq.respuesta !== "pendiente" && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Respuesta</p>
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
            {selectedReq?.respuesta === "pendiente" && (
              <Button onClick={() => {
                setIsDetailOpen(false)
                setRespuestaForm({ respuesta: "", observaciones: "" })
                setIsRespondOpen(true)
              }}>
                Responder
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
