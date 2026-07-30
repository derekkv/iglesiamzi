"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/secure-db"
import { authFetch } from "@/lib/auth-fetch"
import { useRealtime } from "@/hooks/use-realtime"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  Search, Mail, MailOpen, Star, Paperclip, Loader2, ArrowDownLeft, ArrowUpRight,
  AlertCircle, ChevronLeft, ChevronRight, Download, Code2, Eye,
} from "lucide-react"
import type { EmailMessage, EmailAttachment } from "../types"
import { ORIGEN_LABELS } from "../types"
import { formatDateTime, formatRelative, formatBytes } from "../utils"

const PAGE_SIZE = 25

export function EmailInbox({ reloadKey, canEdit }: { reloadKey: number; canEdit: boolean }) {
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [direction, setDirection] = useState<"todos" | "inbound" | "outbound">("todos")
  const [status, setStatus] = useState<"todos" | "sent" | "failed" | "received">("todos")
  const [origen, setOrigen] = useState<string>("todos")
  const [selected, setSelected] = useState<EmailMessage | null>(null)
  const [attachments, setAttachments] = useState<EmailAttachment[]>([])
  const [viewSource, setViewSource] = useState(false)

  // -----------------------------------------------------------------------
  // Carga
  // -----------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from("email_messages")
      .select(
        "id,message_id,direction,from_email,from_name,to_emails,cc_emails,bcc_emails,reply_to," +
        "subject,snippet,template,status,error_message,thread_id,folder,is_read,is_starred," +
        "has_attachments,attachment_count,sent_by_name,origen,sent_at,received_at,created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (direction !== "todos") query = query.eq("direction", direction)
    if (status !== "todos") query = query.eq("status", status)
    if (origen !== "todos") query = query.eq("origen", origen)

    const term = search.trim()
    if (term) {
      // PostgREST: or() con varias columnas
      query = query.or(
        `subject.ilike.%${term}%,from_email.ilike.%${term}%,snippet.ilike.%${term}%`
      )
    }

    const { data, error, count } = await query
    setLoading(false)

    if (error) {
      toast.error("No se pudieron cargar los correos")
      return
    }

    setEmails((data as EmailMessage[]) || [])
    setTotal(count || 0)
  }, [page, direction, status, origen, search])

  useEffect(() => {
    load()
  }, [load, reloadKey])

  // Volver a la primera página al cambiar filtros
  useEffect(() => {
    setPage(0)
  }, [direction, status, origen, search])

  useRealtime({ table: "email_messages", onChange: load })

  // -----------------------------------------------------------------------
  // Detalle
  // -----------------------------------------------------------------------

  const openEmail = async (email: EmailMessage) => {
    setViewSource(false)

    // El cuerpo completo se pide aparte para no cargar todo el HTML en la lista
    const { data } = await supabase
      .from("email_messages")
      .select("*")
      .eq("id", email.id)
      .maybeSingle()

    const full = (data as EmailMessage) || email
    setSelected(full)

    const { data: atts } = await supabase
      .from("email_attachments")
      .select("*")
      .eq("email_id", email.id)
    setAttachments((atts as EmailAttachment[]) || [])

    // Marcar como leído los entrantes
    if (full.direction === "inbound" && !full.is_read && canEdit) {
      await supabase.from("email_messages").update({ is_read: true }).eq("id", email.id)
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e)))
    }
  }

  const toggleStar = async (email: EmailMessage) => {
    if (!canEdit) return
    const next = !email.is_starred
    const { error } = await supabase
      .from("email_messages")
      .update({ is_starred: next })
      .eq("id", email.id)

    if (error) {
      toast.error("No se pudo actualizar")
      return
    }
    setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, is_starred: next } : e)))
    if (selected?.id === email.id) setSelected({ ...selected, is_starred: next })
  }

  const origenOptions = useMemo(() => Object.entries(ORIGEN_LABELS), [])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
      {/* Lista */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar por asunto, remitente o contenido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="inbound">Recibidos</SelectItem>
                <SelectItem value="outbound">Enviados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Cualquier estado</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Fallido</SelectItem>
                <SelectItem value="received">Recibido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={origen} onValueChange={setOrigen}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Cualquier origen</SelectItem>
                {origenOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="divide-y max-h-[560px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                No hay correos con estos filtros. Los enviados se registran automáticamente; los
                recibidos aparecen tras sincronizar por IMAP.
              </p>
            </div>
          ) : (
            emails.map((e) => {
              const active = selected?.id === e.id
              const unread = e.direction === "inbound" && !e.is_read
              return (
                <button
                  key={e.id}
                  onClick={() => openEmail(e)}
                  className={`w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors ${
                    active ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                  } ${unread ? "bg-blue-50/40" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      {e.direction === "inbound" ? (
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      ) : e.status === "failed" ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-blue-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm truncate ${unread ? "font-semibold text-gray-900" : "text-gray-700"}`}
                        >
                          {e.direction === "inbound"
                            ? e.from_name || e.from_email || "—"
                            : (e.to_emails || []).join(", ") || "—"}
                        </span>
                        {e.has_attachments && (
                          <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-sm truncate ${unread ? "font-medium text-gray-900" : "text-gray-600"}`}
                      >
                        {e.subject || "(sin asunto)"}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{e.snippet}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {e.status === "failed" && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Fallido
                          </Badge>
                        )}
                        {e.origen && e.origen !== "manual" && (
                          <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {ORIGEN_LABELS[e.origen] || e.origen}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {formatRelative(e.created_at)}
                      </span>
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation()
                          toggleStar(e)
                        }}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            e.is_starred ? "fill-amber-400 text-amber-400" : "text-gray-300"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Paginación */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50">
            <span className="text-xs text-gray-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detalle */}
      <Card className="overflow-hidden">
        {!selected ? (
          <div className="flex flex-col items-center justify-center text-center p-10 h-full min-h-[400px]">
            <MailOpen className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Seleccione un correo para leerlo.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-gray-900">{selected.subject || "(sin asunto)"}</h3>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewSource((v) => !v)}
                    title={viewSource ? "Ver formateado" : "Ver HTML original"}
                  >
                    {viewSource ? <Eye className="w-4 h-4" /> : <Code2 className="w-4 h-4" />}
                  </Button>
                  <button onClick={() => toggleStar(selected)} className="p-1.5">
                    <Star
                      className={`w-4 h-4 ${
                        selected.is_starred ? "fill-amber-400 text-amber-400" : "text-gray-300"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-600 space-y-0.5">
                <p>
                  <span className="text-gray-400">De:</span>{" "}
                  {selected.from_name ? `${selected.from_name} <${selected.from_email}>` : selected.from_email}
                </p>
                <p>
                  <span className="text-gray-400">Para:</span> {(selected.to_emails || []).join(", ")}
                </p>
                {(selected.cc_emails || []).length > 0 && (
                  <p>
                    <span className="text-gray-400">CC:</span> {selected.cc_emails.join(", ")}
                  </p>
                )}
                <p>
                  <span className="text-gray-400">Fecha:</span>{" "}
                  {formatDateTime(selected.received_at || selected.sent_at || selected.created_at)}
                </p>
                {selected.sent_by_name && (
                  <p>
                    <span className="text-gray-400">Enviado por:</span> {selected.sent_by_name}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {selected.direction === "inbound" ? "Recibido" : "Enviado"}
                </Badge>
                {selected.status === "failed" && (
                  <Badge variant="destructive" className="text-[10px]">Fallido</Badge>
                )}
                {selected.template && (
                  <Badge variant="secondary" className="text-[10px]">
                    Plantilla: {selected.template}
                  </Badge>
                )}
                {selected.origen && (
                  <Badge variant="secondary" className="text-[10px]">
                    {ORIGEN_LABELS[selected.origen] || selected.origen}
                  </Badge>
                )}
                {selected.folder && (
                  <Badge variant="secondary" className="text-[10px]">{selected.folder}</Badge>
                )}
              </div>

              {selected.status === "failed" && selected.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800">
                  {selected.error_message}
                </div>
              )}
            </div>

            {/* Adjuntos */}
            {attachments.length > 0 && (
              <div className="px-4 py-2 border-b bg-gray-50">
                <p className="text-xs text-gray-500 mb-1.5">
                  {attachments.length} adjunto(s)
                </p>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a) => (
                    <AttachmentChip key={a.id} attachment={a} />
                  ))}
                </div>
              </div>
            )}

            {/* Cuerpo */}
            <div className="flex-1 min-h-[320px] overflow-hidden">
              {viewSource ? (
                <pre className="p-4 text-[11px] font-mono whitespace-pre-wrap break-all overflow-auto max-h-[520px] text-gray-700">
                  {selected.body_html || selected.body_text || "(sin contenido)"}
                </pre>
              ) : selected.body_html ? (
                /*
                 * El HTML de un correo entrante es contenido NO CONFIABLE.
                 * Se renderiza en un iframe con sandbox vacío: sin scripts, sin
                 * formularios, sin acceso al DOM padre ni a las cookies.
                 */
                <iframe
                  title="Contenido del correo"
                  sandbox=""
                  srcDoc={selected.body_html}
                  className="w-full h-[520px] border-0 bg-white"
                />
              ) : (
                <pre className="p-4 text-sm whitespace-pre-wrap text-gray-700 overflow-auto max-h-[520px]">
                  {selected.body_text || "(sin contenido)"}
                </pre>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function AttachmentChip({ attachment }: { attachment: EmailAttachment }) {
  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    if (!attachment.storage_path) {
      toast.error("Este adjunto no se almacenó (excedía el tamaño máximo)")
      return
    }
    setDownloading(true)
    try {
      const res = await authFetch(`/api/email/attachment/${attachment.id}`)
      if (!res.ok) throw new Error("No se pudo descargar")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = attachment.filename || "adjunto"
      link.click()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      toast.error(error?.message || "Error descargando el adjunto")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={downloading}
      className="flex items-center gap-2 border rounded-lg px-2.5 py-1.5 bg-white hover:bg-gray-50 text-left max-w-[240px]"
    >
      {downloading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 shrink-0" />
      ) : (
        <Download className="w-3.5 h-3.5 text-blue-600 shrink-0" />
      )}
      <span className="min-w-0">
        <span className="block text-xs font-medium truncate">
          {attachment.filename || "adjunto"}
        </span>
        <span className="block text-[10px] text-gray-400">
          {formatBytes(attachment.size_bytes)}
          {attachment.is_inline ? " · inline" : ""}
        </span>
      </span>
    </button>
  )
}
