"use client"

import { useMemo, useState } from "react"
import { supabase } from "@/lib/secure-db"
import { getAllUsers } from "@/lib/admin"
import { auditService } from "@/lib/mod/audit-service"
import { useAuth } from "@/contexts/auth-context"
import { formatPhoneForWhatsApp, formatPhoneDisplay } from "@/lib/format-phone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Search, Pencil, UserPlus, Download, Ban, Loader2, Tag as TagIcon, Trash2 } from "lucide-react"
import type { WaContact, WaTag } from "../types"
import { contactName, isWindowOpen, formatDateTime } from "../utils"

export function WaContacts({
  contacts,
  tags,
  canEdit,
  canAdmin,
  onChange,
  onTagsChange,
}: {
  contacts: WaContact[]
  tags: WaTag[]
  canEdit: boolean
  canAdmin?: boolean
  onChange: () => void
  onTagsChange: () => void
}) {
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [tagFilter, setTagFilter] = useState<string>("todos")
  const [editing, setEditing] = useState<WaContact | null>(null)
  const [form, setForm] = useState({
    display_name: "",
    ministerio: "",
    notes: "",
    tags: [] as string[],
    opt_in: true,
    blocked: false,
  })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [newContactOpen, setNewContactOpen] = useState(false)
  const [newContact, setNewContact] = useState({ phone: "", display_name: "" })
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [newTag, setNewTag] = useState({ nombre: "", color: "#2563eb" })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (tagFilter !== "todos" && !(c.tags || []).includes(tagFilter)) return false
      if (!q) return true
      return (
        contactName(c).toLowerCase().includes(q) ||
        c.wa_id.includes(q.replace(/\D/g, "")) ||
        (c.ministerio || "").toLowerCase().includes(q)
      )
    })
  }, [contacts, search, tagFilter])

  const openEdit = (contact: WaContact) => {
    setEditing(contact)
    setForm({
      display_name: contact.display_name || contact.profile_name || "",
      ministerio: contact.ministerio || "",
      notes: contact.notes || "",
      tags: contact.tags || [],
      opt_in: contact.opt_in,
      blocked: contact.blocked,
    })
  }

  const handleSave = async () => {
    if (!editing || !canEdit) return
    setSaving(true)

    const { error } = await supabase
      .from("wa_contacts")
      .update({
        display_name: form.display_name || null,
        ministerio: form.ministerio || null,
        notes: form.notes || null,
        tags: form.tags,
        opt_in: form.opt_in,
        opt_out_at: form.opt_in ? null : new Date().toISOString(),
        blocked: form.blocked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editing.id)

    setSaving(false)

    if (error) {
      toast.error(error.message || "No se pudo guardar el contacto")
      return
    }

    toast.success("Contacto actualizado")
    if (user) {
      auditService.log({
        user_id: user.id,
        user_name: user.username,
        module: "comunicaciones",
        action: "editar",
        description: `Contacto WhatsApp actualizado: ${form.display_name || editing.wa_id}`,
        details: { wa_id: editing.wa_id, cambios: form },
      })
    }
    setEditing(null)
    onChange()
  }

  const handleCreate = async () => {
    if (!canEdit) return
    const waId = formatPhoneForWhatsApp(newContact.phone)
    if (!waId || waId.length < 8) {
      toast.error("Número de teléfono inválido")
      return
    }

    setSaving(true)
    const { error } = await supabase.from("wa_contacts").insert({
      wa_id: waId,
      display_name: newContact.display_name || null,
    })
    setSaving(false)

    if (error) {
      toast.error(
        error.message?.includes("duplicate")
          ? "Ese número ya existe en los contactos"
          : error.message || "No se pudo crear el contacto"
      )
      return
    }

    toast.success("Contacto creado")
    setNewContactOpen(false)
    setNewContact({ phone: "", display_name: "" })
    onChange()
  }

  /** Crea contactos a partir de los usuarios activos del sistema que tengan teléfono. */
  const handleImportUsers = async () => {
    if (!canEdit) return
    setImporting(true)

    try {
      const result = await getAllUsers()
      if (!result.success) throw new Error(result.error || "No se pudo leer los usuarios")

      const existing = new Set(contacts.map((c) => c.wa_id))
      const rows = (result.users || [])
        .filter((u: any) => u.phone && u.is_active)
        .map((u: any) => ({
          wa_id: formatPhoneForWhatsApp(u.phone),
          display_name: u.displayName,
          user_id: u.id,
          ministerio: u.ministerio_name || null,
          tags: ["Servidor"],
        }))
        .filter((r) => r.wa_id.length >= 8 && !existing.has(r.wa_id))

      // Quitar duplicados dentro del propio lote
      const unique = Array.from(new Map(rows.map((r) => [r.wa_id, r])).values())

      if (unique.length === 0) {
        toast.info("Todos los usuarios con teléfono ya están en los contactos")
        return
      }

      const { error } = await supabase.from("wa_contacts").insert(unique)
      if (error) throw new Error(error.message)

      toast.success(`${unique.length} contacto(s) importado(s)`)
      onChange()
    } catch (error: any) {
      toast.error(error?.message || "Error importando usuarios")
    } finally {
      setImporting(false)
    }
  }

  const handleCreateTag = async () => {
    if (!newTag.nombre.trim()) return
    const { error } = await supabase.from("wa_tags").insert({
      nombre: newTag.nombre.trim(),
      color: newTag.color,
    })
    if (error) {
      toast.error(error.message?.includes("duplicate") ? "Esa etiqueta ya existe" : error.message)
      return
    }
    toast.success("Etiqueta creada")
    setNewTag({ nombre: "", color: "#2563eb" })
    onTagsChange()
  }

  const handleDeleteTag = async (tag: WaTag) => {
    if (!confirm(`¿Eliminar la etiqueta "${tag.nombre}"? No se borran los contactos.`)) return
    const { error } = await supabase.from("wa_tags").delete().eq("id", tag.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Etiqueta eliminada")
    onTagsChange()
  }

  const toggleTag = (nombre: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(nombre)
        ? prev.tags.filter((t) => t !== nombre)
        : [...prev.tags, nombre],
    }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Contactos de WhatsApp</CardTitle>
              <CardDescription>
                {contacts.length} contacto(s). Los contactos se crean solos cuando alguien escribe
                o cuando el sistema envía un mensaje.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTagDialogOpen(true)}>
                <TagIcon className="w-4 h-4 mr-2" />
                Etiquetas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportUsers}
                disabled={!canEdit || importing}
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Importar usuarios
              </Button>
              <Button size="sm" onClick={() => setNewContactOpen(true)} disabled={!canEdit}>
                <UserPlus className="w-4 h-4 mr-2" />
                Nuevo contacto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, número o ministerio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Etiqueta" />
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
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Etiquetas</TableHead>
                  <TableHead>Ventana 24 h</TableHead>
                  <TableHead>Último mensaje</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-gray-500 py-8">
                      Sin contactos que coincidan.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 300).map((c) => (
                    <TableRow key={c.id} className={c.blocked ? "bg-red-50/50" : ""}>
                      <TableCell>
                        <div className="font-medium text-sm">{contactName(c)}</div>
                        {c.ministerio && (
                          <div className="text-xs text-gray-500">{c.ministerio}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                        {formatPhoneDisplay(c.wa_id)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(c.tags || []).map((t) => {
                            const tag = tags.find((x) => x.nombre === t)
                            return (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.5 rounded text-white"
                                style={{ backgroundColor: tag?.color || "#64748b" }}
                              >
                                {t}
                              </span>
                            )
                          })}
                          {(c.tags || []).length === 0 && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isWindowOpen(c) ? (
                          <Badge className="bg-green-600 hover:bg-green-600 text-white">Abierta</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">Cerrada</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDateTime(c.last_message_at)}
                      </TableCell>
                      <TableCell>
                        {c.blocked ? (
                          <Badge variant="destructive">Bloqueado</Badge>
                        ) : !c.opt_in ? (
                          <Badge variant="secondary">Opt-out</Badge>
                        ) : (
                          <Badge className="bg-green-600 hover:bg-green-600 text-white">Activo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(c)}
                          disabled={!canEdit}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 300 && (
            <p className="text-xs text-gray-500 mt-3">
              Mostrando los primeros 300 de {filtered.length}. Refine la búsqueda.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Editar contacto */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar contacto</DialogTitle>
            <DialogDescription>
              {editing && formatPhoneDisplay(editing.wa_id)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Nombre del contacto"
              />
            </div>
            <div className="grid gap-2">
              <Label>Ministerio</Label>
              <Input
                value={form.ministerio}
                onChange={(e) => setForm({ ...form, ministerio: e.target.value })}
                placeholder="Ministerio o grupo"
              />
            </div>
            <div className="grid gap-2">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.nombre)}
                    className={`text-xs px-2 py-1 rounded border transition-all ${
                      form.tags.includes(t.nombre)
                        ? "text-white border-transparent"
                        : "text-gray-600 bg-white hover:bg-gray-50"
                    }`}
                    style={
                      form.tags.includes(t.nombre) ? { backgroundColor: t.color } : undefined
                    }
                  >
                    {t.nombre}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notas internas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Notas visibles solo para el equipo"
              />
            </div>
            <div className="space-y-2 pt-2 border-t">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.opt_in}
                  onCheckedChange={(v) => setForm({ ...form, opt_in: v === true })}
                />
                Acepta recibir mensajes (opt-in)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.blocked}
                  onCheckedChange={(v) => setForm({ ...form, blocked: v === true })}
                />
                <span className="flex items-center gap-1">
                  <Ban className="w-3.5 h-3.5 text-red-600" />
                  Bloquear: no se le enviará ningún mensaje
                </span>
              </label>
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

      {/* Nuevo contacto */}
      <Dialog open={newContactOpen} onOpenChange={setNewContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo contacto</DialogTitle>
            <DialogDescription>
              El número se normaliza automáticamente al formato internacional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Teléfono *</Label>
              <Input
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="0999999999"
              />
              {newContact.phone && (
                <p className="text-xs text-gray-500">
                  Se guardará como {formatPhoneDisplay(newContact.phone)}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input
                value={newContact.display_name}
                onChange={(e) => setNewContact({ ...newContact, display_name: e.target.value })}
                placeholder="Nombre del contacto"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewContactOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving || !newContact.phone}>
              {saving ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gestión de etiquetas */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Etiquetas del CRM</DialogTitle>
            <DialogDescription>
              Sirven para segmentar contactos y para los envíos masivos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tags.map((t) => (
                <div key={t.id} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-sm flex-1">{t.nombre}</span>
                  <span className="text-xs text-gray-400">
                    {contacts.filter((c) => (c.tags || []).includes(t.nombre)).length}
                  </span>
                  {canAdmin && (
                    <button
                      onClick={() => handleDeleteTag(t)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2 pt-2 border-t">
                <Input
                  placeholder="Nueva etiqueta"
                  value={newTag.nombre}
                  onChange={(e) => setNewTag({ ...newTag, nombre: e.target.value })}
                />
                <input
                  type="color"
                  value={newTag.color}
                  onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                  className="w-10 h-9 rounded border cursor-pointer"
                />
                <Button onClick={handleCreateTag} disabled={!newTag.nombre.trim()}>
                  Añadir
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
