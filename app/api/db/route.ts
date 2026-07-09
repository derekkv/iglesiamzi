import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyToken } from "@/lib/jwt"
import { TABLE_ACCESS_MAP, checkTableAccess } from "@/lib/module-table-map"

const SUPABASE_URL = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Cache simple de permisos por userId (TTL 60s)
const permissionsCache = new Map<string, { modules: string[]; canEdit: boolean; canAdmin: boolean; ts: number }>()
const CACHE_TTL = 60_000

async function getUserModules(userId: string): Promise<{ modules: string[]; canEdit: boolean; canAdmin: boolean }> {
  const cached = permissionsCache.get(userId)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached
  }

  const { data, error } = await supabase
    .from("user_permissions")
    .select(`
      can_view,
      can_edit,
      can_admin,
      module:system_modules!inner(name)
    `)
    .eq("user_id", userId)
    .eq("can_view", true)

  if (error || !data) {
    return { modules: [], canEdit: false, canAdmin: false }
  }

  const modules = data.map((p: any) => p.module?.name).filter(Boolean) as string[]
  const canEdit = data.some((p: any) => p.can_edit)
  const canAdmin = data.some((p: any) => p.can_admin)

  const result = { modules, canEdit, canAdmin, ts: Date.now() }
  permissionsCache.set(userId, result)
  return result
}

/**
 * Verifica si un usuario tiene can_edit en al menos uno de los módulos de una tabla
 */
async function getUserEditForTable(userId: string, table: string): Promise<boolean> {
  const access = TABLE_ACCESS_MAP[table]
  if (!access || access.modules === "any") return true

  const { data } = await supabase
    .from("user_permissions")
    .select(`can_edit, module:system_modules!inner(name)`)
    .eq("user_id", userId)
    .eq("can_view", true)
    .eq("can_edit", true)

  if (!data) return false
  const editModules = data.map((p: any) => p.module?.name).filter(Boolean) as string[]
  return (access.modules as string[]).some((m) => editModules.includes(m))
}

async function getUserAdminForTable(userId: string, table: string): Promise<boolean> {
  const access = TABLE_ACCESS_MAP[table]
  if (!access || access.modules === "any") return false

  const { data } = await supabase
    .from("user_permissions")
    .select(`can_admin, module:system_modules!inner(name)`)
    .eq("user_id", userId)
    .eq("can_admin", true)

  if (!data) return false
  const adminModules = data.map((p: any) => p.module?.name).filter(Boolean) as string[]
  return (access.modules as string[]).some((m) => adminModules.includes(m))
}

export interface DbRequest {
  action: "select" | "insert" | "update" | "delete" | "upsert"
  table: string
  select?: string
  data?: any
  filters?: Array<{ column: string; operator: string; value: any }>
  order?: { column: string; ascending?: boolean }
  limit?: number
  single?: boolean
  onConflict?: string
}

function stripBlockedFields(data: any, table: string): any {
  const access = TABLE_ACCESS_MAP[table]
  if (!access?.blockedFields || !data) return data

  if (Array.isArray(data)) {
    return data.map((row) => {
      const cleaned = { ...row }
      for (const field of access.blockedFields!) {
        delete cleaned[field]
      }
      return cleaned
    })
  }

  const cleaned = { ...data }
  for (const field of access.blockedFields!) {
    delete cleaned[field]
  }
  return cleaned
}

export async function POST(request: NextRequest) {
  try {
    // 1. AUTENTICACIÓN: Verificar JWT
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token de autenticación requerido" }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 })
    }

    const userId = payload.userId

    // 2. PARSEAR REQUEST
    const body = await request.json() as DbRequest
    const { action, table, select: selectFields, data, filters, order, limit, single, onConflict } = body

    if (!action || !table) {
      return NextResponse.json({ error: "action y table son requeridos" }, { status: 400 })
    }

    // 3. AUTORIZACIÓN: Verificar permisos del módulo para esta tabla
    const { modules } = await getUserModules(userId)

    const operation = action === "select" ? "select"
      : action === "insert" || action === "upsert" ? "insert"
      : action === "update" ? "update"
      : "delete"

    const canEditTable = operation !== "select" ? await getUserEditForTable(userId, table) : false
    const canAdminTable = operation === "delete" ? await getUserAdminForTable(userId, table) : false

    const accessCheck = checkTableAccess(table, modules, operation, canEditTable, canAdminTable)

    if (!accessCheck.allowed) {
      return NextResponse.json(
        { error: `Acceso denegado: ${accessCheck.reason}` },
        { status: 403 }
      )
    }

    // 4. EJECUTAR QUERY con service_key (bypassa RLS)
    let result: any

    switch (action) {
      case "select": {
        let query = supabase.from(table).select(selectFields || "*")
        if (filters) {
          for (const f of filters) {
            if (f.operator === "eq") query = query.eq(f.column, f.value)
            else if (f.operator === "neq") query = query.neq(f.column, f.value)
            else if (f.operator === "gt") query = query.gt(f.column, f.value)
            else if (f.operator === "gte") query = query.gte(f.column, f.value)
            else if (f.operator === "lt") query = query.lt(f.column, f.value)
            else if (f.operator === "lte") query = query.lte(f.column, f.value)
            else if (f.operator === "like") query = query.like(f.column, f.value)
            else if (f.operator === "ilike") query = query.ilike(f.column, f.value)
            else if (f.operator === "in") query = query.in(f.column, f.value)
            else if (f.operator === "is") query = query.is(f.column, f.value)
            else if (f.operator === "not") query = query.not(f.column, f.value.operator, f.value.value)
            else if (f.operator === "or") query = query.or(f.value)
          }
        }
        if (order) query = query.order(order.column, { ascending: order.ascending ?? true })
        if (limit) query = query.limit(limit)
        if (single) {
          result = await query.single()
        } else {
          result = await query
        }
        break
      }

      case "insert": {
        const insertQuery = supabase.from(table).insert(data).select(selectFields || "*")
        if (single) {
          result = await insertQuery.single()
        } else {
          result = await insertQuery
        }
        break
      }

      case "upsert": {
        const upsertQuery = supabase.from(table).upsert(data, onConflict ? { onConflict } : undefined).select(selectFields || "*")
        if (single) {
          result = await upsertQuery.single()
        } else {
          result = await upsertQuery
        }
        break
      }

      case "update": {
        if (!filters || filters.length === 0) {
          return NextResponse.json({ error: "UPDATE requiere al menos un filtro" }, { status: 400 })
        }
        let updateQuery: any = supabase.from(table).update(data)
        for (const f of filters) {
          if (f.operator === "eq") updateQuery = updateQuery.eq(f.column, f.value)
          else if (f.operator === "in") updateQuery = updateQuery.in(f.column, f.value)
        }
        updateQuery = updateQuery.select(selectFields || "*")
        if (single) {
          result = await updateQuery.single()
        } else {
          result = await updateQuery
        }
        break
      }

      case "delete": {
        if (!filters || filters.length === 0) {
          return NextResponse.json({ error: "DELETE requiere al menos un filtro (no se permite DELETE masivo)" }, { status: 400 })
        }
        let deleteQuery: any = supabase.from(table).delete()
        for (const f of filters) {
          if (f.operator === "eq") deleteQuery = deleteQuery.eq(f.column, f.value)
          else if (f.operator === "in") deleteQuery = deleteQuery.in(f.column, f.value)
        }
        result = await deleteQuery
        break
      }

      default:
        return NextResponse.json({ error: `Acción "${action}" no soportada` }, { status: 400 })
    }

    // 5. RETORNAR RESULTADO (sin campos bloqueados)
    if (result.error) {
      return NextResponse.json({ error: result.error.message, details: result.error }, { status: 500 })
    }

    const cleanData = stripBlockedFields(result.data, table)

    return NextResponse.json({ data: cleanData, count: result.count })
  } catch (error: any) {
    console.error("Error en /api/db:", error)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
