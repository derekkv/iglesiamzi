/**
 * POST /api/finanzas/ingreso-diezmo-sync
 *
 * Flujo INVERSO: cuando desde el módulo Ingresos/Egresos se edita o elimina un
 * ingreso con concepto "auto-diezmo", hay que reflejar el cambio en la tabla
 * `diezmos` (tabla de OTRO módulo). Si el usuario del módulo ingresos_egresos
 * no tiene permiso sobre `diezmos`, esa escritura daba 403 silencioso.
 * Aquí se hace server-side con service_role.
 *
 * Body: { action, ...payload }
 *   update: { mes_id, old_detalle, monto, fecha, new_detalle }
 *   delete: { mes_id, donador, monto }
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as db } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"

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

  const action = body?.action as "update" | "delete"

  try {
    if (action === "update") {
      const { mes_id, old_detalle, monto, fecha, new_detalle } = body
      if (!mes_id || !old_detalle) {
        return NextResponse.json({ error: "mes_id y old_detalle requeridos" }, { status: 400 })
      }
      // old_detalle / new_detalle tienen formato "{Tipo} - {donador}".
      const oldDonador = String(old_detalle).split(" - ").slice(1).join(" - ") || ""
      const newDonador = new_detalle ? (String(new_detalle).split(" - ").slice(1).join(" - ") || "") : oldDonador
      if (!oldDonador) return NextResponse.json({ ok: true, skipped: true })

      const { data: diezmoVinculado, error: findErr } = await db
        .from("diezmos")
        .select("id")
        .eq("mes_id", mes_id)
        .eq("transaccion", "transferencia")
        .ilike("donador", `%${oldDonador}%`)
        .limit(1)
        .maybeSingle()
      if (findErr) throw new Error(findErr.message)

      if (diezmoVinculado) {
        const upd: Record<string, any> = {
          valor: Number(monto),
          fecha,
          updated_at: new Date().toISOString(),
        }
        if (newDonador) upd.donador = newDonador
        const { error: updErr } = await db.from("diezmos").update(upd).eq("id", diezmoVinculado.id)
        if (updErr) throw new Error(updErr.message)
      }
      return NextResponse.json({ ok: true })
    }

    if (action === "delete") {
      const { mes_id, donador, monto } = body
      if (!mes_id || !donador) {
        return NextResponse.json({ error: "mes_id y donador requeridos" }, { status: 400 })
      }
      const { error } = await db
        .from("diezmos")
        .delete()
        .eq("mes_id", mes_id)
        .eq("donador", donador)
        .eq("transaccion", "transferencia")
        .eq("valor", Number(monto))
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: `Acción "${action}" no soportada` }, { status: 400 })
  } catch (error: any) {
    console.error("[/api/finanzas/ingreso-diezmo-sync]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
