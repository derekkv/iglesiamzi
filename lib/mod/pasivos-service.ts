import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "./audit-service"

// === TIPOS ===

export interface Pasivo {
  id: number
  acreedor: string
  detalle: string | null
  monto_total: number
  fecha: string
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

class PasivosService {
  // --- LECTURA ---

  async getPasivos(): Promise<Pasivo[]> {
    const { data, error } = await supabase
      .from("pasivos")
      .select("*")
      .order("created_at", { ascending: false })
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

  /** Elimina un pasivo, sus abonos (cascada) y los egresos generados por esos abonos. */
  async deletePasivo(pasivo: Pasivo, audit?: AuditInfo): Promise<void> {
    // 1. Borrar los egresos vinculados a los abonos de este pasivo
    const { data: abonos } = await supabase
      .from("pasivos_abonos")
      .select("egreso_id")
      .eq("pasivo_id", pasivo.id)
    const egresoIds = (abonos || []).map((a: any) => a.egreso_id).filter((x: any) => x != null)
    if (egresoIds.length > 0) {
      const { error: egErr } = await supabase.from("egresos").delete().in("id", egresoIds)
      if (egErr) throw egErr
    }

    // 2. Borrar el pasivo (los abonos se eliminan por ON DELETE CASCADE)
    const { error } = await supabase.from("pasivos").delete().eq("id", pasivo.id)
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "pasivos",
        action: "eliminar",
        description: `Pasivo eliminado: ${pasivo.acreedor} - $${pasivo.monto_total}`,
        details: { id: pasivo.id, acreedor: pasivo.acreedor, egresos_eliminados: egresoIds.length },
      })
    }
  }

  // --- ABONOS ---

  /**
   * Registra un abono a un pasivo. Además crea un EGRESO en el mes activo
   * (categoría "PAGO DE PASIVOS"), igual que la nómina. Guarda el `egreso_id`
   * en el abono para poder revertirlo si el abono se elimina.
   */
  async addAbono(pasivo: Pasivo, mesId: string, input: AbonoInput, audit?: AuditInfo): Promise<PasivoAbono> {
    if (!input.monto || input.monto <= 0) throw new Error("El monto del abono debe ser mayor a 0")
    if (!mesId) throw new Error("No hay mes activo para registrar el egreso del abono")

    // 1. Crear el egreso en el mes activo
    const observacionEgreso = `Abono a ${pasivo.acreedor}${input.metodo_pago ? ` — ${input.metodo_pago}` : ""}${input.observacion ? ` (${input.observacion})` : ""}`
    const { data: egreso, error: egErr } = await supabase
      .from("egresos")
      .insert({
        mes_id: mesId,
        concepto: "pasivo",
        monto: input.monto,
        fecha: input.fecha,
        ministerio: "Administración",
        categoria_principal: CATEGORIA_PASIVOS,
        detalle: pasivo.detalle || pasivo.acreedor,
        observacion: observacionEgreso,
        metodo_pago: input.metodo_pago || "N/A",
      })
      .select("id")
      .single()
    if (egErr) throw egErr

    // 2. Crear el abono, vinculando el egreso
    const { data: abono, error: abErr } = await supabase
      .from("pasivos_abonos")
      .insert({
        pasivo_id: pasivo.id,
        monto: input.monto,
        fecha: input.fecha,
        metodo_pago: input.metodo_pago || null,
        observacion: input.observacion?.trim() || null,
        egreso_id: egreso?.id ?? null,
      })
      .select()
      .single()
    if (abErr) throw abErr

    // 3. Recalcular estado del pasivo
    await this.recomputeEstado(pasivo.id, pasivo.monto_total)

    if (audit) {
      auditService.log({
        ...audit,
        module: "pasivos",
        action: "crear",
        description: `Abono a ${pasivo.acreedor}: $${input.monto}`,
        details: { pasivo_id: pasivo.id, monto: input.monto, fecha: input.fecha, metodo_pago: input.metodo_pago, egreso_id: egreso?.id, mes_id: mesId },
      })
    }
    return abono
  }

  /** Elimina un abono y su egreso vinculado, y recalcula el estado del pasivo. */
  async deleteAbono(abono: PasivoAbono, acreedor: string, audit?: AuditInfo): Promise<void> {
    if (abono.egreso_id) {
      const { error: egErr } = await supabase.from("egresos").delete().eq("id", abono.egreso_id)
      if (egErr) throw egErr
    }
    const { error } = await supabase.from("pasivos_abonos").delete().eq("id", abono.id)
    if (error) throw error

    const { data: p } = await supabase.from("pasivos").select("monto_total").eq("id", abono.pasivo_id).single()
    await this.recomputeEstado(abono.pasivo_id, Number(p?.monto_total ?? 0))

    if (audit) {
      auditService.log({
        ...audit,
        module: "pasivos",
        action: "eliminar",
        description: `Abono eliminado de ${acreedor}: $${abono.monto}`,
        details: { pasivo_id: abono.pasivo_id, abono_id: abono.id, monto: abono.monto, egreso_id: abono.egreso_id },
      })
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
