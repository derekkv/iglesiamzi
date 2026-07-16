/**
 * Cliente seguro de base de datos — DROP-IN REPLACEMENT para supabase.
 * 
 * Reemplaza las llamadas directas a supabase.from() desde el browser.
 * Todas las queries pasan por /api/db que verifica JWT + permisos de módulo.
 * 
 * USO: Exactamente igual que supabase — no necesita .execute()
 * 
 *   import { db } from "@/lib/secure-db"
 *   // equivale a: import { supabase } from "@/lib/supabase"
 * 
 *   const { data, error } = await db.from("diezmos").select("*").eq("mes_id", "abc")
 *   const { data, error } = await db.from("ingresos").insert({ ... }).select().single()
 *   const { error } = await db.from("nomina").update({ ... }).eq("id", 123)
 *   const { error } = await db.from("egresos").delete().eq("id", 123)
 */

interface Filter {
  column: string
  operator: string
  value: any
}

interface QueryState {
  table: string
  action: "select" | "insert" | "update" | "delete" | "upsert"
  selectFields?: string
  data?: any
  filters: Filter[]
  orderBy?: { column: string; ascending?: boolean }
  limitCount?: number
  isSingle?: boolean
  isMaybeSingle?: boolean
  onConflictStr?: string
}

type QueryResult = { data: any[] | any | null; error: any; count?: number }

// Campos que NO deben convertirse a uppercase (contraseñas, tokens, IDs, fechas, campos con CHECK constraints)
const NO_UPPERCASE_FIELDS = [
  // Técnicos / IDs / seguridad
  "password", "password_hash", "token", "jwt", "secret",
  "mes_id", "id", "user_id", "created_at", "updated_at",
  "concepto", // campo técnico de sync (auto-diezmo, auto-pago-diario, etc.)

  // Campos con CHECK constraints — pago_diario, ingresos, egresos
  "metodo_pago", // 'Efectivo' | 'Transferencia'
  "estado", // 'Procesado' | 'Pendiente' | 'asistio' | 'falto' | 'justifico' | 'atrasado' | 'pendiente'

  // Campos con CHECK constraints — audit_logs
  "action", // 'crear' | 'editar' | 'eliminar'

  // Campos con CHECK constraints — diezmos
  "tipo_ofrenda", // 'diezmo' | 'primicia' | 'diezmo_especial'
  "transaccion", // 'efectivo' | 'transferencia'

  // Campos con CHECK constraints — discipulado
  "estatus", // 'en_curso' | 'aprobado' | 'reprobado'
  "status", // 'A' | 'J' | 'F' | 'AT' | 'none'

  // Campos con CHECK constraints — buzon_mensajes, mensajes_citaciones, requerimientos
  "tipo", // 'info' | 'requerimiento' | 'aprobado' | 'negado' | 'suspenso' | 'mensaje' | 'invitacion' | 'domingo' | 'mdg'
  "respuesta", // 'pendiente' | 'aprobado' | 'negado' | 'suspenso'
  "referencia_tipo", // 'cumpleanos' | 'cronograma' | 'mensaje_citacion' | 'requerimiento'
  "destinatario_tipo", // 'usuario' | 'modulo' | 'todos'

  // Campos con CHECK constraints — gestion_celulas, cumpleanos_enviados, bautizos, matrimonios
  "fuente", // 'protocolo' | 'mdg' | 'manual'

  // Campos que se comparan con valores hardcoded en el frontend (case-sensitive match)
  "celula_nombre", // 'Carlos y Ruth', 'Sarita y Lady', etc. — se usa en filtros === exactos

  // Campos con CHECK constraints — nomina (métodos de pago por quincena)
  "primera_quincena_metodo", // 'Transferencia' | 'Efectivo'
  "segunda_quincena_metodo", // 'Transferencia' | 'Efectivo'
  "movilizacion_metodo", // 'Transferencia' | 'Efectivo'
  "movilizacion_segunda_metodo", // 'Transferencia' | 'Efectivo'
]

/**
 * Convierte todos los valores string de un objeto/array a uppercase,
 * excepto los campos técnicos que no deben modificarse.
 */
function uppercaseData(data: any): any {
  if (data === null || data === undefined) return data
  if (Array.isArray(data)) return data.map(uppercaseData)
  if (typeof data === "object") {
    const result: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (NO_UPPERCASE_FIELDS.includes(key)) {
        result[key] = value
      } else if (typeof value === "string") {
        // No uppercase para valores que parecen fechas, UUIDs, URLs, emails o JSON
        if (
          /^\d{4}-\d{2}/.test(value) || // fecha ISO
          /^[0-9a-f]{8}-/.test(value) || // UUID
          /^(http|https):\/\//.test(value) || // URLs
          value.includes("@") || // emails
          /^ey[A-Za-z0-9]/.test(value) || // JWT tokens
          value.startsWith("{") || value.startsWith("[") // JSON
        ) {
          result[key] = value
        } else {
          result[key] = value.toUpperCase()
        }
      } else {
        result[key] = value
      }
    }
    return result
  }
  return data
}

class QueryBuilder implements PromiseLike<QueryResult> {
  private state: QueryState

  constructor(table: string, action?: "insert" | "update" | "delete" | "upsert", data?: any) {
    this.state = {
      table,
      action: action || "select",
      filters: [],
      data,
    }
  }

  select(fields: string = "*", _options?: { count?: string; head?: boolean }): QueryBuilder {
    if (this.state.action === "select" || !this.state.data) {
      this.state.action = "select"
    }
    this.state.selectFields = fields
    return this
  }

  insert(data: any): QueryBuilder {
    this.state.action = "insert"
    this.state.data = data
    return this
  }

  upsert(data: any, options?: { onConflict?: string | string[]; ignoreDuplicates?: boolean }): QueryBuilder {
    this.state.action = "upsert"
    this.state.data = data
    if (options?.onConflict) {
      this.state.onConflictStr = Array.isArray(options.onConflict) ? options.onConflict.join(",") : options.onConflict
    }
    return this
  }

  update(data: any): QueryBuilder {
    this.state.action = "update"
    this.state.data = data
    return this
  }

  delete(): QueryBuilder {
    this.state.action = "delete"
    return this
  }

  // Filters
  eq(column: string, value: any): QueryBuilder {
    this.state.filters.push({ column, operator: "eq", value })
    return this
  }

  neq(column: string, value: any): QueryBuilder {
    this.state.filters.push({ column, operator: "neq", value })
    return this
  }

  gt(column: string, value: any): QueryBuilder {
    this.state.filters.push({ column, operator: "gt", value })
    return this
  }

  gte(column: string, value: any): QueryBuilder {
    this.state.filters.push({ column, operator: "gte", value })
    return this
  }

  lt(column: string, value: any): QueryBuilder {
    this.state.filters.push({ column, operator: "lt", value })
    return this
  }

  lte(column: string, value: any): QueryBuilder {
    this.state.filters.push({ column, operator: "lte", value })
    return this
  }

  like(column: string, value: string): QueryBuilder {
    this.state.filters.push({ column, operator: "like", value })
    return this
  }

  ilike(column: string, value: string): QueryBuilder {
    this.state.filters.push({ column, operator: "ilike", value })
    return this
  }

  in(column: string, values: any[]): QueryBuilder {
    this.state.filters.push({ column, operator: "in", value: values })
    return this
  }

  is(column: string, value: any): QueryBuilder {
    this.state.filters.push({ column, operator: "is", value })
    return this
  }

  not(column: string, operator: string, value: any): QueryBuilder {
    this.state.filters.push({ column, operator: "not", value: { operator, value } })
    return this
  }

  or(expression: string): QueryBuilder {
    this.state.filters.push({ column: "", operator: "or", value: expression })
    return this
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder {
    this.state.orderBy = { column, ascending: options?.ascending ?? true }
    return this
  }

  limit(count: number): QueryBuilder {
    this.state.limitCount = count
    return this
  }

  range(from: number, to: number): QueryBuilder {
    // Approximate range with limit (offset not directly supported, but we pass it)
    this.state.limitCount = to - from + 1
    return this
  }

  single(): QueryBuilder {
    this.state.isSingle = true
    return this
  }

  maybeSingle(): QueryBuilder {
    this.state.isSingle = true
    this.state.isMaybeSingle = true
    return this
  }

  /**
   * Makes QueryBuilder thenable — so `await db.from("x").select()` works
   * without needing .execute()
   */
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  /**
   * Execute the query against /api/db with authentication.
   */
  private async execute(): Promise<QueryResult> {
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null

    if (!token) {
      return { data: null, error: { message: "No autenticado" } }
    }

    try {
      const body: any = {
        action: this.state.action,
        table: this.state.table,
      }

      if (this.state.selectFields) body.select = this.state.selectFields
      if (this.state.data !== undefined) body.data = uppercaseData(this.state.data)
      if (this.state.filters.length > 0) body.filters = this.state.filters
      if (this.state.orderBy) body.order = this.state.orderBy
      if (this.state.limitCount) body.limit = this.state.limitCount
      if (this.state.isSingle) body.single = true
      if (this.state.isMaybeSingle) body.maybeSingle = true
      if (this.state.onConflictStr) body.onConflict = this.state.onConflictStr

      const res = await fetch("/api/db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok) {
        return { data: null, error: { message: json.error || "Error en la petición", status: res.status } }
      }

      return { data: json.data, error: null, count: json.count }
    } catch (error: any) {
      return { data: null, error: { message: error.message || "Error de conexión" } }
    }
  }
}

class SecureDbClient {
  from(table: string) {
    return {
      select(fields: string = "*", _options?: { count?: string; head?: boolean }) {
        const qb = new QueryBuilder(table)
        return qb.select(fields)
      },
      insert(data: any) {
        return new QueryBuilder(table, "insert", data)
      },
      upsert(data: any, options?: { onConflict?: string | string[]; ignoreDuplicates?: boolean }) {
        const qb = new QueryBuilder(table, "upsert", data)
        if (options?.onConflict) {
          const conflict = Array.isArray(options.onConflict) ? options.onConflict.join(",") : options.onConflict
          qb.upsert(data, { onConflict: conflict })
        }
        return qb
      },
      update(data: any) {
        return new QueryBuilder(table, "update", data)
      },
      delete() {
        return new QueryBuilder(table, "delete")
      },
    }
  }
}

/**
 * Drop-in replacement for supabase client.
 * Use `db` everywhere instead of `supabase` for secure data access.
 * 
 * Each request:
 * 1. Sends the user's JWT
 * 2. Server verifies the JWT is valid
 * 3. Verifies user has permission on the module that owns the table
 * 4. Executes query with service_key (bypasses RLS)
 * 5. Strips blocked fields (like password_hash) before returning
 */
export const db = new SecureDbClient()

// Re-export as "supabase" alias for easier migration
export { db as supabase }
