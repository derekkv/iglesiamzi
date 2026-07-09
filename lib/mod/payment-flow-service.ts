import { supabase } from "@/lib/secure-db"
import { auditService, type AuditInfo } from "./audit-service"

// Types matching the original component
export interface PaymentRow {
  id: string
  fecha: string
  beneficiarios: string
  detalle: string
  valor: number
}

export interface PaymentTable {
  id: string
  nombre: string
  fechaCreacion: string
  rows: PaymentRow[]
}

// Database types (matching our SQL schema)
interface DbPaymentTable {
  id: string
  nombre: string
  fecha_creacion: string
  created_at: string
  updated_at: string
}

interface DbPaymentRow {
  id: string
  table_id: string
  fecha: string
  beneficiarios: string
  detalle: string
  valor: number
  created_at: string
  updated_at: string
}

class PaymentFlowService {
  private supabase = supabase

  // Payment Tables CRUD operations
  async getAllTables(): Promise<PaymentTable[]> {
    try {
      // Get all tables
      const { data: tables, error: tablesError } = await this.supabase
        .from("payment_tables")
        .select("*")
        .order("created_at", { ascending: false })

      if (tablesError) throw tablesError

      // Get all rows for all tables
      const { data: rows, error: rowsError } = await this.supabase
        .from("payment_rows")
        .select("*")
        .order("fecha", { ascending: true })

      if (rowsError) throw rowsError

      // Group rows by table_id and transform to expected format
      const rowsByTable =
        rows?.reduce(
          (acc, row) => {
            if (!acc[row.table_id]) acc[row.table_id] = []
            acc[row.table_id].push({
              id: row.id,
              fecha: row.fecha,
              beneficiarios: row.beneficiarios,
              detalle: row.detalle,
              valor: row.valor,
            })
            return acc
          },
          {} as Record<string, PaymentRow[]>,
        ) || {}

      // Transform tables to expected format
      return (
        tables?.map((table) => ({
          id: table.id,
          nombre: table.nombre,
          fechaCreacion: table.fecha_creacion,
          rows: rowsByTable[table.id] || [],
        })) || []
      )
    } catch (error) {
      console.error("Error fetching payment tables:", error)
      throw error
    }
  }

  async createTable(nombre: string, audit?: AuditInfo): Promise<PaymentTable> {
    const { data, error } = await this.supabase.from("payment_tables").insert({ nombre: nombre.trim(), fecha_creacion: new Date().toISOString().split("T")[0] }).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "flujo_pago", action: "crear", description: `Tabla: ${nombre}`, details: { tabla: nombre } })
    return { id: data.id, nombre: data.nombre, fechaCreacion: data.fecha_creacion, rows: [] }
  }

  async updateTable(tableId: string, nombre: string, audit?: AuditInfo): Promise<void> {
    const { data: antes } = audit ? await this.supabase.from("payment_tables").select("nombre").eq("id", tableId).single() : { data: null }
    const { error } = await this.supabase.from("payment_tables").update({ nombre: nombre.trim(), updated_at: new Date().toISOString() }).eq("id", tableId)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "flujo_pago", action: "editar", description: `Tabla renombrada a: ${nombre}`, details: { antes: { nombre: antes?.nombre }, despues: { nombre } } })
  }

  async deleteTable(tableId: string, audit?: AuditInfo): Promise<void> {
    const { data } = await this.supabase.from("payment_tables").select("nombre").eq("id", tableId).single()
    const { error } = await this.supabase.from("payment_tables").delete().eq("id", tableId)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "flujo_pago", action: "eliminar", description: `Tabla: ${data?.nombre}`, details: { id: tableId, nombre: data?.nombre } })
  }

  async createRow(tableId: string, rowData: Omit<PaymentRow, "id">, audit?: AuditInfo): Promise<PaymentRow> {
    const { data, error } = await this.supabase.from("payment_rows").insert({ table_id: tableId, fecha: rowData.fecha, beneficiarios: rowData.beneficiarios, detalle: rowData.detalle, valor: rowData.valor }).select().single()
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "flujo_pago", action: "crear", description: `Fila: ${rowData.beneficiarios} - $${rowData.valor}`, details: { fecha: rowData.fecha, beneficiarios: rowData.beneficiarios, detalle: rowData.detalle, valor: rowData.valor } })
    return { id: data.id, fecha: data.fecha, beneficiarios: data.beneficiarios, detalle: data.detalle, valor: data.valor }
  }

  async updateRow(rowId: string, rowData: Omit<PaymentRow, "id">, audit?: AuditInfo): Promise<void> {
    const { data: antes } = audit ? await this.supabase.from("payment_rows").select("fecha,beneficiarios,detalle,valor").eq("id", rowId).single() : { data: null }
    const { error } = await this.supabase.from("payment_rows").update({ fecha: rowData.fecha, beneficiarios: rowData.beneficiarios, detalle: rowData.detalle, valor: rowData.valor, updated_at: new Date().toISOString() }).eq("id", rowId)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "flujo_pago", action: "editar", description: `Fila: ${rowData.beneficiarios} - $${rowData.valor}`, details: { antes: { fecha: antes?.fecha, beneficiarios: antes?.beneficiarios, detalle: antes?.detalle, valor: antes?.valor }, despues: { fecha: rowData.fecha, beneficiarios: rowData.beneficiarios, detalle: rowData.detalle, valor: rowData.valor } } })
  }

  async deleteRow(rowId: string, audit?: AuditInfo): Promise<void> {
    const { data } = await this.supabase.from("payment_rows").select("beneficiarios,valor,fecha,detalle").eq("id", rowId).single()
    const { error } = await this.supabase.from("payment_rows").delete().eq("id", rowId)
    if (error) throw error
    if (audit) auditService.log({ ...audit, module: "flujo_pago", action: "eliminar", description: `Fila: ${data?.beneficiarios} - $${data?.valor}`, details: { id: rowId, fecha: data?.fecha, beneficiarios: data?.beneficiarios, detalle: data?.detalle, valor: data?.valor } })
  }

  async getTableRows(tableId: string): Promise<PaymentRow[]> {
    try {
      const { data, error } = await this.supabase
        .from("payment_rows")
        .select("*")
        .eq("table_id", tableId)
        .order("fecha", { ascending: true })

      if (error) throw error

      return (
        data?.map((row) => ({
          id: row.id,
          fecha: row.fecha,
          beneficiarios: row.beneficiarios,
          detalle: row.detalle,
          valor: row.valor,
        })) || []
      )
    } catch (error) {
      console.error("Error fetching table rows:", error)
      throw error
    }
  }
}

export const paymentFlowService = new PaymentFlowService()
