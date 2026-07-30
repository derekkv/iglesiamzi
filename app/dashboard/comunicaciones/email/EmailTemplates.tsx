"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Pencil, Eye, Loader2, RotateCcw, Download, FileText } from "lucide-react"
import type { EmailTemplate, EmailTemplateDefault } from "../types"
import { formatDateTime } from "../utils"

interface Row {
  slug: string
  nombre: string
  asunto: string
  categoria: string
  descripcion: string
  variables: string[]
  enBd: boolean
  is_active: boolean
  id?: string
  body_html?: string
  updated_at?: string | null
}

export function EmailTemplates({ canEdit }: { canEdit: boolean }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [defaults, setDefaults] = useState<EmailTemplateDefault[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState({ nombre: "", asunto: "", body_html: "", is_active: true })
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ slug: string; html: string; subject: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/email/templates")
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setTemplates((data.templates as EmailTemplate[]) || [])
      setDefaults((data.defaults as EmailTemplateDefault[]) || [])
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron cargar las plantillas")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Une el catálogo del código con lo guardado en BD. */
  const rows: Row[] = useMemo(() => {
    const byDb = new Map(templates.map((t) => [t.slug, t]))
    const merged: Row[] = defaults.map((d) => {
      const db = byDb.get(d.slug)
      return {
        slug: d.slug,
        nombre: db?.nombre || d.nombre,
        asunto: db?.asunto || d.asunto,
        categoria: db?.categoria || d.categoria,
        descripcion: db?.descripcion || d.descripcion,
        variables: db?.variables || d.variables,
        enBd: !!db,
        is_active: db ? db.is_active : true,
        id: db?.id,
        body_html: db?.body_html,
        updated_at: db?.updated_at,
      }
    })

    // Plantillas creadas solo en BD (sin equivalente en el código)
    for (const t of templates) {
      if (!merged.some((m) => m.slug === t.slug)) {
        merged.push({
          slug: t.slug,
          nombre: t.nombre,
          asunto: t.asunto,
          categoria: t.categoria || "General",
          descripcion: t.descripcion || "",
          variables: t.variables || [],
          enBd: true,
          is_active: t.is_active,
          id: t.id,
          body_html: t.body_html,
          updated_at: t.updated_at,
        })
      }
    }

    return merged.sort((a, b) => a.categoria.localeCompare(b.categoria, "es") || a.nombre.localeCompare(b.nombre, "es"))
  }, [templates, defaults])

  // -----------------------------------------------------------------------
  // Acciones
  // -----------------------------------------------------------------------

  const handlePreview = async (slug: string) => {
    setBusy(slug)
    try {
      const res = await authFetch(`/api/email/templates?preview=${encodeURIComponent(slug)}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setPreview({ slug, html: data.html, subject: data.subject })
    } catch (error: any) {
      toast.error(error?.message || "No se pudo previsualizar")
    } finally {
      setBusy(null)
    }
  }

  /** Copia la plantilla del código a la BD para poder editarla. */
  const handleImport = async (slug: string) => {
    setBusy(slug)
    try {
      const res = await authFetch("/api/email/templates", {
        method: "POST",
        body: JSON.stringify({ slug }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success("Plantilla importada: ya se puede editar")
      await load()
    } catch (error: any) {
      toast.error(error?.message || "No se pudo importar")
    } finally {
      setBusy(null)
    }
  }

  const handleRestore = async (slug: string) => {
    if (!confirm("¿Volver a la versión original del sistema? Se perderán los cambios guardados.")) return
    setBusy(slug)
    try {
      const res = await authFetch(`/api/email/templates?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success("Plantilla restaurada a la versión original")
      await load()
    } catch (error: any) {
      toast.error(error?.message || "No se pudo restaurar")
    } finally {
      setBusy(null)
    }
  }

  const openEdit = async (row: Row) => {
    // Si aún no está en BD, se trae el HTML renderizado como punto de partida
    let html = row.body_html || ""
    if (!html) {
      try {
        const res = await authFetch(`/api/email/templates?preview=${encodeURIComponent(row.slug)}`)
        const data = await res.json()
        if (data.success) html = data.html
      } catch {
        // Se abre vacío
      }
    }

    setEditing(row)
    setForm({
      nombre: row.nombre,
      asunto: row.asunto,
      body_html: html,
      is_active: row.is_active,
    })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      // Si no existía en BD, primero se importa para tener la fila
      if (!editing.enBd) {
        const imp = await authFetch("/api/email/templates", {
          method: "POST",
          body: JSON.stringify({ slug: editing.slug }),
        })
        const impData = await imp.json()
        if (!impData.success) throw new Error(impData.error)
      }

      const res = await authFetch("/api/email/templates", {
        method: "PUT",
        body: JSON.stringify({
          slug: editing.slug,
          nombre: form.nombre,
          asunto: form.asunto,
          body_html: form.body_html,
          is_active: form.is_active,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      toast.success("Plantilla guardada")
      setEditing(null)
      await load()
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Plantillas de correo</CardTitle>
          <CardDescription>
            Estas plantillas son las que usa el sistema para sus correos automáticos. Las
            marcadas como <strong>Original</strong> viven en el código; al editarlas se copian a la
            base de datos y desde ahí se pueden modificar sin tocar el código.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plantilla</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Asunto</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.slug}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.nombre}</div>
                        <div className="text-xs text-gray-400 font-mono">{r.slug}</div>
                        {r.descripcion && (
                          <div className="text-xs text-gray-500 max-w-[280px] mt-0.5">
                            {r.descripcion}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{r.categoria}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{r.asunto}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {r.variables.slice(0, 4).map((v) => (
                            <span
                              key={v}
                              className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono"
                            >
                              {v}
                            </span>
                          ))}
                          {r.variables.length > 4 && (
                            <span className="text-[10px] text-gray-400">
                              +{r.variables.length - 4}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.enBd ? (
                          <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px]">
                            Personalizada
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Original</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.is_active ? (
                          <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px]">
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Inactiva</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(r.slug)}
                            disabled={busy === r.slug}
                            title="Previsualizar"
                          >
                            {busy === r.slug ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(r)}
                            disabled={!canEdit}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {r.enBd && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(r.slug)}
                              disabled={!canEdit || busy === r.slug}
                              title="Restaurar la versión original"
                            >
                              <RotateCcw className="w-4 h-4 text-amber-600" />
                            </Button>
                          )}
                          {!r.enBd && canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleImport(r.slug)}
                              disabled={busy === r.slug}
                              title="Copiar a la base de datos para editarla"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Editar plantilla</DialogTitle>
            <DialogDescription className="font-mono text-xs">{editing?.slug}</DialogDescription>
          </DialogHeader>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Asunto</Label>
                <Input
                  value={form.asunto}
                  onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  Puede usar variables: {"{{nombre}}"}
                </p>
              </div>
              {editing && editing.variables.length > 0 && (
                <div className="grid gap-1">
                  <Label className="text-xs">Variables disponibles</Label>
                  <div className="flex flex-wrap gap-1">
                    {editing.variables.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`{{${v}}}`)
                          toast.success(`{{${v}}} copiado`)
                        }}
                        className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-mono"
                        title="Copiar"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Cuerpo HTML</Label>
                <Textarea
                  value={form.body_html}
                  onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                  rows={18}
                  className="font-mono text-[11px]"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v === true })}
                />
                Plantilla activa (si se desactiva, el sistema usa la versión original)
              </label>
            </div>

            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <div className="px-3 py-2 border-b bg-white text-xs text-gray-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Previsualización en vivo (sin variables sustituidas)
              </div>
              <iframe
                title="Previsualización de la plantilla"
                sandbox=""
                srcDoc={form.body_html}
                className="w-full h-[520px] border-0 bg-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Previsualización */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Previsualización</DialogTitle>
            <DialogDescription>{preview?.subject}</DialogDescription>
          </DialogHeader>
          <iframe
            title="Previsualización del correo"
            sandbox=""
            srcDoc={preview?.html || ""}
            className="w-full h-[560px] border rounded-lg bg-white"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
