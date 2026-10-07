/**
 * POST /api/finanzas/eventos
 *
 * Sincroniza el INGRESO vinculado a un participante de evento (abono) en la
 * tabla `ingresos`, server-side con service_role.
 *
 * CLAVE DE DISEÑO (corrige el bug de duplicación entre meses)
 * -----------------------------------------------------------
 * Un abono de evento equivale a UN SOLO ingreso que vive en el mes real en que
 * se registró. Los eventos (ENCUENTRO, cursos, etc.) son "permanentes": sus
 * participantes persisten mes a mes. Si el ingreso se buscara/creara acotado al
 * `mes_id` activo, cada mes nuevo el sincronizador "no encontraría" el ingreso
 * del mes anterior y crearía uno nuevo → el mismo abono quedaba contado en
 * varios meses (inflando los totales).
 *
 * Por eso el ingreso vinculado se identifica SOLO por:
 *   concepto = "auto-evento"  +  detalle = "Abono evento - {nombre} ({evento})"
 * ignorando el mes. Si existe en cualquier mes → se ACTUALIZA en su sitio
 * (se preserva su mes_id y su fecha reales); si no existe en ningún mes → se
 * CREA en el mes activo. Nunca se duplica entre meses.
 *
 * Body: { action, ...payload }
 *   ingreso-upsert: { mes_id, nombre, evento_nombre, abono, valor, metodo_pago, keyNombre? }
 *   ingreso-delete: { nombre, evento_nombre }
 *   rename:         { nombre_viejo, nombre_nuevo }
 *   sync:           { mes_id, evento_nombre, participantes: [{nombre, abono, valor, metodo_pago}] }
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as db } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"

// ── Helpers ──────────────────────────────────────────────────────────────────

function ingresoDetalle(nombre: string, eventoNombre: string): string {
  return `Abono evento - ${nombre} (${eventoNombre})`
}

/** Campos base compartidos (no incluye mes_id/fecha/monto, que dependen del caso). */
function ingresoBaseFields(args: { nombre: string; evento_nombre: string; valor: number; metodo_pago?: string }) {
  return {
    concepto: "auto-evento",
    ministerio: "Administración",
    categoria_principal: "Ingresos x Eventos",
    estado: "Procesado",
    detalle: ingresoDetalle(args.nombre, args.evento_nombre),
    observacion: `Abono de ${args.nombre} para ${args.evento_nombre} (valor total: $${Number(args.valor).toFixed(2)})`,
    metodo_pago: args.metodo_pago || "Efectivo",
  }
}

interface IngresoRow {
  id: number
  mes_id: string
  monto: number
  metodo_pago: string | null
  fecha: string | null
  created_at: string
  detalle: string
}

/** Trae TODOS los ingresos auto-evento con ese detalle, en CUALQUIER mes (más antiguo primero). */
async function findIngresosPorDetalle(detalle: string): Promise<IngresoRow[]> {
  const { data, error } = await db
    .from("ingresos")
    .select("id, mes_id, monto, metodo_pago, fecha, created_at, detalle")
    .eq("concepto", "auto-evento")
    .eq("detalle", detalle)
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []) as IngresoRow[]
}

/**
 * Crea o actualiza (idempotente, cross-month) el ingreso de un abono.
 * - Si no existe en ningún mes → INSERT en `mes_id` con fecha de hoy.
 * - Si existe → UPDATE del más antiguo (preserva su mes_id/fecha reales) y
 *   elimina cualquier duplicado remanente del mismo detalle.
 * `keyDetalle` permite buscar por un detalle distinto (p.ej. nombre anterior).
 */
async function upsertIngresoEvento(args: {
  mes_id: string; nombre: string; evento_nombre: string
  abono: number; valor: number; metodo_pago?: string; keyDetalle?: string
}): Promise<{ id: number; created: boolean; dedup: number }> {
  const detalleNuevo = ingresoDetalle(args.nombre, args.evento_nombre)
  const detalleBusqueda = args.keyDetalle ?? detalleNuevo
  const base = ingresoBaseFields(args)

  // Buscar por el detalle de búsqueda; si cambió (rename), también considerar el nuevo.
  let existentes = await findIngresosPorDetalle(detalleBusqueda)
  if (args.keyDetalle && detalleBusqueda !== detalleNuevo) {
    const yaConNuevo = await findIngresosPorDetalle(detalleNuevo)
    existentes = [...existentes, ...yaConNuevo].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
  }

  if (existentes.length === 0) {
    const { data, error } = await db
      .from("ingresos")
      .insert({ ...base, mes_id: args.mes_id, monto: args.abono, fecha: new Date().toISOString().split("T")[0] })
      .select("id")
      .single()
    if (error || !data) throw new Error(error?.message || "Error creando ingreso de evento")
    return { id: data.id, created: true, dedup: 0 }
  }

  const [principal, ...extras] = existentes
  const { error: updErr } = await db
    .from("ingresos")
    .update({ ...base, monto: args.abono }) // NO toca mes_id ni fecha → se preserva el mes real
    .eq("id", principal.id)
  if (updErr) throw new Error(updErr.message)

  let dedup = 0
  for (const ex of extras) {
    const { error: delErr } = await db.from("ingresos").delete().eq("id", ex.id)
    if (delErr) throw new Error(delErr.message)
    dedup++
  }
  return { id: principal.id, created: false, dedup }
}

/** Elimina TODOS los ingresos auto-evento con ese detalle (en cualquier mes). */
async function deleteIngresoEvento(detalle: string): Promise<number> {
  const existentes = await findIngresosPorDetalle(detalle)
  let eliminados = 0
  for (const r of existentes) {
    const { error } = await db.from("ingresos").delete().eq("id", r.id)
    if (error) throw new Error(error.message)
    eliminados++
  }
  return eliminados
}

// ── Handler ──────────────────────────────────────────────────────────────────

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
      const keyDetalle = keyNombre ? ingresoDetalle(keyNombre, evento_nombre) : undefined

      // Abono <= 0 → no debe existir ingreso: eliminar el existente (nombre viejo o actual)
      if (Number(abono) <= 0) {
        const borr = await deleteIngresoEvento(keyDetalle ?? ingresoDetalle(nombre, evento_nombre))
        return NextResponse.json({ ok: true, deleted: borr })
      }

      const r = await upsertIngresoEvento({ mes_id, nombre, evento_nombre, abono, valor, metodo_pago, keyDetalle })
      return NextResponse.json({ ok: true, id: r.id, created: r.created, dedup: r.dedup })
    }

    // ─────────────────── DELETE ingreso vinculado ───────────────────
    if (action === "ingreso-delete") {
      const { nombre, evento_nombre } = body
      if (!nombre || !evento_nombre) {
        return NextResponse.json({ error: "nombre y evento_nombre requeridos" }, { status: 400 })
      }
      const eliminados = await deleteIngresoEvento(ingresoDetalle(nombre, evento_nombre))
      return NextResponse.json({ ok: true, eliminados })
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

    // ─────────────────── SYNC evento completo (reconciliación cross-month) ─────
    if (action === "sync") {
      const { mes_id, evento_nombre, participantes } = body as {
        mes_id: string; evento_nombre: string
        participantes: { nombre: string; abono: number; valor: number; metodo_pago?: string }[]
      }
      if (!mes_id || !evento_nombre || !Array.isArray(participantes)) {
        return NextResponse.json({ error: "mes_id, evento_nombre y participantes requeridos" }, { status: 400 })
      }

      const sufijo = `(${evento_nombre})`
      // Traer ingresos auto-evento de este evento en TODOS los meses
      const { data: todos, error: iErr } = await db
        .from("ingresos")
        .select("id, detalle, monto, metodo_pago, mes_id, created_at")
        .eq("concepto", "auto-evento")
        .like("detalle", `%${sufijo}`)
        .order("created_at", { ascending: true })
      if (iErr) throw new Error(iErr.message)

      // Agrupar por detalle exacto (los que terminan EXACTAMENTE con el sufijo)
      const groups = new Map<string, IngresoRow[]>()
      for (const r of (todos || []) as IngresoRow[]) {
        if (!String(r.detalle).endsWith(sufijo)) continue
        const arr = groups.get(r.detalle) || []
        arr.push(r)
        groups.set(r.detalle, arr)
      }

      let creados = 0, actualizados = 0, eliminados = 0
      const detallesActivos = new Set<string>()

      for (const p of participantes) {
        if (Number(p.abono) <= 0) continue
        const detalle = ingresoDetalle(p.nombre, evento_nombre)
        detallesActivos.add(detalle)
        const rows = groups.get(detalle) || []

        if (rows.length === 0) {
          const { error } = await db.from("ingresos").insert({
            ...ingresoBaseFields({ nombre: p.nombre, evento_nombre, valor: p.valor, metodo_pago: p.metodo_pago }),
            mes_id,
            monto: p.abono,
            fecha: new Date().toISOString().split("T")[0],
          })
          if (error) throw new Error(error.message)
          creados++
        } else {
          const [principal, ...extras] = rows
          if (Number(principal.monto) !== Number(p.abono) || (principal.metodo_pago || "Efectivo") !== (p.metodo_pago || "Efectivo")) {
            const { error } = await db.from("ingresos").update({
              monto: p.abono,
              metodo_pago: p.metodo_pago || "Efectivo",
              observacion: `Abono de ${p.nombre} para ${evento_nombre} (valor total: $${Number(p.valor).toFixed(2)})`,
            }).eq("id", principal.id) // preserva mes_id/fecha reales
            if (error) throw new Error(error.message)
            actualizados++
          }
          // Eliminar duplicados remanentes del mismo detalle (re-emisiones entre meses)
          for (const ex of extras) {
            const { error } = await db.from("ingresos").delete().eq("id", ex.id)
            if (error) throw new Error(error.message)
            eliminados++
          }
        }
      }

      // Huérfanos: detalle con ingreso(s) pero sin participante activo (abono>0) → eliminar
      for (const [detalle, rows] of groups) {
        if (detallesActivos.has(detalle)) continue
        for (const r of rows) {
          const { error } = await db.from("ingresos").delete().eq("id", r.id)
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
