"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Upload, X, FileText, Film, ImageIcon, Paperclip, StickyNote, Loader2,
  Pencil, Trash2, Check, MessageSquarePlus, ClipboardList, CheckCircle, XCircle, Package,
} from "lucide-react"
import { toast } from "sonner"
import {
  redilService, construirTimeline, ETAPAS_LABELS,
  type EtapaRedil, type AdjuntoRedil, type NotaRedil, type CasoCompleto, type TimelineEvento,
} from "@/lib/mod/redil-ayuda-social-service"

// ============================================================
// HELPERS
// ============================================================

/** Sube un archivo al bucket redil-archivos bajo caso-<id>/<etapa>. */
export async function uploadRedilFile(
  file: File,
  casoId: number,
  etapa: EtapaRedil
): Promise<{ url: string; path: string; name: string; size: number; type: string } | null> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
  if (!token) return null

  const formData = new FormData()
  formData.append("file", file)
  formData.append("folder", `caso-${casoId}/${etapa}`)

  try {
    const res = await fetch("/api/upload-file", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return { url: json.url, path: json.path, name: json.name, size: json.size, type: json.type }
  } catch (err: any) {
    toast.error(`Error subiendo ${file.name}: ${err.message}`)
    return null
  }
}

function getFileIcon(type: string | null) {
  if (type?.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />
  if (type?.startsWith("video/")) return <Film className="w-5 h-5 text-purple-500" />
  return <FileText className="w-5 h-5 text-orange-500" />
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "—"
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / 1048576).toFixed(1) + " MB"
}

function formatFecha(fecha: string): string {
  const d = new Date(fecha)
  return d.toLocaleString("es-EC", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

const MAX_SIZE = 50 * 1024 * 1024

// ============================================================
// PANEL: Adjuntos y Notas de una etapa
// ============================================================
export function AdjuntosNotasPanel({
  casoId, etapa, canEdit, userId, userName, adjuntos, notas, onChange, titulo,
}: {
  casoId: number
  etapa: EtapaRedil
  canEdit: boolean
  userId: string
  userName: string
  adjuntos: AdjuntoRedil[]
  notas: NotaRedil[]
  onChange: () => void
  titulo?: string
}) {
  const usuario = { id: userId, nombre: userName }

  // --- Notas ---
  const [nuevaNota, setNuevaNota] = useState("")
  const [savingNota, setSavingNota] = useState(false)
  const [editNotaId, setEditNotaId] = useState<number | null>(null)
  const [editNotaTexto, setEditNotaTexto] = useState("")

  const handleAgregarNota = async () => {
    if (!nuevaNota.trim()) return
    setSavingNota(true)
    try {
      await redilService.agregarNota(casoId, etapa, nuevaNota, usuario)
      setNuevaNota("")
      toast.success("Nota agregada")
      onChange()
    } catch (err: any) {
      toast.error("Error agregando nota: " + err.message)
    } finally {
      setSavingNota(false)
    }
  }

  const handleGuardarEdicionNota = async (id: number) => {
    if (!editNotaTexto.trim()) return
    try {
      await redilService.actualizarNota(id, editNotaTexto, usuario)
      setEditNotaId(null)
      setEditNotaTexto("")
      toast.success("Nota actualizada")
      onChange()
    } catch (err: any) {
      toast.error("Error editando nota: " + err.message)
    }
  }

  const handleEliminarNota = async (id: number) => {
    try {
      await redilService.eliminarNota(id, usuario)
      toast.success("Nota eliminada")
      onChange()
    } catch (err: any) {
      toast.error("Error eliminando nota: " + err.message)
    }
  }

  // --- Adjuntos ---
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [editAdjId, setEditAdjId] = useState<number | null>(null)
  const [editAdjDesc, setEditAdjDesc] = useState("")

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const files = Array.from(fileList)
    const invalid = files.filter((f) => f.size > MAX_SIZE)
    if (invalid.length > 0) toast.error(`${invalid.length} archivo(s) exceden 50MB y fueron descartados`)
    setPendingFiles((prev) => [...prev, ...files.filter((f) => f.size <= MAX_SIZE)])
  }

  const handleSubirPendientes = async () => {
    if (pendingFiles.length === 0) return
    setUploading(true)
    try {
      let ok = 0
      for (const file of pendingFiles) {
        const subido = await uploadRedilFile(file, casoId, etapa)
        if (subido) {
          await redilService.agregarAdjunto(casoId, etapa, subido, usuario)
          ok++
        }
      }
      setPendingFiles([])
      if (ok > 0) toast.success(`${ok} archivo(s) subido(s)`)
      onChange()
    } catch (err: any) {
      toast.error("Error subiendo archivos: " + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleGuardarDescripcion = async (id: number) => {
    try {
      await redilService.actualizarAdjunto(id, editAdjDesc, usuario)
      setEditAdjId(null)
      setEditAdjDesc("")
      toast.success("Descripción actualizada")
      onChange()
    } catch (err: any) {
      toast.error("Error: " + err.message)
    }
  }

  const handleEliminarAdjunto = async (id: number) => {
    try {
      await redilService.eliminarAdjunto(id, usuario)
      toast.success("Adjunto eliminado")
      onChange()
    } catch (err: any) {
      toast.error("Error eliminando adjunto: " + err.message)
    }
  }

  return (
    <div className="space-y-5 bg-gray-50/70 border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-gray-500" />
        <h4 className="font-semibold text-sm text-gray-700">{titulo || `Archivos y notas — ${ETAPAS_LABELS[etapa]}`}</h4>
      </div>

      {/* ---- NOTAS ---- */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5" />Notas ({notas.length})
        </Label>

        {notas.length === 0 && <p className="text-xs text-gray-400 italic">Aún no hay notas en esta etapa.</p>}

        <div className="space-y-2">
          {notas.map((nota) => (
            <div key={nota.id} className="bg-white border border-gray-200 rounded-lg p-3">
              {editNotaId === nota.id ? (
                <div className="space-y-2">
                  <Textarea value={editNotaTexto} onChange={(e) => setEditNotaTexto(e.target.value)} rows={3} className="text-sm" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditNotaId(null); setEditNotaTexto("") }}>Cancelar</Button>
                    <Button size="sm" onClick={() => handleGuardarEdicionNota(nota.id)} className="bg-amber-600 hover:bg-amber-700"><Check className="w-3.5 h-3.5 mr-1" />Guardar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{nota.contenido}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] text-gray-400">
                      {nota.usuario_nombre || "—"} · {formatFecha(nota.created_at)}{nota.editado && " · (editado)"}
                    </p>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-amber-600" onClick={() => { setEditNotaId(nota.id); setEditNotaTexto(nota.contenido) }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar esta nota?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleEliminarNota(nota.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Textarea value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} rows={2} placeholder="Escribe una nota de seguimiento..." className="text-sm flex-1" />
            <Button onClick={handleAgregarNota} disabled={savingNota || !nuevaNota.trim()} className="sm:self-end bg-amber-600 hover:bg-amber-700">
              {savingNota ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MessageSquarePlus className="w-4 h-4 mr-1" />Agregar</>}
            </Button>
          </div>
        )}
      </div>

      {/* ---- ADJUNTOS ---- */}
      <div className="space-y-3 pt-2 border-t border-gray-200">
        <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />Archivos ({adjuntos.length})
        </Label>

        {adjuntos.length === 0 && <p className="text-xs text-gray-400 italic">Aún no hay archivos en esta etapa.</p>}

        {adjuntos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {adjuntos.map((adj) => (
              <div key={adj.id} className="bg-white border border-gray-200 rounded-lg p-2.5">
                <div className="flex items-start gap-2.5">
                  {adj.type?.startsWith("image/") ? (
                    <a href={adj.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src={adj.url} alt={adj.name} className="w-12 h-12 rounded object-cover border" />
                    </a>
                  ) : (
                    <div className="shrink-0 mt-0.5">{getFileIcon(adj.type)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={adj.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium truncate block hover:underline">{adj.name}</a>
                    <p className="text-[11px] text-gray-400">{formatFileSize(adj.size)} · {adj.subido_por_nombre || "—"}</p>
                    {editAdjId === adj.id ? (
                      <div className="mt-1.5 space-y-1.5">
                        <Input value={editAdjDesc} onChange={(e) => setEditAdjDesc(e.target.value)} placeholder="Descripción" className="h-8 text-xs" />
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditAdjId(null); setEditAdjDesc("") }}>Cancelar</Button>
                          <Button size="sm" className="h-7 bg-blue-600 hover:bg-blue-700" onClick={() => handleGuardarDescripcion(adj.id)}><Check className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    ) : (
                      adj.descripcion && <p className="text-xs text-gray-600 mt-0.5 italic">{adj.descripcion}</p>
                    )}
                  </div>
                  {canEdit && editAdjId !== adj.id && (
                    <div className="flex flex-col gap-0.5">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600" onClick={() => { setEditAdjId(adj.id); setEditAdjDesc(adj.descripcion || "") }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle><AlertDialogDescription>Se quitará del caso. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleEliminarAdjunto(adj.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="space-y-2">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
              <Upload className="w-7 h-7 mx-auto text-gray-400 mb-1.5" />
              <p className="text-xs text-gray-500">Fotos, videos, PDFs, documentos — Máx 50MB</p>
              <Input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { handleAddFiles(e.target.files); e.currentTarget.value = "" }} className="mt-2 max-w-xs mx-auto text-xs" />
            </div>

            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border text-sm">
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{file.name}</p>
                      <p className="text-[11px] text-gray-400">{formatFileSize(file.size)}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}><X className="w-4 h-4" /></Button>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSubirPendientes} disabled={uploading} className="bg-blue-600 hover:bg-blue-700">
                    {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Subiendo...</> : <><Upload className="w-4 h-4 mr-1" />Subir {pendingFiles.length} archivo(s)</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// LÍNEA DE TIEMPO / HISTORIAL
// ============================================================

const ICON_MAP: Record<string, any> = {
  ClipboardList, CheckCircle, XCircle, Package, StickyNote, Paperclip,
}

const COLOR_MAP: Record<string, { dot: string; ring: string; text: string }> = {
  blue: { dot: "bg-blue-500", ring: "ring-blue-100", text: "text-blue-600" },
  green: { dot: "bg-green-500", ring: "ring-green-100", text: "text-green-600" },
  red: { dot: "bg-red-500", ring: "ring-red-100", text: "text-red-600" },
  emerald: { dot: "bg-emerald-500", ring: "ring-emerald-100", text: "text-emerald-600" },
  amber: { dot: "bg-amber-500", ring: "ring-amber-100", text: "text-amber-600" },
  slate: { dot: "bg-slate-500", ring: "ring-slate-100", text: "text-slate-600" },
}

export function TimelineCaso({ casoCompleto, notas, adjuntos }: {
  casoCompleto: CasoCompleto
  notas: NotaRedil[]
  adjuntos: AdjuntoRedil[]
}) {
  const eventos: TimelineEvento[] = construirTimeline(casoCompleto, notas, adjuntos)

  if (eventos.length === 0) {
    return <p className="text-center text-gray-500 py-8 text-sm">Sin actividad registrada todavía.</p>
  }

  return (
    <div className="relative pl-6">
      {/* Línea vertical */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200" />
      <div className="space-y-5">
        {eventos.map((ev) => {
          const Icon = ICON_MAP[ev.icon] || StickyNote
          const color = COLOR_MAP[ev.color] || COLOR_MAP.slate
          return (
            <div key={ev.id} className="relative">
              <div className={`absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full ${color.dot} ring-4 ${color.ring} flex items-center justify-center`}>
                <Icon className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-semibold ${color.text}`}>{ev.titulo}</p>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">{formatFecha(ev.fecha)}</span>
                </div>
                {ev.tipo === "adjunto" && ev.adjunto ? (
                  <a href={ev.adjunto.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-2 text-sm text-gray-700 hover:underline">
                    {getFileIcon(ev.adjunto.type)}
                    <span className="truncate">{ev.adjunto.descripcion || ev.adjunto.name}</span>
                  </a>
                ) : (
                  ev.descripcion && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{ev.descripcion}</p>
                )}
                {ev.usuario && <p className="text-[11px] text-gray-400 mt-1.5">{ev.usuario}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
