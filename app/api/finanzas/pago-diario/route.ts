/**
 * POST /api/finanzas/pago-diario
 *
 * Pago Diario: crea/edita/elimina el registro en `pago_diario` Y su egreso
 * vinculado en `egresos`, de forma ATÓMICA en el servidor (service_role).
 * Evita el fallo silencioso por permisos sobre `egresos` que causaba descuadres.
 *
 * El egreso vinculado se identifica por:
 *   concepto = "auto-pago-diario", detalle = "Pago diario - {nombre}", mes_id
 *   (+ observacion = detalle del pago, usado al editar para desambiguar).
 *
 * Body: { action, ...payload }
 *   create: { record, usuario }
 *   update: { id, updates, usuario }
 *   delete: { id, usuario }
 *   sync:   { mes_id }
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as db } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"
import { verifyToken } from "@/lib/jwt"
import { logAuditServer } from "@/lib/server/finanzas-sync"

interface PagoDiarioInput {
  mes_id: string
  fecha: string
  nombre: string
  telefono: string | null
  email: string | null
  ministerio: string
  categoria: string
  detalle: string
  valor: number
  metodo_pago: string
}

/** Payload del egreso vinculado a un pago diario. */
function egresoRowFromPago(r: {
  mes_id: string; fecha: string; nombre: string; ministerio: string
  categoria: string; detalle: string; valor: number; metodo_pago: string
}) {
  return {
    mes_id: r.mes_id,
    concepto: "auto-pago-diario",
    monto: r.valor,
    fecha: r.fecha,
    ministerio: r.ministerio,
    categoria_principal: r.categoria,
    detalle: `Pago diario - ${r.nombre}`,
    observacion: r.detalle,
    estado: "Procesado",
    metodo_pago: r.metodo_pago,
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
      const record = body.record as PagoDiarioInput
      if (!record?.mes_id || !record?.fecha || !record?.nombre || record?.valor == null) {
        return NextResponse.json({ error: "Datos de pago incompletos" }, { status: 400 })
      }

      // 1. Insertar pago diario (registro base)
      const { data: creado, error: insErr } = await db
        .from("pago_diario")
        .insert({
          mes_id: record.mes_id,
          fecha: record.fecha,
          nombre: record.nombre,
          telefono: record.telefono || null,
          email: record.email || null,
          ministerio: record.ministerio,
          categoria: record.categoria,
          detalle: record.detalle,
          valor: record.valor,
          metodo_pago: record.metodo_pago,
        })
        .select()
        .single()
      if (insErr || !creado) throw new Error(insErr?.message || "Error creando el pago")

      // 2. Egreso vinculado — con rollback si falla
      const { error: egErr } = await db.from("egresos").insert(egresoRowFromPago(creado))
      if (egErr) {
        await db.from("pago_diario").delete().eq("id", creado.id)
        throw new Error(
          "No se pudo registrar el egreso vinculado, se revirtió el pago: " + egErr.message,
        )
      }

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "pago_diario", action: "crear",
        description: `Pago: ${creado.nombre} - $${creado.valor} (${creado.detalle})`,
        details: { nombre: creado.nombre, valor: creado.valor, ministerio: creado.ministerio, detalle: creado.detalle, fecha: creado.fecha, metodo_pago: creado.metodo_pago },
      })

      return NextResponse.json({ ok: true, data: creado })
    }

    // ───────────────────────────── UPDATE ─────────────────────────────
    if (action === "update") {
      const id = body.id as number
      const updates = body.updates as Partial<PagoDiarioInput>
      if (!id || !updates) {
        return NextResponse.json({ error: "id y updates son requeridos" }, { status: 400 })
      }

      const { data: antes, error: antesErr } = await db
        .from("pago_diario").select("*").eq("id", id).single()
      if (antesErr || !antes) {
        return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
      }

      // 1. Actualizar pago diario
      const { data: despues, error: updErr } = await db
        .from("pago_diario")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single()
      if (updErr || !despues) throw new Error(updErr?.message || "Error actualizando el pago")

      // 2. Sincronizar egreso vinculado (busca por datos ANTERIORES)
      try {
        const { data: egreso, error: findErr } = await db
          .from("egresos")
          .select("id")
          .eq("concepto", "auto-pago-diario")
          .eq("detalle", `Pago diario - ${antes.nombre}`)
          .eq("mes_id", antes.mes_id)
          .eq("observacion", antes.detalle)
          .limit(1)
          .maybeSingle()
        if (findErr) throw new Error(findErr.message)

        if (egreso) {
          const { error: eUpdErr } = await db.from("egresos").update({
            monto: despues.valor,
            fecha: despues.fecha,
            ministerio: despues.ministerio,
            categoria_principal: despues.categoria,
            detalle: `Pago diario - ${despues.nombre}`,
            observacion: despues.detalle,
            metodo_pago: despues.metodo_pago,
          }).eq("id", egreso.id)
          if (eUpdErr) throw new Error(eUpdErr.message)
        } else {
          // No existía egreso → crearlo para no dejar descuadre
          const { error: eInsErr } = await db.from("egresos").insert(egresoRowFromPago(despues))
          if (eInsErr) throw new Error(eInsErr.message)
        }
      } catch (syncErr: any) {
        // Rollback del pago a estado anterior
        await db.from("pago_diario").update({
          mes_id: antes.mes_id, fecha: antes.fecha, nombre: antes.nombre,
          telefono: antes.telefono, email: antes.email, ministerio: antes.ministerio,
          categoria: antes.categoria, detalle: antes.detalle, valor: antes.valor,
          metodo_pago: antes.metodo_pago, updated_at: new Date().toISOString(),
        }).eq("id", id)
        throw new Error(
          "No se pudo sincronizar el egreso vinculado, se revirtió la edición: " + syncErr.message,
        )
      }

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "pago_diario", action: "editar",
        description: `Pago editado: ${despues.nombre} - $${despues.valor}`,
        details: { antes: { nombre: antes.nombre, valor: antes.valor, detalle: antes.detalle }, despues: { nombre: despues.nombre, valor: despues.valor, detalle: despues.detalle } },
      })

      return NextResponse.json({ ok: true, data: despues })
    }

    // ───────────────────────────── DELETE ─────────────────────────────
    if (action === "delete") {
      const id = body.id as number
      if (!id) return NextResponse.json({ error: "id es requerido" }, { status: 400 })

      const { data: actual } = await db.from("pago_diario").select("*").eq("id", id).maybeSingle()

      const { error: delErr } = await db.from("pago_diario").delete().eq("id", id)
      if (delErr) throw new Error(delErr.message || "Error eliminando el pago")

      if (actual) {
        const { error: egDelErr } = await db
          .from("egresos")
          .delete()
          .eq("concepto", "auto-pago-diario")
          .eq("detalle", `Pago diario - ${actual.nombre}`)
          .eq("mes_id", actual.mes_id)
        if (egDelErr) throw new Error("Error eliminando egreso vinculado: " + egDelErr.message)
      }

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "pago_diario", action: "eliminar",
        description: `Pago eliminado: ${actual?.nombre} - $${actual?.valor}`,
        details: { id, nombre: actual?.nombre, valor: actual?.valor, detalle: actual?.detalle },
      })

      return NextResponse.json({ ok: true })
    }

    // ───────────────────────────── SYNC ─────────────────────────────
    if (action === "sync") {
      const mesId = body.mes_id as string
      if (!mesId) return NextResponse.json({ error: "mes_id es requerido" }, { status: 400 })

      const { data: pagos, error: pErr } = await db.from("pago_diario").select("*").eq("mes_id", mesId)
      if (pErr) throw new Error("Error consultando pagos: " + pErr.message)
      if (!pagos || pagos.length === 0) return NextResponse.json({ ok: true, creados: 0 })

      const { data: egresosExistentes, error: eErr } = await db
        .from("egresos").select("detalle, monto, observacion").eq("mes_id", mesId).eq("concepto", "auto-pago-diario")
      if (eErr) throw new Error("Error consultando egresos: " + eErr.message)

      const existingSet = new Set((egresosExistentes || []).map((e: any) => `${e.detalle}|${e.monto}|${e.observacion}`))
      let creados = 0
      for (const record of pagos) {
        const key = `Pago diario - ${record.nombre}|${record.valor}|${record.detalle}`
        if (!existingSet.has(key)) {
          const { error } = await db.from("egresos").insert(egresoRowFromPago(record))
          if (error) throw new Error("Error creando egreso faltante: " + error.message)
          creados++
        }
      }

      return NextResponse.json({ ok: true, creados })
    }

    return NextResponse.json({ error: `Acción "${action}" no soportada` }, { status: 400 })
  } catch (error: any) {
    console.error("[/api/finanzas/pago-diario]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
