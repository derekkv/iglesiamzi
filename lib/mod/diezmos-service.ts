import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "./audit-service"

export interface DiezmoRecord {
  id: number
  mes_id: string
  numero: number
  fecha: string
  donador: string
  valor: number
  tipo_ofrenda: "diezmo" | "primicia" | "diezmo_especial"
  transaccion: "efectivo" | "transferencia"
  created_at?: string
  updated_at?: string
}

export type DiezmoWithMonth = DiezmoRecord & {
  mes_name?: string
}


export class DiezmosService {
  // Get all diezmos for a specific month
  async getDiezmosByMonth(mesId: string): Promise<DiezmoRecord[]> {

    const { data, error } = await supabase
      .from("diezmos")
      .select("*")
      .eq("mes_id", mesId)
      .order("numero", { ascending: true })

    if (error) {
      throw error
    }

    return data || []
  }

  async searchDiezmos(filters: {
    donador?: string
    fechaDesde?: string
    fechaHasta?: string
  }): Promise<DiezmoWithMonth[]> {
    let query = supabase
      .from("diezmos")
      .select(`
        *,
        meses:mes_id (
          name
        )
      `)
      .order("fecha", { ascending: false })

    // Filtrar por donador si se proporciona
    if (filters.donador && filters.donador.trim()) {
      query = query.ilike("donador", `%${filters.donador.trim()}%`)
    }

    // Filtrar por rango de fechas
    if (filters.fechaDesde) {
      query = query.gte("fecha", filters.fechaDesde)
    }
    if (filters.fechaHasta) {
      query = query.lte("fecha", filters.fechaHasta)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error searching diezmos:", error)
      throw new Error("Error al buscar los diezmos")
    }

    // Mapear los resultados para incluir el nombre del mes
    return (data || []).map((item: any) => ({
      ...item,
      mes_name: item.meses?.name || "Sin mes",
    }))
  }
  // Get next available number for a month
  async getNextNumber(mesId: string): Promise<number> {
    const { data, error } = await supabase
      .from("diezmos")
      .select("numero")
      .eq("mes_id", mesId)
      .order("numero", { ascending: false })
      .limit(1)

    if (error) {
      throw error
    }

    return data && data.length > 0 ? data[0].numero + 1 : 1
  }

  async createDiezmo(diezmo: Omit<DiezmoRecord, "id" | "created_at" | "updated_at">, audit?: AuditInfo): Promise<DiezmoRecord> {
    const { data, error } = await supabase
      .from("diezmos")
      .insert({ mes_id: diezmo.mes_id, numero: diezmo.numero, fecha: diezmo.fecha, donador: diezmo.donador, valor: diezmo.valor, tipo_ofrenda: diezmo.tipo_ofrenda, transaccion: diezmo.transaccion })
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "diezmos", action: "crear", description: `${data.tipo_ofrenda === "primicia" ? "Primicia" : data.tipo_ofrenda === "diezmo_especial" ? "Ofrenda Especial" : "Diezmo"} #${data.numero} - ${data.donador} ($${data.valor}) [${data.transaccion}]`, details: { numero: data.numero, fecha: data.fecha, donador: data.donador, valor: data.valor, tipo_ofrenda: data.tipo_ofrenda, transaccion: data.transaccion, mes_id: data.mes_id } })

    // Registrar automáticamente como ingreso si es transferencia
    if (diezmo.transaccion === "transferencia") {
      const TIPO_LABEL: Record<string, string> = {
        diezmo: "Diezmo",
        primicia: "Primicia",
        diezmo_especial: "Ofrenda Especial",
      }
      const tipoLabel = TIPO_LABEL[diezmo.tipo_ofrenda] || "Diezmo"

      await supabase.from("ingresos").insert({
        mes_id: diezmo.mes_id,
        concepto: "auto-diezmo",
        monto: diezmo.valor,
        fecha: diezmo.fecha,
        ministerio: "Administración",
        categoria_principal: tipoLabel,
        detalle: `${tipoLabel} - ${diezmo.donador}`,
        observacion: `Registrado automáticamente desde módulo Diezmos (#${data.numero})`,
        estado: "Procesado",
        metodo_pago: "Transferencia",
      })
    }

    return data
  }

  async updateDiezmo(id: number, updates: Partial<Omit<DiezmoRecord, "id" | "created_at" | "updated_at">>, audit?: AuditInfo): Promise<DiezmoRecord> {
    // Obtener datos actuales antes de actualizar
    const { data: antes } = await supabase.from("diezmos").select("*").eq("id", id).single()
    const { data, error } = await supabase
      .from("diezmos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "diezmos", action: "editar", description: `Diezmo #${data.numero} - ${data.donador}`, details: { antes: { numero: antes?.numero, fecha: antes?.fecha, donador: antes?.donador, valor: antes?.valor }, despues: { numero: data.numero, fecha: data.fecha, donador: data.donador, valor: data.valor } } })

    // Sincronizar con ingreso vinculado
    if (antes && antes.transaccion === "transferencia") {
      const TIPO_LABEL: Record<string, string> = { diezmo: "Diezmo", primicia: "Primicia", diezmo_especial: "Ofrenda Especial" }
      const oldLabel = TIPO_LABEL[antes.tipo_ofrenda] || "Diezmo"
      const oldDetalle = `${oldLabel} - ${antes.donador}`

      // Buscar el ingreso vinculado por concepto + detalle + mes
      const { data: ingresoVinculado } = await supabase
        .from("ingresos")
        .select("id")
        .eq("concepto", "auto-diezmo")
        .eq("detalle", oldDetalle)
        .eq("mes_id", antes.mes_id)
        .limit(1)
        .single()

      if (ingresoVinculado) {
        if (data.transaccion === "transferencia") {
          // Actualizar el ingreso con los nuevos datos
          const newLabel = TIPO_LABEL[data.tipo_ofrenda] || "Diezmo"
          await supabase.from("ingresos").update({
            monto: data.valor,
            fecha: data.fecha,
            categoria_principal: newLabel,
            detalle: `${newLabel} - ${data.donador}`,
            observacion: `Registrado automáticamente desde módulo Diezmos (#${data.numero})`,
          }).eq("id", ingresoVinculado.id)
        } else {
          // Cambió a efectivo → eliminar el ingreso
          await supabase.from("ingresos").delete().eq("id", ingresoVinculado.id)
        }
      } else if (data.transaccion === "transferencia") {
        // No existía ingreso pero ahora es transferencia → crear
        const newLabel = TIPO_LABEL[data.tipo_ofrenda] || "Diezmo"
        await supabase.from("ingresos").insert({
          mes_id: data.mes_id,
          concepto: "auto-diezmo",
          monto: data.valor,
          fecha: data.fecha,
          ministerio: "Administración",
          categoria_principal: newLabel,
          detalle: `${newLabel} - ${data.donador}`,
          observacion: `Registrado automáticamente desde módulo Diezmos (#${data.numero})`,
          estado: "Procesado",
          metodo_pago: "Transferencia",
        })
      }
    } else if (data.transaccion === "transferencia" && antes?.transaccion === "efectivo") {
      // Cambió de efectivo a transferencia → crear ingreso
      const TIPO_LABEL: Record<string, string> = { diezmo: "Diezmo", primicia: "Primicia", diezmo_especial: "Ofrenda Especial" }
      const newLabel = TIPO_LABEL[data.tipo_ofrenda] || "Diezmo"
      await supabase.from("ingresos").insert({
        mes_id: data.mes_id,
        concepto: "auto-diezmo",
        monto: data.valor,
        fecha: data.fecha,
        ministerio: "Administración",
        categoria_principal: newLabel,
        detalle: `${newLabel} - ${data.donador}`,
        observacion: `Registrado automáticamente desde módulo Diezmos (#${data.numero})`,
        estado: "Procesado",
        metodo_pago: "Transferencia",
      })
    }

    return data
  }

  async deleteDiezmo(id: number, audit?: AuditInfo): Promise<void> {
    const { data } = await supabase.from("diezmos").select("*").eq("id", id).single()
    const { error } = await supabase.from("diezmos").delete().eq("id", id)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "diezmos", action: "eliminar", description: `Diezmo #${data?.numero} - ${data?.donador}`, details: { id, numero: data?.numero, donador: data?.donador, valor: data?.valor } })

    // Eliminar ingreso vinculado si era transferencia
    if (data && data.transaccion === "transferencia") {
      const TIPO_LABEL: Record<string, string> = { diezmo: "Diezmo", primicia: "Primicia", diezmo_especial: "Ofrenda Especial" }
      const tipoLabel = TIPO_LABEL[data.tipo_ofrenda] || "Diezmo"
      const detalle = `${tipoLabel} - ${data.donador}`

      await supabase
        .from("ingresos")
        .delete()
        .eq("concepto", "auto-diezmo")
        .eq("detalle", detalle)
        .eq("mes_id", data.mes_id)
    }
  }

  // Get total value of diezmos for a month
  async getTotalByMonth(mesId: string): Promise<number> {
    const { data, error } = await supabase.from("diezmos").select("valor").eq("mes_id", mesId)

    if (error) {
      throw error
    }

    return data?.reduce((sum, record) => sum + Number(record.valor), 0) || 0
  }
}

export const diezmosService = new DiezmosService()
