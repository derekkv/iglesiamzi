"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/secure-db"
import { authFetch } from "@/lib/auth-fetch"
import { useAuth } from "@/contexts/auth-context"
import { formatPhoneForWhatsApp, formatPhoneDisplay } from "@/lib/format-phone"
import { auditService } from "@/lib/mod/audit-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Send, Paperclip, X, Loader2, Search, AlertTriangle, CheckCircle2, Clock, Lock } from "lucide-react"
import type { WaContact, WaTag, WaTemplate, WaSendResultRow } from "../types"
import { contactName, isWindowOpen, templateVariables, fillTemplatePreview } from "../utils"

type Mode = "individual" | "masivo"

export function WaSend({
  contacts,
  tags,
  canEdit,
  onSent,
}: {
  contacts: WaContact[]
  tags: WaTag[]
  canEdit: boolean
  onSent: () => void
}) {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>("individual")
  const [templates, setTemplates] = useState<WaTemplate[]>([])

  // Individual
  const [phone, setPhone] = useState("")
  const [contactId, setContactId] = useState<string>("")
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Plantilla
  const [useTemplate, setUseTemplate] = useState(false)
  const [templateName, setTemplateName] = useState<string>("")
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({})

  // Masivo
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSearch, setBulkSearch] = useState("")
  const [bulkTag, setBulkTag] = useState("todos")
  const [bulkMessage, setBulkMessage] = useState("")
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkName, setBulkName] = useState("")
  const [bulkSending, setBulkSending] = useState(false)
  const [results, setResults] = useState<WaSendResultRow[]>([])
  const bulkFileRef = useRef<HTMLInputElement>(null)

  const loadTemplates = useCallback(async () => {
    try {
      const res = await authFetch("/api/whatsapp/templates")
      const data = await res.json()
      if (data.success) {
        setTemplates(
          ((data.templates as WaTemplate[]) || []).filter(
            (t) => (t.status || "").toUpperCase() === "APPROVED"
          )
        )
      }
    } catch {
      // Sin plantillas: la UI lo indica
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.name === templateName) || null,
    [templates, templateName]
  )

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) || null,
    [contacts, contactId]
  )

  // El teléfono efectivo: el del contacto elegido o el escrito a mano
  const effectivePhone = selectedContact?.wa_id || formatPhoneForWhatsApp(phone)
  const targetContact = useMemo(
    () => selectedContact || contacts.find((c) => c.wa_id === effectivePhone) || null,
    [selectedContact, contacts, effectivePhone]
  )
  const windowOpen = isWindowOpen(targetContact)

  // -----------------------------------------------------------------------
  // Envío individual
  // -----------------------------------------------------------------------

  const handleSendIndividual = async () => {
    if (!canEdit) {
      toast.error("No tiene permisos para enviar mensajes")
      return
    }
    if (!effectivePhone || effectivePhone.length < 8) {
      toast.error("Indique un número de teléfono válido")
      return
    }

    setSending(true)
    try {
      // --- Plantilla explícita ---
      if (useTemplate && selectedTemplate) {
        const data: Record<string, string> = {}
        const map = selectedTemplate.variable_map || {}
        for (const [index, value] of Object.entries(templateVars)) {
          const field = map[index] || `var${index}`
          data[field] = value
        }

        const res = await authFetch("/api/whatsapp/send-template", {
          method: "POST",
          body: JSON.stringify({
            phone: effectivePhone,
            template: selectedTemplate.name,
            language: selectedTemplate.language,
            data,
            previewText: fillTemplatePreview(selectedTemplate.body_preview || "", templateVars),
            origen: "manual",
            sentByName: user?.displayName,
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "No se pudo enviar la plantilla")
        toast.success("Plantilla enviada")
      }
      // --- Archivo ---
      else if (file) {
        const form = new FormData()
        form.append("phone", effectivePhone)
        form.append("file", file)
        if (message.trim()) form.append("caption", message.trim())
        form.append("origen", "manual")

        const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
        const res = await fetch("/api/whatsapp/send-media", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "No se pudo enviar el archivo")
        toast.success("Archivo enviado")
      }
      // --- Texto libre ---
      else {
        if (!message.trim()) {
          toast.error("Escriba un mensaje")
          setSending(false)
          return
        }
        const res = await authFetch("/api/whatsapp/send", {
          method: "POST",
          body: JSON.stringify({
            phone: effectivePhone,
            message: message.trim(),
            origen: "manual",
            sentByName: user?.displayName,
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "No se pudo enviar el mensaje")
        toast.success(json.mode === "template" ? "Enviado como plantilla" : "Mensaje enviado")
      }

      setMessage("")
      setFile(null)
      if (fileRef.current) fileRef.current.value = ""
      onSent()
    } catch (error: any) {
      toast.error(error?.message || "Error enviando el mensaje")
    } finally {
      setSending(false)
    }
  }

  // -----------------------------------------------------------------------
  // Envío masivo
  // -----------------------------------------------------------------------

  const bulkCandidates = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase()
    return contacts.filter((c) => {
      if (c.blocked || !c.opt_in) return false
      if (bulkTag !== "todos" && !(c.tags || []).includes(bulkTag)) return false
      if (!q) return true
      return contactName(c).toLowerCase().includes(q) || c.wa_id.includes(q.replace(/\D/g, ""))
    })
  }, [contacts, bulkSearch, bulkTag])

  const toggleAll = () => {
    if (selectedIds.size === bulkCandidates.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(bulkCandidates.map((c) => c.id)))
    }
  }

  const handleSendBulk = async () => {
    if (!canEdit) {
      toast.error("No tiene permisos para enviar mensajes")
      return
    }
    const targets = contacts.filter((c) => selectedIds.has(c.id))
    if (targets.length === 0) {
      toast.error("Seleccione al menos un destinatario")
      return
    }
    if (!bulkMessage.trim() && !bulkFile) {
      toast.error("Escriba un mensaje o adjunte un archivo")
      return
    }

    const cerradas = targets.filter((c) => !isWindowOpen(c)).length
    const aviso = cerradas > 0
      ? `\n\n${cerradas} de ${targets.length} contactos tienen la ventana de 24 h cerrada: a esos solo llegará el mensaje si hay una plantilla aprobada asignada.`
      : ""

    if (!confirm(`¿Enviar a ${targets.length} contacto(s)?${aviso}`)) return

    setBulkSending(true)
    setResults([])

    try {
      // Registrar la campaña para poder seguir las métricas
      const { data: campaign } = await supabase
        .from("wa_campaigns")
        .insert({
          nombre: bulkName.trim() || `Envío ${new Date().toLocaleString("es-EC")}`,
          canal: "whatsapp",
          tipo: bulkFile ? "media" : "texto",
          body: bulkMessage.trim() || null,
          total: targets.length,
          estado: "enviando",
          created_by: user?.id || null,
          created_by_name: user?.displayName || null,
          started_at: new Date().toISOString(),
          filtro: { tag: bulkTag, count: targets.length },
        })
        .select("id")
        .single()

      const campaignId = campaign?.id as string | undefined

      if (campaignId) {
        await supabase.from("wa_campaign_recipients").insert(
          targets.map((c) => ({
            campaign_id: campaignId,
            contact_id: c.id,
            wa_id: c.wa_id,
            nombre: contactName(c),
            status: "pendiente",
          }))
        )
      }

      const phones = targets.map((c) => c.wa_id)
      let rows: WaSendResultRow[] = []

      if (bulkFile) {
        const form = new FormData()
        form.append("phones", JSON.stringify(phones))
        form.append("file", bulkFile)
        if (bulkMessage.trim()) form.append("caption", bulkMessage.trim())
        form.append("origen", "campana")
        if (campaignId) form.append("campaignId", campaignId)

        const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
        const res = await fetch("/api/whatsapp/send-bulk-media", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "No se pudo enviar el envío masivo")
        rows = json.results || []
      } else {
        const res = await authFetch("/api/whatsapp/send-bulk", {
          method: "POST",
          body: JSON.stringify({
            phones,
            message: bulkMessage.trim(),
            origen: "campana",
            campaignId,
            sentByName: user?.displayName,
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "No se pudo enviar el envío masivo")
        rows = json.results || []
      }

      setResults(rows)

      const ok = rows.filter((r) => r.success).length
      const fail = rows.length - ok

      // Cerrar la campaña con el resultado
      if (campaignId) {
        for (const row of rows) {
          await supabase
            .from("wa_campaign_recipients")
            .update({
              status: row.success ? "enviado" : "fallido",
              wamid: row.messageId || null,
              error_message: row.error || null,
              sent_at: new Date().toISOString(),
            })
            .eq("campaign_id", campaignId)
            .eq("wa_id", row.phone)
        }

        await supabase
          .from("wa_campaigns")
          .update({
            enviados: ok,
            fallidos: fail,
            estado: "completada",
            finished_at: new Date().toISOString(),
          })
          .eq("id", campaignId)
      }

      if (user) {
        auditService.log({
          user_id: user.id,
          user_name: user.username,
          module: "comunicaciones",
          action: "crear",
          description: `Envío masivo WhatsApp: ${ok} enviados, ${fail} fallidos`,
          details: { total: rows.length, enviados: ok, fallidos: fail, etiqueta: bulkTag },
        })
      }

      if (fail === 0) toast.success(`${ok} mensaje(s) enviado(s)`)
      else toast.warning(`${ok} enviado(s), ${fail} con error`)

      onSent()
    } catch (error: any) {
      toast.error(error?.message || "Error en el envío masivo")
    } finally {
      setBulkSending(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const vars = templateVariables(selectedTemplate?.body_preview)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={mode === "individual" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("individual")}
        >
          Individual
        </Button>
        <Button
          variant={mode === "masivo" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("masivo")}
        >
          Masivo
        </Button>
      </div>

      {mode === "individual" ? (
        <Card>
          <CardHeader>
            <CardTitle>Enviar mensaje individual</CardTitle>
            <CardDescription>
              Si la ventana de 24 horas está cerrada, WhatsApp exige una plantilla aprobada.
              El sistema la usa automáticamente cuando hay una asignada al caso de uso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Contacto existente</Label>
                <Select
                  value={contactId || "none"}
                  onValueChange={(v) => {
                    setContactId(v === "none" ? "" : v)
                    if (v !== "none") setPhone("")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un contacto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Escribir número manualmente —</SelectItem>
                    {contacts.slice(0, 200).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {contactName(c)} · {formatPhoneDisplay(c.wa_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>O número manual</Label>
                <Input
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (e.target.value) setContactId("")
                  }}
                  placeholder="0999999999"
                  disabled={!!contactId}
                />
              </div>
            </div>

            {effectivePhone && effectivePhone.length >= 8 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Destino: {formatPhoneDisplay(effectivePhone)}</span>
                {targetContact ? (
                  windowOpen ? (
                    <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1">
                      <Clock className="w-3 h-3" /> Ventana abierta
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="w-3 h-3" /> Ventana cerrada
                    </Badge>
                  )
                ) : (
                  <Badge variant="secondary">Contacto nuevo</Badge>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={useTemplate}
                onCheckedChange={(v) => setUseTemplate(v === true)}
              />
              Enviar una plantilla aprobada
            </label>

            {useTemplate ? (
              <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                {templates.length === 0 ? (
                  <div className="flex items-start gap-2 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      No hay plantillas aprobadas. Créelas en Meta Business y sincronícelas
                      desde la sección <strong>Plantillas</strong>.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label>Plantilla</Label>
                      <Select value={templateName} onValueChange={(v) => { setTemplateName(v); setTemplateVars({}) }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una plantilla" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.name}>
                              {t.name} ({t.language})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {vars.length > 0 && (
                      <div className="grid gap-2">
                        <Label>Variables</Label>
                        {vars.map((n) => (
                          <div key={n} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-16 shrink-0">
                              {`{{${n}}}`}
                              {selectedTemplate?.variable_map?.[String(n)] && (
                                <span className="block text-[10px] text-gray-400">
                                  {selectedTemplate.variable_map[String(n)]}
                                </span>
                              )}
                            </span>
                            <Input
                              value={templateVars[String(n)] || ""}
                              onChange={(e) =>
                                setTemplateVars({ ...templateVars, [String(n)]: e.target.value })
                              }
                              placeholder={`Valor de la variable ${n}`}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedTemplate?.body_preview && (
                      <div className="bg-white border rounded-lg p-3">
                        <p className="text-[11px] text-gray-500 mb-1">Previsualización</p>
                        <p className="text-sm whitespace-pre-wrap">
                          {fillTemplatePreview(selectedTemplate.body_preview, templateVars)}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>Mensaje</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Escriba el mensaje. Puede usar *negrita*, _cursiva_ y emojis."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="w-4 h-4 mr-2" />
                    Adjuntar
                  </Button>
                  {file && (
                    <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1">
                      <span className="truncate max-w-[240px]">{file.name}</span>
                      <button
                        onClick={() => {
                          setFile(null)
                          if (fileRef.current) fileRef.current.value = ""
                        }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            <Button
              onClick={handleSendIndividual}
              disabled={!canEdit || sending || !effectivePhone}
              className="w-full sm:w-auto"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[1fr_400px] gap-4">
          {/* Selección de destinatarios */}
          <Card>
            <CardHeader>
              <CardTitle>Destinatarios</CardTitle>
              <CardDescription>
                {selectedIds.size} de {bulkCandidates.length} seleccionados. Se excluyen contactos
                bloqueados y con opt-out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Buscar..."
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={bulkTag} onValueChange={setBulkTag}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas las etiquetas</SelectItem>
                    {tags.map((t) => (
                      <SelectItem key={t.id} value={t.nombre}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedIds.size === bulkCandidates.length ? "Ninguno" : "Todos"}
                </Button>
              </div>

              <div className="border rounded-lg max-h-[420px] overflow-y-auto divide-y">
                {bulkCandidates.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 text-center">
                    Sin contactos disponibles con ese filtro.
                  </p>
                ) : (
                  bulkCandidates.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(selectedIds)
                          if (v === true) next.add(c.id)
                          else next.delete(c.id)
                          setSelectedIds(next)
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{contactName(c)}</p>
                        <p className="text-xs text-gray-500">{formatPhoneDisplay(c.wa_id)}</p>
                      </div>
                      {isWindowOpen(c) ? (
                        <span
                          className="w-2 h-2 rounded-full bg-green-500 shrink-0"
                          title="Ventana abierta"
                        />
                      ) : (
                        <Lock className="w-3 h-3 text-gray-300 shrink-0" />
                      )}
                    </label>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Composición */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contenido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <Label>Nombre de la campaña</Label>
                  <Input
                    value={bulkName}
                    onChange={(e) => setBulkName(e.target.value)}
                    placeholder="Ej. Convocatoria servidores agosto"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Mensaje</Label>
                  <Textarea
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    rows={6}
                    placeholder="Mensaje que recibirán todos los seleccionados"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={bulkFileRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                  />
                  <Button variant="outline" size="sm" onClick={() => bulkFileRef.current?.click()}>
                    <Paperclip className="w-4 h-4 mr-2" />
                    Adjuntar
                  </Button>
                  {bulkFile && (
                    <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 min-w-0">
                      <span className="truncate">{bulkFile.name}</span>
                      <button
                        onClick={() => {
                          setBulkFile(null)
                          if (bulkFileRef.current) bulkFileRef.current.value = ""
                        }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  El archivo se sube una sola vez a WhatsApp y se reutiliza para todos los
                  destinatarios. Los envíos van secuenciales con una pausa entre cada uno para
                  respetar los límites de la API.
                </div>

                <Button
                  onClick={handleSendBulk}
                  disabled={!canEdit || bulkSending || selectedIds.size === 0}
                  className="w-full"
                >
                  {bulkSending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Enviar a {selectedIds.size} contacto(s)
                </Button>
              </CardContent>
            </Card>

            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resultados</CardTitle>
                  <CardDescription>
                    {results.filter((r) => r.success).length} enviados ·{" "}
                    {results.filter((r) => !r.success).length} con error
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r, i) => {
                        const contact = contacts.find((c) => c.wa_id === r.phone)
                        return (
                          <TableRow key={`${r.phone}-${i}`}>
                            <TableCell className="text-xs">
                              <div>{contact ? contactName(contact) : formatPhoneDisplay(r.phone)}</div>
                              {contact && (
                                <div className="text-gray-400">{formatPhoneDisplay(r.phone)}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.success ? (
                                <span className="text-green-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {r.mode === "template" ? "Plantilla" : "Enviado"}
                                </span>
                              ) : (
                                <span className="text-red-600">{r.error || "Error"}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
