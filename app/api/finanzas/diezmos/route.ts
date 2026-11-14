/**
 * POST /api/finanzas/diezmos
 *
 * Registra, edita o elimina un diezmo Y su ingreso vinculado de forma ATÓMICA
 * en el servidor con service_role, evitando el fallo silencioso que ocurría
 * cuando la escritura a `ingresos` se hacía desde el cliente y era rechazada
 * por permisos (403) sin que nadie lo notara → descuadre de dinero.
 *
 * Body: { action: "create" | "update" | "delete", ...payload }
 *   create: { diezmo: {...}, usuario: {id, nombre} }
 *   update: { id, updates: {...}, usuario: {id, nombre} }
 *   delete: { id, usuario: {id, nombre} }
 *
 * El "ingreso vinculado" se identifica por (concepto = "auto-diezmo", detalle,
 * mes_id) y solo existe cuando `transaccion === "transferencia"`. El detalle y
 * el payload los construye `lib/server/diezmos-ingreso.ts`, compartido con el
 * detector de discrepancias.
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as db } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"
import { verifyToken } from "@/lib/jwt"
import {
  upsertMovimientoVinculado,
  deleteMovimientoVinculado,
  logAuditServer,
} from "@/lib/server/finanzas-sync"
import {
  descripcionDiezmo,
  detalleIngresoDiezmo,
  ingresoInputDesdeDiezmo,
} from "@/lib/server/diezmos-ingreso"
import { etiquetaTipoOfrenda, type TipoOfrenda } from "@/lib/mod/diezmos-tipos"

interface DiezmoPayload {
  mes_id: string
  numero: number
  fecha: string
  donador: string
  valor: number
  tipo_ofrenda: TipoOfrenda
  transaccion: "efectivo" | "transferencia"
}

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const token = request.headers.get("authorization")?.slice(7) ?? ""
  const jwtPayload = await verifyToken(token)

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const action = body?.action as "create" | "update" | "delete"
  const usuarioId = body?.usuario?.id || auth.userId || "sistema"
  const usuarioNombre =
    body?.usuario?.nombre || jwtPayload?.displayName || jwtPayload?.username || "Sistema"

  try {
    // ───────────────────────────── CREATE ─────────────────────────────
    if (action === "create") {
      const diezmo = body.diezmo as DiezmoPayload
      if (!diezmo?.mes_id || !diezmo?.fecha || !diezmo?.donador || diezmo?.valor == null) {
        return NextResponse.json({ error: "Datos de diezmo incompletos" }, { status: 400 })
      }

      // 1. Insertar el diezmo (registro base)
      const { data: creado, error: insErr } = await db
        .from("diezmos")
        .insert({
          mes_id: diezmo.mes_id,
          numero: diezmo.numero,
          fecha: diezmo.fecha,
          donador: diezmo.donador,
          valor: diezmo.valor,
          tipo_ofrenda: diezmo.tipo_ofrenda,
          transaccion: diezmo.transaccion,
        })
        .select()
        .single()

      if (insErr || !creado) {
        throw new Error(insErr?.message || "Error creando el diezmo")
      }

      // 2. Ingreso vinculado (solo transferencia) — con rollback si falla
      if (diezmo.transaccion === "transferencia") {
        try {
          await upsertMovimientoVinculado("ingresos", ingresoInputDesdeDiezmo(creado))
        } catch (syncErr: any) {
          // Rollback: eliminar el diezmo recién creado para no dejar descuadre
          await db.from("diezmos").delete().eq("id", creado.id)
          throw new Error(
            "No se pudo registrar el ingreso vinculado, se revirtió el diezmo: " + syncErr.message,
          )
        }
      }

      logAuditServer({
        user_id: usuarioId,
        user_name: usuarioNombre,
        module: "diezmos",
        action: "crear",
        description: descripcionDiezmo(creado),
        details: {
          numero: creado.numero, fecha: creado.fecha, donador: creado.donador,
          valor: creado.valor, tipo_ofrenda: creado.tipo_ofrenda,
          transaccion: creado.transaccion, mes_id: creado.mes_id,
        },
      })

      return NextResponse.json({ ok: true, data: creado })
    }

    // ───────────────────────────── UPDATE ─────────────────────────────
    if (action === "update") {
      const id = body.id as number
      const updates = body.updates as Partial<DiezmoPayload>
      if (!id || !updates) {
        return NextResponse.json({ error: "id y updates son requeridos" }, { status: 400 })
      }

      // 0. Estado previo (para sincronizar/eliminar el ingreso correcto)
      const { data: antes, error: antesErr } = await db
        .from("diezmos").select("*").eq("id", id).single()
      if (antesErr || !antes) {
        return NextResponse.json({ error: "Diezmo no encontrado" }, { status: 404 })
      }

      // 1. Actualizar el diezmo
      const { data: despues, error: updErr } = await db
        .from("diezmos")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single()
      if (updErr || !despues) {
        throw new Error(updErr?.message || "Error actualizando el diezmo")
      }

      // 2. Sincronizar ingreso vinculado según transición de transacción.
      //    La clave de búsqueda usa el donador y el tipo ANTERIORES, por si
      //    cambiaron: así se actualiza el ingreso que ya existe en lugar de
      //    crear otro y duplicar el dinero.
      const oldDetalle = detalleIngresoDiezmo(despues, {
        donador: antes.donador,
        tipo_ofrenda: antes.tipo_ofrenda,
      })
      try {
        if (despues.transaccion === "transferencia") {
          // Crear o actualizar el ingreso vinculado
          await upsertMovimientoVinculado(
            "ingresos",
            ingresoInputDesdeDiezmo(despues),
            oldDetalle,
          )
        } else {
          // Pasó a efectivo → eliminar el ingreso vinculado si existía
          await deleteMovimientoVinculado("ingresos", {
            concepto: "auto-diezmo",
            detalle: oldDetalle,
            mes_id: antes.mes_id,
          })
        }
      } catch (syncErr: any) {
        // Rollback: restaurar el diezmo a su estado anterior
        await db.from("diezmos").update({
          mes_id: antes.mes_id, numero: antes.numero, fecha: antes.fecha,
          donador: antes.donador, valor: antes.valor, tipo_ofrenda: antes.tipo_ofrenda,
          transaccion: antes.transaccion, updated_at: new Date().toISOString(),
        }).eq("id", id)
        throw new Error(
          "No se pudo sincronizar el ingreso vinculado, se revirtió la edición: " + syncErr.message,
        )
      }

      logAuditServer({
        user_id: usuarioId,
        user_name: usuarioNombre,
        module: "diezmos",
        action: "editar",
        description: descripcionDiezmo(despues),
        details: {
          antes: { numero: antes.numero, fecha: antes.fecha, donador: antes.donador, valor: antes.valor },
          despues: { numero: despues.numero, fecha: despues.fecha, donador: despues.donador, valor: despues.valor },
        },
      })

      return NextResponse.json({ ok: true, data: despues })
    }

    // ───────────────────────────── DELETE ─────────────────────────────
    if (action === "delete") {
      const id = body.id as number
      if (!id) {
        return NextResponse.json({ error: "id es requerido" }, { status: 400 })
      }

      const { data: actual } = await db.from("diezmos").select("*").eq("id", id).maybeSingle()

      const { error: delErr } = await db.from("diezmos").delete().eq("id", id)
      if (delErr) {
        throw new Error(delErr.message || "Error eliminando el diezmo")
      }

      // Eliminar ingreso vinculado si era transferencia
      if (actual && actual.transaccion === "transferencia") {
        await deleteMovimientoVinculado("ingresos", {
          concepto: "auto-diezmo",
          detalle: detalleIngresoDiezmo(actual),
          mes_id: actual.mes_id,
        })
      }

      logAuditServer({
        user_id: usuarioId,
        user_name: usuarioNombre,
        module: "diezmos",
        action: "eliminar",
        description: actual
          ? descripcionDiezmo(actual)
          : `Registro de diezmos #${id}`,
        details: {
          id,
          numero: actual?.numero,
          donador: actual?.donador,
          valor: actual?.valor,
          tipo_ofrenda: actual?.tipo_ofrenda,
          tipo: actual ? etiquetaTipoOfrenda(actual.tipo_ofrenda) : undefined,
        },
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: `Acción "${action}" no soportada` }, { status: 400 })
  } catch (error: any) {
    console.error("[/api/finanzas/diezmos]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
