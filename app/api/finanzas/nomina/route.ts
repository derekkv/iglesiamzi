/**
 * POST /api/finanzas/nomina
 *
 * Egresos de Nómina (categoría "PAGO DE NOMINA"), server-side con service_role.
 * Elimina el fallo silencioso por permisos sobre `egresos`. A diferencia de
 * otros módulos, Nómina NO usa un `concepto` marcador: identifica sus egresos
 * por categoria_principal = "PAGO DE NOMINA" + patrón en `observacion`.
 *
 * Body: { action, ...payload, usuario }
 *   add-egreso:    { mes_id, egreso: {detalle, observacion, monto, fecha, metodo_pago, ministerio?} }
 *   delete-like:   { mes_id, observacion_like }   // borra por ilike en observacion
 *   sync:          { mes_id, egresos: [ {detalle, observacion, monto, fecha, metodo_pago} ] }
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as db } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"
import { verifyToken } from "@/lib/jwt"
import { logAuditServer } from "@/lib/server/finanzas-sync"

const CATEGORIA_NOMINA = "PAGO DE NOMINA"

interface EgresoNominaInput {
  detalle: string
  observacion: string
  monto: number
  fecha: string
  metodo_pago: string
  ministerio?: string
}

function egresoRow(mesId: string, e: EgresoNominaInput) {
  return {
    mes_id: mesId,
    concepto: "auto-nomina",
    monto: e.monto,
    fecha: e.fecha,
    ministerio: e.ministerio || "Administración",
    categoria_principal: CATEGORIA_NOMINA,
    detalle: e.detalle || "Nómina",
    observacion: e.observacion,
    estado: "Procesado",
    metodo_pago: e.metodo_pago,
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

  const action = body?.action as "add-egreso" | "delete-like" | "sync"
  const usuarioId = body?.usuario?.id || auth.userId || "sistema"
  const usuarioNombre =
    body?.usuario?.nombre || jwtPayload?.displayName || jwtPayload?.username || "Sistema"

  try {
    // ───────────────────────── ADD EGRESO ─────────────────────────
    if (action === "add-egreso") {
      const mesId = body.mes_id as string
      const egreso = body.egreso as EgresoNominaInput
      if (!mesId || !egreso?.observacion) {
        return NextResponse.json({ error: "mes_id y egreso.observacion requeridos" }, { status: 400 })
      }

      // Idempotencia: no duplicar si ya existe un egreso con esa observacion exacta.
      const { data: existente } = await db
        .from("egresos")
        .select("id")
        .eq("mes_id", mesId)
        .eq("categoria_principal", CATEGORIA_NOMINA)
        .ilike("observacion", egreso.observacion)
        .limit(1)
        .maybeSingle()
      if (existente) {
        return NextResponse.json({ ok: true, data: existente, skipped: true })
      }

      const { data, error } = await db.from("egresos").insert(egresoRow(mesId, egreso)).select("id").single()
      if (error) throw new Error(error.message || "Error creando egreso de nómina")

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "flujo_pago", action: "crear",
        description: `Egreso nómina: ${egreso.observacion} - $${egreso.monto}`,
        details: { tipo: "Egreso", monto: egreso.monto, categoria: CATEGORIA_NOMINA, observacion: egreso.observacion, fecha: egreso.fecha },
      })

      return NextResponse.json({ ok: true, data })
    }

    // ───────────────────────── DELETE (ilike) ─────────────────────────
    if (action === "delete-like") {
      const mesId = body.mes_id as string
      const observacionLike = body.observacion_like as string
      if (!mesId || !observacionLike) {
        return NextResponse.json({ error: "mes_id y observacion_like requeridos" }, { status: 400 })
      }
      const { error } = await db
        .from("egresos")
        .delete()
        .eq("mes_id", mesId)
        .eq("categoria_principal", CATEGORIA_NOMINA)
        .ilike("observacion", observacionLike)
      if (error) throw new Error(error.message || "Error eliminando egreso de nómina")

      return NextResponse.json({ ok: true })
    }

    // ───────────────────────── SYNC ─────────────────────────
    // Crea los egresos faltantes del mes (los que no existan por observacion).
    if (action === "sync") {
      const mesId = body.mes_id as string
      const egresos = body.egresos as EgresoNominaInput[]
      if (!mesId || !Array.isArray(egresos)) {
        return NextResponse.json({ error: "mes_id y egresos requeridos" }, { status: 400 })
      }

      const { data: existentes, error: exErr } = await db
        .from("egresos")
        .select("observacion")
        .eq("mes_id", mesId)
        .eq("categoria_principal", CATEGORIA_NOMINA)
      if (exErr) throw new Error(exErr.message)

      const observaciones = new Set((existentes || []).map((e: any) => (e.observacion || "").toLowerCase()))
      let creados = 0
      for (const e of egresos) {
        if (!observaciones.has((e.observacion || "").toLowerCase())) {
          const { error } = await db.from("egresos").insert(egresoRow(mesId, e))
          if (error) throw new Error("Error creando egreso faltante: " + error.message)
          observaciones.add((e.observacion || "").toLowerCase())
          creados++
        }
      }

      return NextResponse.json({ ok: true, creados })
    }

    return NextResponse.json({ error: `Acción "${action}" no soportada` }, { status: 400 })
  } catch (error: any) {
    console.error("[/api/finanzas/nomina]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
