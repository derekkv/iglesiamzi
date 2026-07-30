"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { getAllUsers } from "@/lib/admin"
import { useAuth } from "@/contexts/auth-context"
import { auditService } from "@/lib/mod/audit-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Send, Paperclip, X, Loader2, Search, Eye, Users } from "lucide-react"
import type { SystemUser, EmailTemplate, EmailTemplateDefault } from "../types"

const MAX_ATTACHMENT_TOTAL = 20 * 1024 * 1024 // 20 MB en total

export function EmailCompose({ canEdit, onSent }: { canEdit: boolean; onSent: () => void }) {
  const { user } = useAuth()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [defaults, setDefaults] = useState<EmailTemplateDefault[]>([])

  const [mode, setMode] = useState<"libre" | "plantilla">("libre")
  const [recipientMode, setRecipientMode] = useState<"manual" | "usuarios">("manual")

  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [isHtml, setIsHtml] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Selección de usuarios
  const [userSearch, setUserSearch] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())

  // Plantilla
  const [templateSlug, setTemplateSlug] = useState("")
  const [templateData, setTemplateData] = useState<Record<string, string>>({})

  // -----------------------------------------------------------------------
  // Carga
  // -----------------------------------------------------------------------

  useEffect(() => {
    getAllUsers().then((res) => {
      if (res.success) {
        setUsers(((res.users as SystemUser[]) || []).filter((u) => u.email && u.is_active !== false))
      }
    })

    authFetch("/api/email/templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setTemplates((data.templates as EmailTemplate[]) || [])
          setDefaults((data.defaults as EmailTemplateDefault[]) || [])
        }
      })
      .catch(() => {})
  }, [])

  /** Catálogo unificado: las de BD pisan a las del código. */
  const allTemplates = useMemo(() => {
    const map = new Map<string, { slug: string; nombre: string; variables: string[]; enBd: boolean }>()
    for (const d of defaults) {
      map.set(d.slug, { slug: d.slug, nombre: d.nombre, variables: d.variables, enBd: false })
    }
    for (const t of templates) {
      map.set(t.slug, {
        slug: t.slug,
        nombre: t.nombre,
        variables: t.variables || [],
        enBd: true,
      })
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [templates, defaults])

  const selectedTemplate = allTemplates.find((t) => t.slug === templateSlug) || null

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.ministerio_name || "").toLowerCase().includes(q)
    )
  }, [users, userSearch])

  const recipients = useMemo(() => {
    if (recipientMode === "usuarios") {
      return users.filter((u) => selectedUsers.has(u.id)).map((u) => u.email as string)
    }
    return to
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }, [recipientMode, users, selectedUsers, to])

  const totalAttachmentSize = files.reduce((sum, f) => sum + f.size, 0)

  // -----------------------------------------------------------------------
  // Acciones
  // -----------------------------------------------------------------------

  const handlePreview = async () => {
    if (mode === "plantilla" && templateSlug) {
      try {
        const res = await authFetch(`/api/email/templates?preview=${encodeURIComponent(templateSlug)}`)
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        setPreview(data.html)
      } catch (error: any) {
        toast.error(error?.message || "No se pudo previsualizar")
      }
      return
    }

    setPreview(isHtml ? body : `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</pre>`)
  }

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(",")[1] || "")
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleSend = async () => {
    if (!canEdit) {
      toast.error("No tiene permisos para enviar correos")
      return
    }
    if (recipients.length === 0) {
      toast.error("Indique al menos un destinatario")
      return
    }
    if (totalAttachmentSize > MAX_ATTACHMENT_TOTAL) {
      toast.error("Los adjuntos superan los 20 MB en total")
      return
    }

    if (mode === "libre" && (!subject.trim() || !body.trim())) {
      toast.error("Complete el asunto y el contenido")
      return
    }
    if (mode === "plantilla" && !templateSlug) {
      toast.error("Seleccione una plantilla")
      return
    }

    if (recipients.length > 1 && !confirm(`¿Enviar a ${recipients.length} destinatarios?`)) return

    setSending(true)
    try {
      const attachments = await Promise.all(
        files.map(async (f) => ({
          filename: f.name,
          contentBase64: await toBase64(f),
          contentType: f.type || "application/octet-stream",
        }))
      )

      const payload: Record<string, any> =
        mode === "plantilla"
          ? {
              to: recipients,
              template: templateSlug,
              data: templateData,
              subject: subject.trim() || undefined,
            }
          : {
              to: recipients,
              subject: subject.trim(),
              html: isHtml
                ? body
                : `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#374151;white-space:pre-wrap">${escapeHtml(body)}</div>`,
              text: isHtml ? undefined : body,
            }

      if (cc.trim()) payload.cc = cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      if (bcc.trim()) payload.bcc = bcc.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      if (attachments.length > 0) payload.attachments = attachments
      payload.origen = "manual"
      payload.sentByName = user?.displayName

      const res = await authFetch("/api/send-email", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "No se pudo enviar el correo")

      toast.success(`Correo enviado a ${recipients.length} destinatario(s)`)

      if (user) {
        auditService.log({
          user_id: user.id,
          user_name: user.username,
          module: "comunicaciones",
          action: "crear",
          description: `Correo enviado: ${subject.trim() || templateSlug} (${recipients.length} destinatarios)`,
          details: { destinatarios: recipients.length, modo: mode, plantilla: templateSlug || null },
        })
      }

      // Limpiar
      setSubject("")
      setBody("")
      setFiles([])
      setSelectedUsers(new Set())
      setTo("")
      setCc("")
      setBcc("")
      setTemplateData({})
      if (fileRef.current) fileRef.current.value = ""
      onSent()
    } catch (error: any) {
      toast.error(error?.message || "Error enviando el correo")
    } finally {
      setSending(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Redactar correo</CardTitle>
          <CardDescription>
            Todo lo que se envía queda registrado en la bandeja, con éxito o con error.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === "libre" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("libre")}
            >
              Contenido libre
            </Button>
            <Button
              variant={mode === "plantilla" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("plantilla")}
            >
              Usar plantilla
            </Button>
          </div>

          {/* Destinatarios */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Destinatarios</Label>
              <div className="flex gap-1">
                <button
                  onClick={() => setRecipientMode("manual")}
                  className={`text-xs px-2 py-1 rounded ${
                    recipientMode === "manual" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-500"
                  }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setRecipientMode("usuarios")}
                  className={`text-xs px-2 py-1 rounded ${
                    recipientMode === "usuarios" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-500"
                  }`}
                >
                  Usuarios del sistema
                </button>
              </div>
            </div>

            {recipientMode === "manual" ? (
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="correo@ejemplo.com, otro@ejemplo.com"
              />
            ) : (
              <div className="border rounded-lg">
                <div className="p-2 border-b flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Buscar usuario..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedUsers(
                        selectedUsers.size === filteredUsers.length
                          ? new Set()
                          : new Set(filteredUsers.map((u) => u.id))
                      )
                    }
                  >
                    <Users className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y">
                  {filteredUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedUsers.has(u.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(selectedUsers)
                          if (v === true) next.add(u.id)
                          else next.delete(u.id)
                          setSelectedUsers(next)
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{u.displayName}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {recipients.length > 0 && (
              <p className="text-xs text-gray-500">{recipients.length} destinatario(s)</p>
            )}

            {!showCcBcc ? (
              <button
                onClick={() => setShowCcBcc(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                Añadir CC / BCC
              </button>
            ) : (
              <div className="grid gap-2">
                <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="CC" />
                <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="BCC" />
              </div>
            )}
          </div>

          {/* Contenido */}
          {mode === "plantilla" ? (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Plantilla</Label>
                <Select value={templateSlug} onValueChange={(v) => { setTemplateSlug(v); setTemplateData({}) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una plantilla" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTemplates.map((t) => (
                      <SelectItem key={t.slug} value={t.slug}>
                        {t.nombre} {t.enBd ? "" : "(por defecto)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div className="grid gap-2">
                  <Label>Variables de la plantilla</Label>
                  {selectedTemplate.variables.map((v) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-28 shrink-0 truncate">{v}</span>
                      <Input
                        value={templateData[v] || ""}
                        onChange={(e) => setTemplateData({ ...templateData, [v]: e.target.value })}
                        placeholder={v}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-2">
                <Label>Asunto (opcional, sobrescribe el de la plantilla)</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Dejar vacío para usar el asunto de la plantilla"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>Asunto *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del correo"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Contenido *</Label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-gray-600">
                    <Checkbox
                      checked={isHtml}
                      onCheckedChange={(v) => setIsHtml(v === true)}
                    />
                    Escribir HTML
                  </label>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  placeholder={
                    isHtml
                      ? "<p>Contenido en HTML...</p>"
                      : "Escriba el mensaje. Se enviará con la plantilla de marca de la iglesia."
                  }
                  className={isHtml ? "font-mono text-xs" : ""}
                />
              </div>
            </>
          )}

          {/* Adjuntos */}
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])])}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="w-4 h-4 mr-2" />
                Adjuntar archivos
              </Button>
              {files.length > 0 && (
                <span className="text-xs text-gray-500">
                  {(totalAttachmentSize / 1024 / 1024).toFixed(1)} MB de 20 MB
                </span>
              )}
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1"
                  >
                    <span className="truncate max-w-[180px]">{f.name}</span>
                    <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSend} disabled={!canEdit || sending || recipients.length === 0}>
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar
            </Button>
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="w-4 h-4 mr-2" />
              Previsualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Previsualización */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Previsualización</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {preview ? (
            <iframe
              title="Previsualización"
              sandbox=""
              srcDoc={preview}
              className="w-full h-[560px] border-0"
            />
          ) : (
            <div className="p-8 text-center text-sm text-gray-500">
              Pulse <strong>Previsualizar</strong> para ver cómo llegará el correo.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
