"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Trash2, Edit2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { useRestrictedAccess } from "@/hooks/use-restricted-access"
import { useRealtime } from "@/hooks/use-realtime"
import { toast } from "sonner"

interface NominaRecord {
  id: number
  mes_id: string
  cedula: string
  nombre: string
  valor: number
  primera_quincena_pagada: boolean
  primera_quincena_fecha: string | null
  primera_quincena_metodo: string | null
  segunda_quincena_pagada: boolean
  segunda_quincena_fecha: string | null
  segunda_quincena_metodo: string | null
  created_at: string
}

export function NominaSection() {
  const { hasAccess, loading: accessLoading } = useRestrictedAccess("nomina")
  const { currentMonth } = useMonth()
  const { user } = useAuth()

  const [records, setRecords] = useState<NominaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<NominaRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    cedula: "",
    nombre: "",
    valor: "",
    primera_quincena_pagada: false,
    primera_quincena_fecha: "",
    primera_quincena_metodo: "Efectivo",
    segunda_quincena_pagada: false,
    segunda_quincena_fecha: "",
    segunda_quincena_metodo: "Efectivo",
  })

  useEffect(() => {
    if (currentMonth && hasAccess) loadNomina()
  }, [currentMonth, hasAccess])

  const loadNomina = async (silent = false) => {
    if (!currentMonth) return
    try {
      if (!silent) setLoading(true)
      const { data, error } = await supabase
        .from("nomina")
        .select("*")
        .eq("mes_id", currentMonth.id)
        .order("nombre", { ascending: true })

      if (error) throw error
      setRecords(data || [])
    } catch (error) {
      console.error("Error cargando nómina:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useRealtime({ table: "nomina", onChange: () => loadNomina(true) })

  const resetForm = () => {
    setFormData({
      cedula: "",
      nombre: "",
      valor: "",
      primera_quincena_pagada: false,
      primera_quincena_fecha: "",
      primera_quincena_metodo: "Efectivo",
      segunda_quincena_pagada: false,
      segunda_quincena_fecha: "",
      segunda_quincena_metodo: "Efectivo",
    })
  }

  const handleAdd = async () => {
    if (!formData.cedula || !formData.nombre || !formData.valor || !currentMonth) {
      toast.error("Complete los campos obligatorios")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from("nomina").insert({
        mes_id: currentMonth.id,
        cedula: formData.cedula,
        nombre: formData.nombre,
        valor: parseFloat(formData.valor),
        primera_quincena_pagada: formData.primera_quincena_pagada,
        primera_quincena_fecha: formData.primera_quincena_fecha || null,
        primera_quincena_metodo: formData.primera_quincena_pagada ? formData.primera_quincena_metodo : null,
        segunda_quincena_pagada: formData.segunda_quincena_pagada,
        segunda_quincena_fecha: formData.segunda_quincena_fecha || null,
        segunda_quincena_metodo: formData.segunda_quincena_pagada ? formData.segunda_quincena_metodo : null,
      })
      if (error) throw error
      toast.success("Registro de nómina agregado")
      setShowAddModal(false)
      resetForm()
      loadNomina(true)
    } catch (error) {
      console.error(error)
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (record: NominaRecord) => {
    setEditingRecord(record)
    setFormData({
      cedula: record.cedula,
      nombre: record.nombre,
      valor: record.valor.toString(),
      primera_quincena_pagada: record.primera_quincena_pagada,
      primera_quincena_fecha: record.primera_quincena_fecha || "",
      primera_quincena_metodo: record.primera_quincena_metodo || "Efectivo",
      segunda_quincena_pagada: record.segunda_quincena_pagada,
      segunda_quincena_fecha: record.segunda_quincena_fecha || "",
      segunda_quincena_metodo: record.segunda_quincena_metodo || "Efectivo",
    })
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!editingRecord || !formData.cedula || !formData.nombre || !formData.valor) {
      toast.error("Complete los campos obligatorios")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from("nomina")
        .update({
          cedula: formData.cedula,
          nombre: formData.nombre,
          valor: parseFloat(formData.valor),
          primera_quincena_pagada: formData.primera_quincena_pagada,
          primera_quincena_fecha: formData.primera_quincena_fecha || null,
          primera_quincena_metodo: formData.primera_quincena_pagada ? formData.primera_quincena_metodo : null,
          segunda_quincena_pagada: formData.segunda_quincena_pagada,
          segunda_quincena_fecha: formData.segunda_quincena_fecha || null,
          segunda_quincena_metodo: formData.segunda_quincena_pagada ? formData.segunda_quincena_metodo : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingRecord.id)
      if (error) throw error
      toast.success("Nómina actualizada")
      setShowEditModal(false)
      setEditingRecord(null)
      resetForm()
      loadNomina(true)
    } catch (error) {
      console.error(error)
      toast.error("Error al actualizar")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este registro de nómina?")) return
    try {
      const { error } = await supabase.from("nomina").delete().eq("id", id)
      if (error) throw error
      toast.success("Registro eliminado")
      loadNomina(true)
    } catch (error) {
      toast.error("Error al eliminar")
    }
  }

  // No mostrar si no tiene acceso
  if (accessLoading) return null
  if (!hasAccess) return null

  const totalNomina = records.reduce((s, r) => s + Number(r.valor), 0)
  const pendientes1ra = records.filter((r) => !r.primera_quincena_pagada)
  const pendientes2da = records.filter((r) => !r.segunda_quincena_pagada)

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Cédula *</Label>
          <Input value={formData.cedula} onChange={(e) => setFormData({ ...formData, cedula: e.target.value })} placeholder="1234567890" />
        </div>
        <div>
          <Label>Nombre *</Label>
          <Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Nombre completo" />
        </div>
      </div>
      <div>
        <Label>Valor Total *</Label>
        <Input type="number" value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: e.target.value })} placeholder="0.00" />
      </div>

      {/* Primera Quincena */}
      <div className="border rounded-lg p-4 space-y-3 bg-blue-50/50">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="pq_pagada"
            checked={formData.primera_quincena_pagada}
            onCheckedChange={(c) => setFormData({ ...formData, primera_quincena_pagada: c as boolean })}
          />
          <Label htmlFor="pq_pagada" className="font-medium cursor-pointer">Primera Quincena Pagada</Label>
        </div>
        {formData.primera_quincena_pagada && (
          <div className="grid grid-cols-2 gap-3 ml-6">
            <div>
              <Label className="text-sm">Fecha de pago</Label>
              <Input type="date" value={formData.primera_quincena_fecha} onChange={(e) => setFormData({ ...formData, primera_quincena_fecha: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">Método</Label>
              <select
                value={formData.primera_quincena_metodo}
                onChange={(e) => setFormData({ ...formData, primera_quincena_metodo: e.target.value })}
                className="w-full h-9 px-3 rounded-md border text-sm"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Banco">Banco</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Segunda Quincena */}
      <div className="border rounded-lg p-4 space-y-3 bg-green-50/50">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="sq_pagada"
            checked={formData.segunda_quincena_pagada}
            onCheckedChange={(c) => setFormData({ ...formData, segunda_quincena_pagada: c as boolean })}
          />
          <Label htmlFor="sq_pagada" className="font-medium cursor-pointer">Segunda Quincena Pagada</Label>
        </div>
        {formData.segunda_quincena_pagada && (
          <div className="grid grid-cols-2 gap-3 ml-6">
            <div>
              <Label className="text-sm">Fecha de pago</Label>
              <Input type="date" value={formData.segunda_quincena_fecha} onChange={(e) => setFormData({ ...formData, segunda_quincena_fecha: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">Método</Label>
              <select
                value={formData.segunda_quincena_metodo}
                onChange={(e) => setFormData({ ...formData, segunda_quincena_metodo: e.target.value })}
                className="w-full h-9 px-3 rounded-md border text-sm"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Banco">Banco</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="mt-8">
      <Card className="border-amber-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>💰</span> Nómina de Pago
              </CardTitle>
              <CardDescription>Gestión de pagos de quincena — {currentMonth?.name}</CardDescription>
            </div>
            <Button size="sm" onClick={() => { resetForm(); setShowAddModal(true) }}>
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-amber-600">Total Nómina</p>
              <p className="text-lg font-bold text-amber-800">${totalNomina.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-600">Pendientes 1ra Q.</p>
              <p className="text-lg font-bold text-blue-800">{pendientes1ra.length}</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-green-600">Pendientes 2da Q.</p>
              <p className="text-lg font-bold text-green-800">{pendientes2da.length}</p>
            </div>
          </div>

          {/* Tabla */}
          {records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2 font-medium">Nombre</th>
                    <th className="text-left p-2 font-medium">Cédula</th>
                    <th className="text-right p-2 font-medium">Valor</th>
                    <th className="text-center p-2 font-medium">1ra Quincena</th>
                    <th className="text-center p-2 font-medium">2da Quincena</th>
                    <th className="text-center p-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{record.nombre}</td>
                      <td className="p-2">{record.cedula}</td>
                      <td className="p-2 text-right">${Number(record.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-center">
                        {record.primera_quincena_pagada ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            {record.primera_quincena_metodo} {record.primera_quincena_fecha ? `- ${new Date(record.primera_quincena_fecha).toLocaleDateString("es-CO")}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pendiente</Badge>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {record.segunda_quincena_pagada ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            {record.segunda_quincena_metodo} {record.segunda_quincena_fecha ? `- ${new Date(record.segunda_quincena_fecha).toLocaleDateString("es-CO")}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pendiente</Badge>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(record)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(record.id)}>
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay registros de nómina para este mes.</p>
          )}
        </CardContent>
      </Card>

      {/* Modal Agregar */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar a Nómina</DialogTitle>
            <DialogDescription>Registre un nuevo pago de nómina</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Guardando..." : "Agregar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Nómina</DialogTitle>
            <DialogDescription>Modifique los datos del pago</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingRecord(null) }}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
