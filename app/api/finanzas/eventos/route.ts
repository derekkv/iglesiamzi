/**
 * POST /api/finanzas/eventos
 *
 * Sincroniza el INGRESO vinculado a un participante de evento (abono) en la
 * tabla `ingresos`, de forma server-side con service_role. Evita el fallo
 * silencioso por permisos sobre `ingresos` que causaba descuadres/duplicados.
 *
 * A diferencia de diezmos/caja-chica/pago-diario, aquí el registro base
 * (evento_participantes) lo sigue gestionando el cliente (su módulo
 * `eventos_encuentro` sí tiene permiso sobre esa tabla); SOLO la escritura a
 * `ingresos` se mueve al servidor, que es donde estaba el 403.
 *
 * El ingreso vinculado se identifica por:
 *   concepto = "auto-evento", detalle = "Abono evento - {nombre} ({evento})", mes_id.
 *
 * Body: { action, ...payload }
 *   ingreso-upsert: { mes_id, nombre, evento_nombre, abono, valor, metodo_pago, keyNombre? }
 *   ingreso-delete: { mes_id?, nombre, evento_nombre }
 *   rename:         { nombre_viejo, nombre_nuevo }
 *   sync:           { mes_id, evento_nombre, participantes: [{nombre, abono, valor, metodo_pago}] }
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as db } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"
import {
  upsertMovimientoVinculado,
  deleteMovimientoVinculado,
} from "@/lib/server/finanzas-sync"

function ingresoDetalle(nombre: string, eventoNombre: string): string {
  return `Abono evento - ${nombre} (${eventoNombre})`
}

function ingresoInput(args: {
  mes_id: string; nombre: string; evento_nombre: string
  abono: number; valor: number; metodo_pago?: string
}) {
  return {
    mes_id: args.mes_id,
    concepto: "auto-evento",
    monto: args.abono,
    fecha: new Date().toISOString().split("T")[0],
    ministerio: "Administración",
    categoria_principal: "Ingresos x Eventos",
    detalle: ingresoDetalle(args.nombre, args.evento_nombre),
    observacion: `Abono de ${args.nombre} para ${args.evento_nombre} (valor total: $${Number(args.valor).toFixed(2)})`,
    estado: "Procesado",
    metodo_pago: args.metodo_pago || "Efectivo",
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const action = body?.action as "ingreso-upsert" | "ingreso-delete" | "rename" | "sync"

  try {
    // ─────────────────── UPSERT ingreso vinculado ───────────────────
    if (action === "ingreso-upsert") {
      const { mes_id, nombre, evento_nombre, abono, valor, metodo_pago, keyNombre } = body
      if (!mes_id || !nombre || !evento_nombre) {
        return NextResponse.json({ error: "mes_id, nombre y evento_nombre requeridos" }, { status: 400 })
      }
      // Si el abono es 0 o menos, no debe existir ingreso → eliminar si lo había
      if (Number(abono) <= 0) {
        await deleteMovimientoVinculado("ingresos", {
          concepto: "auto-evento",
          detalle: ingresoDetalle(keyNombre || nombre, evento_nombre),
          mes_id,
        })
        return NextResponse.json({ ok: true, deleted: true })
      }
      const keyDetalle = keyNombre ? ingresoDetalle(keyNombre, evento_nombre) : undefined
      const r = await upsertMovimientoVinculado(
        "ingresos",
        ingresoInput({ mes_id, nombre, evento_nombre, abono, valor, metodo_pago }),
        keyDetalle,
      )
      return NextResponse.json({ ok: true, id: r.id, created: r.created })
    }

    // ─────────────────── DELETE ingreso vinculado ───────────────────
    if (action === "ingreso-delete") {
      const { mes_id, nombre, evento_nombre } = body
      if (!nombre || !evento_nombre) {
        return NextResponse.json({ error: "nombre y evento_nombre requeridos" }, { status: 400 })
      }
      // Borrado por detalle; si viene mes_id se acota, si no, por concepto+detalle global.
      if (mes_id) {
        await deleteMovimientoVinculado("ingresos", {
          concepto: "auto-evento",
          detalle: ingresoDetalle(nombre, evento_nombre),
          mes_id,
        })
      } else {
        const { error } = await db
          .from("ingresos")
          .delete()
          .eq("concepto", "auto-evento")
          .eq("detalle", ingresoDetalle(nombre, evento_nombre))
        if (error) throw new Error(error.message)
      }
      return NextResponse.json({ ok: true })
    }

    // ─────────────────── RENAME evento (re-vincular) ───────────────────
    if (action === "rename") {
      const { nombre_viejo, nombre_nuevo } = body
      if (!nombre_viejo || !nombre_nuevo || nombre_viejo === nombre_nuevo) {
        return NextResponse.json({ ok: true, actualizados: 0 })
      }
      const sufijoViejo = `(${nombre_viejo})`
      const { data: ings, error } = await db
        .from("ingresos")
        .select("id, detalle, observacion")
        .eq("concepto", "auto-evento")
        .like("detalle", `%${sufijoViejo}`)
      if (error) throw new Error(error.message)

      let actualizados = 0
      for (const ing of ings || []) {
        if (!String(ing.detalle).endsWith(sufijoViejo)) continue
        const nuevoDetalle = String(ing.detalle).slice(0, -sufijoViejo.length) + `(${nombre_nuevo})`
        const nuevaObs = String(ing.observacion || "").split(nombre_viejo).join(nombre_nuevo)
        const { error: updErr } = await db
          .from("ingresos")
          .update({ detalle: nuevoDetalle, observacion: nuevaObs })
          .eq("id", ing.id)
        if (updErr) throw new Error(updErr.message)
        actualizados++
      }
      return NextResponse.json({ ok: true, actualizados })
    }

    // ─────────────────── SYNC evento completo ───────────────────
    if (action === "sync") {
      const { mes_id, evento_nombre, participantes } = body as {
        mes_id: string; evento_nombre: string
        participantes: { nombre: string; abono: number; valor: number; metodo_pago?: string }[]
      }
      if (!mes_id || !evento_nombre || !Array.isArray(participantes)) {
        return NextResponse.json({ error: "mes_id, evento_nombre y participantes requeridos" }, { status: 400 })
      }

      const sufijo = `(${evento_nombre})`
      const { data: ingresosExistentes, error: iErr } = await db
        .from("ingresos")
        .select("id, detalle, monto, metodo_pago")
        .eq("concepto", "auto-evento")
        .eq("mes_id", mes_id)
      if (iErr) throw new Error(iErr.message)

      const ingresosMap = new Map<string, { id: number; monto: number; metodo_pago: string }>()
      for (const ing of ingresosExistentes || []) {
        if (!String(ing.detalle).endsWith(sufijo)) continue
        ingresosMap.set(ing.detalle, { id: ing.id, monto: Number(ing.monto), metodo_pago: ing.metodo_pago })
      }

      let creados = 0, actualizados = 0, eliminados = 0
      const detallesActivos = new Set<string>()

      for (const p of participantes) {
        if (Number(p.abono) <= 0) continue
        const detalle = ingresoDetalle(p.nombre, evento_nombre)
        detallesActivos.add(detalle)
        const existente = ingresosMap.get(detalle)
        if (!existente) {
          await upsertMovimientoVinculado(
            "ingresos",
            ingresoInput({ mes_id, nombre: p.nombre, evento_nombre, abono: p.abono, valor: p.valor, metodo_pago: p.metodo_pago }),
          )
          creados++
        } else if (existente.monto !== Number(p.abono) || existente.metodo_pago !== (p.metodo_pago || "Efectivo")) {
          const { error } = await db.from("ingresos").update({
            monto: p.abono,
            observacion: `Abono de ${p.nombre} para ${evento_nombre} (valor total: $${Number(p.valor).toFixed(2)})`,
            metodo_pago: p.metodo_pago || "Efectivo",
          }).eq("id", existente.id)
          if (error) throw new Error(error.message)
          actualizados++
        }
      }

      for (const [detalle, ing] of ingresosMap) {
        if (!detallesActivos.has(detalle)) {
          const { error } = await db.from("ingresos").delete().eq("id", ing.id)
          if (error) throw new Error(error.message)
          eliminados++
        }
      }

      return NextResponse.json({ ok: true, creados, actualizados, eliminados })
    }

    return NextResponse.json({ error: `Acción "${action}" no soportada` }, { status: 400 })
  } catch (error: any) {
    console.error("[/api/finanzas/eventos]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
