import { supabase } from "@/lib/secure-db"
import { authFetch } from "@/lib/auth-fetch"
import { auditService, type AuditInfo } from "./audit-service"

// === TIPOS ===

export interface Pasivo {
  id: number
  acreedor: string
  detalle: string | null
  monto_total: number
  /** Fecha de pago acordada/estimada (ingresada manualmente) */
  fecha: string
  /** Fecha y hora de ingreso al sistema — automática, hora Ecuador (UTC-5) */
  fecha_ingreso: string
  estado: "pendiente" | "pagado"
  observacion: string | null
  created_at: string
  updated_at: string
}

export interface PasivoAbono {
  id: number
  pasivo_id: number
  monto: number
  fecha: string
  metodo_pago: string | null
  observacion: string | null
  egreso_id: number | null
  created_at: string
}

export interface PasivoInput {
  acreedor: string
  detalle?: string | null
  monto_total: number
  fecha: string
  observacion?: string | null
}

export interface AbonoInput {
  monto: number
  fecha: string
  metodo_pago?: string | null
  observacion?: string | null
}

/** Categoría con la que se registran los egresos generados por abonos a pasivos. */
export const CATEGORIA_PASIVOS = "PAGO DE PASIVOS"

// === HELPERS REUTILIZABLES ===
// Funciones puras para calcular saldos y clasificar pasivos. Se usan en la lista
// de pasivos, el presupuesto anual y el resumen/control mensual para mantener una
// única fuente de verdad sobre "abonado", "saldo" y "vencido".

/** Suma de abonos de un pasivo. */
export function calcAbonado(abonos: PasivoAbono[], pasivoId: number): number {
  return abonos
    .filter((a) => a.pasivo_id === pasivoId)
    .reduce((s, a) => s + Number(a.monto), 0)
}

/** Saldo pendiente de un pasivo (monto total - abonado). */
export function calcSaldo(pasivo: Pasivo, abonos: PasivoAbono[]): number {
  return Number(pasivo.monto_total) - calcAbonado(abonos, pasivo.id)
}

/**
 * ¿El pasivo está vencido? = tiene saldo pendiente y su fecha de pago ya pasó.
 * `hoy` debe ser un string ISO (YYYY-MM-DD), típicamente `todayEcuador()`.
 */
export function esVencido(pasivo: Pasivo, saldo: number, hoy: string): boolean {
  return saldo > 0.0001 && !!pasivo.fecha && pasivo.fecha < hoy
}

/** Año (número) de la fecha de pago del pasivo. */
export function anioDePasivo(pasivo: Pasivo): number {
  return pasivo.fecha ? Number(pasivo.fecha.slice(0, 4)) : 0
}

/** Mes (1-12) de la fecha de pago del pasivo. */
export function mesDePasivo(pasivo: Pasivo): number {
  return pasivo.fecha ? Number(pasivo.fecha.slice(5, 7)) : 0
}

class PasivosService {
  // --- LECTURA ---

  async getPasivos(): Promise<Pasivo[]> {
    const { data, error } = await supabase
      .from("pasivos")
      .select("*")
      .order("fecha", { ascending: false })
    if (error) throw error
    return data || []
  }

  /** Todos los abonos (para calcular saldos en la UI). */
  async getAbonos(): Promise<PasivoAbono[]> {
    const { data, error } = await supabase
      .from("pasivos_abonos")
      .select("*")
      .order("fecha", { ascending: true })
    if (error) throw error
    return data || []
  }

  // --- PASIVOS ---

  async createPasivo(input: PasivoInput, audit?: AuditInfo): Promise<Pasivo> {
    const { data, error } = await supabase
      .from("pasivos")
      .insert({
        acreedor: input.acreedor.trim(),
        detalle: input.detalle?.trim() || null,
        monto_total: input.monto_total,
        fecha: input.fecha,
        estado: "pendiente",
        observacion: input.observacion?.trim() || null,
      })
      .select()
      .single()
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "pasivos",
        action: "crear",
        description: `Pasivo: ${input.acreedor} - $${input.monto_total}`,
        details: { id: data.id, acreedor: input.acreedor, monto_total: input.monto_total, detalle: input.detalle },
      })
    }
    return data
  }

  async updatePasivo(id: number, input: PasivoInput, audit?: AuditInfo): Promise<void> {
    const { error } = await supabase
      .from("pasivos")
      .update({
        acreedor: input.acreedor.trim(),
        detalle: input.detalle?.trim() || null,
        monto_total: input.monto_total,
        fecha: input.fecha,
        observacion: input.observacion?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
    if (error) throw error

    // El monto pudo cambiar: recalcular estado
    await this.recomputeEstado(id, input.monto_total)

    if (audit) {
      auditService.log({
        ...audit,
        module: "pasivos",
        action: "editar",
        description: `Pasivo #${id}: ${input.acreedor} - $${input.monto_total}`,
        details: { id, acreedor: input.acreedor, monto_total: input.monto_total },
      })
    }
  }

  /** Elimina un pasivo, sus abonos (cascada) y los egresos generados por esos abonos. Atómico server-side. */
  async deletePasivo(pasivo: Pasivo, audit?: AuditInfo): Promise<void> {
    const res = await authFetch("/api/finanzas/pasivos", {
      method: "POST",
      body: JSON.stringify({
        action: "delete-pasivo",
        pasivo: { id: pasivo.id, acreedor: pasivo.acreedor, monto_total: pasivo.monto_total },
        usuario: audit ? { id: audit.user_id, nombre: audit.user_name } : undefined,
      }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || "Error eliminando el pasivo")
    }
  }

  // --- ABONOS ---

  /**
   * Registra un abono a un pasivo. Crea un EGRESO ("PAGO DE PASIVOS") + el abono
   * vinculado de forma ATÓMICA en el servidor (/api/finanzas/pasivos). Evita el
   * fallo silencioso por permisos sobre `egresos`.
   */
  async addAbono(pasivo: Pasivo, mesId: string, input: AbonoInput, audit?: AuditInfo): Promise<PasivoAbono> {
    if (!input.monto || input.monto <= 0) throw new Error("El monto del abono debe ser mayor a 0")
    if (!mesId) throw new Error("No hay mes activo para registrar el egreso del abono")

    const res = await authFetch("/api/finanzas/pasivos", {
      method: "POST",
      body: JSON.stringify({
        action: "add-abono",
        pasivo: { id: pasivo.id, acreedor: pasivo.acreedor, detalle: pasivo.detalle, monto_total: pasivo.monto_total },
        mes_id: mesId,
        input,
        usuario: audit ? { id: audit.user_id, nombre: audit.user_name } : undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(json.error || "Error registrando el abono")
    }
    return json.data as PasivoAbono
  }

  /** Elimina un abono y su egreso vinculado, y recalcula el estado del pasivo. Atómico server-side. */
  async deleteAbono(abono: PasivoAbono, acreedor: string, audit?: AuditInfo): Promise<void> {
    const res = await authFetch("/api/finanzas/pasivos", {
      method: "POST",
      body: JSON.stringify({
        action: "delete-abono",
        abono: { id: abono.id, pasivo_id: abono.pasivo_id, monto: abono.monto, egreso_id: abono.egreso_id },
        acreedor,
        usuario: audit ? { id: audit.user_id, nombre: audit.user_name } : undefined,
      }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || "Error eliminando el abono")
    }
  }

  /** Marca 'pagado' si lo abonado cubre el monto total; si no, 'pendiente'. */
  private async recomputeEstado(pasivoId: number, montoTotal: number): Promise<void> {
    const { data: abonos } = await supabase
      .from("pasivos_abonos")
      .select("monto")
      .eq("pasivo_id", pasivoId)
    const pagado = (abonos || []).reduce((s: number, a: any) => s + Number(a.monto), 0)
    const estado = pagado >= Number(montoTotal) && Number(montoTotal) > 0 ? "pagado" : "pendiente"
    await supabase
      .from("pasivos")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", pasivoId)
  }
}

export const pasivosService = new PasivosService()
