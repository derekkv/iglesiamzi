/**
 * POST /api/finanzas/pasivos
 *
 * Operaciones de pasivos que tocan la tabla `egresos`, ejecutadas de forma
 * ATÓMICA en el servidor (service_role) para evitar fallos silenciosos por
 * permisos y descuadres:
 *   - add-abono:    crea egreso ("PAGO DE PASIVOS") + abono vinculado + recalcula estado.
 *   - delete-abono: borra egreso vinculado + abono + recalcula estado.
 *   - delete-pasivo: borra egresos de todos los abonos + el pasivo (abonos por cascada).
 *
 * Body: { action, ...payload, usuario }
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as db } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"
import { verifyToken } from "@/lib/jwt"
import { logAuditServer } from "@/lib/server/finanzas-sync"

const CATEGORIA_PASIVOS = "PAGO DE PASIVOS"

async function recomputeEstado(pasivoId: number, montoTotal: number): Promise<void> {
  const { data: abonos } = await db
    .from("pasivos_abonos").select("monto").eq("pasivo_id", pasivoId)
  const pagado = (abonos || []).reduce((s: number, a: any) => s + Number(a.monto), 0)
  const estado = pagado >= Number(montoTotal) && Number(montoTotal) > 0 ? "pagado" : "pendiente"
  await db.from("pasivos").update({ estado, updated_at: new Date().toISOString() }).eq("id", pasivoId)
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

  const action = body?.action as "add-abono" | "delete-abono" | "delete-pasivo"
  const usuarioId = body?.usuario?.id || auth.userId || "sistema"
  const usuarioNombre =
    body?.usuario?.nombre || jwtPayload?.displayName || jwtPayload?.username || "Sistema"

  try {
    // ───────────────────────────── ADD ABONO ─────────────────────────────
    if (action === "add-abono") {
      const { pasivo, mes_id, input } = body as {
        pasivo: { id: number; acreedor: string; detalle: string | null; monto_total: number }
        mes_id: string
        input: { monto: number; fecha: string; metodo_pago?: string | null; observacion?: string | null }
      }
      if (!pasivo?.id || !mes_id) {
        return NextResponse.json({ error: "pasivo y mes_id son requeridos" }, { status: 400 })
      }
      if (!input?.monto || input.monto <= 0) {
        return NextResponse.json({ error: "El monto del abono debe ser mayor a 0" }, { status: 400 })
      }

      // 1. Crear el egreso
      const observacionEgreso = `Abono a ${pasivo.acreedor}${input.metodo_pago ? ` — ${input.metodo_pago}` : ""}${input.observacion ? ` (${input.observacion})` : ""}`
      const { data: egreso, error: egErr } = await db
        .from("egresos")
        .insert({
          mes_id,
          concepto: "pasivo",
          monto: input.monto,
          fecha: input.fecha,
          ministerio: "Administración",
          categoria_principal: CATEGORIA_PASIVOS,
          detalle: pasivo.detalle || pasivo.acreedor,
          observacion: observacionEgreso,
          metodo_pago: input.metodo_pago || "N/A",
        })
        .select("id")
        .single()
      if (egErr || !egreso) throw new Error(egErr?.message || "Error creando el egreso")

      // 2. Crear el abono vinculando el egreso — rollback del egreso si falla
      const { data: abono, error: abErr } = await db
        .from("pasivos_abonos")
        .insert({
          pasivo_id: pasivo.id,
          monto: input.monto,
          fecha: input.fecha,
          metodo_pago: input.metodo_pago || null,
          observacion: input.observacion?.trim() || null,
          egreso_id: egreso.id,
        })
        .select()
        .single()
      if (abErr || !abono) {
        await db.from("egresos").delete().eq("id", egreso.id)
        throw new Error("No se pudo registrar el abono, se revirtió el egreso: " + (abErr?.message || ""))
      }

      // 3. Recalcular estado del pasivo
      await recomputeEstado(pasivo.id, pasivo.monto_total)

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "pasivos", action: "crear",
        description: `Abono a ${pasivo.acreedor}: $${input.monto}`,
        details: { pasivo_id: pasivo.id, monto: input.monto, fecha: input.fecha, metodo_pago: input.metodo_pago, egreso_id: egreso.id, mes_id },
      })

      return NextResponse.json({ ok: true, data: abono })
    }

    // ───────────────────────────── DELETE ABONO ─────────────────────────────
    if (action === "delete-abono") {
      const { abono, acreedor } = body as {
        abono: { id: number; pasivo_id: number; monto: number; egreso_id: number | null }
        acreedor: string
      }
      if (!abono?.id) {
        return NextResponse.json({ error: "abono es requerido" }, { status: 400 })
      }

      if (abono.egreso_id) {
        const { error: egErr } = await db.from("egresos").delete().eq("id", abono.egreso_id)
        if (egErr) throw new Error("Error eliminando egreso vinculado: " + egErr.message)
      }
      const { error: abErr } = await db.from("pasivos_abonos").delete().eq("id", abono.id)
      if (abErr) throw new Error("Error eliminando abono: " + abErr.message)

      const { data: p } = await db.from("pasivos").select("monto_total").eq("id", abono.pasivo_id).single()
      await recomputeEstado(abono.pasivo_id, Number(p?.monto_total ?? 0))

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "pasivos", action: "eliminar",
        description: `Abono eliminado de ${acreedor}: $${abono.monto}`,
        details: { pasivo_id: abono.pasivo_id, abono_id: abono.id, monto: abono.monto, egreso_id: abono.egreso_id },
      })

      return NextResponse.json({ ok: true })
    }

    // ───────────────────────────── DELETE PASIVO ─────────────────────────────
    if (action === "delete-pasivo") {
      const { pasivo } = body as {
        pasivo: { id: number; acreedor: string; monto_total: number }
      }
      if (!pasivo?.id) {
        return NextResponse.json({ error: "pasivo es requerido" }, { status: 400 })
      }

      // 1. Borrar egresos vinculados a los abonos del pasivo
      const { data: abonos } = await db
        .from("pasivos_abonos").select("egreso_id").eq("pasivo_id", pasivo.id)
      const egresoIds = (abonos || []).map((a: any) => a.egreso_id).filter((x: any) => x != null)
      if (egresoIds.length > 0) {
        const { error: egErr } = await db.from("egresos").delete().in("id", egresoIds)
        if (egErr) throw new Error("Error eliminando egresos vinculados: " + egErr.message)
      }

      // 2. Borrar el pasivo (abonos por ON DELETE CASCADE)
      const { error } = await db.from("pasivos").delete().eq("id", pasivo.id)
      if (error) throw new Error("Error eliminando el pasivo: " + error.message)

      logAuditServer({
        user_id: usuarioId, user_name: usuarioNombre, module: "pasivos", action: "eliminar",
        description: `Pasivo eliminado: ${pasivo.acreedor} - $${pasivo.monto_total}`,
        details: { id: pasivo.id, acreedor: pasivo.acreedor, egresos_eliminados: egresoIds.length },
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: `Acción "${action}" no soportada` }, { status: 400 })
  } catch (error: any) {
    console.error("[/api/finanzas/pasivos]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
