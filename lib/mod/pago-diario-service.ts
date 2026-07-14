import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "./audit-service"
import { authFetch } from "@/lib/auth-fetch"

export interface PagoDiarioRecord {
  id: number
  mes_id: string
  fecha: string
  nombre: string
  telefono: string | null
  email: string | null
  ministerio: string
  categoria: string
  detalle: string
  valor: number
  metodo_pago: "Efectivo" | "Transferencia"
  created_at: string
  updated_at?: string
}

export const pagoDiarioService = {
  // === CRUD ===

  async getByMonth(mesId: string): Promise<PagoDiarioRecord[]> {
    const { data, error } = await supabase
      .from("pago_diario")
      .select("*")
      .eq("mes_id", mesId)
      .order("fecha", { ascending: false })
    if (error) throw error
    return data || []
  },

  async getByDate(mesId: string, fecha: string): Promise<PagoDiarioRecord[]> {
    const { data, error } = await supabase
      .from("pago_diario")
      .select("*")
      .eq("mes_id", mesId)
      .eq("fecha", fecha)
      .order("created_at", { ascending: false })
    if (error) throw error
    return data || []
  },

  async search(filters: { nombre?: string; fechaDesde?: string; fechaHasta?: string; ministerio?: string }): Promise<PagoDiarioRecord[]> {
    let query = supabase.from("pago_diario").select("*").order("fecha", { ascending: false })
    if (filters.nombre?.trim()) query = query.ilike("nombre", `%${filters.nombre.trim()}%`)
    if (filters.fechaDesde) query = query.gte("fecha", filters.fechaDesde)
    if (filters.fechaHasta) query = query.lte("fecha", filters.fechaHasta)
    if (filters.ministerio && filters.ministerio !== "todos") query = query.eq("ministerio", filters.ministerio)
    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async create(record: Omit<PagoDiarioRecord, "id" | "created_at" | "updated_at">, audit?: AuditInfo): Promise<PagoDiarioRecord> {
    const { data, error } = await supabase
      .from("pago_diario")
      .insert({
        mes_id: record.mes_id,
        fecha: record.fecha,
        nombre: record.nombre,
        telefono: record.telefono || null,
        email: record.email || null,
        ministerio: record.ministerio,
        categoria: record.categoria,
        detalle: record.detalle,
        valor: record.valor,
        metodo_pago: record.metodo_pago,
      })
      .select()
      .single()
    if (error) throw error

    // Registrar egreso sincronizado
    await this._syncEgresoCreate(data)

    // Audit
    if (audit) auditService.log({ ...audit, module: "pago_diario", action: "crear", description: `Pago: ${record.nombre} - $${record.valor} (${record.detalle})`, details: { nombre: record.nombre, valor: record.valor, ministerio: record.ministerio, detalle: record.detalle, fecha: record.fecha, metodo_pago: record.metodo_pago } })

    return data
  },

  async update(id: number, updates: Partial<Omit<PagoDiarioRecord, "id" | "created_at" | "updated_at">>, audit?: AuditInfo): Promise<PagoDiarioRecord> {
    const { data: antes } = await supabase.from("pago_diario").select("*").eq("id", id).single()

    const { data, error } = await supabase
      .from("pago_diario")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error

    // Sincronizar egreso
    if (antes) await this._syncEgresoUpdate(antes, data)

    if (audit) auditService.log({ ...audit, module: "pago_diario", action: "editar", description: `Pago editado: ${data.nombre} - $${data.valor}`, details: { antes: { nombre: antes?.nombre, valor: antes?.valor, detalle: antes?.detalle }, despues: { nombre: data.nombre, valor: data.valor, detalle: data.detalle } } })

    return data
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("pago_diario").select("*").eq("id", id).single()
    const { error } = await supabase.from("pago_diario").delete().eq("id", id)
    if (error) throw error

    // Eliminar egreso sincronizado
    if (data) await this._syncEgresoDelete(data)

    if (audit) auditService.log({ ...audit, module: "pago_diario", action: "eliminar", description: `Pago eliminado: ${data?.nombre} - $${data?.valor}`, details: { id, nombre: data?.nombre, valor: data?.valor, detalle: data?.detalle } })
  },

  // === EGRESO SYNC ===

  async syncMissingEgresos(mesId: string) {
    // Obtener todos los pagos diarios del mes
    const { data: pagos } = await supabase.from("pago_diario").select("*").eq("mes_id", mesId)
    if (!pagos || pagos.length === 0) return

    // Obtener egresos sincronizados existentes
    const { data: egresosExistentes } = await supabase.from("egresos").select("detalle, monto, observacion").eq("mes_id", mesId).eq("concepto", "auto-pago-diario")
    const existingSet = new Set((egresosExistentes || []).map((e: any) => `${e.detalle}|${e.monto}|${e.observacion}`))

    for (const record of pagos) {
      const key = `Pago diario - ${record.nombre}|${record.valor}|${record.detalle}`
      if (!existingSet.has(key)) {
        await this._syncEgresoCreate(record)
      }
    }
  },

  async _syncEgresoCreate(record: PagoDiarioRecord) {
    await supabase.from("egresos").insert({
      mes_id: record.mes_id,
      concepto: "auto-pago-diario",
      monto: record.valor,
      fecha: record.fecha,
      ministerio: record.ministerio,
      categoria_principal: record.categoria,
      detalle: `Pago diario - ${record.nombre}`,
      observacion: record.detalle,
      estado: "Procesado",
      metodo_pago: record.metodo_pago,
    })
  },

  async _syncEgresoUpdate(antes: PagoDiarioRecord, despues: PagoDiarioRecord) {
    // Find linked egreso by concepto + detalle + mes_id (sin monto para soportar ediciones previas)
    const { data: egreso } = await supabase
      .from("egresos")
      .select("id")
      .eq("concepto", "auto-pago-diario")
      .eq("detalle", `Pago diario - ${antes.nombre}`)
      .eq("mes_id", antes.mes_id)
      .eq("observacion", antes.detalle)
      .limit(1)
      .single()

    if (egreso) {
      await supabase.from("egresos").update({
        monto: despues.valor,
        fecha: despues.fecha,
        ministerio: despues.ministerio,
        categoria_principal: despues.categoria,
        detalle: `Pago diario - ${despues.nombre}`,
        observacion: despues.detalle,
        metodo_pago: despues.metodo_pago,
      }).eq("id", egreso.id)
    }
  },

  async _syncEgresoDelete(record: PagoDiarioRecord) {
    await supabase
      .from("egresos")
      .delete()
      .eq("concepto", "auto-pago-diario")
      .eq("detalle", `Pago diario - ${record.nombre}`)
      .eq("mes_id", record.mes_id)
  },

  // === NOTIFICATIONS ===

  async notify(record: PagoDiarioRecord) {
    const { nombre, telefono, email, valor, metodo_pago, detalle } = record
    const metodoTexto = metodo_pago === "Transferencia" ? "Transferencia bancaria" : "Efectivo"

    if (telefono) {
      const msg = [
        `💸 *Pago Realizado — IRDD*`,
        ``,
        `Hola *${nombre}*,`,
        ``,
        `Se ha realizado un pago a tu nombre.`,
        `💵 *Valor:* $${valor.toFixed(2)}`,
        `📝 *Detalle:* ${detalle}`,
        `🏦 *Método:* ${metodoTexto}`,
        ``,
        `¡Dios te bendiga! 🙏`,
        `— Administración`,
      ].join("\n")
      authFetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: telefono, message: msg }),
      }).catch(() => {})
    }

    if (email) {
      authFetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: `💸 Pago realizado — $${valor.toFixed(2)} — IRDD`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:#7c3aed;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;"><h2 style="margin:0;">💸 Pago Realizado</h2></div><div style="background:white;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 12px 12px;"><p>Hola <strong>${nombre}</strong>,</p><p>Se ha realizado un pago a tu nombre:</p><div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:8px;padding:16px;margin:16px 0;text-align:center;"><p style="margin:0;font-size:12px;color:#6b7280;">VALOR</p><p style="font-size:24px;font-weight:700;color:#7c3aed;margin:4px 0;">$${valor.toFixed(2)}</p><p style="margin:0;font-size:13px;color:#6b7280;">${detalle} · ${metodoTexto}</p></div><p style="color:#9ca3af;font-size:12px;text-align:center;">Administración — Iglesia Regalo de Dios</p></div></div>`,
        }),
      }).catch(() => {})
    }
  },
}
