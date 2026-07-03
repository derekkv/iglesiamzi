"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useRealtime } from "@/hooks/use-realtime"
import { useNotificaciones } from "@/hooks/use-notificaciones"
import { getGlobalConfig, type GlobalConfig } from "@/lib/globalConfig"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Send, Clock, CheckCircle, XCircle, PauseCircle, Eye } from "lucide-react"
import { toast } from "sonner"

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
  created_at: string
  updated_at: string
}

interface Props {
  modulo: string // nombre del módulo actual
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
  const { notificarAdmins } = useNotificaciones()
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([])
  const [config, setConfig] = useState<GlobalConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedReq, setSelectedReq] = useState<Requerimiento | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form
  const [formData, setFormData] = useState({
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
    setFormData({
      ministerio: "",
      requerimiento: "",
      valor: "",
      evento_lugar: "",
      fecha_entrega: "",
    })
  }

  const handleCreate = async () => {
    if (!user) return
    if (!formData.ministerio || !formData.requerimiento || !formData.evento_lugar) {
      toast.error("Complete los campos obligatorios: Ministerio, Requerimiento y Evento/Lugar")
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
        ministerio: formData.ministerio,
        persona_id: user.id,
        persona_nombre: user.displayName,
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

  const pendientes = requerimientos.filter((r) => r.respuesta === "pendiente").length
  const aprobados = requerimientos.filter((r) => r.respuesta === "aprobado").length
  const negados = requerimientos.filter((r) => r.respuesta === "negado").length

  return (
    <div className="space-y-4">
      {/* Header con stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />{pendientes} Pendientes
          </Badge>
          <Badge variant="outline" className="text-green-700 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />{aprobados} Aprobados
          </Badge>
          <Badge variant="outline" className="text-red-700 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />{negados} Negados
          </Badge>
        </div>
        {canEdit && (
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Requerimiento
          </Button>
        )}
      </div>

      {/* Tabla de requerimientos */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-500">Cargando requerimientos...</p>
        </div>
      ) : requerimientos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay requerimientos en este módulo</p>
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
                  <TableHead className="text-xs">Requerimiento</TableHead>
                  <TableHead className="text-xs">Valor</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requerimientos.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(req.fecha_requerimiento).toLocaleDateString("es")}
                    </TableCell>
                    <TableCell className="text-xs">{req.ministerio}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={req.requerimiento}>
                      {req.requerimiento}
                    </TableCell>
                    <TableCell className="text-xs">
                      {req.valor ? `$${req.valor.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell>{getEstadoBadge(req.respuesta)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setSelectedReq(req)
                          setIsDetailOpen(true)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

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
                <Label className="text-sm">Ministerio *</Label>
                <Select
                  value={formData.ministerio}
                  onValueChange={(v) => setFormData({ ...formData, ministerio: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {config?.ministerios.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Persona</Label>
                <Input value={user?.displayName || ""} disabled className="bg-gray-50" />
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
