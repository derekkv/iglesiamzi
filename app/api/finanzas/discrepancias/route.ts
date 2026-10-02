/**
 * GET  /api/finanzas/discrepancias   → detecta descuadres (solo lectura)
 * POST /api/finanzas/discrepancias   → repara los descuadres (crea los movimientos faltantes)
 *
 * Compara los registros base de cada módulo con su movimiento derivado en
 * `ingresos`/`egresos` y reporta (o repara) los que faltan. Server-side con
 * service_role, por lo que no depende de permisos del usuario.
 *
 * Tipos de discrepancia detectados:
 *  - diezmo-sin-ingreso      : diezmo transferencia sin ingreso "auto-diezmo".
 *  - caja-chica-sin-ingreso  : gestión de efectivo sin ingreso "auto-caja-chica".
 *  - pago-diario-sin-egreso  : pago diario sin egreso "auto-pago-diario".
 *  - evento-sin-ingreso      : participante con abono>0 sin ingreso "auto-evento".
 *  - pasivo-abono-sin-egreso : abono de pasivo sin egreso vinculado (egreso_id null
 *                              o egreso inexistente).
 *
 * GET acepta ?mes_id=<id> para acotar diezmos/caja-chica/pago-diario a un mes.
 * POST con { apply: true } crea los movimientos faltantes; sin apply hace dry-run.
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as db } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"
import { verifyToken } from "@/lib/jwt"
import {
  upsertMovimientoVinculado,
  logAuditServer,
} from "@/lib/server/finanzas-sync"

const TIPO_LABEL: Record<string, string> = {
  diezmo: "Diezmo",
  primicia: "Primicia",
  diezmo_especial: "Ofrenda Especial",
}

interface Discrepancia {
  tipo: string
  tabla_base: string
  id_base: number
  mes_id: string | null
  descripcion: string
  monto: number
  /** Payload listo para crear el movimiento faltante (si aplica). */
  _fix?: { tabla: "ingresos" | "egresos"; input: any; keyDetalle?: string }
}

/** Recolecta todas las discrepancias. */
async function detectar(mesId?: string | null): Promise<Discrepancia[]> {
  const out: Discrepancia[] = []

  // ───────── 1. DIEZMOS (transferencia) sin ingreso auto-diezmo ─────────
  {
    let q = db.from("diezmos").select("*").eq("transaccion", "transferencia")
    if (mesId) q = q.eq("mes_id", mesId)
    const { data: diezmos, error } = await q
    if (error) throw new Error("diezmos: " + error.message)

    // Ingresos auto-diezmo existentes (por mes para eficiencia)
    let qi = db.from("ingresos").select("detalle, mes_id").eq("concepto", "auto-diezmo")
    if (mesId) qi = qi.eq("mes_id", mesId)
    const { data: ingresos } = await qi
    const existentes = new Set((ingresos || []).map((i: any) => `${i.mes_id}|${i.detalle}`))

    for (const d of diezmos || []) {
      const tipoLabel = TIPO_LABEL[d.tipo_ofrenda] || "Diezmo"
      const detalle = `${tipoLabel} - ${d.donador}`
      if (!existentes.has(`${d.mes_id}|${detalle}`)) {
        out.push({
          tipo: "diezmo-sin-ingreso",
          tabla_base: "diezmos",
          id_base: d.id,
          mes_id: d.mes_id,
          descripcion: `Diezmo #${d.numero} (${d.donador}) transferencia sin ingreso vinculado`,
          monto: Number(d.valor),
          _fix: {
            tabla: "ingresos",
            input: {
              mes_id: d.mes_id, concepto: "auto-diezmo", monto: d.valor, fecha: d.fecha,
              ministerio: "Administración", categoria_principal: "Ingresos x Ofrendas, Diezmo y Primicias",
              detalle, observacion: `Registrado automáticamente desde módulo Diezmos (#${d.numero})`,
              estado: "Procesado", metodo_pago: "Transferencia",
            },
          },
        })
      }
    }
  }

  // ───────── 2. CAJA CHICA (gestión de efectivo) sin ingreso ─────────
  {
    let q = db.from("caja_chica_movimientos").select("*").eq("concepto", "Gestion de Efectivo")
    if (mesId) q = q.eq("mes_id", mesId)
    const { data: gestiones, error } = await q
    if (error) throw new Error("caja_chica: " + error.message)

    let qi = db.from("ingresos").select("detalle, mes_id").eq("concepto", "auto-caja-chica")
    if (mesId) qi = qi.eq("mes_id", mesId)
    const { data: ingresos } = await qi
    const existentes = new Set((ingresos || []).map((i: any) => `${i.mes_id}|${i.detalle}`))

    for (const g of gestiones || []) {
      const detalle = `Gestion de Efectivo - ${g.responsable}`
      if (!existentes.has(`${g.mes_id}|${detalle}`)) {
        out.push({
          tipo: "caja-chica-sin-ingreso",
          tabla_base: "caja_chica_movimientos",
          id_base: g.id,
          mes_id: g.mes_id,
          descripcion: `Gestión de efectivo (${g.responsable}) sin ingreso vinculado`,
          monto: Number(g.monto),
          _fix: {
            tabla: "ingresos",
            input: {
              mes_id: g.mes_id, concepto: "auto-caja-chica", monto: g.monto, fecha: g.fecha,
              ministerio: "Administracion", categoria_principal: "Caja Chica",
              detalle, observacion: `${g.detalle} (${g.metodo_pago})`,
              estado: "Procesado", metodo_pago: "Transferencia",
            },
          },
        })
      }
    }
  }

  // ───────── 3. PAGO DIARIO sin egreso auto-pago-diario ─────────
  {
    let q = db.from("pago_diario").select("*")
    if (mesId) q = q.eq("mes_id", mesId)
    const { data: pagos, error } = await q
    if (error) throw new Error("pago_diario: " + error.message)

    let qe = db.from("egresos").select("detalle, monto, observacion, mes_id").eq("concepto", "auto-pago-diario")
    if (mesId) qe = qe.eq("mes_id", mesId)
    const { data: egresos } = await qe
    const existentes = new Set((egresos || []).map((e: any) => `${e.mes_id}|Pago diario - ${e.detalle?.replace("Pago diario - ", "")}|${e.monto}|${e.observacion}`))
    // Usamos la misma clave que el sync: detalle|monto|observacion por mes.
    const existentesKey = new Set((egresos || []).map((e: any) => `${e.mes_id}|${e.detalle}|${e.monto}|${e.observacion}`))

    for (const p of pagos || []) {
      const detalle = `Pago diario - ${p.nombre}`
      const key = `${p.mes_id}|${detalle}|${p.valor}|${p.detalle}`
      if (!existentesKey.has(key)) {
        out.push({
          tipo: "pago-diario-sin-egreso",
          tabla_base: "pago_diario",
          id_base: p.id,
          mes_id: p.mes_id,
          descripcion: `Pago diario (${p.nombre}) sin egreso vinculado`,
          monto: Number(p.valor),
          _fix: {
            tabla: "egresos",
            input: {
              mes_id: p.mes_id, concepto: "auto-pago-diario", monto: p.valor, fecha: p.fecha,
              ministerio: p.ministerio, categoria_principal: p.categoria,
              detalle, observacion: p.detalle, estado: "Procesado", metodo_pago: p.metodo_pago,
            },
          },
        })
      }
    }
    void existentes
  }

  // ───────── 4. EVENTOS (abono>0) sin ingreso auto-evento ─────────
  {
    const { data: participantes, error } = await db
      .from("evento_participantes").select("*").gt("abono", 0)
    if (error) throw new Error("evento_participantes: " + error.message)

    // Nombres de eventos
    const { data: tabs } = await db.from("eventos_tabs").select("id, nombre")
    const eventoNombre = new Map((tabs || []).map((t: any) => [t.id, t.nombre]))

    // Mes activo (los ingresos de evento se registran en el mes activo)
    const { data: mesesActivos } = await db
      .from("meses").select("id").eq("status", "active").order("start_date", { ascending: false }).limit(1)
    const mesActivoId = mesesActivos && mesesActivos.length > 0 ? mesesActivos[0].id : null

    const { data: ingresos } = await db
      .from("ingresos").select("detalle, mes_id").eq("concepto", "auto-evento")
    const existentes = new Set((ingresos || []).map((i: any) => `${i.mes_id}|${i.detalle}`))

    for (const p of participantes || []) {
      const evNombre = eventoNombre.get(p.evento_id) || `Evento #${p.evento_id}`
      const detalle = `Abono evento - ${p.nombre} (${evNombre})`
      // Un abono es discrepancia si NO existe el ingreso en NINGÚN mes
      // (el evento pudo registrarse en meses distintos). Buscamos por detalle.
      const existeEnAlgunMes = (ingresos || []).some((i: any) => i.detalle === detalle)
      if (!existeEnAlgunMes) {
        out.push({
          tipo: "evento-sin-ingreso",
          tabla_base: "evento_participantes",
          id_base: p.id,
          mes_id: mesActivoId,
          descripcion: `Abono de ${p.nombre} en "${evNombre}" sin ingreso vinculado`,
          monto: Number(p.abono),
          _fix: mesActivoId ? {
            tabla: "ingresos",
            input: {
              mes_id: mesActivoId, concepto: "auto-evento", monto: p.abono,
              fecha: new Date().toISOString().split("T")[0], ministerio: "Administración",
              categoria_principal: "Ingresos x Eventos", detalle,
              observacion: `Abono de ${p.nombre} para ${evNombre} (valor total: $${Number(p.valor).toFixed(2)})`,
              estado: "Procesado", metodo_pago: p.metodo_pago || "Efectivo",
            },
          } : undefined,
        })
      }
    }
    void existentes
  }

  // ───────── 5. PASIVOS: abonos sin egreso vinculado ─────────
  {
    const { data: abonos, error } = await db.from("pasivos_abonos").select("*")
    if (error) throw new Error("pasivos_abonos: " + error.message)

    // Egresos existentes por id (para verificar egreso_id no colgado)
    const egresoIds = (abonos || []).map((a: any) => a.egreso_id).filter((x: any) => x != null)
    const egresosValidos = new Set<number>()
    if (egresoIds.length > 0) {
      const { data: egs } = await db.from("egresos").select("id").in("id", egresoIds)
      for (const e of egs || []) egresosValidos.add(e.id)
    }

    // Para reparar necesitamos datos del pasivo y un mes
    const pasivoIds = Array.from(new Set((abonos || []).map((a: any) => a.pasivo_id)))
    const pasivoMap = new Map<number, any>()
    if (pasivoIds.length > 0) {
      const { data: pasivos } = await db.from("pasivos").select("*").in("id", pasivoIds)
      for (const p of pasivos || []) pasivoMap.set(p.id, p)
    }

    for (const a of abonos || []) {
      const faltaEgreso = a.egreso_id == null || !egresosValidos.has(a.egreso_id)
      if (faltaEgreso) {
        const pasivo = pasivoMap.get(a.pasivo_id)
        out.push({
          tipo: "pasivo-abono-sin-egreso",
          tabla_base: "pasivos_abonos",
          id_base: a.id,
          mes_id: null, // no se repara automáticamente (requiere mes y re-vincular egreso_id)
          descripcion: `Abono de pasivo${pasivo ? ` (${pasivo.acreedor})` : ""} $${a.monto} sin egreso vinculado`,
          monto: Number(a.monto),
          // Sin _fix: la reparación de pasivos requiere re-vincular egreso_id en el abono,
          // lo que es inseguro hacer en bloque. Se reporta para revisión manual.
        })
      }
    }
  }

  return out
}

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const mesId = request.nextUrl.searchParams.get("mes_id")
  try {
    const discrepancias = await detectar(mesId)
    // No exponer el payload interno _fix en el reporte
    const limpio = discrepancias.map(({ _fix, ...rest }) => ({ ...rest, reparable: !!_fix }))
    const resumen = {
      total: limpio.length,
      monto_total: limpio.reduce((s, d) => s + d.monto, 0),
      por_tipo: limpio.reduce((acc: Record<string, number>, d) => {
        acc[d.tipo] = (acc[d.tipo] || 0) + 1
        return acc
      }, {}),
    }
    return NextResponse.json({ ok: true, resumen, discrepancias: limpio })
  } catch (error: any) {
    console.error("[/api/finanzas/discrepancias GET]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const token = request.headers.get("authorization")?.slice(7) ?? ""
  const jwtPayload = await verifyToken(token)
  const usuarioId = auth.userId || "sistema"
  const usuarioNombre = jwtPayload?.displayName || jwtPayload?.username || "Sistema"

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // body vacío = dry-run
  }
  const apply = body?.apply === true
  const mesId = body?.mes_id ?? null

  try {
    const discrepancias = await detectar(mesId)
    const reparables = discrepancias.filter((d) => d._fix)

    if (!apply) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        reparables: reparables.length,
        no_reparables: discrepancias.length - reparables.length,
        monto_reparable: reparables.reduce((s, d) => s + d.monto, 0),
      })
    }

    let reparados = 0
    const errores: string[] = []
    for (const d of reparables) {
      try {
        await upsertMovimientoVinculado(d._fix!.tabla, d._fix!.input, d._fix!.keyDetalle)
        reparados++
      } catch (e: any) {
        errores.push(`${d.tipo} base#${d.id_base}: ${e.message}`)
      }
    }

    logAuditServer({
      user_id: usuarioId, user_name: usuarioNombre, module: "ingresos_egresos", action: "crear",
      description: `Reparación de discrepancias financieras: ${reparados} movimientos creados`,
      details: { reparados, errores: errores.length, mes_id: mesId },
    })

    return NextResponse.json({
      ok: true,
      reparados,
      no_reparados: reparables.length - reparados,
      errores,
    })
  } catch (error: any) {
    console.error("[/api/finanzas/discrepancias POST]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
