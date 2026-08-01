"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/secure-db"
import { authFetch } from "@/lib/auth-fetch"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  Search, Send, Paperclip, X, Clock, Lock, FileText, Loader2,
  Download, MessageCircle, Zap,
} from "lucide-react"
import { formatPhoneDisplay } from "@/lib/format-phone"
import type { WaContact, WaMessage, WaQuickReply } from "../types"
import { ORIGEN_LABELS } from "../types"
import {
  contactName, isWindowOpen, windowRemaining, formatRelative,
  formatTime, dayLabel, statusMark, messagePreview,
} from "../utils"

const PAGE_SIZE = 60

export function WaInbox({
  contacts,
  quickReplies,
  canEdit,
  onContactsChange,
}: {
  contacts: WaContact[]
  quickReplies: WaQuickReply[]
  canEdit: boolean
  onContactsChange: () => void
}) {
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"todos" | "no_leidos" | "abiertos">("todos")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isNearBottom = useRef(true)   // ¿el usuario está cerca del fondo?
  const isInitialLoad = useRef(false) // primera carga del hilo — siempre scroll

  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedId) || null,
    [contacts, selectedId]
  )

  // -----------------------------------------------------------------------
  // Lista de conversaciones
  // -----------------------------------------------------------------------

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts
      .filter((c) => {
        // Ocultar contactos sin ningún mensaje
        if (!c.last_message_at && !c.last_message_preview) return false
        if (filter === "no_leidos" && (c.unread_count || 0) === 0) return false
        if (filter === "abiertos" && !isWindowOpen(c)) return false
        if (!q) return true
        return (
          contactName(c).toLowerCase().includes(q) ||
          c.wa_id.includes(q.replace(/\D/g, "")) ||
          (c.last_message_preview || "").toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return tb - ta
      })
  }, [contacts, search, filter])

  // -----------------------------------------------------------------------
  // Mensajes de la conversación abierta
  // -----------------------------------------------------------------------

  const loadMessages = useCallback(async (contactId: string, initial = false) => {
    if (initial) {
      isInitialLoad.current = true
      setLoadingMessages(true)
    }
    const { data, error } = await supabase
      .from("wa_messages")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE)

    if (initial) setLoadingMessages(false)

    if (error) {
      toast.error("No se pudo cargar la conversación")
      return
    }
    setMessages(((data as WaMessage[]) || []).slice().reverse())
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    loadMessages(selectedId, true)
  }, [selectedId, loadMessages])

  // Realtime del hilo abierto — solo recarga si hay cambios
  useRealtime({
    table: "wa_messages",
    enabled: !!selectedId,
    onChange: () => {
      if (selectedId) loadMessages(selectedId, false)
    },
  })

  // Scroll inteligente: al fondo siempre en carga inicial o si el usuario
  // ya estaba cerca del fondo. Nunca interrumpe si está leyendo arriba.
  useEffect(() => {
    if (messages.length === 0) return
    if (isInitialLoad.current) {
      // Primera carga: scroll instantáneo sin animación para evitar el efecto "sube"
      bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" })
      isInitialLoad.current = false
    } else if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [messages])

  // Marcar como leída al abrir
  const openConversation = async (contact: WaContact) => {
    setSelectedId(contact.id)
    setDraft("")
    setFile(null)
    isNearBottom.current = true // al abrir un chat siempre ir al fondo

    if ((contact.unread_count || 0) > 0) {
      const lastInbound = messages.filter((m) => m.direction === "inbound").at(-1)
      await authFetch("/api/whatsapp/read", {
        method: "POST",
        body: JSON.stringify({ contactId: contact.id, wamid: lastInbound?.wamid || undefined }),
      }).catch(() => {})
      onContactsChange()
    }
  }

  // Detectar posición de scroll para saber si el usuario está cerca del fondo
  const handleScroll = () => {
    const el = scrollAreaRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isNearBottom.current = distFromBottom < 120
  }

  // -----------------------------------------------------------------------
  // Envío
  // -----------------------------------------------------------------------

  const windowOpen = isWindowOpen(selected)

  const handleSend = async () => {
    if (!selected || !canEdit) return
    if (!draft.trim() && !file) return

    if (!windowOpen && !file) {
      toast.error(
        "La ventana de 24 horas está cerrada. Use una plantilla aprobada desde la sección Enviar."
      )
      return
    }

    setSending(true)
    try {
      if (file) {
        const form = new FormData()
        form.append("phone", selected.wa_id)
        form.append("file", file)
        if (draft.trim()) form.append("caption", draft.trim())
        form.append("origen", "manual")

        // authFetch pondría Content-Type: application/json y rompería el multipart
        const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
        const res = await fetch("/api/whatsapp/send-media", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || "No se pudo enviar el archivo")
        toast.success("Archivo enviado")
      } else {
        const res = await authFetch("/api/whatsapp/send", {
          method: "POST",
          body: JSON.stringify({
            phone: selected.wa_id,
            message: draft.trim(),
            origen: "manual",
            sentByName: user?.displayName,
          }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || "No se pudo enviar el mensaje")
        toast.success("Mensaje enviado")
      }

      setDraft("")
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      isNearBottom.current = true  // al enviar, siempre ir al fondo
      await loadMessages(selected.id)
      onContactsChange()
    } catch (error: any) {
      toast.error(error?.message || "Error enviando el mensaje")
    } finally {
      setSending(false)
    }
  }

  const applyQuickReply = (reply: WaQuickReply) => {
    setDraft((prev) => (prev ? `${prev}\n${reply.texto}` : reply.texto))
    setShowQuickReplies(false)
  }

  // Detecta "/atajo" al escribir
  useEffect(() => {
    const match = draft.match(/\/(\w*)$/)
    setShowQuickReplies(!!match && quickReplies.length > 0)
  }, [draft, quickReplies.length])

  const quickReplyMatches = useMemo(() => {
    const match = draft.match(/\/(\w*)$/)
    if (!match) return []
    const term = match[1].toLowerCase()
    return quickReplies.filter((r) => r.atajo.toLowerCase().includes(term)).slice(0, 6)
  }, [draft, quickReplies])

  const insertQuickReply = (reply: WaQuickReply) => {
    setDraft((prev) => prev.replace(/\/(\w*)$/, reply.texto))
    setShowQuickReplies(false)
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-320px)] min-h-[520px]">
      {/* Lista de conversaciones */}
      <div className="bg-white border rounded-xl flex flex-col overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar conversación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            {([
              { id: "todos", label: "Todas" },
              { id: "no_leidos", label: "No leídas" },
              { id: "abiertos", label: "Ventana abierta" },
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  filter === f.id
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              {contacts.filter(c => c.last_message_at).length === 0
                ? "Aún no hay conversaciones. Aparecerán aquí cuando alguien escriba o cuando envíe un mensaje."
                : "Ningún resultado con ese filtro."}
            </div>
          ) : (
            filtered.map((c) => {
              const active = c.id === selectedId
              const open = isWindowOpen(c)
              return (
                <button
                  key={c.id}
                  onClick={() => openConversation(c)}
                  className={`w-full text-left px-3 py-2.5 border-b hover:bg-gray-50 transition-colors ${
                    active ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {contactName(c)}
                        </span>
                        {open && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Ventana abierta" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {c.last_message_preview || formatPhoneDisplay(c.wa_id)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] text-gray-400">{formatRelative(c.last_message_at)}</span>
                      {(c.unread_count || 0) > 0 && (
                        <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] px-1.5 py-0">
                          {c.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Panel de chat */}
      <div className="bg-white border rounded-xl flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm max-w-sm">
              Seleccione una conversación para ver el historial y responder.
            </p>
          </div>
        ) : (
          <>
            {/* Cabecera del chat — compacta */}
            <div className="px-4 py-2.5 border-b flex items-center justify-between gap-3 bg-white">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate leading-tight">{contactName(selected)}</p>
                <p className="text-xs text-gray-400">{formatPhoneDisplay(selected.wa_id)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selected.blocked && <Badge variant="destructive" className="text-[10px] px-1.5">Bloqueado</Badge>}
                {!selected.opt_in  && <Badge variant="secondary"  className="text-[10px] px-1.5">Opt-out</Badge>}
                {windowOpen ? (
                  <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1 text-[10px] px-2">
                    <Clock className="w-2.5 h-2.5" />{windowRemaining(selected)}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-[10px] px-2">
                    <Lock className="w-2.5 h-2.5" />Cerrada
                  </Badge>
                )}
              </div>
            </div>

            {/* Mensajes */}
            <div
              ref={scrollAreaRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-3 bg-gray-50 space-y-1"
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">
                  Sin mensajes en esta conversación.
                </p>
              ) : (
                messages.map((msg, index) => {
                  const prev = messages[index - 1]
                  const showDay =
                    !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString()
                  return (
                    <div key={msg.id}>
                      {showDay && (
                        <div className="text-center my-3">
                          <span className="text-[11px] bg-white border text-gray-500 px-2.5 py-1 rounded-full">
                            {dayLabel(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <MessageBubble msg={msg} />
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="border-t p-3 space-y-2 relative">
              {!windowOpen && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-800 flex items-center gap-2">
                  <Lock className="w-3 h-3 shrink-0" />
                  Ventana cerrada — usa <strong className="mx-0.5">Enviar → Plantilla</strong> para escribir.
                </div>
              )}

              {file && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs text-blue-900 truncate flex-1">{file.name}</span>
                  <button
                    onClick={() => {
                      setFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Sugerencias de respuestas rápidas */}
              {showQuickReplies && quickReplyMatches.length > 0 && (
                <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border rounded-lg shadow-lg overflow-hidden z-10">
                  <div className="px-3 py-1.5 bg-gray-50 border-b text-[11px] text-gray-500 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Respuestas rápidas
                  </div>
                  {quickReplyMatches.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => insertQuickReply(r)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <span className="text-xs font-medium text-blue-600">/{r.atajo}</span>
                      <p className="text-xs text-gray-600 truncate">{r.texto}</p>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={!canEdit || sending}
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar archivo"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={
                    windowOpen
                      ? "Escriba un mensaje... (/ para respuestas rápidas)"
                      : "Solo se puede adjuntar archivos o enviar plantillas"
                  }
                  rows={2}
                  className="resize-none"
                  disabled={!canEdit || sending || selected.blocked}
                />
                <Button
                  className="shrink-0"
                  onClick={handleSend}
                  disabled={!canEdit || sending || (!draft.trim() && !file) || selected.blocked}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Burbuja de mensaje
// -------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: WaMessage }) {
  const outbound = msg.direction === "outbound"
  const mark = statusMark(msg.status)
  const isMedia = ["image", "video", "audio", "document", "sticker"].includes(msg.type)

  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
          outbound
            ? msg.status === "failed"
              ? "bg-red-50 border border-red-200"
              : "bg-blue-600 text-white"
            : "bg-white border"
        }`}
      >
        {msg.type === "template" && (
          <div
            className={`text-[10px] mb-1 flex items-center gap-1 ${
              outbound && msg.status !== "failed" ? "text-blue-100" : "text-gray-500"
            }`}
          >
            <FileText className="w-3 h-3" />
            Plantilla: {msg.template_name}
          </div>
        )}

        {isMedia && msg.media_id && (
          <MediaPreview msg={msg} outbound={outbound} />
        )}

        {isMedia && !msg.media_id && (
          <div
            className={`text-xs italic ${
              outbound && msg.status !== "failed" ? "text-blue-100" : "text-gray-500"
            }`}
          >
            {messagePreview(msg)}
          </div>
        )}

        {(msg.body || msg.caption) && (
          <p
            className={`text-sm whitespace-pre-wrap break-words ${
              outbound && msg.status !== "failed" ? "text-white" : "text-gray-900"
            }`}
          >
            {msg.body || msg.caption}
          </p>
        )}

        {msg.status === "failed" && msg.error_message && (
          <p className="text-[11px] text-red-700 mt-1.5 border-t border-red-200 pt-1.5">
            {msg.error_message}
          </p>
        )}

        <div
          className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
            outbound && msg.status !== "failed" ? "text-blue-100" : "text-gray-400"
          }`}
        >
          {msg.origen && msg.origen !== "manual" && (
            <span className="opacity-80">{ORIGEN_LABELS[msg.origen] || msg.origen}</span>
          )}
          <span>{formatTime(msg.created_at)}</span>
          {outbound && (
            <span
              className={msg.status === "failed" ? "text-red-600" : ""}
              title={mark.label}
            >
              {mark.icon}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Los archivos entrantes viven en el CDN de Meta y exigen el access_token, así
 * que se piden por el proxy autenticado /api/whatsapp/media/[id].
 */
function MediaPreview({ msg, outbound }: { msg: WaMessage; outbound: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!msg.media_id || url || loading) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/whatsapp/media/${msg.media_id}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      setUrl(URL.createObjectURL(blob))
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [msg.media_id, url, loading])

  // Las imágenes se cargan solas; el resto bajo demanda
  useEffect(() => {
    if (msg.type === "image" || msg.type === "sticker") load()
  }, [msg.type, load])

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  if (failed) {
    return (
      <p className={`text-xs italic ${outbound ? "text-blue-100" : "text-gray-500"}`}>
        No se pudo cargar el archivo (los archivos de Meta caducan a los 30 días).
      </p>
    )
  }

  if (msg.type === "image" || msg.type === "sticker") {
    return loading || !url ? (
      <div className="w-48 h-32 bg-black/10 rounded-lg flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin opacity-60" />
      </div>
    ) : (
      // max-h evita que una imagen vertical (como la tarjeta de cumpleaños,
      // 1280x1810) estire la burbuja a lo largo de toda la conversación.
      // Se ve completa al abrirla en una pestaña nueva.
      <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir la imagen completa">
        <img
          src={url}
          alt="Adjunto"
          className="max-w-full max-h-72 w-auto object-contain rounded-lg mb-1"
        />
      </a>
    )
  }

  if (msg.type === "audio") {
    return url ? (
      <audio controls src={url} className="max-w-full mb-1" />
    ) : (
      <Button size="sm" variant="secondary" onClick={load} disabled={loading} className="mb-1">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "🎤 Reproducir audio"}
      </Button>
    )
  }

  if (msg.type === "video") {
    return url ? (
      <video controls src={url} className="max-w-full max-h-72 rounded-lg mb-1" />
    ) : (
      <Button size="sm" variant="secondary" onClick={load} disabled={loading} className="mb-1">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "🎬 Cargar video"}
      </Button>
    )
  }

  // Documento
  return url ? (
    <a
      href={url}
      download={msg.media_filename || "documento"}
      className={`flex items-center gap-1.5 text-xs underline mb-1 ${
        outbound ? "text-blue-100" : "text-blue-600"
      }`}
    >
      <Download className="w-3 h-3" />
      {msg.media_filename || "Descargar documento"}
    </a>
  ) : (
    <Button size="sm" variant="secondary" onClick={load} disabled={loading} className="mb-1">
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : `📄 ${msg.media_filename || "Descargar"}`}
    </Button>
  )
}
