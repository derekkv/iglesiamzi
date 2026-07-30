"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/secure-db"
import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, ShieldCheck, Plug, Inbox, Send as SendIcon } from "lucide-react"
import type { EmailConfigPublic } from "../types"
import { formatDateTime } from "../utils"
import { CHURCH } from "@/lib/branding"

export function EmailSettings({
  config,
  onSaved,
}: {
  config: EmailConfigPublic | null
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testingImap, setTestingImap] = useState(false)
  const [mailboxes, setMailboxes] = useState<string[]>([])
  const [stats, setStats] = useState({ enviados: 0, fallidos: 0, recibidos: 0 })

  const [form, setForm] = useState({
    smtp_host: "smtp.hostinger.com",
    smtp_port: 465,
    smtp_secure: true,
    smtp_user: "",
    smtp_pass: "",
    from_name: CHURCH.name,
    from_email: "",
    reply_to: "",
    imap_host: "imap.hostinger.com",
    imap_port: 993,
    imap_secure: true,
    imap_user: "",
    imap_pass: "",
    imap_folders: "INBOX",
    sync_enabled: false,
    sync_max_messages: 100,
  })

  useEffect(() => {
    if (!config) return
    setForm({
      smtp_host: config.smtp_host || "smtp.hostinger.com",
      smtp_port: config.smtp_port || 465,
      smtp_secure: config.smtp_secure ?? true,
      smtp_user: config.smtp_user || "",
      smtp_pass: "",
      from_name: config.from_name || CHURCH.name,
      from_email: config.from_email || "",
      reply_to: config.reply_to || "",
      imap_host: config.imap_host || "imap.hostinger.com",
      imap_port: config.imap_port || 993,
      imap_secure: config.imap_secure ?? true,
      imap_user: config.imap_user || "",
      imap_pass: "",
      imap_folders: (config.imap_folders || ["INBOX"]).join(", "),
      sync_enabled: config.sync_enabled,
      sync_max_messages: config.sync_max_messages || 100,
    })
  }, [config])

  const loadStats = useCallback(async () => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const counts = await Promise.all([
      supabase.from("email_messages").select("id", { count: "exact", head: true })
        .eq("status", "sent").gte("created_at", startOfMonth.toISOString()),
      supabase.from("email_messages").select("id", { count: "exact", head: true })
        .eq("status", "failed").gte("created_at", startOfMonth.toISOString()),
      supabase.from("email_messages").select("id", { count: "exact", head: true })
        .eq("direction", "inbound").gte("created_at", startOfMonth.toISOString()),
    ])

    setStats({
      enviados: counts[0].count || 0,
      fallidos: counts[1].count || 0,
      recibidos: counts[2].count || 0,
    })
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        ...form,
        imap_folders: form.imap_folders
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }

      const res = await authFetch("/api/email/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setForm((prev) => ({ ...prev, smtp_pass: "", imap_pass: "" }))

      if (data.health?.ok) toast.success("Configuración guardada. SMTP verificado.")
      else toast.warning(`Guardado, pero SMTP falla: ${data.health?.error || "error desconocido"}`)

      onSaved()
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const testSmtp = async () => {
    setTestingSmtp(true)
    try {
      const res = await authFetch("/api/email/config", { method: "POST" })
      const data = await res.json()
      if (data.health?.ok) toast.success("Conexión SMTP correcta")
      else toast.error(data.health?.error || "No se pudo conectar por SMTP")
      onSaved()
    } catch (error: any) {
      toast.error(error?.message || "Error probando SMTP")
    } finally {
      setTestingSmtp(false)
    }
  }

  const testImap = async () => {
    setTestingImap(true)
    setMailboxes([])
    try {
      const res = await authFetch("/api/email/sync")
      const data = await res.json()
      if (data.ok) {
        setMailboxes(data.mailboxes || [])
        toast.success(`Conexión IMAP correcta. ${(data.mailboxes || []).length} carpeta(s).`)
      } else {
        toast.error(data.error || "No se pudo conectar por IMAP")
      }
    } catch (error: any) {
      toast.error(error?.message || "Error probando IMAP")
    } finally {
      setTestingImap(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Enviados este mes" value={stats.enviados} />
        <Kpi label="Recibidos este mes" value={stats.recibidos} />
        <Kpi label="Fallidos este mes" value={stats.fallidos} danger={stats.fallidos > 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* SMTP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SendIcon className="w-4 h-4" />
              Salida — SMTP
            </CardTitle>
            <CardDescription>
              Servidor para enviar. Deje la contraseña vacía para conservar la actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <div className="grid gap-2">
                <Label>Servidor</Label>
                <Input
                  value={form.smtp_host}
                  onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Puerto</Label>
                <Input
                  type="number"
                  value={form.smtp_port}
                  onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Usuario</Label>
              <Input
                value={form.smtp_user}
                onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                placeholder="notificaciones@iglesiaregalodedios.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>
                Contraseña
                {config?.has_smtp_pass && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">Guardada</Badge>
                )}
              </Label>
              <Input
                type="password"
                value={form.smtp_pass}
                onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                placeholder={config?.has_smtp_pass ? "•••••••• (sin cambios)" : "Contraseña del buzón"}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Nombre del remitente</Label>
                <Input
                  value={form.from_name}
                  onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Correo del remitente</Label>
                <Input
                  value={form.from_email}
                  onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                  placeholder="Igual al usuario si se deja vacío"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Responder a (Reply-To)</Label>
              <Input
                value={form.reply_to}
                onChange={(e) => setForm({ ...form, reply_to: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={form.smtp_secure}
                onCheckedChange={(v) => setForm({ ...form, smtp_secure: v === true })}
              />
              Conexión segura (SSL/TLS directo — recomendado en el puerto 465)
            </label>

            <div className="pt-2 border-t space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Estado</span>
                {config?.last_health_ok ? (
                  <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px]">
                    Verificado
                  </Badge>
                ) : config?.last_health_check_at ? (
                  <Badge variant="destructive" className="text-[10px]">Con error</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Sin verificar</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Última verificación</span>
                <span>{formatDateTime(config?.last_health_check_at)}</span>
              </div>
              {config?.last_health_error && (
                <p className="text-red-600 pt-1">{config.last_health_error}</p>
              )}
            </div>

            <Button variant="outline" onClick={testSmtp} disabled={testingSmtp} className="w-full">
              {testingSmtp ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plug className="w-4 h-4 mr-2" />
              )}
              Probar conexión SMTP
            </Button>
          </CardContent>
        </Card>

        {/* IMAP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-4 h-4" />
              Entrada — IMAP
            </CardTitle>
            <CardDescription>
              Permite ver en la bandeja los correos que llegan al buzón.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <div className="grid gap-2">
                <Label>Servidor</Label>
                <Input
                  value={form.imap_host}
                  onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Puerto</Label>
                <Input
                  type="number"
                  value={form.imap_port}
                  onChange={(e) => setForm({ ...form, imap_port: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Usuario</Label>
              <Input
                value={form.imap_user}
                onChange={(e) => setForm({ ...form, imap_user: e.target.value })}
                placeholder="Normalmente el mismo del SMTP"
              />
            </div>
            <div className="grid gap-2">
              <Label>
                Contraseña
                {config?.has_imap_pass && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">Guardada</Badge>
                )}
              </Label>
              <Input
                type="password"
                value={form.imap_pass}
                onChange={(e) => setForm({ ...form, imap_pass: e.target.value })}
                placeholder={config?.has_imap_pass ? "•••••••• (sin cambios)" : "Contraseña del buzón"}
              />
            </div>
            <div className="grid gap-2">
              <Label>Carpetas a sincronizar</Label>
              <Input
                value={form.imap_folders}
                onChange={(e) => setForm({ ...form, imap_folders: e.target.value })}
                placeholder="INBOX, Enviados"
              />
              <p className="text-xs text-gray-500">Separadas por comas.</p>
            </div>
            <div className="grid gap-2">
              <Label>Máximo de correos por sincronización</Label>
              <Input
                type="number"
                min={10}
                max={500}
                value={form.sync_max_messages}
                onChange={(e) => setForm({ ...form, sync_max_messages: Number(e.target.value) })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={form.imap_secure}
                onCheckedChange={(v) => setForm({ ...form, imap_secure: v === true })}
              />
              Conexión segura (SSL/TLS)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={form.sync_enabled}
                onCheckedChange={(v) => setForm({ ...form, sync_enabled: v === true })}
              />
              <span>
                <strong>Activar sincronización automática</strong> — necesario para el cron
              </span>
            </label>

            <div className="pt-2 border-t space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Última sincronización</span>
                <span>{formatDateTime(config?.last_sync_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Correos en la última pasada</span>
                <span>{config?.last_sync_count ?? 0}</span>
              </div>
              {config?.last_sync_error && (
                <p className="text-red-600 pt-1">{config.last_sync_error}</p>
              )}
            </div>

            <Button variant="outline" onClick={testImap} disabled={testingImap} className="w-full">
              {testingImap ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plug className="w-4 h-4 mr-2" />
              )}
              Probar conexión IMAP
            </Button>

            {mailboxes.length > 0 && (
              <div className="bg-gray-50 border rounded-lg p-2">
                <p className="text-xs text-gray-500 mb-1">Carpetas disponibles:</p>
                <div className="flex flex-wrap gap-1">
                  {mailboxes.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        const current = form.imap_folders.split(",").map((s) => s.trim()).filter(Boolean)
                        if (!current.includes(m)) {
                          setForm({ ...form, imap_folders: [...current, m].join(", ") })
                        }
                      }}
                      className="text-[10px] bg-white border hover:bg-blue-50 px-1.5 py-0.5 rounded font-mono"
                      title="Añadir a las carpetas a sincronizar"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 mb-4">
            Para descargar el correo automáticamente, programe una llamada cada 5 minutos a{" "}
            <code className="bg-white px-1 py-0.5 rounded">POST /api/email/sync</code> con el
            header <code className="bg-white px-1 py-0.5 rounded">X-Internal-Secret</code>. También
            puede pulsar <strong>Sincronizar</strong> en la cabecera del tab en cualquier momento.
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4 mr-2" />
            )}
            Guardar configuración
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="bg-white border rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${danger ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  )
}
