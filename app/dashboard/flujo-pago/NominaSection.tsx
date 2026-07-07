"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Trash2, Edit2, Settings } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { useRestrictedAccess } from "@/hooks/use-restricted-access"
import { useRealtime } from "@/hooks/use-realtime"
import { storage } from "@/lib/storage"
import { toast } from "sonner"


interface NominaRecord {
  id: number; mes_id: string; cedula: string; nombre: string
  telefono: string | null; email: string | null
  valor_sueldo: number; descuento: string | null; descuento_valor: number; descuento_motivo: string | null
  valor_a_pagar: number; categoria_principal: string; detalle: string | null
  primera_quincena_pagada: boolean; primera_quincena_valor: number | null
  primera_quincena_fecha: string | null; primera_quincena_metodo: string | null
  segunda_quincena_pagada: boolean; segunda_quincena_valor: number | null
  segunda_quincena_fecha: string | null; segunda_quincena_metodo: string | null
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
  const [showDetallesConfig, setShowDetallesConfig] = useState(false)
  const [editingRecord, setEditingRecord] = useState<NominaRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [detalles, setDetalles] = useState<string[]>([])
  const [newDetalle, setNewDetalle] = useState("")


  const [formData, setFormData] = useState({
    cedula: "", nombre: "", telefono: "", email: "",
    valor_sueldo: "", descuento: "", descuento_valor: "0", descuento_motivo: "",
    detalle: "",
    primera_quincena_pagada: false, primera_quincena_valor: "", primera_quincena_fecha: "", primera_quincena_metodo: "Banco",
    segunda_quincena_pagada: false, segunda_quincena_valor: "", segunda_quincena_fecha: "", segunda_quincena_metodo: "Banco",
  })

  // Valor a pagar calculado
  const valorSueldo = parseFloat(formData.valor_sueldo) || 0
  const descuentoValor = parseFloat(formData.descuento_valor) || 0
  const valorAPagar = Math.max(0, valorSueldo - descuentoValor)
  const quincenaAuto = (valorAPagar / 2).toFixed(2)

  // Auto-llenar quincenas cuando cambian sueldo o descuento
  const updateQuincenas = (newSueldo: string, newDescuento: string) => {
    const s = parseFloat(newSueldo) || 0
    const d = parseFloat(newDescuento) || 0
    const pagar = Math.max(0, s - d)
    const mitad = (pagar / 2).toFixed(2)
    setFormData(prev => ({ ...prev, valor_sueldo: newSueldo, descuento_valor: newDescuento, primera_quincena_valor: mitad, segunda_quincena_valor: mitad }))
  }

  useEffect(() => { if (currentMonth && hasAccess) { loadNomina(); loadDetalles() } }, [currentMonth, hasAccess])

  const loadNomina = async (silent = false) => {
    if (!currentMonth) return
    try {
      if (!silent) setLoading(true)
      const { data, error } = await supabase.from("nomina").select("*").eq("mes_id", currentMonth.id).order("nombre", { ascending: true })
      if (error) throw error
      setRecords(data || [])
    } catch (error) { console.error("Error cargando nómina:", error) }
    finally { if (!silent) setLoading(false) }
  }
  const loadDetalles = async () => { const { data } = await supabase.from("configuraciones_globales").select("nomina_detalles").eq("id", 1).single(); if (data?.nomina_detalles) setDetalles(data.nomina_detalles) }
  const saveDetalles = async (newList: string[]) => { setDetalles(newList); await supabase.from("configuraciones_globales").update({ nomina_detalles: newList }).eq("id", 1) }
  useRealtime({ table: "nomina", onChange: () => loadNomina(true) })

  const resetForm = () => setFormData({ cedula: "", nombre: "", telefono: "", email: "", valor_sueldo: "", descuento: "", descuento_valor: "0", descuento_motivo: "", detalle: "", primera_quincena_pagada: false, primera_quincena_valor: "", primera_quincena_fecha: "", primera_quincena_metodo: "Banco", segunda_quincena_pagada: false, segunda_quincena_valor: "", segunda_quincena_fecha: "", segunda_quincena_metodo: "Banco" })


  const registerEgreso = async (nombre: string, valor: number, fecha: string, metodo: string, quincena: string, detalle: string | null) => {
    if (!currentMonth) return
    try { await storage.addEgreso(currentMonth.id, { mes_id: currentMonth.id, ministerio: "Administración", categoria_principal: "Pago de nómina", detalle: detalle || "Nómina", observacion: `${quincena} de ${nombre} — ${metodo}`, monto: valor, fecha, metodo_pago: metodo, estado: "Procesado" }, { user_id: user!.id, user_name: user!.username }) } catch (e) { console.error("Error registrando egreso:", e) }
  }

  const sendPaymentNotification = async (nombre: string, telefono: string | null, email: string | null, valor: number, metodo: string, quincena: "primera" | "segunda") => {
    const label = quincena === "primera" ? "primera quincena" : "segunda quincena"
    const esBanco = metodo === "Banco"
    if (telefono) {
      const msg = esBanco ? [`💰 *Pago de Nómina — IRDD*`,``,`Hola *${nombre}*,`,``,`Tu *${label}* ha sido depositada.`,`💵 *Valor:* $${valor.toFixed(2)}`,`🏦 *Método:* Transferencia bancaria`,``,`Revisa tu cuenta bancaria. ¡Dios te bendiga! 🙏`,`— Administración`].join("\n") : [`💰 *Pago de Nómina — IRDD*`,``,`Hola *${nombre}*,`,``,`Tu *${label}* fue cancelada en efectivo.`,`💵 *Valor:* $${valor.toFixed(2)}`,``,`Queda registrado. ¡Dios te bendiga! 🙏`,`— Administración`].join("\n")
      fetch("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: telefono, message: msg }) }).catch(() => {})
    }
    if (email) {
      const contenido = esBanco ? `<p>Tu <strong>${label}</strong> ha sido depositada en tu cuenta bancaria. Revisa tu estado de cuenta.</p>` : `<p>Tu <strong>${label}</strong> fue cancelada en efectivo. Queda registrado.</p>`
      fetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: email, subject: `💰 Tu ${label} fue cancelada — IRDD`, html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:#059669;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;"><h2 style="margin:0;">💰 Pago de Nómina</h2></div><div style="background:white;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 12px 12px;"><p>Hola <strong>${nombre}</strong>,</p>${contenido}<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;"><p style="margin:0;font-size:12px;color:#6b7280;">VALOR</p><p style="font-size:24px;font-weight:700;color:#059669;margin:4px 0;">$${valor.toFixed(2)}</p><p style="margin:0;font-size:13px;color:#6b7280;">${quincena === "primera" ? "1ra" : "2da"} Quincena · ${metodo}</p></div><p style="color:#9ca3af;font-size:12px;text-align:center;">Administración — Iglesia Regalo de Dios</p></div></div>` }) }).catch(() => {})
    }
  }


  const handleAdd = async () => {
    if (!formData.cedula || !formData.nombre || !formData.valor_sueldo || !currentMonth) { toast.error("Complete los campos obligatorios"); return }
    setSaving(true)
    try {
      const vap = Math.max(0, (parseFloat(formData.valor_sueldo) || 0) - (parseFloat(formData.descuento_valor) || 0))
      const { error } = await supabase.from("nomina").insert({
        mes_id: currentMonth.id, cedula: formData.cedula, nombre: formData.nombre,
        telefono: formData.telefono || null, email: formData.email || null,
        valor_sueldo: parseFloat(formData.valor_sueldo), descuento: formData.descuento || null,
        descuento_valor: parseFloat(formData.descuento_valor) || 0, descuento_motivo: formData.descuento_motivo || null,
        valor_a_pagar: vap, categoria_principal: "Pago de nómina", detalle: formData.detalle || null,
        primera_quincena_pagada: formData.primera_quincena_pagada, primera_quincena_valor: formData.primera_quincena_pagada ? parseFloat(formData.primera_quincena_valor) || 0 : null,
        primera_quincena_fecha: formData.primera_quincena_fecha || null, primera_quincena_metodo: formData.primera_quincena_pagada ? formData.primera_quincena_metodo : null,
        segunda_quincena_pagada: formData.segunda_quincena_pagada, segunda_quincena_valor: formData.segunda_quincena_pagada ? parseFloat(formData.segunda_quincena_valor) || 0 : null,
        segunda_quincena_fecha: formData.segunda_quincena_fecha || null, segunda_quincena_metodo: formData.segunda_quincena_pagada ? formData.segunda_quincena_metodo : null,
      })
      if (error) throw error
      if (formData.primera_quincena_pagada) { const v = parseFloat(formData.primera_quincena_valor) || 0; await sendPaymentNotification(formData.nombre, formData.telefono, formData.email, v, formData.primera_quincena_metodo, "primera"); await registerEgreso(formData.nombre, v, formData.primera_quincena_fecha || new Date().toISOString().split("T")[0], formData.primera_quincena_metodo, "1ra quincena", formData.detalle) }
      if (formData.segunda_quincena_pagada) { const v = parseFloat(formData.segunda_quincena_valor) || 0; await sendPaymentNotification(formData.nombre, formData.telefono, formData.email, v, formData.segunda_quincena_metodo, "segunda"); await registerEgreso(formData.nombre, v, formData.segunda_quincena_fecha || new Date().toISOString().split("T")[0], formData.segunda_quincena_metodo, "2da quincena", formData.detalle) }
      toast.success("Registro agregado"); setShowAddModal(false); resetForm(); loadNomina(true)
    } catch (error) { console.error(error); toast.error("Error al guardar") } finally { setSaving(false) }
  }

  const handleEdit = (record: NominaRecord) => {
    setEditingRecord(record)
    setFormData({ cedula: record.cedula, nombre: record.nombre, telefono: record.telefono || "", email: record.email || "",
      valor_sueldo: (record.valor_sueldo || 0).toString(), descuento: record.descuento || "", descuento_valor: (record.descuento_valor || 0).toString(), descuento_motivo: record.descuento_motivo || "", detalle: record.detalle || "",
      primera_quincena_pagada: record.primera_quincena_pagada, primera_quincena_valor: record.primera_quincena_valor?.toString() || "", primera_quincena_fecha: record.primera_quincena_fecha || "", primera_quincena_metodo: record.primera_quincena_metodo || "Banco",
      segunda_quincena_pagada: record.segunda_quincena_pagada, segunda_quincena_valor: record.segunda_quincena_valor?.toString() || "", segunda_quincena_fecha: record.segunda_quincena_fecha || "", segunda_quincena_metodo: record.segunda_quincena_metodo || "Banco",
    })
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!editingRecord || !formData.cedula || !formData.nombre || !formData.valor_sueldo) { toast.error("Complete los campos obligatorios"); return }
    setSaving(true)
    try {
      const vap = Math.max(0, (parseFloat(formData.valor_sueldo) || 0) - (parseFloat(formData.descuento_valor) || 0))
      const { error } = await supabase.from("nomina").update({
        cedula: formData.cedula, nombre: formData.nombre, telefono: formData.telefono || null, email: formData.email || null,
        valor_sueldo: parseFloat(formData.valor_sueldo), descuento: formData.descuento || null,
        descuento_valor: parseFloat(formData.descuento_valor) || 0, descuento_motivo: formData.descuento_motivo || null,
        valor_a_pagar: vap, categoria_principal: "Pago de nómina", detalle: formData.detalle || null,
        primera_quincena_pagada: formData.primera_quincena_pagada, primera_quincena_valor: formData.primera_quincena_pagada ? parseFloat(formData.primera_quincena_valor) || 0 : null,
        primera_quincena_fecha: formData.primera_quincena_fecha || null, primera_quincena_metodo: formData.primera_quincena_pagada ? formData.primera_quincena_metodo : null,
        segunda_quincena_pagada: formData.segunda_quincena_pagada, segunda_quincena_valor: formData.segunda_quincena_pagada ? parseFloat(formData.segunda_quincena_valor) || 0 : null,
        segunda_quincena_fecha: formData.segunda_quincena_fecha || null, segunda_quincena_metodo: formData.segunda_quincena_pagada ? formData.segunda_quincena_metodo : null,
        updated_at: new Date().toISOString(),
      }).eq("id", editingRecord.id)
      if (error) throw error
      if (formData.primera_quincena_pagada && !editingRecord.primera_quincena_pagada) { const v = parseFloat(formData.primera_quincena_valor) || 0; await sendPaymentNotification(formData.nombre, formData.telefono, formData.email, v, formData.primera_quincena_metodo, "primera"); await registerEgreso(formData.nombre, v, formData.primera_quincena_fecha || new Date().toISOString().split("T")[0], formData.primera_quincena_metodo, "1ra quincena", formData.detalle) }
      if (formData.segunda_quincena_pagada && !editingRecord.segunda_quincena_pagada) { const v = parseFloat(formData.segunda_quincena_valor) || 0; await sendPaymentNotification(formData.nombre, formData.telefono, formData.email, v, formData.segunda_quincena_metodo, "segunda"); await registerEgreso(formData.nombre, v, formData.segunda_quincena_fecha || new Date().toISOString().split("T")[0], formData.segunda_quincena_metodo, "2da quincena", formData.detalle) }
      toast.success("Nómina actualizada"); setShowEditModal(false); setEditingRecord(null); resetForm(); loadNomina(true)
    } catch (error) { console.error(error); toast.error("Error al actualizar") } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => { if (!confirm("¿Eliminar este registro?")) return; try { await supabase.from("nomina").delete().eq("id", id); toast.success("Eliminado"); loadNomina(true) } catch { toast.error("Error") } }
  if (accessLoading || !hasAccess) return null


  const totalNomina = records.reduce((s, r) => s + Number(r.valor_a_pagar || 0), 0)
  const pendientes1ra = records.filter((r) => !r.primera_quincena_pagada)
  const pendientes2da = records.filter((r) => !r.segunda_quincena_pagada)

  const renderForm = () => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Cédula *</Label><Input value={formData.cedula} onChange={(e) => setFormData({ ...formData, cedula: e.target.value })} placeholder="1234567890" /></div>
        <div><Label>Nombre *</Label><Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Nombre completo" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Teléfono</Label><Input value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="0980000000" /></div>
        <div><Label>Correo</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="correo@ejemplo.com" /></div>
      </div>

      {/* Sueldo y descuento */}
      <div><Label>Valor del Sueldo *</Label><Input type="number" value={formData.valor_sueldo} onChange={(e) => updateQuincenas(e.target.value, formData.descuento_valor)} placeholder="0.00" /></div>

      <div className="border rounded-lg p-4 space-y-3 bg-red-50/50">
        <div><Label>Descuento</Label>
          <Select value={formData.descuento} onValueChange={(v) => setFormData({ ...formData, descuento: v })}>
            <SelectTrigger><SelectValue placeholder="Sin descuento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ninguno">Sin descuento</SelectItem>
              <SelectItem value="prestamo">Préstamo</SelectItem>
              <SelectItem value="multas">Multas</SelectItem>
              <SelectItem value="eventos">Eventos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {formData.descuento && formData.descuento !== "ninguno" && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Valor del descuento</Label><Input type="number" value={formData.descuento_valor} onChange={(e) => updateQuincenas(formData.valor_sueldo, e.target.value)} placeholder="0.00" /></div>
            <div><Label className="text-xs">Motivo</Label><Input value={formData.descuento_motivo} onChange={(e) => setFormData({ ...formData, descuento_motivo: e.target.value })} placeholder="Razón del descuento..." /></div>
          </div>
        )}
      </div>

      {/* Valor a pagar */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <Label className="text-green-700 font-medium">Valor a Pagar</Label>
          <span className="text-xl font-bold text-green-700">${valorAPagar.toFixed(2)}</span>
        </div>
        <p className="text-xs text-green-600 mt-1">Sueldo (${valorSueldo.toFixed(2)}) - Descuento (${descuentoValor.toFixed(2)}) = ${valorAPagar.toFixed(2)} → ${quincenaAuto}/quincena</p>
      </div>

      {/* Categoría y Detalle */}
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Categoría Principal</Label><Input value="Pago de nómina" disabled className="bg-gray-50" /></div>
        <div>
          <div className="flex items-center justify-between"><Label>Detalle</Label><Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowDetallesConfig(true)}><Settings className="h-3 w-3" /></Button></div>
          <Select value={formData.detalle} onValueChange={(v) => setFormData({ ...formData, detalle: v })}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{detalles.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent></Select>
        </div>
      </div>

      {/* Primera Quincena */}
      <div className="border rounded-lg p-4 space-y-3 bg-blue-50/50">
        <div className="flex items-center space-x-2">
          <Checkbox id="pq_pagada" checked={formData.primera_quincena_pagada} onCheckedChange={(c) => setFormData({ ...formData, primera_quincena_pagada: c as boolean })} />
          <Label htmlFor="pq_pagada" className="font-medium cursor-pointer">Primera Quincena Pagada</Label>
        </div>
        {formData.primera_quincena_pagada && (
          <div className="grid grid-cols-3 gap-3 ml-6">
            <div><Label className="text-xs">Valor pagado</Label><Input type="number" value={formData.primera_quincena_valor} onChange={(e) => setFormData({ ...formData, primera_quincena_valor: e.target.value })} placeholder="0.00" /></div>
            <div><Label className="text-xs">Fecha</Label><Input type="date" value={formData.primera_quincena_fecha} onChange={(e) => setFormData({ ...formData, primera_quincena_fecha: e.target.value })} /></div>
            <div><Label className="text-xs">Método</Label><select value={formData.primera_quincena_metodo} onChange={(e) => setFormData({ ...formData, primera_quincena_metodo: e.target.value })} className="w-full h-9 px-3 rounded-md border text-sm"><option value="Banco">Banco</option><option value="Efectivo">Efectivo</option></select></div>
          </div>
        )}
      </div>

      {/* Segunda Quincena */}
      <div className="border rounded-lg p-4 space-y-3 bg-green-50/50">
        <div className="flex items-center space-x-2">
          <Checkbox id="sq_pagada" checked={formData.segunda_quincena_pagada} onCheckedChange={(c) => setFormData({ ...formData, segunda_quincena_pagada: c as boolean })} />
          <Label htmlFor="sq_pagada" className="font-medium cursor-pointer">Segunda Quincena Pagada</Label>
        </div>
        {formData.segunda_quincena_pagada && (
          <div className="grid grid-cols-3 gap-3 ml-6">
            <div><Label className="text-xs">Valor pagado</Label><Input type="number" value={formData.segunda_quincena_valor} onChange={(e) => setFormData({ ...formData, segunda_quincena_valor: e.target.value })} placeholder="0.00" /></div>
            <div><Label className="text-xs">Fecha</Label><Input type="date" value={formData.segunda_quincena_fecha} onChange={(e) => setFormData({ ...formData, segunda_quincena_fecha: e.target.value })} /></div>
            <div><Label className="text-xs">Método</Label><select value={formData.segunda_quincena_metodo} onChange={(e) => setFormData({ ...formData, segunda_quincena_metodo: e.target.value })} className="w-full h-9 px-3 rounded-md border text-sm"><option value="Banco">Banco</option><option value="Efectivo">Efectivo</option></select></div>
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
            <div><CardTitle className="flex items-center gap-2"><span>💰</span> Nómina de Pago</CardTitle><CardDescription>Gestión de pagos — {currentMonth?.name}</CardDescription></div>
            <Button size="sm" onClick={() => { resetForm(); setShowAddModal(true) }}><Plus className="w-4 h-4 mr-1" /> Agregar</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100"><p className="text-xs text-amber-600">Total a Pagar</p><p className="text-lg font-bold text-amber-800">${totalNomina.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p></div>
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100"><p className="text-xs text-blue-600">Pendientes 1ra Q.</p><p className="text-lg font-bold text-blue-800">{pendientes1ra.length}</p></div>
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100"><p className="text-xs text-green-600">Pendientes 2da Q.</p><p className="text-lg font-bold text-green-800">{pendientes2da.length}</p></div>
          </div>
          {records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead><tr className="border-b bg-gray-50">
                  <th className="text-left p-2 font-medium">Nombre</th>
                  <th className="text-left p-2 font-medium">Detalle</th>
                  <th className="text-right p-2 font-medium">Sueldo</th>
                  <th className="text-right p-2 font-medium">Desc.</th>
                  <th className="text-right p-2 font-medium">A Pagar</th>
                  <th className="text-center p-2 font-medium">1ra Q.</th>
                  <th className="text-center p-2 font-medium">2da Q.</th>
                  <th className="text-center p-2 font-medium">Acc.</th>
                </tr></thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">
                        <div>{r.nombre}</div>
                        {r.descuento && r.descuento !== "ninguno" && <div className="text-[10px] text-red-500">{r.descuento}{r.descuento_motivo ? `: ${r.descuento_motivo}` : ""}</div>}
                      </td>
                      <td className="p-2 text-xs">{r.detalle || "-"}</td>
                      <td className="p-2 text-right">${Number(r.valor_sueldo || 0).toFixed(2)}</td>
                      <td className="p-2 text-right text-red-600">{(r.descuento_valor || 0) > 0 ? `-$${Number(r.descuento_valor).toFixed(2)}` : "-"}</td>
                      <td className="p-2 text-right font-medium text-green-700">${Number(r.valor_a_pagar || 0).toFixed(2)}</td>
                      <td className="p-2 text-center">{r.primera_quincena_pagada ? <Badge className="bg-green-100 text-green-800 text-xs">${(r.primera_quincena_valor || 0).toFixed(0)}</Badge> : <Badge variant="secondary" className="text-xs">Pend.</Badge>}</td>
                      <td className="p-2 text-center">{r.segunda_quincena_pagada ? <Badge className="bg-green-100 text-green-800 text-xs">${(r.segunda_quincena_valor || 0).toFixed(0)}</Badge> : <Badge variant="secondary" className="text-xs">Pend.</Badge>}</td>
                      <td className="p-2 text-center"><div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(r)}><Edit2 className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (<p className="text-center text-gray-500 py-8">No hay registros de nómina para este mes.</p>)}
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Agregar a Nómina</DialogTitle><DialogDescription>Registre un nuevo pago</DialogDescription></DialogHeader>{renderForm()}<DialogFooter><Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button><Button onClick={handleAdd} disabled={saving}>{saving ? "Guardando..." : "Agregar"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Editar Nómina</DialogTitle><DialogDescription>Modifique los datos</DialogDescription></DialogHeader>{renderForm()}<DialogFooter><Button variant="outline" onClick={() => { setShowEditModal(false); setEditingRecord(null) }}>Cancelar</Button><Button onClick={handleUpdate} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={showDetallesConfig} onOpenChange={setShowDetallesConfig}><DialogContent><DialogHeader><DialogTitle>Configurar Detalles</DialogTitle></DialogHeader><div className="space-y-3"><div className="flex gap-2"><Input value={newDetalle} onChange={(e) => setNewDetalle(e.target.value)} placeholder="Nuevo detalle..." /><Button size="sm" onClick={() => { if (newDetalle.trim() && !detalles.includes(newDetalle.trim())) { saveDetalles([...detalles, newDetalle.trim()]); setNewDetalle("") } }}><Plus className="w-4 h-4" /></Button></div><div className="space-y-1 max-h-48 overflow-y-auto">{detalles.map((d) => (<div key={d} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"><span>{d}</span><button onClick={() => saveDetalles(detalles.filter((x) => x !== d))} className="text-red-500 hover:text-red-700">×</button></div>))}{detalles.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay detalles</p>}</div></div><DialogFooter><Button onClick={() => setShowDetallesConfig(false)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}
