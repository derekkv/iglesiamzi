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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Trash2, Edit2, Settings, History } from "lucide-react"
import { supabase } from "@/lib/secure-db"
import { useMonth } from "@/contexts/month-context"
import { authFetch } from "@/lib/auth-fetch"
import { useAuth } from "@/contexts/auth-context"
import { useRestrictedAccess } from "@/hooks/use-restricted-access"
import { useRealtime } from "@/hooks/use-realtime"
import { useSecurityCheck } from "@/contexts/security-context"
import { storage } from "@/lib/storage"
import { toast } from "sonner"
import { auditService } from "@/lib/mod/audit-service"



interface NominaRecord {
  id: number; mes_id: string; cedula: string; nombre: string
  telefono: string | null; email: string | null
  valor_sueldo: number; descuento: string | null; descuento_valor: number; descuento_motivo: string | null
  valor_a_pagar: number; categoria_principal: string; detalle: string | null
  primera_quincena_pagada: boolean; primera_quincena_valor: number | null
  primera_quincena_fecha: string | null; primera_quincena_metodo: string | null
  segunda_quincena_pagada: boolean; segunda_quincena_valor: number | null
  segunda_quincena_fecha: string | null; segunda_quincena_metodo: string | null
  // Movilización del mes
  movilizacion_con_quincenas: boolean
  movilizacion_pagada: boolean; movilizacion_valor: number | null
  movilizacion_fecha: string | null; movilizacion_metodo: string | null
  movilizacion_segunda_pagada: boolean; movilizacion_segunda_valor: number | null
  movilizacion_segunda_fecha: string | null; movilizacion_segunda_metodo: string | null
  created_at: string
}


export function NominaSection() {
  const { hasAccess, loading: accessLoading } = useRestrictedAccess("nomina")
  const { currentMonth, monthHistory } = useMonth()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()
  const [records, setRecords] = useState<NominaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetallesConfig, setShowDetallesConfig] = useState(false)
  const [editingRecord, setEditingRecord] = useState<NominaRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [detalles, setDetalles] = useState<string[]>([])
  const [newDetalle, setNewDetalle] = useState("")
  const [activeTab, setActiveTab] = useState<"actual" | "historial">("actual")
  const [historialMesId, setHistorialMesId] = useState<string>("")
  const [historialRecords, setHistorialRecords] = useState<NominaRecord[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteRecordId, setDeleteRecordId] = useState<number | null>(null)
  const hasSyncedRef = { current: false }

  const emptyForm = {
    cedula: "", nombre: "", telefono: "", email: "",
    valor_sueldo: "", descuento: "", descuento_valor: "0", descuento_motivo: "",
    detalle: "",
    primera_quincena_pagada: false, primera_quincena_valor: "", primera_quincena_fecha: "", primera_quincena_metodo: "Transferencia",
    segunda_quincena_pagada: false, segunda_quincena_valor: "", segunda_quincena_fecha: "", segunda_quincena_metodo: "Transferencia",
    // Movilización del mes
    movilizacion_con_quincenas: false,
    movilizacion_pagada: false, movilizacion_valor: "", movilizacion_fecha: "", movilizacion_metodo: "Transferencia",
    movilizacion_segunda_pagada: false, movilizacion_segunda_valor: "", movilizacion_segunda_fecha: "", movilizacion_segunda_metodo: "Transferencia",
  }

  const [formData, setFormData] = useState(emptyForm)


  // Valor a pagar calculado
  const valorSueldo = parseFloat(formData.valor_sueldo) || 0
  const descuentoValor = parseFloat(formData.descuento_valor) || 0
  const valorAPagar = Math.max(0, valorSueldo - descuentoValor)
  const quincenaAuto = (valorAPagar / 2).toFixed(2)

  // Auto-llenar quincenas y transporte cuando cambian sueldo o descuento
  const updateQuincenas = (newSueldo: string, newDescuento: string) => {
    const s = parseFloat(newSueldo) || 0
    const d = parseFloat(newDescuento) || 0
    const pagar = Math.max(0, s - d)
    const mitad = (pagar / 2).toFixed(2)
    setFormData(prev => {
      const transporteActivo = prev.movilizacion_valor !== "" || prev.movilizacion_pagada || prev.movilizacion_con_quincenas
      return {
        ...prev,
        valor_sueldo: newSueldo,
        descuento_valor: newDescuento,
        primera_quincena_valor: transporteActivo ? "" : mitad,
        segunda_quincena_valor: transporteActivo ? "" : mitad,
        movilizacion_valor: transporteActivo ? pagar.toFixed(2) : prev.movilizacion_valor,
      }
    })
  }

  useEffect(() => { if (currentMonth && hasAccess) { loadNomina(); loadDetalles() } }, [currentMonth, hasAccess])

  const loadNomina = async (silent = false) => {
    if (!currentMonth) return
    try {
      if (!silent) setLoading(true)
      const { data, error } = await supabase.from("nomina").select("*").eq("mes_id", currentMonth.id).order("nombre", { ascending: true })
      if (error) throw error
      if (data && data.length > 0) {
        setRecords(data)
        // Sincronizar egresos faltantes (solo una vez al montar)
        if (!silent && !hasSyncedRef.current) {
          hasSyncedRef.current = true
          syncEgresosFromNomina(data)
        }
      } else {
        setRecords([])
        if (!silent) await autoCopyFromPreviousMonth()
      }
    } catch (error) { console.error("Error cargando nómina:", error) }
    finally { if (!silent) setLoading(false) }
  }

  // Sincronizar egresos faltantes: si un pago está marcado pero no tiene egreso, crearlo
  const syncEgresosFromNomina = async (nominaData: NominaRecord[]) => {
    if (!currentMonth) return
    try {
      // Obtener todos los egresos de nómina del mes
      const { data: egresosExistentes } = await supabase.from("egresos").select("observacion").eq("mes_id", currentMonth.id).eq("categoria_principal", "PAGO DE NOMINA")
      const observaciones = new Set((egresosExistentes || []).map((e: any) => e.observacion?.toLowerCase() || ""))

      for (const r of nominaData) {
        const tieneTransporte = Number(r.movilizacion_valor || 0) > 0 && !r.movilizacion_con_quincenas

        // 1ra quincena (solo si no es transporte)
        if (r.primera_quincena_pagada && !tieneTransporte) {
          const obs = `1ra quincena de ${r.nombre} — ${r.primera_quincena_metodo || "Transferencia"}`.toLowerCase()
          if (!observaciones.has(obs)) {
            await storage.addEgreso(currentMonth.id, {
              mes_id: currentMonth.id, ministerio: "Administración", categoria_principal: "PAGO DE NOMINA",
              detalle: r.detalle || "Nómina", observacion: `1ra quincena de ${r.nombre} — ${r.primera_quincena_metodo || "Transferencia"}`,
              monto: r.primera_quincena_valor || 0, fecha: r.primera_quincena_fecha || new Date().toISOString().split("T")[0],
              metodo_pago: r.primera_quincena_metodo || "Transferencia", estado: "Procesado",
            }, { user_id: user!.id, user_name: user!.username })
          }
        }

        // 2da quincena (solo si no es transporte)
        if (r.segunda_quincena_pagada && !tieneTransporte) {
          const obs = `2da quincena de ${r.nombre} — ${r.segunda_quincena_metodo || "Transferencia"}`.toLowerCase()
          if (!observaciones.has(obs)) {
            await storage.addEgreso(currentMonth.id, {
              mes_id: currentMonth.id, ministerio: "Administración", categoria_principal: "PAGO DE NOMINA",
              detalle: r.detalle || "Nómina", observacion: `2da quincena de ${r.nombre} — ${r.segunda_quincena_metodo || "Transferencia"}`,
              monto: r.segunda_quincena_valor || 0, fecha: r.segunda_quincena_fecha || new Date().toISOString().split("T")[0],
              metodo_pago: r.segunda_quincena_metodo || "Transferencia", estado: "Procesado",
            }, { user_id: user!.id, user_name: user!.username })
          }
        }

        // Transporte
        if (r.movilizacion_pagada) {
          const label = r.movilizacion_con_quincenas ? "1ra quincena movilización" : "Transporte del mes"
          const obs = `${label} de ${r.nombre} — ${r.movilizacion_metodo || "Transferencia"}`.toLowerCase()
          const obsAlt = `movilización del mes de ${r.nombre}`.toLowerCase()
          if (!observaciones.has(obs) && !observaciones.has(obsAlt)) {
            await storage.addEgreso(currentMonth.id, {
              mes_id: currentMonth.id, ministerio: "Administración", categoria_principal: "PAGO DE NOMINA",
              detalle: r.detalle || "Nómina", observacion: `${label} de ${r.nombre} — ${r.movilizacion_metodo || "Transferencia"}`,
              monto: r.movilizacion_valor || 0, fecha: r.movilizacion_fecha || new Date().toISOString().split("T")[0],
              metodo_pago: r.movilizacion_metodo || "Transferencia", estado: "Procesado",
            }, { user_id: user!.id, user_name: user!.username })
          }
        }

        // 2da quincena movilización (legacy)
        if (r.movilizacion_con_quincenas && r.movilizacion_segunda_pagada) {
          const obs = `2da quincena movilización de ${r.nombre} — ${r.movilizacion_segunda_metodo || "Transferencia"}`.toLowerCase()
          if (!observaciones.has(obs)) {
            await storage.addEgreso(currentMonth.id, {
              mes_id: currentMonth.id, ministerio: "Administración", categoria_principal: "PAGO DE NOMINA",
              detalle: r.detalle || "Nómina", observacion: `2da quincena movilización de ${r.nombre} — ${r.movilizacion_segunda_metodo || "Transferencia"}`,
              monto: r.movilizacion_segunda_valor || 0, fecha: r.movilizacion_segunda_fecha || new Date().toISOString().split("T")[0],
              metodo_pago: r.movilizacion_segunda_metodo || "Transferencia", estado: "Procesado",
            }, { user_id: user!.id, user_name: user!.username })
          }
        }
      }
    } catch (e) { console.error("Error sincronizando egresos:", e) }
  }

  // Auto-copiar personas del mes anterior (sin pagos ni descuentos)
  const autoCopyFromPreviousMonth = async () => {
    if (!currentMonth) return
    try {
      const allMonths = [...monthHistory].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
      })

      let previousRecords: NominaRecord[] = []
      for (const m of allMonths) {
        if (m.id === currentMonth.id) continue
        const { data } = await supabase.from("nomina").select("*").eq("mes_id", m.id)
        if (data && data.length > 0) { previousRecords = data; break }
      }

      if (previousRecords.length === 0) return

      const inserts = previousRecords.map(r => ({
        mes_id: currentMonth.id,
        cedula: r.cedula,
        nombre: r.nombre,
        telefono: r.telefono,
        email: r.email,
        valor_sueldo: r.valor_sueldo,
        descuento: null,
        descuento_valor: 0,
        descuento_motivo: null,
        valor_a_pagar: r.valor_sueldo,
        categoria_principal: "PAGO DE NOMINA",
        detalle: r.detalle,
        primera_quincena_pagada: false, primera_quincena_valor: null, primera_quincena_fecha: null, primera_quincena_metodo: null,
        segunda_quincena_pagada: false, segunda_quincena_valor: null, segunda_quincena_fecha: null, segunda_quincena_metodo: null,
        movilizacion_con_quincenas: false, movilizacion_pagada: false, movilizacion_valor: null, movilizacion_fecha: null, movilizacion_metodo: null,
        movilizacion_segunda_pagada: false, movilizacion_segunda_valor: null, movilizacion_segunda_fecha: null, movilizacion_segunda_metodo: null,
      }))

      const { error, data: inserted } = await supabase.from("nomina").insert(inserts).select()
      if (error) throw error
      if (inserted) {
        setRecords(inserted)
        toast.info(`Se cargaron ${inserted.length} persona${inserted.length > 1 ? "s" : ""} del mes anterior`)
      }
    } catch (e) { console.error("Error auto-copiando:", e) }
  }

  const loadDetalles = async () => {
    const { data } = await supabase.from("configuraciones_globales").select("nomina_detalles").eq("id", 1).single()
    if (data?.nomina_detalles) setDetalles(data.nomina_detalles)
  }
  const saveDetalles = async (newList: string[]) => {
    setDetalles(newList)
    await supabase.from("configuraciones_globales").update({ nomina_detalles: newList }).eq("id", 1)
  }
  useRealtime({ table: "nomina", onChange: () => loadNomina(true) })

  const resetForm = () => setFormData(emptyForm)

  // Cargar historial de un mes específico
  const loadHistorial = async (mesId: string) => {
    if (!mesId) { setHistorialRecords([]); return }
    setLoadingHistorial(true)
    try {
      const { data, error } = await supabase.from("nomina").select("*").eq("mes_id", mesId).order("nombre", { ascending: true })
      if (error) throw error
      setHistorialRecords(data || [])
    } catch (e) { console.error(e) }
    finally { setLoadingHistorial(false) }
  }


  const registerEgreso = async (nombre: string, valor: number, fecha: string, metodo: string, quincena: string, detalle: string | null) => {
    if (!currentMonth) return
    try {
      await storage.addEgreso(currentMonth.id, {
        mes_id: currentMonth.id, ministerio: "Administración", categoria_principal: "PAGO DE NOMINA",
        detalle: detalle || "Nómina", observacion: `${quincena} de ${nombre} — ${metodo}`,
        monto: valor, fecha, metodo_pago: metodo, estado: "Procesado",
      }, { user_id: user!.id, user_name: user!.username })
    } catch (e) { console.error("Error registrando egreso:", e) }
  }

  // Notificación para quincenas de nómina
  const sendPaymentNotification = async (
    nombre: string, telefono: string | null, email: string | null,
    valor: number, metodo: string, quincena: "primera" | "segunda"
  ) => {
    const label = quincena === "primera" ? "primera quincena" : "segunda quincena"
    const esBanco = metodo === "Transferencia" || metodo === "Banco"
    if (telefono) {
      const msg = esBanco
        ? [`💰 *Pago de Nómina — IRDD*`, ``, `Hola *${nombre}*,`, ``, `Tu *${label}* ha sido depositada.`, `💵 *Valor:* $${valor.toFixed(2)}`, `🏦 *Método:* Transferencia bancaria`, ``, `Revisa tu cuenta bancaria. ¡Dios te bendiga! 🙏`, `— Administración`].join("\n")
        : [`💰 *Pago de Nómina — IRDD*`, ``, `Hola *${nombre}*,`, ``, `Tu *${label}* fue cancelada en efectivo.`, `💵 *Valor:* $${valor.toFixed(2)}`, ``, `Queda registrado. ¡Dios te bendiga! 🙏`, `— Administración`].join("\n")
      authFetch("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: telefono, message: msg }) }).catch(() => {})
    }
    if (email) {
      const contenido = esBanco
        ? `<p>Tu <strong>${label}</strong> ha sido depositada en tu cuenta bancaria. Revisa tu estado de cuenta.</p>`
        : `<p>Tu <strong>${label}</strong> fue cancelada en efectivo. Queda registrado.</p>`
      authFetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        to: email, subject: `💰 Tu ${label} fue cancelada — IRDD`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:#059669;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;"><h2 style="margin:0;">💰 Pago de Nómina</h2></div><div style="background:white;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 12px 12px;"><p>Hola <strong>${nombre}</strong>,</p>${contenido}<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;"><p style="margin:0;font-size:12px;color:#6b7280;">VALOR</p><p style="font-size:24px;font-weight:700;color:#059669;margin:4px 0;">$${valor.toFixed(2)}</p><p style="margin:0;font-size:13px;color:#6b7280;">${quincena === "primera" ? "1ra" : "2da"} Quincena · ${metodo}</p></div><p style="color:#9ca3af;font-size:12px;text-align:center;">Administración — Iglesia Regalo de Dios</p></div></div>`,
      }) }).catch(() => {})
    }
  }

  // Notificación para transporte/movilización del mes
  const sendMovilizacionNotification = async (
    nombre: string, telefono: string | null, email: string | null,
    valor: number, metodo: string, quincena: "primera" | "segunda", conQuincenas: boolean
  ) => {
    const label = conQuincenas
      ? (quincena === "primera" ? "1ra quincena de movilización" : "2da quincena de movilización")
      : "transporte del mes"
    const esBanco = metodo === "Transferencia" || metodo === "Banco"
    if (telefono) {
      const msg = esBanco
        ? [`*Transporte — IRDD*`, ``, `Hola *${nombre}*,`, ``, `Tu *${label}* ha sido depositada.`, `💵 *Valor:* $${valor.toFixed(2)}`, `🏦 *Método:* Transferencia bancaria`, ``, `Revisa tu cuenta bancaria. ¡Dios te bendiga! 🙏`, `— Administración`].join("\n")
        : [`*Transporte — IRDD*`, ``, `Hola *${nombre}*,`, ``, `Tu *${label}* fue cancelada en efectivo.`, `💵 *Valor:* $${valor.toFixed(2)}`, ``, `Queda registrado. ¡Dios te bendiga! 🙏`, `— Administración`].join("\n")
      authFetch("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: telefono, message: msg }) }).catch(() => {})
    }
    if (email) {
      const contenido = esBanco
        ? `<p>Tu <strong>${label}</strong> ha sido depositada en tu cuenta bancaria.</p>`
        : `<p>Tu <strong>${label}</strong> fue cancelada en efectivo. Queda registrado.</p>`
      authFetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        to: email, subject: `Tu ${label} fue cancelada — IRDD`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:#7c3aed;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;"><h2 style="margin:0;">Transporte del Mes</h2></div><div style="background:white;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 12px 12px;"><p>Hola <strong>${nombre}</strong>,</p>${contenido}<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;margin:16px 0;text-align:center;"><p style="margin:0;font-size:12px;color:#6b7280;">VALOR</p><p style="font-size:24px;font-weight:700;color:#7c3aed;margin:4px 0;">$${valor.toFixed(2)}</p><p style="margin:0;font-size:13px;color:#6b7280;">Transporte · ${metodo}</p></div><p style="color:#9ca3af;font-size:12px;text-align:center;">Administración — Iglesia Regalo de Dios</p></div></div>`,
      }) }).catch(() => {})
    }
  }


  const handleAdd = async () => {
    if (!formData.cedula || !formData.nombre || !formData.valor_sueldo || !currentMonth) { toast.error("Complete los campos obligatorios"); return }
    setSaving(true)
    try {
      const vap = Math.max(0, (parseFloat(formData.valor_sueldo) || 0) - (parseFloat(formData.descuento_valor) || 0))
      const esTransporte = formData.movilizacion_valor !== "" && !formData.movilizacion_con_quincenas
      const { error } = await supabase.from("nomina").insert({
        mes_id: currentMonth.id, cedula: formData.cedula, nombre: formData.nombre,
        telefono: formData.telefono || null, email: formData.email || null,
        valor_sueldo: parseFloat(formData.valor_sueldo), descuento: formData.descuento || null,
        descuento_valor: parseFloat(formData.descuento_valor) || 0, descuento_motivo: formData.descuento_motivo || null,
        valor_a_pagar: vap, categoria_principal: "PAGO DE NOMINA", detalle: formData.detalle || null,
        primera_quincena_pagada: esTransporte ? false : formData.primera_quincena_pagada,
        primera_quincena_valor: (!esTransporte && formData.primera_quincena_pagada) ? parseFloat(formData.primera_quincena_valor) || 0 : null,
        primera_quincena_fecha: (!esTransporte && formData.primera_quincena_pagada) ? formData.primera_quincena_fecha || null : null,
        primera_quincena_metodo: (!esTransporte && formData.primera_quincena_pagada) ? formData.primera_quincena_metodo : null,
        segunda_quincena_pagada: esTransporte ? false : formData.segunda_quincena_pagada,
        segunda_quincena_valor: (!esTransporte && formData.segunda_quincena_pagada) ? parseFloat(formData.segunda_quincena_valor) || 0 : null,
        segunda_quincena_fecha: (!esTransporte && formData.segunda_quincena_pagada) ? formData.segunda_quincena_fecha || null : null,
        segunda_quincena_metodo: (!esTransporte && formData.segunda_quincena_pagada) ? formData.segunda_quincena_metodo : null,
        // Movilización
        movilizacion_con_quincenas: formData.movilizacion_con_quincenas,
        movilizacion_pagada: formData.movilizacion_pagada,
        movilizacion_valor: formData.movilizacion_valor ? parseFloat(formData.movilizacion_valor) || 0 : null,
        movilizacion_fecha: formData.movilizacion_fecha || null,
        movilizacion_metodo: formData.movilizacion_pagada ? formData.movilizacion_metodo : null,
        movilizacion_segunda_pagada: formData.movilizacion_con_quincenas ? formData.movilizacion_segunda_pagada : false,
        movilizacion_segunda_valor: (formData.movilizacion_con_quincenas && formData.movilizacion_segunda_pagada) ? parseFloat(formData.movilizacion_segunda_valor) || 0 : null,
        movilizacion_segunda_fecha: formData.movilizacion_segunda_fecha || null,
        movilizacion_segunda_metodo: (formData.movilizacion_con_quincenas && formData.movilizacion_segunda_pagada) ? formData.movilizacion_segunda_metodo : null,
      })
      if (error) throw error
      if (formData.primera_quincena_pagada) {
        const v = parseFloat(formData.primera_quincena_valor) || 0
        await sendPaymentNotification(formData.nombre, formData.telefono, formData.email, v, formData.primera_quincena_metodo, "primera")
        await registerEgreso(formData.nombre, v, formData.primera_quincena_fecha || new Date().toISOString().split("T")[0], formData.primera_quincena_metodo, "1ra quincena", formData.detalle)
      }
      if (formData.segunda_quincena_pagada) {
        const v = parseFloat(formData.segunda_quincena_valor) || 0
        await sendPaymentNotification(formData.nombre, formData.telefono, formData.email, v, formData.segunda_quincena_metodo, "segunda")
        await registerEgreso(formData.nombre, v, formData.segunda_quincena_fecha || new Date().toISOString().split("T")[0], formData.segunda_quincena_metodo, "2da quincena", formData.detalle)
      }
      if (formData.movilizacion_pagada) {
        const v = parseFloat(formData.movilizacion_valor) || 0
        const label = formData.movilizacion_con_quincenas ? "1ra quincena movilización" : "Transporte del mes"
        await sendMovilizacionNotification(formData.nombre, formData.telefono, formData.email, v, formData.movilizacion_metodo, "primera", formData.movilizacion_con_quincenas)
        await registerEgreso(formData.nombre, v, formData.movilizacion_fecha || new Date().toISOString().split("T")[0], formData.movilizacion_metodo, label, formData.detalle)
      }
      if (formData.movilizacion_con_quincenas && formData.movilizacion_segunda_pagada) {
        const v = parseFloat(formData.movilizacion_segunda_valor) || 0
        await sendMovilizacionNotification(formData.nombre, formData.telefono, formData.email, v, formData.movilizacion_segunda_metodo, "segunda", true)
        await registerEgreso(formData.nombre, v, formData.movilizacion_segunda_fecha || new Date().toISOString().split("T")[0], formData.movilizacion_segunda_metodo, "2da quincena movilización", formData.detalle)
      }
      toast.success("Registro agregado"); setShowAddModal(false); resetForm(); loadNomina(true)
      auditService.log({ user_id: user!.id, user_name: user!.username, module: "flujo_pago", action: "crear", description: `Nómina: ${formData.nombre} - $${vap}`, details: { nombre: formData.nombre, cedula: formData.cedula, valor_a_pagar: vap, detalle: formData.detalle } })
    } catch (error) { console.error(error); toast.error("Error al guardar") } finally { setSaving(false) }
  }


  const handleEdit = (record: NominaRecord) => {
    setEditingRecord(record)
    setFormData({
      cedula: record.cedula, nombre: record.nombre, telefono: record.telefono || "", email: record.email || "",
      valor_sueldo: (record.valor_sueldo || 0).toString(), descuento: record.descuento || "",
      descuento_valor: (record.descuento_valor || 0).toString(), descuento_motivo: record.descuento_motivo || "",
      detalle: record.detalle || "",
      primera_quincena_pagada: record.primera_quincena_pagada,
      primera_quincena_valor: record.primera_quincena_valor?.toString() || "",
      primera_quincena_fecha: record.primera_quincena_fecha || "",
      primera_quincena_metodo: record.primera_quincena_metodo || "Transferencia",
      segunda_quincena_pagada: record.segunda_quincena_pagada,
      segunda_quincena_valor: record.segunda_quincena_valor?.toString() || "",
      segunda_quincena_fecha: record.segunda_quincena_fecha || "",
      segunda_quincena_metodo: record.segunda_quincena_metodo || "Transferencia",
      movilizacion_con_quincenas: record.movilizacion_con_quincenas ?? false,
      movilizacion_pagada: record.movilizacion_pagada ?? false,
      movilizacion_valor: record.movilizacion_valor?.toString() || "",
      movilizacion_fecha: record.movilizacion_fecha || "",
      movilizacion_metodo: record.movilizacion_metodo || "Transferencia",
      movilizacion_segunda_pagada: record.movilizacion_segunda_pagada ?? false,
      movilizacion_segunda_valor: record.movilizacion_segunda_valor?.toString() || "",
      movilizacion_segunda_fecha: record.movilizacion_segunda_fecha || "",
      movilizacion_segunda_metodo: record.movilizacion_segunda_metodo || "Transferencia",
    })
    setShowEditModal(true)
  }


  const handleUpdate = async () => {
    if (!editingRecord || !formData.cedula || !formData.nombre || !formData.valor_sueldo) { toast.error("Complete los campos obligatorios"); return }
    setSaving(true)
    try {
      const vap = Math.max(0, (parseFloat(formData.valor_sueldo) || 0) - (parseFloat(formData.descuento_valor) || 0))
      const esTransporte = formData.movilizacion_valor !== "" && !formData.movilizacion_con_quincenas
      const { error } = await supabase.from("nomina").update({
        cedula: formData.cedula, nombre: formData.nombre, telefono: formData.telefono || null, email: formData.email || null,
        valor_sueldo: parseFloat(formData.valor_sueldo), descuento: formData.descuento || null,
        descuento_valor: parseFloat(formData.descuento_valor) || 0, descuento_motivo: formData.descuento_motivo || null,
        valor_a_pagar: vap, categoria_principal: "PAGO DE NOMINA", detalle: formData.detalle || null,
        primera_quincena_pagada: esTransporte ? false : formData.primera_quincena_pagada,
        primera_quincena_valor: (!esTransporte && formData.primera_quincena_pagada) ? parseFloat(formData.primera_quincena_valor) || 0 : null,
        primera_quincena_fecha: (!esTransporte && formData.primera_quincena_pagada) ? formData.primera_quincena_fecha || null : null,
        primera_quincena_metodo: (!esTransporte && formData.primera_quincena_pagada) ? formData.primera_quincena_metodo : null,
        segunda_quincena_pagada: esTransporte ? false : formData.segunda_quincena_pagada,
        segunda_quincena_valor: (!esTransporte && formData.segunda_quincena_pagada) ? parseFloat(formData.segunda_quincena_valor) || 0 : null,
        segunda_quincena_fecha: (!esTransporte && formData.segunda_quincena_pagada) ? formData.segunda_quincena_fecha || null : null,
        segunda_quincena_metodo: (!esTransporte && formData.segunda_quincena_pagada) ? formData.segunda_quincena_metodo : null,
        // Movilización
        movilizacion_con_quincenas: formData.movilizacion_con_quincenas,
        movilizacion_pagada: formData.movilizacion_pagada,
        movilizacion_valor: formData.movilizacion_valor ? parseFloat(formData.movilizacion_valor) || 0 : null,
        movilizacion_fecha: formData.movilizacion_fecha || null,
        movilizacion_metodo: formData.movilizacion_pagada ? formData.movilizacion_metodo : null,
        movilizacion_segunda_pagada: formData.movilizacion_con_quincenas ? formData.movilizacion_segunda_pagada : false,
        movilizacion_segunda_valor: (formData.movilizacion_con_quincenas && formData.movilizacion_segunda_pagada) ? parseFloat(formData.movilizacion_segunda_valor) || 0 : null,
        movilizacion_segunda_fecha: formData.movilizacion_segunda_fecha || null,
        movilizacion_segunda_metodo: (formData.movilizacion_con_quincenas && formData.movilizacion_segunda_pagada) ? formData.movilizacion_segunda_metodo : null,
        updated_at: new Date().toISOString(),
      }).eq("id", editingRecord.id)
      if (error) throw error

      // --- Sync egresos: solo cuando CAMBIA el estado de pagado ---
      // Primera quincena: solo si no es transporte
      if (!esTransporte) {
        if (formData.primera_quincena_pagada && !editingRecord.primera_quincena_pagada) {
          // Marcó como pagada → crear egreso
          const v = parseFloat(formData.primera_quincena_valor) || 0
          await sendPaymentNotification(formData.nombre, formData.telefono, formData.email, v, formData.primera_quincena_metodo, "primera")
          await registerEgreso(formData.nombre, v, formData.primera_quincena_fecha || new Date().toISOString().split("T")[0], formData.primera_quincena_metodo, "1ra quincena", formData.detalle)
        } else if (!formData.primera_quincena_pagada && editingRecord.primera_quincena_pagada) {
          // Desmarcó pagada → eliminar egreso
          await supabase.from("egresos").delete().eq("mes_id", editingRecord.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%1ra quincena de ${editingRecord.nombre}%`)
        }
      }

      // Segunda quincena: solo si no es transporte
      if (!esTransporte) {
        if (formData.segunda_quincena_pagada && !editingRecord.segunda_quincena_pagada) {
          const v = parseFloat(formData.segunda_quincena_valor) || 0
          await sendPaymentNotification(formData.nombre, formData.telefono, formData.email, v, formData.segunda_quincena_metodo, "segunda")
          await registerEgreso(formData.nombre, v, formData.segunda_quincena_fecha || new Date().toISOString().split("T")[0], formData.segunda_quincena_metodo, "2da quincena", formData.detalle)
        } else if (!formData.segunda_quincena_pagada && editingRecord.segunda_quincena_pagada) {
          await supabase.from("egresos").delete().eq("mes_id", editingRecord.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%2da quincena de ${editingRecord.nombre}%`)
        }
      }

      // Si cambió a transporte y antes tenía quincenas pagadas → eliminar egresos de quincena
      const antesTeniaTransporte = Number(editingRecord.movilizacion_valor || 0) > 0 && !editingRecord.movilizacion_con_quincenas
      if (esTransporte && !antesTeniaTransporte) {
        if (editingRecord.primera_quincena_pagada) {
          await supabase.from("egresos").delete().eq("mes_id", editingRecord.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%1ra quincena de ${editingRecord.nombre}%`)
        }
        if (editingRecord.segunda_quincena_pagada) {
          await supabase.from("egresos").delete().eq("mes_id", editingRecord.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%2da quincena de ${editingRecord.nombre}%`)
        }
      }

      // Transporte: solo cuando cambia estado de pagado
      if (formData.movilizacion_pagada && !editingRecord.movilizacion_pagada) {
        // Marcó transporte como pagado → crear egreso
        const v = parseFloat(formData.movilizacion_valor) || 0
        const label = formData.movilizacion_con_quincenas ? "1ra quincena movilización" : "Transporte del mes"
        await sendMovilizacionNotification(formData.nombre, formData.telefono, formData.email, v, formData.movilizacion_metodo, "primera", formData.movilizacion_con_quincenas)
        await registerEgreso(formData.nombre, v, formData.movilizacion_fecha || new Date().toISOString().split("T")[0], formData.movilizacion_metodo, label, formData.detalle)
      } else if (!formData.movilizacion_pagada && editingRecord.movilizacion_pagada) {
        // Desmarcó transporte pagado → eliminar egreso
        await supabase.from("egresos").delete().eq("mes_id", editingRecord.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%Movilización del mes de ${editingRecord.nombre}%`)
        await supabase.from("egresos").delete().eq("mes_id", editingRecord.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%Transporte del mes de ${editingRecord.nombre}%`)
      }

      // Movilización 2da quincena (legacy)
      if (formData.movilizacion_con_quincenas && formData.movilizacion_segunda_pagada && !editingRecord.movilizacion_segunda_pagada) {
        const v = parseFloat(formData.movilizacion_segunda_valor) || 0
        await sendMovilizacionNotification(formData.nombre, formData.telefono, formData.email, v, formData.movilizacion_segunda_metodo, "segunda", true)
        await registerEgreso(formData.nombre, v, formData.movilizacion_segunda_fecha || new Date().toISOString().split("T")[0], formData.movilizacion_segunda_metodo, "2da quincena movilización", formData.detalle)
      } else if ((!formData.movilizacion_con_quincenas || !formData.movilizacion_segunda_pagada) && editingRecord.movilizacion_segunda_pagada) {
        await supabase.from("egresos").delete().eq("mes_id", editingRecord.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%2da quincena movilización de ${editingRecord.nombre}%`)
      }

      toast.success("Nómina actualizada"); setShowEditModal(false); setEditingRecord(null); resetForm(); loadNomina(true)
      auditService.log({ user_id: user!.id, user_name: user!.username, module: "flujo_pago", action: "editar", description: `Nómina editada: ${formData.nombre}`, details: { nombre: formData.nombre, cedula: formData.cedula, valor_a_pagar: vap } })
    } catch (error) { console.error(error); toast.error("Error al actualizar") } finally { setSaving(false) }
  }


  const handleDelete = async (id: number) => {
    try {
      const record = records.find(r => r.id === id)
      if (record) {
        if (record.primera_quincena_pagada) {
          await supabase.from("egresos").delete().eq("mes_id", record.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%1ra quincena de ${record.nombre}%`)
        }
        if (record.segunda_quincena_pagada) {
          await supabase.from("egresos").delete().eq("mes_id", record.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%2da quincena de ${record.nombre}%`)
        }
        if (record.movilizacion_pagada) {
          const movLabel = record.movilizacion_con_quincenas ? "1ra quincena movilización" : "Movilización del mes"
          await supabase.from("egresos").delete().eq("mes_id", record.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%${movLabel} de ${record.nombre}%`)
          if (!record.movilizacion_con_quincenas) {
            await supabase.from("egresos").delete().eq("mes_id", record.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%Transporte del mes de ${record.nombre}%`)
          }
        }
        if (record.movilizacion_segunda_pagada) {
          await supabase.from("egresos").delete().eq("mes_id", record.mes_id).eq("categoria_principal", "PAGO DE NOMINA").ilike("observacion", `%2da quincena movilización de ${record.nombre}%`)
        }
      }
      await supabase.from("nomina").delete().eq("id", id)
      toast.success("Eliminado")
      auditService.log({ user_id: user!.id, user_name: user!.username, module: "flujo_pago", action: "eliminar", description: `Nómina eliminada: ${record?.nombre}`, details: { id, nombre: record?.nombre, valor: record?.valor_a_pagar } })
      loadNomina(true)
    } catch { toast.error("Error") }
    finally { setDeleteDialogOpen(false); setDeleteRecordId(null) }
  }

  const handleDeleteClick = (record: NominaRecord) => {
    checkAndExecute(record.created_at, () => {
      setDeleteRecordId(record.id)
      setDeleteDialogOpen(true)
    })
  }

  const handleEditClick = (record: NominaRecord) => {
    checkAndExecute(record.created_at, () => {
      handleEdit(record)
    })
  }

  if (accessLoading || !hasAccess) return null


  // --- Resumen estadísticas ---
  const totalNomina = records.reduce((s, r) => s + Number(r.valor_a_pagar || 0), 0)
  const pendientes1ra = records.filter((r) => !r.primera_quincena_pagada)
  const pendientes2da = records.filter((r) => !r.segunda_quincena_pagada)
  const falta1ra = pendientes1ra.reduce((s, r) => s + (Number(r.valor_a_pagar || 0) / 2), 0)
  const falta2da = pendientes2da.reduce((s, r) => s + (Number(r.valor_a_pagar || 0) / 2), 0)
  const pagado1ra = records.filter(r => r.primera_quincena_pagada).reduce((s, r) => s + Number(r.primera_quincena_valor || 0), 0)
  const pagado2da = records.filter(r => r.segunda_quincena_pagada).reduce((s, r) => s + Number(r.segunda_quincena_valor || 0), 0)
  // Transporte
  const pagadoMov = records.reduce((s, r) => {
    let total = 0
    if (r.movilizacion_pagada) total += Number(r.movilizacion_valor || 0)
    if (r.movilizacion_segunda_pagada) total += Number(r.movilizacion_segunda_valor || 0)
    return s + total
  }, 0)
  const pendientesMov = records.filter(r => {
    const tieneTransporte = Number(r.movilizacion_valor || 0) > 0 || r.movilizacion_pagada
    if (!tieneTransporte) return false
    if (r.movilizacion_con_quincenas) return !r.movilizacion_pagada || !r.movilizacion_segunda_pagada
    return !r.movilizacion_pagada
  })


  const renderForm = () => {
    const transporteActivo = formData.movilizacion_valor !== "" || formData.movilizacion_pagada || formData.movilizacion_con_quincenas
    const isEditing = !!editingRecord
    return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Cédula *</Label><Input value={formData.cedula} onChange={(e) => setFormData({ ...formData, cedula: e.target.value })} placeholder="1234567890" /></div>
        <div><Label>Nombre *</Label><Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Nombre completo" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Teléfono</Label><Input value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="0980000000" /></div>
        <div><Label>Correo</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="correo@ejemplo.com" /></div>
      </div>

      <div><Label>Valor del Sueldo *</Label><Input type="number" value={formData.valor_sueldo} onChange={(e) => updateQuincenas(e.target.value, formData.descuento_valor)} placeholder="0.00" /></div>

      <div className="border rounded-lg p-4 space-y-3 bg-red-50/50">
        <div><Label>Descuento</Label>
          <Select value={formData.descuento} onValueChange={(v) => {
            if (v === "ninguno") {
              updateQuincenas(formData.valor_sueldo, "0")
              setFormData(prev => ({ ...prev, descuento: v, descuento_motivo: "" }))
            } else {
              setFormData({ ...formData, descuento: v })
            }
          }}>
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

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <Label className="text-green-700 font-medium">Valor a Pagar</Label>
          <span className="text-xl font-bold text-green-700">${valorAPagar.toFixed(2)}</span>
        </div>
        <p className="text-xs text-green-600 mt-1">Sueldo (${valorSueldo.toFixed(2)}) - Descuento (${descuentoValor.toFixed(2)}) = ${valorAPagar.toFixed(2)} → ${quincenaAuto}/quincena</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><Label>Categoría Principal</Label><Input value="PAGO DE NOMINA" disabled className="bg-gray-50" /></div>
        <div>
          <div className="flex items-center justify-between"><Label>Detalle</Label><Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowDetallesConfig(true)}><Settings className="h-3 w-3" /></Button></div>
          <Select value={formData.detalle} onValueChange={(v) => setFormData({ ...formData, detalle: v })}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{detalles.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent></Select>
        </div>
      </div>

      {/* Primera Quincena */}
      <div className={`border rounded-lg p-4 space-y-3 ${transporteActivo ? "bg-gray-100 opacity-60" : "bg-blue-50/50"}`}>
        <div className="flex items-center space-x-2">
          <Checkbox id="pq_pagada" disabled={transporteActivo} checked={formData.primera_quincena_pagada} onCheckedChange={(c) => {
            const checked = c as boolean
            const updates: any = { ...formData, primera_quincena_pagada: checked }
            if (checked && !formData.primera_quincena_valor) updates.primera_quincena_valor = (Math.max(0, (parseFloat(formData.valor_sueldo) || 0) - (parseFloat(formData.descuento_valor) || 0)) / 2).toFixed(2)
            setFormData(updates)
          }} />
          <Label htmlFor="pq_pagada" className={`font-medium cursor-pointer ${transporteActivo ? "text-gray-400" : ""}`}>Primera Quincena Pagada</Label>
          {transporteActivo && <span className="text-xs text-gray-400 ml-2">(deshabilitado por transporte)</span>}
        </div>
        {formData.primera_quincena_pagada && !transporteActivo && (
          <div className={`grid ${isEditing ? "grid-cols-3" : "grid-cols-2"} gap-3 ml-6`}>
            <div><Label className="text-xs">Valor pagado</Label><Input type="number" value={formData.primera_quincena_valor} onChange={(e) => setFormData({ ...formData, primera_quincena_valor: e.target.value })} placeholder="0.00" /></div>
            {isEditing && <div><Label className="text-xs">Fecha</Label><Input type="date" value={formData.primera_quincena_fecha} onChange={(e) => setFormData({ ...formData, primera_quincena_fecha: e.target.value })} /></div>}
            <div><Label className="text-xs">Método</Label><select value={formData.primera_quincena_metodo} onChange={(e) => setFormData({ ...formData, primera_quincena_metodo: e.target.value })} className="w-full h-9 px-3 rounded-md border text-sm"><option value="Transferencia">Transferencia</option><option value="Efectivo">Efectivo</option></select></div>
          </div>
        )}
      </div>

      {/* Segunda Quincena */}
      <div className={`border rounded-lg p-4 space-y-3 ${transporteActivo ? "bg-gray-100 opacity-60" : "bg-green-50/50"}`}>
        <div className="flex items-center space-x-2">
          <Checkbox id="sq_pagada" disabled={transporteActivo} checked={formData.segunda_quincena_pagada} onCheckedChange={(c) => {
            const checked = c as boolean
            const updates: any = { ...formData, segunda_quincena_pagada: checked }
            if (checked && !formData.segunda_quincena_valor) updates.segunda_quincena_valor = (Math.max(0, (parseFloat(formData.valor_sueldo) || 0) - (parseFloat(formData.descuento_valor) || 0)) / 2).toFixed(2)
            setFormData(updates)
          }} />
          <Label htmlFor="sq_pagada" className={`font-medium cursor-pointer ${transporteActivo ? "text-gray-400" : ""}`}>Segunda Quincena Pagada</Label>
          {transporteActivo && <span className="text-xs text-gray-400 ml-2">(deshabilitado por transporte)</span>}
        </div>
        {formData.segunda_quincena_pagada && !transporteActivo && (
          <div className={`grid ${isEditing ? "grid-cols-3" : "grid-cols-2"} gap-3 ml-6`}>
            <div><Label className="text-xs">Valor pagado</Label><Input type="number" value={formData.segunda_quincena_valor} onChange={(e) => setFormData({ ...formData, segunda_quincena_valor: e.target.value })} placeholder="0.00" /></div>
            {isEditing && <div><Label className="text-xs">Fecha</Label><Input type="date" value={formData.segunda_quincena_fecha} onChange={(e) => setFormData({ ...formData, segunda_quincena_fecha: e.target.value })} /></div>}
            <div><Label className="text-xs">Método</Label><select value={formData.segunda_quincena_metodo} onChange={(e) => setFormData({ ...formData, segunda_quincena_metodo: e.target.value })} className="w-full h-9 px-3 rounded-md border text-sm"><option value="Transferencia">Transferencia</option><option value="Efectivo">Efectivo</option></select></div>
          </div>
        )}
      </div>

      {/* Transporte (pago único mensual) */}
      <div className="border-2 border-purple-200 rounded-lg p-4 space-y-3 bg-purple-50/50">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="mov_activar"
            checked={formData.movilizacion_valor !== "" || formData.movilizacion_pagada || formData.movilizacion_con_quincenas}
            onCheckedChange={(c) => {
              const checked = c as boolean
              if (!checked) {
                setFormData({ ...formData, movilizacion_con_quincenas: false, movilizacion_pagada: false, movilizacion_valor: "", movilizacion_fecha: "", movilizacion_metodo: "Transferencia", movilizacion_segunda_pagada: false, movilizacion_segunda_valor: "", movilizacion_segunda_fecha: "", movilizacion_segunda_metodo: "Transferencia", primera_quincena_pagada: false, primera_quincena_valor: "", primera_quincena_fecha: "", segunda_quincena_pagada: false, segunda_quincena_valor: "", segunda_quincena_fecha: "" })
              } else {
                // Al activar transporte: valor = valor_a_pagar, desactivar quincenas
                const vap = Math.max(0, (parseFloat(formData.valor_sueldo) || 0) - (parseFloat(formData.descuento_valor) || 0))
                setFormData({ ...formData, movilizacion_con_quincenas: false, movilizacion_valor: vap.toFixed(2), primera_quincena_pagada: false, primera_quincena_valor: "", primera_quincena_fecha: "", segunda_quincena_pagada: false, segunda_quincena_valor: "", segunda_quincena_fecha: "" })
              }
            }}
          />
          <Label htmlFor="mov_activar" className="font-semibold cursor-pointer text-purple-700">Transporte (pago único mensual)</Label>
        </div>

        {(formData.movilizacion_valor !== "" || formData.movilizacion_pagada || formData.movilizacion_con_quincenas) && (
          <>
            <div className="flex items-center space-x-2 ml-6">
              <Checkbox
                id="mov_pagada"
                checked={formData.movilizacion_pagada}
                onCheckedChange={(c) => setFormData({ ...formData, movilizacion_pagada: c as boolean })}
              />
              <Label htmlFor="mov_pagada" className="font-medium cursor-pointer text-purple-800">Pagado</Label>
            </div>
            <div className={`grid ${isEditing ? "grid-cols-3" : "grid-cols-2"} gap-3 ml-6`}>
              <div><Label className="text-xs">Valor</Label><Input type="number" value={formData.movilizacion_valor} onChange={(e) => setFormData({ ...formData, movilizacion_valor: e.target.value })} placeholder="0.00" /></div>
              {isEditing && <div><Label className="text-xs">Fecha</Label><Input type="date" value={formData.movilizacion_fecha} onChange={(e) => setFormData({ ...formData, movilizacion_fecha: e.target.value })} /></div>}
              <div><Label className="text-xs">Método</Label><select value={formData.movilizacion_metodo} onChange={(e) => setFormData({ ...formData, movilizacion_metodo: e.target.value })} className="w-full h-9 px-3 rounded-md border text-sm"><option value="Transferencia">Transferencia</option><option value="Efectivo">Efectivo</option></select></div>
            </div>
          </>
        )}

        {/* Legacy: si el registro existente tenía movilización con quincenas, mostrar la 2da */}
        {formData.movilizacion_con_quincenas && (
          <div className="border-t border-purple-200 pt-3 mt-3">
            <p className="text-xs text-purple-500 mb-2">Registro legacy (2da quincena movilización)</p>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mov_segunda_pagada"
                checked={formData.movilizacion_segunda_pagada}
                onCheckedChange={(c) => setFormData({ ...formData, movilizacion_segunda_pagada: c as boolean })}
              />
              <Label htmlFor="mov_segunda_pagada" className="font-medium cursor-pointer text-purple-800">2da Quincena Pagada</Label>
            </div>
            {formData.movilizacion_segunda_pagada && (
              <div className="grid grid-cols-3 gap-3 ml-6 mt-2">
                <div><Label className="text-xs">Valor</Label><Input type="number" value={formData.movilizacion_segunda_valor} onChange={(e) => setFormData({ ...formData, movilizacion_segunda_valor: e.target.value })} placeholder="0.00" /></div>
                <div><Label className="text-xs">Fecha</Label><Input type="date" value={formData.movilizacion_segunda_fecha} onChange={(e) => setFormData({ ...formData, movilizacion_segunda_fecha: e.target.value })} /></div>
                <div><Label className="text-xs">Método</Label><select value={formData.movilizacion_segunda_metodo} onChange={(e) => setFormData({ ...formData, movilizacion_segunda_metodo: e.target.value })} className="w-full h-9 px-3 rounded-md border text-sm"><option value="Transferencia">Transferencia</option><option value="Efectivo">Efectivo</option></select></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )}


  return (
    <div className="mt-8">
      <Card className="border-amber-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><span>💰</span> Nómina de Pago</CardTitle>
              <CardDescription>Gestión de pagos — {currentMonth?.name}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { resetForm(); setShowAddModal(true) }}><Plus className="w-4 h-4 mr-1" /> Agregar</Button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-2 mt-3 border-b">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "actual" ? "border-amber-500 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("actual")}
            >
              Mes Actual
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "historial" ? "border-amber-500 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("historial")}
            >
              <History className="w-3 h-3 inline mr-1" /> Historial
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "actual" ? (
            <>
              {/* Tarjetas de resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
                <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-xs text-amber-600">Total a Pagar</p>
                  <p className="text-lg font-bold text-amber-800">${totalNomina.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-xs text-green-600">Pagado 1ra Q.</p>
                  <p className="text-lg font-bold text-green-800">${pagado1ra.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-700">Falta 1ra Q.</p>
                  <p className="text-lg font-bold text-amber-700">${falta1ra.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-amber-500">{pendientes1ra.length} pendiente{pendientes1ra.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-xs text-green-600">Pagado 2da Q.</p>
                  <p className="text-lg font-bold text-green-800">${pagado2da.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-700">Falta 2da Q.</p>
                  <p className="text-lg font-bold text-amber-700">${falta2da.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-amber-500">{pendientes2da.length} pendiente{pendientes2da.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-700">Transporte</p>
                  <p className="text-lg font-bold text-purple-800">${pagadoMov.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-purple-500">{pendientesMov.length} pendiente{pendientesMov.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Tabla de registros */}
              {records.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 font-medium">Nombre</th>
                        <th className="text-left p-2 font-medium">Detalle</th>
                        <th className="text-right p-2 font-medium">Sueldo</th>
                        <th className="text-right p-2 font-medium">Desc.</th>
                        <th className="text-right p-2 font-medium">A Pagar</th>
                        <th className="text-center p-2 font-medium">1ra Q.</th>
                        <th className="text-center p-2 font-medium">2da Q.</th>
                        <th className="text-center p-2 font-medium">Transporte</th>
                        <th className="text-center p-2 font-medium">Acc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => {
                        const tieneTransporte = r.movilizacion_pagada || (r.movilizacion_valor && Number(r.movilizacion_valor) > 0)
                        const movTotalPagado = Number(r.movilizacion_valor || 0) + Number(r.movilizacion_segunda_valor || 0)
                        const movCompleta = r.movilizacion_con_quincenas
                          ? (r.movilizacion_pagada && r.movilizacion_segunda_pagada)
                          : r.movilizacion_pagada
                        const movParcial = r.movilizacion_pagada && r.movilizacion_con_quincenas && !r.movilizacion_segunda_pagada
                        return (
                          <tr key={r.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-medium">
                              <div>{r.nombre}</div>
                              {r.descuento && r.descuento !== "ninguno" && <div className="text-[10px] text-red-500">{r.descuento}{r.descuento_motivo ? `: ${r.descuento_motivo}` : ""}</div>}
                            </td>
                            <td className="p-2 text-xs">{r.detalle || "-"}</td>
                            <td className="p-2 text-right">${Number(r.valor_sueldo || 0).toFixed(2)}</td>
                            <td className="p-2 text-right text-red-600">{(r.descuento_valor || 0) > 0 ? `-$${Number(r.descuento_valor).toFixed(2)}` : "-"}</td>
                            <td className="p-2 text-right font-medium text-green-700">${Number(r.valor_a_pagar || 0).toFixed(2)}</td>
                            <td className="p-2 text-center">
                              {tieneTransporte && !r.movilizacion_con_quincenas
                                ? <Badge variant="outline" className="text-xs text-gray-400 border-gray-300">—</Badge>
                                : r.primera_quincena_pagada
                                  ? <Badge className="bg-green-100 text-green-800 text-xs">${(r.primera_quincena_valor || 0).toFixed(2)}</Badge>
                                  : <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">${(Number(r.valor_a_pagar || 0) / 2).toFixed(2)}</Badge>}
                            </td>
                            <td className="p-2 text-center">
                              {tieneTransporte && !r.movilizacion_con_quincenas
                                ? <Badge variant="outline" className="text-xs text-gray-400 border-gray-300">—</Badge>
                                : r.segunda_quincena_pagada
                                  ? <Badge className="bg-green-100 text-green-800 text-xs">${(r.segunda_quincena_valor || 0).toFixed(2)}</Badge>
                                  : <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">${(Number(r.valor_a_pagar || 0) / 2).toFixed(2)}</Badge>}
                            </td>
                            <td className="p-2 text-center">
                              {movCompleta
                                ? <Badge className="bg-purple-100 text-purple-800 text-xs">${movTotalPagado.toFixed(2)}</Badge>
                                : movParcial
                                  ? <Badge className="bg-purple-50 text-purple-600 border border-purple-300 text-xs">${movTotalPagado.toFixed(2)} 1/2</Badge>
                                  : tieneTransporte
                                    ? <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">${Number(r.movilizacion_valor || 0).toFixed(2)}</Badge>
                                    : <Badge variant="outline" className="text-xs text-gray-400 border-gray-300">—</Badge>}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditClick(r)}><Edit2 className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteClick(r)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No hay registros de nómina para este mes.</p>
              )}
            </>
          ) : (
            /* Tab Historial */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Label className="whitespace-nowrap">Seleccionar mes:</Label>
                <select
                  value={historialMesId}
                  onChange={(e) => { setHistorialMesId(e.target.value); loadHistorial(e.target.value) }}
                  className="w-full max-w-xs h-9 px-3 rounded-md border text-sm"
                >
                  <option value="">— Seleccionar —</option>
                  {[...monthHistory].sort((a, b) => { if (a.year !== b.year) return b.year - a.year; return b.month - a.month }).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {loadingHistorial && <p className="text-center text-gray-500 py-4">Cargando...</p>}

              {!loadingHistorial && historialMesId && historialRecords.length === 0 && (
                <p className="text-center text-gray-500 py-8">No hay registros de nómina en este mes.</p>
              )}

              {historialRecords.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 font-medium">Nombre</th>
                        <th className="text-left p-2 font-medium">Detalle</th>
                        <th className="text-right p-2 font-medium">Sueldo</th>
                        <th className="text-right p-2 font-medium">Desc.</th>
                        <th className="text-right p-2 font-medium">A Pagar</th>
                        <th className="text-center p-2 font-medium">1ra Q.</th>
                        <th className="text-center p-2 font-medium">2da Q.</th>
                        <th className="text-center p-2 font-medium">Transporte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialRecords.map((r) => {
                        const movTotalPagado = Number(r.movilizacion_valor || 0) + Number(r.movilizacion_segunda_valor || 0)
                        const movCompleta = r.movilizacion_con_quincenas
                          ? (r.movilizacion_pagada && r.movilizacion_segunda_pagada)
                          : r.movilizacion_pagada
                        return (
                          <tr key={r.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-medium">{r.nombre}</td>
                            <td className="p-2 text-xs">{r.detalle || "-"}</td>
                            <td className="p-2 text-right">${Number(r.valor_sueldo || 0).toFixed(2)}</td>
                            <td className="p-2 text-right text-red-600">{(r.descuento_valor || 0) > 0 ? `-$${Number(r.descuento_valor).toFixed(2)}` : "-"}</td>
                            <td className="p-2 text-right font-medium text-green-700">${Number(r.valor_a_pagar || 0).toFixed(2)}</td>
                            <td className="p-2 text-center">
                              {r.primera_quincena_pagada
                                ? <Badge className="bg-green-100 text-green-800 text-xs">${(r.primera_quincena_valor || 0).toFixed(2)}</Badge>
                                : <Badge variant="outline" className="text-xs text-gray-400">—</Badge>}
                            </td>
                            <td className="p-2 text-center">
                              {r.segunda_quincena_pagada
                                ? <Badge className="bg-green-100 text-green-800 text-xs">${(r.segunda_quincena_valor || 0).toFixed(2)}</Badge>
                                : <Badge variant="outline" className="text-xs text-gray-400">—</Badge>}
                            </td>
                            <td className="p-2 text-center">
                              {movCompleta
                                ? <Badge className="bg-purple-100 text-purple-800 text-xs">${movTotalPagado.toFixed(2)}</Badge>
                                : <Badge variant="outline" className="text-xs text-gray-400">—</Badge>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {/* Resumen del historial */}
                  <div className="mt-4 flex gap-4 text-sm text-gray-600">
                    <span>Total pagado 1ra Q: <strong className="text-green-700">${historialRecords.filter(r => r.primera_quincena_pagada).reduce((s, r) => s + Number(r.primera_quincena_valor || 0), 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</strong></span>
                    <span>2da Q: <strong className="text-green-700">${historialRecords.filter(r => r.segunda_quincena_pagada).reduce((s, r) => s + Number(r.segunda_quincena_valor || 0), 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</strong></span>
                    <span>Transporte: <strong className="text-purple-700">${historialRecords.reduce((s, r) => s + (r.movilizacion_pagada ? Number(r.movilizacion_valor || 0) : 0) + (r.movilizacion_segunda_pagada ? Number(r.movilizacion_segunda_valor || 0) : 0), 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Agregar a Nómina</DialogTitle><DialogDescription>Registre un nuevo pago</DialogDescription></DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Guardando..." : "Agregar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Nómina</DialogTitle><DialogDescription>Modifique los datos</DialogDescription></DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingRecord(null) }}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetallesConfig} onOpenChange={setShowDetallesConfig}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configurar Detalles</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={newDetalle} onChange={(e) => setNewDetalle(e.target.value)} placeholder="Nuevo detalle..." />
              <Button size="sm" onClick={() => { if (newDetalle.trim() && !detalles.includes(newDetalle.trim())) { saveDetalles([...detalles, newDetalle.trim()]); setNewDetalle("") } }}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {detalles.map((d) => (
                <div key={d} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <span>{d}</span>
                  <button onClick={() => saveDetalles(detalles.filter((x) => x !== d))} className="text-red-500 hover:text-red-700">×</button>
                </div>
              ))}
              {detalles.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay detalles</p>}
            </div>
          </div>
          <DialogFooter><Button onClick={() => setShowDetallesConfig(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El registro de nómina y sus egresos asociados serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteRecordId) handleDelete(deleteRecordId) }}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
