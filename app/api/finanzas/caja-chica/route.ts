/**
 * POST /api/finanzas/caja-chica
 *
 * Gestión de Efectivo de Caja Chica: crea/edita/elimina el movimiento en
 * `caja_chica_movimientos` Y su ingreso vinculado en `ingresos`, de forma
 * ATÓMICA en el servidor (service_role), evitando el fallo silencioso por
 * permisos que causaba descuadres.
 *
 * El ingreso vinculado se identifica por:
 *   concepto = "auto-caja-chica", detalle = "Gestion de Efectivo - {responsable}", mes_id.
 *
 * Body: { action, ...payload }
 *   create: { input: GestionEfectivoInput, usuario }
 *   update: { id, input: GestionEfectivoInput, usuario }
 *   delete: { id, usuario }
 *   sync:   { mes_id }   // reconciliación del mes
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

interface GestionEfectivoInput {
  fecha: string
  responsable: string
  valor: number
  detalle: string
  metodo_pago: string
  mes_id: string
}

function ingresoInputFromGestion(input: GestionEfectivoInput) {
  return {
    mes_id: input.mes_id,
    concepto: "auto-caja-chica",
    monto: input.valor,
    fecha: input.fecha,
    ministerio: "Administracion",
    categoria_principal: "Caja Chica",
    detalle: `Gestion de Efectivo - ${input.responsable}`,
    observacion: `${input.detalle} (${input.metodo_pago})`,
    estado: "Procesado",
    metodo_pago: "Transferencia",
  }
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

  const action = body?.action as "create" | "update" | "delete" | "sync"
  const usuarioId = body?.usuario?.id || auth.userId || "sistema"
  const usuarioNombre =
    body?.usuario?.nombre || jwtPayload?.displayName || jwtPayload?.username || "Sistema"

  try {
    // ───────────────────────────── CREATE ─────────────────────────────
    if (action === "create") {
      const input = body.input as GestionEfectivoInput
      if (!input?.mes_id || !input?.fecha || !input?.responsable || input?.valor == null) {
        return NextResponse.json({ error: "Datos de gestión incompletos" }, { status: 400 })
      }

      // 1. Crear movimiento base (INGRESO en caja_chica_movimientos)
      const { data: mov, error: movErr } = await db
        .from("caja_chica_movimientos")
        .insert({
          fecha: input.fecha,
          tipo: "Ingreso",
          concepto: "Gestion de Efectivo",
          detalle: input.detalle,
          monto: input.valor,
          metodo_pago: input.metodo_pago,
          responsable: input.responsable,
          mes_id: input.mes_id,
        })
        .select()
        .single()
      if (movErr || !mov) throw new Error(movErr?.message || "Error creando el movimiento")

      // 2. Ingreso vinculado — con rollback si falla
      try {
        await upsertMovimientoVinculado("ingresos", ingresoInputFromGestion(input))
      } catch (syncErr: any) {
        await db.from("caja_chica_movimientos").delete().eq("id", mov.id)
        throw new Error(
          "No se pudo registrar el ingreso vinculado, se revirtió el movimiento: " + syncErr.message,
        )
      }

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "caja_chica", action: "crear",
        description: `Gestion de Efectivo: ${input.responsable} - $${input.valor}`,
        details: { responsable: input.responsable, monto: input.valor, metodo_pago: input.metodo_pago },
      })

      return NextResponse.json({ ok: true, data: mov })
    }

    // ───────────────────────────── UPDATE ─────────────────────────────
    if (action === "update") {
      const id = body.id as number
      const input = body.input as GestionEfectivoInput
      if (!id || !input) {
        return NextResponse.json({ error: "id e input son requeridos" }, { status: 400 })
      }

      const { data: antes } = await db
        .from("caja_chica_movimientos").select("*").eq("id", id).maybeSingle()
      if (!antes) {
        return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 })
      }

      // 1. Actualizar movimiento base
      const { data: despues, error: updErr } = await db
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
      if (updErr || !despues) throw new Error(updErr?.message || "Error actualizando el movimiento")

      // 2. Sincronizar ingreso vinculado (busca por detalle con responsable ANTERIOR)
      try {
        await upsertMovimientoVinculado(
          "ingresos",
          ingresoInputFromGestion(input),
          `Gestion de Efectivo - ${antes.responsable}`,
        )
      } catch (syncErr: any) {
        // Rollback a estado anterior
        await db.from("caja_chica_movimientos").update({
          fecha: antes.fecha, detalle: antes.detalle, monto: antes.monto,
          metodo_pago: antes.metodo_pago, responsable: antes.responsable,
          updated_at: new Date().toISOString(),
        }).eq("id", id)
        throw new Error(
          "No se pudo sincronizar el ingreso vinculado, se revirtió la edición: " + syncErr.message,
        )
      }

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "caja_chica", action: "editar",
        description: `Gestion editada: ${input.responsable} - $${input.valor}`,
        details: { id, antes: { responsable: antes.responsable, monto: antes.monto }, despues: { responsable: input.responsable, monto: input.valor } },
      })

      return NextResponse.json({ ok: true, data: despues })
    }

    // ───────────────────────────── DELETE ─────────────────────────────
    if (action === "delete") {
      const id = body.id as number
      if (!id) return NextResponse.json({ error: "id es requerido" }, { status: 400 })

      const { data: actual } = await db
        .from("caja_chica_movimientos").select("*").eq("id", id).maybeSingle()

      const { error: delErr } = await db.from("caja_chica_movimientos").delete().eq("id", id)
      if (delErr) throw new Error(delErr.message || "Error eliminando el movimiento")

      if (actual) {
        await deleteMovimientoVinculado("ingresos", {
          concepto: "auto-caja-chica",
          detalle: `Gestion de Efectivo - ${actual.responsable}`,
          mes_id: actual.mes_id,
        })
      }

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "caja_chica", action: "eliminar",
        description: `Gestion eliminada: ${actual?.responsable} - $${actual?.monto}`,
        details: { id, responsable: actual?.responsable, monto: actual?.monto },
      })

      return NextResponse.json({ ok: true })
    }

    // ───────────────────────────── SYNC ─────────────────────────────
    // Reconcilia los ingresos auto-caja-chica del mes: crea faltantes,
    // corrige monto/metodo desincronizado y elimina huérfanos.
    if (action === "sync") {
      const mesId = body.mes_id as string
      if (!mesId) return NextResponse.json({ error: "mes_id es requerido" }, { status: 400 })

      const { data: gestiones, error: gErr } = await db
        .from("caja_chica_movimientos")
        .select("*")
        .eq("mes_id", mesId)
        .eq("concepto", "Gestion de Efectivo")
      if (gErr) throw new Error("Error consultando gestiones: " + gErr.message)

      const { data: ingresosExistentes, error: iErr } = await db
        .from("ingresos")
        .select("id, detalle, monto, metodo_pago")
        .eq("concepto", "auto-caja-chica")
        .eq("mes_id", mesId)
      if (iErr) throw new Error("Error consultando ingresos: " + iErr.message)

      const ingresosMap = new Map<string, { id: number; monto: number; metodo_pago: string }>()
      for (const ing of ingresosExistentes || []) {
        ingresosMap.set(ing.detalle, { id: ing.id, monto: Number(ing.monto), metodo_pago: ing.metodo_pago })
      }

      const detallesActivos = new Set<string>()
      let creados = 0, corregidos = 0, eliminados = 0

      for (const g of gestiones || []) {
        const detalle = `Gestion de Efectivo - ${g.responsable}`
        detallesActivos.add(detalle)
        const existente = ingresosMap.get(detalle)
        if (!existente) {
          await upsertMovimientoVinculado("ingresos", ingresoInputFromGestion({
            fecha: g.fecha, responsable: g.responsable, valor: g.monto,
            detalle: g.detalle, metodo_pago: g.metodo_pago, mes_id: mesId,
          }))
          creados++
        } else if (existente.metodo_pago !== "Transferencia" || existente.monto !== Number(g.monto)) {
          await db.from("ingresos").update({ metodo_pago: "Transferencia", monto: g.monto }).eq("id", existente.id)
          corregidos++
        }
      }

      for (const [detalle, ing] of ingresosMap) {
        if (!detallesActivos.has(detalle)) {
          await db.from("ingresos").delete().eq("id", ing.id)
          eliminados++
        }
      }

      return NextResponse.json({ ok: true, creados, corregidos, eliminados })
    }

    return NextResponse.json({ error: `Acción "${action}" no soportada` }, { status: 400 })
  } catch (error: any) {
    console.error("[/api/finanzas/caja-chica]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
