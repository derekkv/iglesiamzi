"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SmartDateInput } from "@/components/ui/smart-date-input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react"
import {
  eventosTabsService,
  type EventoTab,
} from "@/lib/mod/eventos-service"

interface GestionTabsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabs: EventoTab[]
  canEdit: boolean
  userId: string
  userName: string
  onTabsChanged: () => void
}


interface TabForm {
  nombre: string
  descripcion: string
  fecha_inicio: string
  fecha_fin: string
  valor_default: number
}

const emptyTabForm: TabForm = {
  nombre: "",
  descripcion: "",
  fecha_inicio: "",
  fecha_fin: "",
  valor_default: 0,
}

export function GestionTabsDialog({
  open,
  onOpenChange,
  tabs,
  canEdit,
  userId,
  userName,
  onTabsChanged,
}: GestionTabsDialogProps) {
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<TabForm>(emptyTabForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EventoTab | null>(null)

  const handleOpenCreate = () => {
    setForm(emptyTabForm)
    setIsEditing(false)
    setEditingId(null)
    setShowForm(true)
  }

  const handleOpenEdit = (tab: EventoTab) => {
    setForm({
      nombre: tab.nombre,
      descripcion: tab.descripcion || "",
      fecha_inicio: tab.fecha_inicio || "",
      fecha_fin: tab.fecha_fin || "",
      valor_default: tab.valor_default,
    })
    setIsEditing(true)
    setEditingId(tab.id)
    setShowForm(true)
  }


  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre del evento es requerido")
      return
    }
    setSaving(true)
    try {
      const audit = { userId, userName }
      const input = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        valor_default: form.valor_default,
        is_active: true,
        sort_order: isEditing ? undefined : tabs.length,
      }

      if (isEditing && editingId) {
        await eventosTabsService.update(editingId, input, audit)
        toast.success("Evento actualizado")
      } else {
        await eventosTabsService.create(input, audit)
        toast.success("Evento creado")
      }
      setShowForm(false)
      onTabsChanged()
    } catch (error: any) {
      toast.error(error.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (tab: EventoTab) => {
    setDeleteTarget(tab)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await eventosTabsService.delete(deleteTarget.id, { userId, userName, nombre: deleteTarget.nombre })
      toast.success(`Evento "${deleteTarget.nombre}" eliminado`)
      setDeleteTarget(null)
      onTabsChanged()
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar")
    }
  }

  const handleToggleActive = async (tab: EventoTab) => {
    try {
      await eventosTabsService.update(tab.id, { is_active: !tab.is_active }, { userId, userName })
      toast.success(tab.is_active ? "Evento ocultado" : "Evento activado")
      onTabsChanged()
    } catch (error: any) {
      toast.error(error.message || "Error al cambiar estado")
    }
  }


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestionar Eventos</DialogTitle>
            <DialogDescription>
              Crear, editar o eliminar tabs de eventos. Cada evento tiene su propia lista de participantes.
            </DialogDescription>
          </DialogHeader>

          {!showForm ? (
            <div className="py-4 space-y-3">
              {tabs.length === 0 ? (
                <p className="text-center text-gray-400 py-6">No hay eventos creados</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {tabs.map((tab) => (
                    <div
                      key={tab.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        tab.is_active ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-300" />
                        <div>
                          <p className="text-sm font-medium">
                            {tab.nombre}
                            {!tab.is_active && (
                              <span className="ml-2 text-xs text-gray-400">(oculto)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {tab.descripcion || "Sin descripción"}
                            {tab.valor_default > 0 && ` · $${tab.valor_default.toFixed(2)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(tab)}
                          disabled={!canEdit}
                          title={tab.is_active ? "Ocultar" : "Activar"}
                        >
                          <span className="text-xs">{tab.is_active ? "👁" : "👁‍🗨"}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(tab)}
                          disabled={!canEdit}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tab)}
                          disabled={!canEdit}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleOpenCreate}
                disabled={!canEdit}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" /> Crear Nuevo Evento
              </Button>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="grid gap-2">
                <Label>Nombre del Evento *</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Encuentro Marzo 2025"
                />
              </div>
              <div className="grid gap-2">
                <Label>Descripción</Label>
                <Input
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Descripción breve del evento..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Fecha Inicio</Label>
                  <SmartDateInput
                    value={form.fecha_inicio}
                    onChange={(v) => setForm({ ...form, fecha_inicio: v })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Fecha Fin</Label>
                  <SmartDateInput
                    value={form.fecha_fin}
                    onChange={(v) => setForm({ ...form, fecha_fin: v })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Valor por defecto ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_default || ""}
                  onChange={(e) => setForm({ ...form, valor_default: parseFloat(e.target.value) || 0 })}
                  placeholder="50.00"
                />
                <p className="text-xs text-gray-500">
                  Se usa al crear participantes o al importar desde otro evento.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                  Volver
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Evento"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Modal confirmar eliminación */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Evento</DialogTitle>
            <DialogDescription>
              ¿Está seguro de eliminar el evento <strong>&quot;{deleteTarget?.nombre}&quot;</strong>?
              <br /><br />
              <span className="text-red-600 font-medium">
                Esto eliminará TODOS los participantes asociados a este evento. Esta acción no se puede deshacer.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Sí, Eliminar Evento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
