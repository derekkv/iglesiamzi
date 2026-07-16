import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "./audit-service"

// === TIPOS ===

export type MetodoPagoCaja = "Cambio en efectivo" | "Deposito en efectivo" | "Deposito en cheques"
export type TipoMovimiento = "Ingreso" | "Egreso"

export interface CajaChicaMovimiento {
  id: number
  fecha: string
  tipo: TipoMovimiento
  concepto: string
  detalle: string
  monto: number
  metodo_pago: MetodoPagoCaja | string
  responsable: string
  mes_id: string
  created_at: string
  updated_at?: string
}

export interface CajaChicaArqueo {
  id: number
  fecha: string
  contado_por: string
  // Denominaciones
  billetes_20: number
  billetes_10: number
  billetes_5: number
  billetes_1: number
  monedas_050: number
  monedas_025: number
  monedas_010: number
  monedas_005: number
  total: number
  observacion?: string
  mes_id: string
  created_at: string
}

export interface GestionEfectivoInput {
  fecha: string
  responsable: string
  valor: number
  detalle: string
  metodo_pago: MetodoPagoCaja
  mes_id: string
}

export interface ArqueoInput {
  fecha: string
  contado_por: string
  billetes_20: number
  billetes_10: number
  billetes_5: number
  billetes_1: number
  monedas_050: number
  monedas_025: number
  monedas_010: number
  monedas_005: number
  total: number
  observacion?: string
  mes_id: string
}

// === CONSTANTES ===

export const METODOS_PAGO_CAJA: MetodoPagoCaja[] = [
  "Cambio en efectivo",
  "Deposito en efectivo",
  "Deposito en cheques",
]

export const RESPONSABLES_ARQUEO = [
  "JAIME SALAS",
  "JUAN PABLO MURILLO",
  "MERLY ANCHUNDIA",
  "LUCIA AVILA",
  "CARLOS BRIONES",
  "VALERIA ESCOBAR",
  "JOYCE VERA",
  "JORGE LUCAS",
]

export const DENOMINACIONES = [
  { label: "$20", key: "billetes_20", valor: 20 },
  { label: "$10", key: "billetes_10", valor: 10 },
  { label: "$5", key: "billetes_5", valor: 5 },
  { label: "$1", key: "billetes_1", valor: 1 },
  { label: "$0.50", key: "monedas_050", valor: 0.50 },
  { label: "$0.25", key: "monedas_025", valor: 0.25 },
  { label: "$0.10", key: "monedas_010", valor: 0.10 },
  { label: "$0.05", key: "monedas_005", valor: 0.05 },
] as const

// === SERVICIO ===

export const cajaChicaService = {
  // --- MOVIMIENTOS ---

  async getMovimientos(mesId: string): Promise<CajaChicaMovimiento[]> {
    const { data, error } = await supabase
      .from("caja_chica_movimientos")
      .select("*")
      .eq("mes_id", mesId)
      .order("fecha", { ascending: false })
    if (error) throw error
    return data || []
  },

  async createMovimiento(
    mov: Omit<CajaChicaMovimiento, "id" | "created_at" | "updated_at">,
    audit?: AuditInfo
  ): Promise<CajaChicaMovimiento> {
    const { data, error } = await supabase
      .from("caja_chica_movimientos")
      .insert({
        fecha: mov.fecha,
        tipo: mov.tipo,
        concepto: mov.concepto,
        detalle: mov.detalle,
        monto: mov.monto,
        metodo_pago: mov.metodo_pago,
        responsable: mov.responsable,
        mes_id: mov.mes_id,
      })
      .select()
      .single()
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "caja_chica",
        action: "crear",
        description: `${mov.tipo}: ${mov.concepto} - $${mov.monto}`,
        details: { tipo: mov.tipo, concepto: mov.concepto, monto: mov.monto, responsable: mov.responsable },
      })
    }

    return data
  },

  async updateMovimiento(
    id: number,
    updates: Partial<Omit<CajaChicaMovimiento, "id" | "created_at">>,
    audit?: AuditInfo
  ): Promise<CajaChicaMovimiento> {
    const { data, error } = await supabase
      .from("caja_chica_movimientos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "caja_chica",
        action: "editar",
        description: `Movimiento #${id} editado`,
        details: { id, ...updates },
      })
    }

    return data
  },

  async deleteMovimiento(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("caja_chica_movimientos").select("tipo, concepto, monto").eq("id", id).maybeSingle()
    const { error } = await supabase.from("caja_chica_movimientos").delete().eq("id", id)
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "caja_chica",
        action: "eliminar",
        description: `Movimiento eliminado: ${data?.concepto} - $${data?.monto}`,
        details: { id, tipo: data?.tipo, concepto: data?.concepto, monto: data?.monto },
      })
    }
  },

  // --- GESTIÓN DE EFECTIVO (sincronizado con ingresos) ---

  async getGestionEfectivo(mesId: string): Promise<CajaChicaMovimiento[]> {
    const { data, error } = await supabase
      .from("caja_chica_movimientos")
      .select("*")
      .eq("mes_id", mesId)
      .eq("concepto", "Gestion de Efectivo")
      .order("fecha", { ascending: false })
    if (error) throw error
    return data || []
  },

  async registrarGestionEfectivo(
    input: GestionEfectivoInput,
    audit?: AuditInfo
  ): Promise<CajaChicaMovimiento> {
    // 1. Crear movimiento como INGRESO en caja_chica_movimientos
    const movimiento = await this.createMovimiento({
      fecha: input.fecha,
      tipo: "Ingreso",
      concepto: "Gestion de Efectivo",
      detalle: input.detalle,
      monto: input.valor,
      metodo_pago: input.metodo_pago,
      responsable: input.responsable,
      mes_id: input.mes_id,
    }, audit)

    // 2. Sincronizar con tabla de ingresos
    await supabase.from("ingresos").insert({
      mes_id: input.mes_id,
      concepto: "auto-caja-chica",
      monto: input.valor,
      fecha: input.fecha,
      ministerio: "Administracion",
      categoria_principal: "Caja Chica",
      detalle: `Gestion de Efectivo - ${input.responsable}`,
      observacion: `${input.detalle} (${input.metodo_pago})`,
      estado: "Procesado",
      metodo_pago: "Efectivo",
    })

    return movimiento
  },

  async updateGestionEfectivo(
    id: number,
    input: GestionEfectivoInput,
    audit?: AuditInfo
  ): Promise<CajaChicaMovimiento> {
    // Obtener datos anteriores para buscar el ingreso vinculado
    const { data: antes } = await supabase.from("caja_chica_movimientos").select("*").eq("id", id).maybeSingle()

    // 1. Actualizar en caja_chica_movimientos
    const { data, error } = await supabase
      .from("caja_chica_movimientos")
      .update({
        fecha: input.fecha,
        detalle: input.detalle,
        monto: input.valor,
        metodo_pago: input.metodo_pago,
        responsable: input.responsable,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit, module: "caja_chica", action: "editar",
        description: `Gestion editada: ${input.responsable} - $${input.valor}`,
        details: { id, antes: { responsable: antes?.responsable, monto: antes?.monto }, despues: { responsable: input.responsable, monto: input.valor } },
      })
    }

    // 2. Sincronizar con ingreso vinculado
    if (antes) {
      const { data: ingresoVinculado } = await supabase
        .from("ingresos")
        .select("id")
        .eq("concepto", "auto-caja-chica")
        .eq("detalle", `Gestion de Efectivo - ${antes.responsable}`)
        .eq("mes_id", antes.mes_id)
        .limit(1)
        .maybeSingle()

      if (ingresoVinculado) {
        await supabase.from("ingresos").update({
          monto: input.valor,
          fecha: input.fecha,
          detalle: `Gestion de Efectivo - ${input.responsable}`,
          observacion: `${input.detalle} (${input.metodo_pago})`,
        }).eq("id", ingresoVinculado.id)
      }
    }

    return data
  },

  async deleteGestionEfectivo(id: number, audit?: AuditInfo): Promise<void> {
    // Obtener datos antes de eliminar
    const { data } = await supabase.from("caja_chica_movimientos").select("*").eq("id", id).maybeSingle()

    // 1. Eliminar de caja_chica_movimientos
    const { error } = await supabase.from("caja_chica_movimientos").delete().eq("id", id)
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit, module: "caja_chica", action: "eliminar",
        description: `Gestion eliminada: ${data?.responsable} - $${data?.monto}`,
        details: { id, responsable: data?.responsable, monto: data?.monto },
      })
    }

    // 2. Eliminar ingreso vinculado
    if (data) {
      await supabase
        .from("ingresos")
        .delete()
        .eq("concepto", "auto-caja-chica")
        .eq("detalle", `Gestion de Efectivo - ${data.responsable}`)
        .eq("mes_id", data.mes_id)
    }
  },

  // --- ARQUEOS ---

  async getArqueos(mesId: string): Promise<CajaChicaArqueo[]> {
    const { data, error } = await supabase
      .from("caja_chica_arqueos")
      .select("*")
      .eq("mes_id", mesId)
      .order("fecha", { ascending: false })
    if (error) throw error
    return data || []
  },

  async createArqueo(input: ArqueoInput, audit?: AuditInfo): Promise<CajaChicaArqueo> {
    const { data, error } = await supabase
      .from("caja_chica_arqueos")
      .insert({
        fecha: input.fecha,
        contado_por: input.contado_por,
        billetes_20: input.billetes_20,
        billetes_10: input.billetes_10,
        billetes_5: input.billetes_5,
        billetes_1: input.billetes_1,
        monedas_050: input.monedas_050,
        monedas_025: input.monedas_025,
        monedas_010: input.monedas_010,
        monedas_005: input.monedas_005,
        total: input.total,
        observacion: input.observacion || null,
        mes_id: input.mes_id,
      })
      .select()
      .single()
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "caja_chica",
        action: "crear",
        description: `Arqueo: $${input.total} contado por ${input.contado_por}`,
        details: { total: input.total, contado_por: input.contado_por, fecha: input.fecha },
      })
    }

    return data
  },

  async deleteArqueo(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("caja_chica_arqueos").select("total, contado_por, fecha").eq("id", id).maybeSingle()
    const { error } = await supabase.from("caja_chica_arqueos").delete().eq("id", id)
    if (error) throw error

    if (audit) {
      auditService.log({
        ...audit,
        module: "caja_chica",
        action: "eliminar",
        description: `Arqueo eliminado: $${data?.total} (${data?.contado_por})`,
        details: { id, total: data?.total, contado_por: data?.contado_por },
      })
    }
  },

  // --- UTILIDADES ---

  calcularSaldo(movimientos: CajaChicaMovimiento[]): number {
    return movimientos.reduce((saldo, mov) => {
      if (mov.tipo === "Ingreso") return saldo + Number(mov.monto)
      if (mov.tipo === "Egreso") return saldo - Number(mov.monto)
      return saldo
    }, 0)
  },

  calcularTotalArqueo(cantidades: Record<string, number>): number {
    return DENOMINACIONES.reduce((total, den) => {
      const cantidad = cantidades[den.key] || 0
      return total + (cantidad * den.valor)
    }, 0)
  },
}
