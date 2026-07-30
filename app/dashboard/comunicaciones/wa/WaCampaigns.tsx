"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/secure-db"
import { authFetch } from "@/lib/auth-fetch"
import { useAuth } from "@/contexts/auth-context"
import { formatPhoneDisplay } from "@/lib/format-phone"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Eye, RefreshCw, Loader2, RotateCcw, Megaphone } from "lucide-react"
import type { WaCampaign, WaCampaignRecipient } from "../types"
import { formatDateTime } from "../utils"

const ESTADO_STYLES: Record<string, string> = {
  borrador: "bg-gray-500",
  enviando: "bg-blue-600",
  pausada: "bg-amber-500",
  completada: "bg-green-600",
  cancelada: "bg-red-600",
}

export function WaCampaigns({ canEdit }: { canEdit: boolean }) {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<WaCampaign | null>(null)
  const [recipients, setRecipients] = useState<WaCampaignRecipient[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("wa_campaigns")
      .select("*")
      .eq("canal", "whatsapp")
      .order("created_at", { ascending: false })
      .limit(100)

    setLoading(false)
    if (error) {
      toast.error("No se pudieron cargar las campañas")
      return
    }
    setCampaigns((data as WaCampaign[]) || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (campaign: WaCampaign) => {
    setDetail(campaign)
    setLoadingRecipients(true)
    const { data } = await supabase
      .from("wa_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("nombre", { ascending: true })
    setRecipients((data as WaCampaignRecipient[]) || [])
    setLoadingRecipients(false)
  }

  /** Reintenta solo los destinatarios que fallaron. */
  const retryFailed = async () => {
    if (!detail || !canEdit) return
    const failed = recipients.filter((r) => r.status === "fallido" && r.wa_id)
    if (failed.length === 0) {
      toast.info("No hay envíos fallidos que reintentar")
      return
    }
    if (!confirm(`¿Reintentar el envío a ${failed.length} contacto(s)?`)) return

    setRetrying(true)
    try {
      const res = await authFetch("/api/whatsapp/send-bulk", {
        method: "POST",
        body: JSON.stringify({
          phones: failed.map((r) => r.wa_id),
          message: detail.body || "",
          origen: "campana",
          campaignId: detail.id,
          sentByName: user?.displayName,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "No se pudo reintentar")

      const rows = (json.results || []) as Array<{ phone: string; success: boolean; error?: string; messageId?: string }>

      for (const row of rows) {
        await supabase
          .from("wa_campaign_recipients")
          .update({
            status: row.success ? "enviado" : "fallido",
            wamid: row.messageId || null,
            error_message: row.error || null,
            sent_at: new Date().toISOString(),
          })
          .eq("campaign_id", detail.id)
          .eq("wa_id", row.phone)
      }

      const ok = rows.filter((r) => r.success).length
      toast.success(`${ok} de ${rows.length} reenviado(s)`)

      await openDetail(detail)
      await load()
    } catch (error: any) {
      toast.error(error?.message || "Error reintentando")
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Campañas de WhatsApp</CardTitle>
              <CardDescription>
                Historial de envíos masivos con métricas de entrega y lectura. Los estados se
                actualizan solos cuando Meta confirma por webhook.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-10">
              <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Aún no hay campañas. Se crean automáticamente al hacer un envío masivo desde la
                sección <strong>Enviar</strong>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaña</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Enviados</TableHead>
                    <TableHead className="text-right">Entregados</TableHead>
                    <TableHead className="text-right">Leídos</TableHead>
                    <TableHead className="text-right">Fallidos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{c.nombre}</div>
                        <div className="text-xs text-gray-500">
                          {c.tipo === "media" ? "Con archivo" : c.tipo === "plantilla" ? "Plantilla" : "Texto"}
                          {c.created_by_name ? ` · ${c.created_by_name}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDateTime(c.created_at)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.total}</TableCell>
                      <TableCell className="text-right text-sm">{c.enviados}</TableCell>
                      <TableCell className="text-right text-sm">{c.entregados}</TableCell>
                      <TableCell className="text-right text-sm">{c.leidos}</TableCell>
                      <TableCell className="text-right text-sm">
                        {c.fallidos > 0 ? (
                          <span className="text-red-600 font-medium">{c.fallidos}</span>
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${ESTADO_STYLES[c.estado] || "bg-gray-500"} text-white hover:opacity-90`}>
                          {c.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openDetail(c)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.nombre}</DialogTitle>
            <DialogDescription>
              {detail && formatDateTime(detail.created_at)} · {detail?.total} destinatarios
            </DialogDescription>
          </DialogHeader>

          {detail?.body && (
            <div className="bg-gray-50 border rounded-lg p-3 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
              {detail.body}
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex gap-4 text-xs text-gray-600">
              <span>Enviados: <strong>{detail?.enviados}</strong></span>
              <span>Entregados: <strong>{detail?.entregados}</strong></span>
              <span>Leídos: <strong>{detail?.leidos}</strong></span>
              <span className={detail && detail.fallidos > 0 ? "text-red-600" : ""}>
                Fallidos: <strong>{detail?.fallidos}</strong>
              </span>
            </div>
            {canEdit && detail && detail.fallidos > 0 && detail.body && (
              <Button size="sm" variant="outline" onClick={retryFailed} disabled={retrying}>
                {retrying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                Reintentar fallidos
              </Button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto border rounded-lg">
            {loadingRecipients ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.nombre || "—"}</div>
                        <div className="text-gray-400">
                          {r.wa_id ? formatPhoneDisplay(r.wa_id) : r.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "fallido" ? "destructive" : "secondary"}
                          className={
                            r.status === "leido"
                              ? "bg-blue-600 text-white hover:bg-blue-600"
                              : r.status === "entregado" || r.status === "enviado"
                                ? "bg-green-600 text-white hover:bg-green-600"
                                : ""
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-[280px] truncate">
                        {r.error_message || (r.sent_at ? formatDateTime(r.sent_at) : "—")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
