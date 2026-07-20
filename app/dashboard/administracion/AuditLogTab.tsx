"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { auditService, type AuditLog } from "@/lib/mod/audit-service"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const MODULES = [
  { value: "all", label: "Todos" },
  { value: "bautizo", label: "Bautizo" },
  { value: "matrimonio", label: "Matrimonio" },
  { value: "presentacion-ninos", label: "Presentación de Niños" },
  { value: "censo", label: "Censo Protocolo" },
  { value: "censo-mdg", label: "Censo MDG" },
  { value: "censo-ninos", label: "Censo Niños" },
  { value: "diezmos", label: "Diezmos" },
  { value: "asistencia", label: "Asistencia" },
  { value: "discipulado", label: "Discipulado" },
  { value: "flujo_pago", label: "Flujo de Pago" },
  { value: "ingresos_egresos", label: "Ingresos/Egresos" },
  { value: "inventario", label: "Inventario" },
  { value: "administracion", label: "Administración" },
  { value: "caja_chica", label: "Caja Chica" },
  { value: "redil_ayuda_social", label: "Redil - Ayuda Social" },
  { value: "gestion-atrasados", label: "Gestión Atrasados" },
  { value: "eventos_encuentro", label: "Eventos / Encuentro" },
  { value: "ofrenda-celulas", label: "Ofrenda Células" },
  { value: "celulas", label: "Células" },
  { value: "pago_diario", label: "Pago Diario" },
  { value: "cronograma", label: "Cronograma" },
  { value: "proyecto-mario", label: "Proyecto Mario" },
]

const ACTIONS = [
  { value: "all", label: "Todas" },
  { value: "crear", label: "Crear" },
  { value: "editar", label: "Editar" },
  { value: "eliminar", label: "Eliminar" },
]

export function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filterModule, setFilterModule] = useState("all")
  const [filterAction, setFilterAction] = useState("all")
  const [filterUser, setFilterUser] = useState("")
  const [filterFromDate, setFilterFromDate] = useState("")
  const [filterToDate, setFilterToDate] = useState("")
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const totalPages = Math.ceil(totalCount / 50)

  useEffect(() => {
    loadLogs()
  }, [page, filterModule, filterAction, filterUser, filterFromDate, filterToDate])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const { data, count } = await auditService.getLogs({
        page,
        limit: 50,
        module: filterModule === "all" ? undefined : filterModule,
        action: filterAction === "all" ? undefined : filterAction,
        user_name: filterUser || undefined,
        from_date: filterFromDate || undefined,
        to_date: filterToDate || undefined,
      })
      setLogs(data)
      setTotalCount(count)
    } catch (error) {
      console.error("Error loading audit logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilterModule("all")
    setFilterAction("all")
    setFilterUser("")
    setFilterFromDate("")
    setFilterToDate("")
    setPage(1)
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case "crear": return <Badge className="bg-green-100 text-green-800">Crear</Badge>
      case "editar": return <Badge className="bg-blue-100 text-blue-800">Editar</Badge>
      case "eliminar": return <Badge className="bg-red-100 text-red-800">Eliminar</Badge>
      default: return <Badge>{action}</Badge>
    }
  }

  const formatDate = (timestamp: string) => {
    const d = new Date(timestamp)
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs del Sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setPage(1) }}>
            <SelectTrigger><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent>
              {MODULES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1) }}>
            <SelectTrigger><SelectValue placeholder="Acción" /></SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Usuario..." value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setPage(1) }} />
          <Input type="date" value={filterFromDate} onChange={(e) => { setFilterFromDate(e.target.value); setPage(1) }} />
          <Input type="date" value={filterToDate} onChange={(e) => { setFilterToDate(e.target.value); setPage(1) }} />
        </div>
        <Button variant="outline" size="sm" onClick={resetFilters}>Limpiar filtros</Button>

        {/* Tabla */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No hay registros</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                    <TableCell className="text-sm font-medium">{log.user_name}</TableCell>
                    <TableCell className="text-sm">{MODULES.find(m => m.value === log.module)?.label || log.module}</TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{log.description}</TableCell>
                    <TableCell className="text-sm">
                      {log.is_ai ? (
                        <span className="text-purple-600">IA (auth: {log.ai_authorized_by || "N/A"})</span>
                      ) : (
                        <span className="text-gray-600">Humano</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.details && (
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedLog(log)}>
                          Ver detalles
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm text-gray-600">{totalCount} registros totales - Página {page} de {totalPages}</span>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Dialog de detalles */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null) }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-semibold">Fecha:</span> {formatDate(selectedLog.timestamp)}</div>
                <div><span className="font-semibold">Usuario:</span> {selectedLog.user_name}</div>
                <div><span className="font-semibold">Módulo:</span> {MODULES.find(m => m.value === selectedLog.module)?.label || selectedLog.module}</div>
                <div><span className="font-semibold">Acción:</span> {selectedLog.action}</div>
              </div>
              <div><span className="font-semibold">Descripción:</span> {selectedLog.description}</div>
              {selectedLog.is_ai && (
                <div><span className="font-semibold">Autorizado por:</span> {selectedLog.ai_authorized_by || "N/A"}</div>
              )}
              {selectedLog.details && (
                <div className="mt-3">
                  <span className="font-semibold block mb-2">Datos registrados:</span>
                  {selectedLog.details.antes && selectedLog.details.despues ? (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <span className="font-medium text-red-700 block mb-1">Antes:</span>
                        <div className="space-y-1">
                          {Object.entries(selectedLog.details.antes).map(([key, value]) => (
                            <div key={key} className="flex">
                              <span className="font-medium text-gray-600 min-w-[140px]">{key.replace(/_/g, " ")}:</span>
                              <span className="text-gray-900">{String(value ?? "-")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <span className="font-medium text-green-700 block mb-1">Después:</span>
                        <div className="space-y-1">
                          {Object.entries(selectedLog.details.despues).map(([key, value]) => (
                            <div key={key} className="flex">
                              <span className="font-medium text-gray-600 min-w-[140px]">{key.replace(/_/g, " ")}:</span>
                              <span className="text-gray-900">{String(value ?? "-")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {Object.entries(selectedLog.details).filter(([k]) => k !== "antes" && k !== "despues").map(([key, value]) => (
                        <div key={key} className="flex">
                          <span className="font-medium text-gray-700 min-w-[140px]">{key.replace(/_/g, " ")}:</span>
                          <span className="text-gray-900">{String(value ?? "-")}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded p-3 space-y-1">
                      {Object.entries(selectedLog.details).map(([key, value]) => (
                        <div key={key} className="flex">
                          <span className="font-medium text-gray-700 min-w-[140px]">{key.replace(/_/g, " ")}:</span>
                          <span className="text-gray-900">{String(value ?? "-")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
