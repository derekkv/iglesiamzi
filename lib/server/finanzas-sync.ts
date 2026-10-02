/**
 * Helpers server-side para sincronizar registros DERIVADOS en las tablas
 * financieras `ingresos` y `egresos`.
 *
 * CONTEXTO / PROBLEMA QUE RESUELVE
 * --------------------------------
 * Varios módulos (diezmos, caja chica, eventos, pago diario, pasivos, nómina)
 * generan automáticamente un movimiento en `ingresos` o `egresos` cuando se
 * registra un dato propio (ej. un diezmo por transferencia crea un ingreso).
 *
 * Históricamente esa escritura derivada se hacía desde el browser con el
 * cliente `lib/secure-db.ts` → `/api/db`, que aplica permisos por módulo. Si el
 * usuario NO tenía permiso de edición sobre `ingresos`/`egresos`, `secure-db`
 * devolvía `{ error: { status: 403 } }` SIN lanzar excepción, y el código que
 * llamaba hacía `await supabase.from("ingresos").insert(...)` sin revisar el
 * error → el movimiento financiero NUNCA se creaba, pero el registro base sí
 * quedaba guardado → DESCUADRE DE DINERO invisible.
 *
 * SOLUCIÓN
 * --------
 * Estas funciones corren exclusivamente en el servidor con `supabaseServer`
 * (service_role), que BYPASSA el mapa de permisos de `/api/db` y RLS. Así, la
 * intención de negocio ("quien registra un diezmo debe generar su ingreso") se
 * cumple siempre, sin depender de los permisos de tabla del usuario sobre
 * `ingresos`/`egresos`. Cualquier error se PROPAGA (throw) para que el endpoint
 * que las usa pueda revertir el registro base y devolver un error explícito al
 * cliente, eliminando el fallo silencioso.
 *
 * IMPORTANTE: nunca importar este archivo desde código de cliente ("use client").
 */

import { supabaseServer } from "@/lib/supabase-server"

/** Columnas compartidas por `ingresos` y `egresos`. */
export interface MovimientoFinancieroInput {
  mes_id: string
  concepto: string
  monto: number
  fecha: string
  ministerio: string
  categoria_principal: string
  detalle: string
  observacion?: string | null
  estado?: string
  metodo_pago?: string
}

type TablaFinanciera = "ingresos" | "egresos"

/**
 * Identificador de un movimiento vinculado. Se usa el trío
 * (concepto marcador + detalle + mes_id) que ya emplean los módulos para
 * localizar su movimiento derivado.
 */
export interface MovimientoVinculadoKey {
  concepto: string
  detalle: string
  mes_id: string
}

/**
 * Crea o actualiza (idempotente) el movimiento vinculado en la tabla indicada.
 *
 * - Busca un movimiento existente por (concepto + detalle + mes_id).
 * - Si existe → UPDATE con los nuevos valores.
 * - Si no existe → INSERT.
 *
 * `keyDetalle` permite buscar por un detalle DISTINTO al nuevo (útil cuando el
 * detalle cambia porque cambió, p.ej., el nombre del donador). Si se omite, se
 * usa `input.detalle`.
 *
 * Lanza (throw) ante cualquier error de base de datos.
 */
export async function upsertMovimientoVinculado(
  tabla: TablaFinanciera,
  input: MovimientoFinancieroInput,
  keyDetalle?: string,
): Promise<{ id: number; created: boolean }> {
  const detalleBusqueda = keyDetalle ?? input.detalle

  const { data: existente, error: findErr } = await supabaseServer
    .from(tabla)
    .select("id")
    .eq("concepto", input.concepto)
    .eq("detalle", detalleBusqueda)
    .eq("mes_id", input.mes_id)
    .limit(1)
    .maybeSingle()

  if (findErr) {
    throw new Error(`Error buscando ${tabla} vinculado: ${findErr.message}`)
  }

  const payload: Record<string, any> = {
    mes_id: input.mes_id,
    concepto: input.concepto,
    monto: input.monto,
    fecha: input.fecha,
    ministerio: input.ministerio,
    categoria_principal: input.categoria_principal,
    detalle: input.detalle,
    observacion: input.observacion ?? null,
  }
  if (input.estado !== undefined) payload.estado = input.estado
  if (input.metodo_pago !== undefined) payload.metodo_pago = input.metodo_pago

  if (existente) {
    const { error: updErr } = await supabaseServer
      .from(tabla)
      .update(payload)
      .eq("id", existente.id)
    if (updErr) {
      throw new Error(`Error actualizando ${tabla} vinculado: ${updErr.message}`)
    }
    return { id: existente.id, created: false }
  }

  const { data: inserted, error: insErr } = await supabaseServer
    .from(tabla)
    .insert(payload)
    .select("id")
    .single()
  if (insErr || !inserted) {
    throw new Error(`Error creando ${tabla} vinculado: ${insErr?.message || "desconocido"}`)
  }
  return { id: inserted.id, created: true }
}

/**
 * Elimina el movimiento vinculado por (concepto + detalle + mes_id).
 * No falla si no existe (idempotente). Lanza ante error real de BD.
 */
export async function deleteMovimientoVinculado(
  tabla: TablaFinanciera,
  key: MovimientoVinculadoKey,
): Promise<void> {
  const { error } = await supabaseServer
    .from(tabla)
    .delete()
    .eq("concepto", key.concepto)
    .eq("detalle", key.detalle)
    .eq("mes_id", key.mes_id)
  if (error) {
    throw new Error(`Error eliminando ${tabla} vinculado: ${error.message}`)
  }
}

/** Elimina un movimiento vinculado por id directo. Lanza ante error de BD. */
export async function deleteMovimientoPorId(
  tabla: TablaFinanciera,
  id: number,
): Promise<void> {
  const { error } = await supabaseServer.from(tabla).delete().eq("id", id)
  if (error) {
    throw new Error(`Error eliminando ${tabla} #${id}: ${error.message}`)
  }
}


/**
 * Registra una entrada de auditoría desde el servidor (service_role),
 * fire-and-forget: nunca bloquea ni hace fallar la operación principal.
 * Equivale a `auditService.log` pero sin pasar por `/api/db`.
 */
export function logAuditServer(input: {
  user_id: string
  user_name: string
  module: string
  action: "crear" | "editar" | "eliminar"
  description: string
  details?: Record<string, any> | null
  is_ai?: boolean
  ai_authorized_by?: string | null
}): void {
  Promise.resolve(
    supabaseServer.from("audit_logs").insert({
      user_id: input.user_id,
      user_name: input.user_name,
      module: input.module,
      action: input.action,
      description: input.description,
      details: input.details ?? null,
      is_ai: input.is_ai ?? false,
      ai_authorized_by: input.ai_authorized_by ?? null,
    }),
  ).catch((e) => {
    console.error("[finanzas-sync] audit log falló:", e)
  })
}
