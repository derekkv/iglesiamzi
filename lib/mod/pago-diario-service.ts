import { supabase } from "@/lib/secure-db"
import { type AuditInfo } from "./audit-service"
import { authFetch, getInternalHeaders } from "@/lib/auth-fetch"
import { formatPhoneForWhatsApp } from "@/lib/format-phone"

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
  metodo_pago: string
  created_at: string
  updated_at?: string
}

/** Candado anti-concurrencia para syncMissingEgresos. */
const _syncEgresosLocks = new Map<string, Promise<void>>()

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
    const res = await authFetch("/api/finanzas/pago-diario", {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        record,
        usuario: audit ? { id: audit.user_id, nombre: audit.user_name } : undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json.error || "Error creando el pago diario")
    }
    return json.data as PagoDiarioRecord
  },

  async update(id: number, updates: Partial<Omit<PagoDiarioRecord, "id" | "created_at" | "updated_at">>, audit?: AuditInfo): Promise<PagoDiarioRecord> {
    const res = await authFetch("/api/finanzas/pago-diario", {
      method: "POST",
      body: JSON.stringify({
        action: "update",
        id,
        updates,
        usuario: audit ? { id: audit.user_id, nombre: audit.user_name } : undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json.error || "Error actualizando el pago diario")
    }
    return json.data as PagoDiarioRecord
  },

  async delete(id: number, audit?: AuditInfo): Promise<void> {
    const res = await authFetch("/api/finanzas/pago-diario", {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        id,
        usuario: audit ? { id: audit.user_id, nombre: audit.user_name } : undefined,
      }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || "Error eliminando el pago diario")
    }
  },

  // === EGRESO SYNC ===

  async syncMissingEgresos(mesId: string) {
    // MEDIDA ANTI-DUPLICADOS: coalesce de llamadas concurrentes por mes.
    const enCurso = _syncEgresosLocks.get(mesId)
    if (enCurso) return enCurso
    const promesa = this._syncMissingEgresosImpl(mesId).finally(() => { _syncEgresosLocks.delete(mesId) })
    _syncEgresosLocks.set(mesId, promesa)
    return promesa
  },

  async _syncMissingEgresosImpl(mesId: string) {
    try {
      const res = await authFetch("/api/finanzas/pago-diario", {
        method: "POST",
        body: JSON.stringify({ action: "sync", mes_id: mesId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        console.error("[pago-diario] Error syncMissingEgresos:", json.error || res.status)
      }
    } catch (e) {
      console.error("[pago-diario] Error syncMissingEgresos:", e)
    }
  },

  // === NOTIFICATIONS ===

  async notify(record: PagoDiarioRecord) {
    const { nombre, telefono, email, valor, metodo_pago, detalle } = record
    const metodoTexto = metodo_pago === "Transferencia" ? "Transferencia bancaria" : metodo_pago === "Efectivo" ? "Efectivo" : metodo_pago
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

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
      fetch(`${siteUrl}/api/whatsapp/send`, {
        method: "POST",
        headers: getInternalHeaders(),
        body: JSON.stringify({
          phone: formatPhoneForWhatsApp(telefono),
          message: msg,
          origen: "pago_diario",
          useCase: "aviso_pago",
          templateData: { nombre, concepto: detalle, valor: `$${valor.toFixed(2)}`, metodo: metodoTexto },
        }),
      }).catch(() => {})
    }

    if (email) {
      fetch(`${siteUrl}/api/send-email`, {
        method: "POST",
        headers: getInternalHeaders(),
        body: JSON.stringify({
          to: email,
          subject: `💸 Pago realizado — $${valor.toFixed(2)} — IRDD`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:#7c3aed;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;"><h2 style="margin:0;">💸 Pago Realizado</h2></div><div style="background:white;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 12px 12px;"><p>Hola <strong>${nombre}</strong>,</p><p>Se ha realizado un pago a tu nombre:</p><div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:8px;padding:16px;margin:16px 0;text-align:center;"><p style="margin:0;font-size:12px;color:#6b7280;">VALOR</p><p style="font-size:24px;font-weight:700;color:#7c3aed;margin:4px 0;">$${valor.toFixed(2)}</p><p style="margin:0;font-size:13px;color:#6b7280;">${detalle} · ${metodoTexto}</p></div><p style="color:#9ca3af;font-size:12px;text-align:center;">Administración — Iglesia Regalo de Dios</p></div></div>`,
        }),
      }).catch(() => {})
    }
  },
}
