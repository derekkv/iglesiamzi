"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { RefreshCw, Loader2, Link2, FileText, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { WaTemplate } from "../types"
import { formatDateTime, templateVariables } from "../utils"

interface UseCaseOption {
  value: string
  label: string
}

/** Campos que cada caso de uso pasa al enviar; sirven para mapear las variables. */
const USE_CASE_FIELDS: Record<string, string[]> = {
  asignacion_servicio: ["userName", "asignacion", "fecha", "horaEntrada", "modulo", "ministerio"],
  recordatorio_5dias: ["userName", "asignacion", "fecha", "horaEntrada", "modulo", "ministerio"],
  recordatorio_manana: ["userName", "asignacion", "fecha", "horaEntrada", "modulo", "ministerio"],
  felicitacion_cumpleanos: ["nombre", "edad"],
  citacion_ministerio: ["destinatario", "remitente", "asunto", "detalle", "fecha"],
  aviso_pago: ["nombre", "concepto", "valor", "metodo"],
  alerta_atraso_servidor: ["lider", "servidor", "modulo", "fecha"],
  alerta_sistema: ["contexto", "error", "fecha"],
  resumen_admin: ["resumen"],
  aviso_requerimiento: ["destinatario", "solicitante", "detalle"],
  aviso_ayuda_social: ["destinatario", "detalle"],
  aviso_herederos: ["nino", "estado", "salon"],
  aviso_herederos_c: ["nino", "estado", "alergias", "observaciones", "salon"],
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-green-600",
  PENDING: "bg-amber-500",
  REJECTED: "bg-red-600",
  DISABLED: "bg-gray-500",
  PAUSED: "bg-orange-500",
}

export function WaTemplates({ canEdit }: { canEdit: boolean }) {
  const [templates, setTemplates] = useState<WaTemplate[]>([])
  const [useCases, setUseCases] = useState<UseCaseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [mapping, setMapping] = useState<WaTemplate | null>(null)
  const [useCase, setUseCase] = useState<string>("")
  const [varMap, setVarMap] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/whatsapp/templates")
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setTemplates((data.templates as WaTemplate[]) || [])
      setUseCases((data.useCases as UseCaseOption[]) || [])
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron cargar las plantillas")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await authFetch("/api/whatsapp/templates", { method: "POST" })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setTemplates((data.templates as WaTemplate[]) || [])
      toast.success(`${data.synced} plantilla(s) sincronizada(s) desde Meta`)
    } catch (error: any) {
      toast.error(error?.message || "No se pudo sincronizar")
    } finally {
      setSyncing(false)
    }
  }

  const openMapping = (tpl: WaTemplate) => {
    setMapping(tpl)
    setUseCase(tpl.use_case || "")
    setVarMap(tpl.variable_map || {})
  }

  const handleSaveMapping = async () => {
    if (!mapping) return
    setSaving(true)
    try {
      const res = await authFetch("/api/whatsapp/templates", {
        method: "PATCH",
        body: JSON.stringify({
          id: mapping.id,
          use_case: useCase || null,
          variable_map: Object.keys(varMap).length > 0 ? varMap : null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success("Plantilla vinculada")
      setMapping(null)
      await load()
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const vars = useMemo(() => templateVariables(mapping?.body_preview), [mapping])
  const availableFields = useCase ? USE_CASE_FIELDS[useCase] || [] : []

  // Casos de uso sin plantilla asignada: son los que fallarán fuera de la ventana
  const unmapped = useMemo(() => {
    const assigned = new Set(templates.filter((t) => t.use_case).map((t) => t.use_case as string))
    return useCases.filter((uc) => !assigned.has(uc.value))
  }, [templates, useCases])

  return (
    <div className="space-y-4">
      {/* Aviso de cobertura */}
      {!loading && unmapped.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">
                {unmapped.length} caso(s) de uso sin plantilla asignada
              </p>
              <p className="text-sm text-amber-800 mt-1">
                Los mensajes automáticos a contactos que no escribieron en las últimas 24 horas
                necesitan una plantilla aprobada. Sin asignarla, esos envíos fallarán con el
                error 131047.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {unmapped.map((uc) => (
                  <span
                    key={uc.value}
                    className="text-[11px] bg-white border border-amber-300 text-amber-900 px-2 py-0.5 rounded"
                  >
                    {uc.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Plantillas de mensaje</CardTitle>
              <CardDescription>
                Se crean y aprueban en Meta Business Manager. Aquí se sincronizan y se vinculan a
                los casos de uso del sistema.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sincronizar con Meta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                No hay plantillas en el catálogo local. Créelas en Meta Business Manager
                (WhatsApp Manager → Plantillas de mensajes) y pulse
                <strong> Sincronizar con Meta</strong>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plantilla</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cabecera</TableHead>
                    <TableHead>Vars</TableHead>
                    <TableHead>Caso de uso</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => {
                    const status = (t.status || "").toUpperCase()
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="font-mono text-xs font-medium">{t.name}</div>
                          {t.body_preview && (
                            <div className="text-xs text-gray-500 max-w-[280px] truncate mt-0.5">
                              {t.body_preview}
                            </div>
                          )}
                          {status === "REJECTED" && t.rejected_reason && (
                            <div className="text-[11px] text-red-600 mt-0.5">
                              {t.rejected_reason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{t.language}</TableCell>
                        <TableCell className="text-xs">{t.category || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            className={`${STATUS_STYLES[status] || "bg-gray-500"} text-white hover:opacity-90`}
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.header_format && t.header_format !== "NONE" ? t.header_format : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-center">{t.variable_count}</TableCell>
                        <TableCell>
                          {t.use_case ? (
                            <span className="text-xs flex items-center gap-1 text-green-700">
                              <CheckCircle2 className="w-3 h-3" />
                              {useCases.find((u) => u.value === t.use_case)?.label || t.use_case}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Sin asignar</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openMapping(t)}
                            disabled={!canEdit || status !== "APPROVED"}
                            title={
                              status !== "APPROVED"
                                ? "Solo las plantillas aprobadas se pueden vincular"
                                : "Vincular a un caso de uso"
                            }
                          >
                            <Link2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {templates.length > 0 && templates[0].synced_at && (
            <p className="text-xs text-gray-400 mt-3">
              Última sincronización: {formatDateTime(templates[0].synced_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Vinculación a caso de uso */}
      <Dialog open={!!mapping} onOpenChange={(open) => !open && setMapping(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vincular plantilla</DialogTitle>
            <DialogDescription className="font-mono text-xs">{mapping?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {mapping?.body_preview && (
              <div className="bg-gray-50 border rounded-lg p-3">
                <p className="text-[11px] text-gray-500 mb-1">Contenido de la plantilla</p>
                <p className="text-sm whitespace-pre-wrap">{mapping.body_preview}</p>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Caso de uso del sistema</Label>
              <Select value={useCase || "none"} onValueChange={(v) => { setUseCase(v === "none" ? "" : v); setVarMap({}) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el caso de uso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin asignar —</SelectItem>
                  {useCases.map((uc) => (
                    <SelectItem key={uc.value} value={uc.value}>
                      {uc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Cuando el sistema envíe un mensaje de este tipo y la ventana de 24 h esté cerrada,
                usará esta plantilla automáticamente.
              </p>
            </div>

            {vars.length > 0 && (
              <div className="grid gap-2">
                <Label>Mapeo de variables</Label>
                <p className="text-xs text-gray-500 -mt-1">
                  Indique qué dato del sistema va en cada variable de la plantilla.
                </p>
                {vars.map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-600 w-14 shrink-0">
                      {`{{${n}}}`}
                    </span>
                    {availableFields.length > 0 ? (
                      <Select
                        value={varMap[String(n)] || "none"}
                        onValueChange={(v) =>
                          setVarMap({ ...varMap, [String(n)]: v === "none" ? "" : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Campo del sistema" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Vacío —</SelectItem>
                          {availableFields.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={varMap[String(n)] || ""}
                        onChange={(e) => setVarMap({ ...varMap, [String(n)]: e.target.value })}
                        placeholder="Nombre del campo"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {mapping?.header_format && ["IMAGE", "VIDEO", "DOCUMENT"].includes(mapping.header_format) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                Esta plantilla tiene cabecera <strong>{mapping.header_format}</strong>: el archivo
                se adjunta automáticamente cuando el envío lo incluye (por ejemplo la imagen
                personalizada de cumpleaños).
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMapping(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveMapping} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
