"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/secure-db"
import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  Copy, Check, Loader2, RefreshCw, ShieldCheck, ExternalLink, Activity,
} from "lucide-react"
import type { WaConfigPublic, WaHealthResponse, WaWebhookEvent, WaMessage } from "../types"
import { formatDateTime, qualityColor, qualityLabel } from "../utils"

export function WaSettings({
  health,
  onSaved,
}: {
  health: WaHealthResponse | null
  onSaved: () => void
}) {
  const [config, setConfig] = useState<WaConfigPublic | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [events, setEvents] = useState<WaWebhookEvent[]>([])
  const [stats, setStats] = useState({ hoy: 0, mes: 0, entregados: 0, leidos: 0, fallidos: 0, recibidos: 0 })

  const [form, setForm] = useState({
    phone_number_id: "",
    waba_id: "",
    business_id: "",
    api_version: "v21.0",
    access_token: "",
    app_secret: "",
    verify_token: "",
    is_active: false,
    auto_create_contacts: true,
    bulk_delay_ms: 250,
  })

  // -----------------------------------------------------------------------
  // Carga
  // -----------------------------------------------------------------------

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/whatsapp/config")
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      const cfg = data.config as WaConfigPublic
      setConfig(cfg)
      setWebhookUrl(data.webhookUrl || "")
      setForm({
        phone_number_id: cfg.phone_number_id || "",
        waba_id: cfg.waba_id || "",
        business_id: cfg.business_id || "",
        api_version: cfg.api_version || "v21.0",
        access_token: "",
        app_secret: "",
        verify_token: "",
        is_active: cfg.is_active,
        auto_create_contacts: cfg.auto_create_contacts,
        bulk_delay_ms: cfg.bulk_delay_ms,
      })
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar la configuración")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from("wa_webhook_events")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(15)
    setEvents((data as WaWebhookEvent[]) || [])
  }, [])

  const loadStats = useCallback(async () => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const counts = await Promise.all([
      supabase.from("wa_messages").select("id", { count: "exact", head: true })
        .eq("direction", "outbound").gte("created_at", startOfDay.toISOString()),
      supabase.from("wa_messages").select("id", { count: "exact", head: true })
        .eq("direction", "outbound").gte("created_at", startOfMonth.toISOString()),
      supabase.from("wa_messages").select("id", { count: "exact", head: true })
        .in("status", ["delivered", "read"]).gte("created_at", startOfMonth.toISOString()),
      supabase.from("wa_messages").select("id", { count: "exact", head: true })
        .eq("status", "read").gte("created_at", startOfMonth.toISOString()),
      supabase.from("wa_messages").select("id", { count: "exact", head: true })
        .eq("status", "failed").gte("created_at", startOfMonth.toISOString()),
      supabase.from("wa_messages").select("id", { count: "exact", head: true })
        .eq("direction", "inbound").gte("created_at", startOfMonth.toISOString()),
    ])

    setStats({
      hoy: counts[0].count || 0,
      mes: counts[1].count || 0,
      entregados: counts[2].count || 0,
      leidos: counts[3].count || 0,
      fallidos: counts[4].count || 0,
      recibidos: counts[5].count || 0,
    })
  }, [])

  useEffect(() => {
    loadConfig()
    loadEvents()
    loadStats()
  }, [loadConfig, loadEvents, loadStats])

  // -----------------------------------------------------------------------
  // Acciones
  // -----------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await authFetch("/api/whatsapp/config", {
        method: "PUT",
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setConfig(data.config as WaConfigPublic)
      // Limpiar los campos de secretos: ya están guardados
      setForm((prev) => ({ ...prev, access_token: "", app_secret: "", verify_token: "" }))

      if (data.health?.ok) {
        toast.success("Configuración guardada y validada con Meta")
      } else {
        toast.warning(`Guardado, pero Meta responde: ${data.health?.error || "error desconocido"}`)
      }
      onSaved()
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const copy = (value: string, key: string) => {
    navigator.clipboard.writeText(value)
    setCopied(key)
    toast.success("Copiado al portapapeles")
    setTimeout(() => setCopied(null), 2000)
  }

  const tasaEntrega = stats.mes > 0 ? Math.round((stats.entregados / stats.mes) * 100) : 0
  const tasaLectura = stats.mes > 0 ? Math.round((stats.leidos / stats.mes) * 100) : 0

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Enviados hoy" value={stats.hoy} />
        <KpiCard label="Enviados este mes" value={stats.mes} />
        <KpiCard label="Recibidos este mes" value={stats.recibidos} />
        <KpiCard label="Tasa de entrega" value={`${tasaEntrega}%`} />
        <KpiCard label="Tasa de lectura" value={`${tasaLectura}%`} />
        <KpiCard label="Fallidos este mes" value={stats.fallidos} danger={stats.fallidos > 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Credenciales */}
        <Card>
          <CardHeader>
            <CardTitle>Credenciales de Meta</CardTitle>
            <CardDescription>
              Los tokens se guardan cifrados en el servidor y nunca se devuelven al navegador.
              Deje los campos de secretos vacíos para conservar el valor actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label>Phone Number ID *</Label>
              <Input
                value={form.phone_number_id}
                onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                placeholder="123456789012345"
              />
            </div>
            <div className="grid gap-2">
              <Label>WABA ID (cuenta de WhatsApp Business) *</Label>
              <Input
                value={form.waba_id}
                onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
                placeholder="Necesario para sincronizar plantillas"
              />
            </div>
            <div className="grid gap-2">
              <Label>Business ID</Label>
              <Input
                value={form.business_id}
                onChange={(e) => setForm({ ...form, business_id: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="grid gap-2">
              <Label>
                Token de acceso permanente *
                {config?.has_access_token && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">Guardado</Badge>
                )}
              </Label>
              <Input
                type="password"
                value={form.access_token}
                onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                placeholder={config?.has_access_token ? "•••••••• (sin cambios)" : "Token del System User"}
              />
            </div>
            <div className="grid gap-2">
              <Label>
                App Secret
                {config?.has_app_secret && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">Guardado</Badge>
                )}
              </Label>
              <Input
                type="password"
                value={form.app_secret}
                onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
                placeholder={config?.has_app_secret ? "•••••••• (sin cambios)" : "Valida la firma del webhook"}
              />
              <p className="text-xs text-gray-500">
                Sin App Secret no se puede verificar que los eventos vengan realmente de Meta.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>
                Verify Token del webhook
                {config?.has_verify_token && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">Guardado</Badge>
                )}
              </Label>
              <Input
                type="password"
                value={form.verify_token}
                onChange={(e) => setForm({ ...form, verify_token: e.target.value })}
                placeholder={config?.has_verify_token ? "•••••••• (sin cambios)" : "Cadena que usted invente"}
              />
            </div>
            <div className="grid gap-2">
              <Label>Versión de la API</Label>
              <Input
                value={form.api_version}
                onChange={(e) => setForm({ ...form, api_version: e.target.value })}
                placeholder="v21.0"
              />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v === true })}
                />
                <span>
                  <strong>Activar el canal</strong> — sin esto no se envía ningún mensaje
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.auto_create_contacts}
                  onCheckedChange={(v) => setForm({ ...form, auto_create_contacts: v === true })}
                />
                Crear contactos automáticamente al enviar o recibir
              </label>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Pausa entre envíos masivos (ms)</Label>
                <Input
                  type="number"
                  min={0}
                  max={5000}
                  value={form.bulk_delay_ms}
                  onChange={(e) => setForm({ ...form, bulk_delay_ms: Number(e.target.value) })}
                  className="w-24"
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              Guardar y validar con Meta
            </Button>
          </CardContent>
        </Card>

        {/* Webhook y estado */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhook</CardTitle>
              <CardDescription>
                Registre esta URL en Meta → WhatsApp → Configuración → Webhooks, y suscríbase al
                campo <strong>messages</strong>. Sin el webhook no hay estados de entrega, ni
                mensajes entrantes, ni ventana de 24 horas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label>URL de callback</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(webhookUrl, "url")}
                    className="shrink-0"
                  >
                    {copied === "url" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                Abrir el panel de aplicaciones de Meta
                <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado del número</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Estado">
                {health?.connected ? (
                  <Badge className="bg-green-600 hover:bg-green-600 text-white">Operativo</Badge>
                ) : (
                  <Badge variant="destructive">Con error</Badge>
                )}
              </Row>
              <Row label="Número">{health?.phoneNumber || "—"}</Row>
              <Row label="Nombre verificado">{health?.name || "—"}</Row>
              <Row label="Calidad">
                {health?.quality ? (
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${qualityColor(health.quality)}`} />
                    {qualityLabel(health.quality)}
                  </span>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Límite de mensajería">{health?.messagingLimit || "—"}</Row>
              <Row label="Última verificación">
                {formatDateTime(config?.last_health_check_at)}
              </Row>
              {config?.last_health_error && (
                <p className="text-xs text-red-600 border-t pt-2">{config.last_health_error}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Eventos del webhook */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Últimos eventos del webhook
              </CardTitle>
              <CardDescription>
                Útil para comprobar que Meta está entregando los eventos correctamente.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadEvents}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              Todavía no ha llegado ningún evento. Si ya registró el webhook en Meta, envíe un
              mensaje de prueba al número.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recibido</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Procesado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTime(e.received_at)}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{e.event_type || "—"}</TableCell>
                    <TableCell>
                      {e.signature_valid ? (
                        <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px]">
                          Válida
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Sin verificar</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.processed ? (
                        <span className="text-green-700">Sí</span>
                      ) : (
                        <span className="text-red-600">{e.error || "No"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
  return (
    <div className="bg-white border rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${danger ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{children}</span>
    </div>
  )
}
