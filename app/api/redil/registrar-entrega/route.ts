/**
 * POST /api/redil/registrar-entrega
 *
 * Registra una entrega de ayuda social en una sola petición:
 *   1. Valida existencia suficiente de todos los artículos.
 *   2. Inserta el registro en entregas_redil (con JSONB de artículos).
 *   3. Inserta todos los movimientos de egreso en un solo INSERT batch.
 *   4. Actualiza cantidad_actual de cada item con un UPDATE batch (Promise.all).
 *   5. Cierra el caso (estado → "cerrado").
 *   6. Registra audit log.
 *
 * Al hacer todo server-side contra Supabase con service_role, se evitan los
 * N round-trips HTTP del cliente y se reduce el tiempo de respuesta a ~1 llamada.
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as db } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"
import { verifyToken } from "@/lib/jwt"

// ── Tipos del payload ────────────────────────────────────────────────────────

interface ArticuloInput {
  item_id: number
  item_nombre: string
  categoria: string | null
  cantidad: number
}

interface RegistrarEntregaBody {
  caso_id: number
  fecha_entrega: string
  observaciones?: string | null
  /** JSON.stringify de ArchivoSubido[] — se pasa ya serializado desde el cliente */
  foto1?: string | null
  incluye_canasta?: boolean
  articulos?: ArticuloInput[]
  /** Nombre del usuario que entrega (ya resuelto en cliente) */
  usuario_nombre: string
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Autenticación
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Obtener nombre completo del usuario desde el JWT
  const token = request.headers.get("authorization")?.slice(7) ?? ""
  const jwtPayload = await verifyToken(token)
  const usuarioNombre = jwtPayload?.displayName || jwtPayload?.username || "Sistema"
  const usuarioId = auth.userId

  let body: RegistrarEntregaBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { caso_id, fecha_entrega, observaciones, foto1, incluye_canasta, articulos = [] } = body

  if (!caso_id || !fecha_entrega) {
    return NextResponse.json({ error: "caso_id y fecha_entrega son requeridos" }, { status: 400 })
  }

  // Filtrar artículos válidos (cantidad > 0)
  const arts = articulos.filter((a) => a.item_id && Number(a.cantidad) > 0)

  try {
    // 2. Pre-validar existencia de todos los artículos de una sola vez
    if (arts.length > 0) {
      const itemIds = arts.map((a) => a.item_id)
      const { data: items, error: itemsErr } = await db
        .from("existencia_ayuda_items")
        .select("id, nombre, cantidad_actual")
        .in("id", itemIds)

      if (itemsErr) throw new Error("Error consultando inventario: " + itemsErr.message)

      const porId = new Map((items || []).map((i: any) => [i.id, i]))
      const faltantes: string[] = []
      for (const art of arts) {
        const item = porId.get(art.item_id) as any
        if (!item) {
          faltantes.push(`"${art.item_nombre}" no existe en inventario`)
        } else if (Number(art.cantidad) > Number(item.cantidad_actual)) {
          faltantes.push(`"${item.nombre}" (disponible: ${item.cantidad_actual}, solicitado: ${art.cantidad})`)
        }
      }
      if (faltantes.length > 0) {
        return NextResponse.json(
          { error: `Existencia insuficiente: ${faltantes.join("; ")}` },
          { status: 422 }
        )
      }
    }

    // 3. Insertar registro de entrega
    const articulosEntregados = arts.length > 0
      ? { incluye_canasta: !!incluye_canasta, articulos: arts }
      : null

    const { data: entrega, error: entregaErr } = await db
      .from("entregas_redil")
      .insert({
        caso_id,
        fecha_entrega,
        foto1: foto1 || null,
        observaciones: observaciones || null,
        entregado_por: usuarioId,
        entregado_por_nombre: usuarioNombre,
        articulos_entregados: articulosEntregados,
      })
      .select("id")
      .single()

    if (entregaErr || !entrega) {
      throw new Error(entregaErr?.message || "Error insertando entrega")
    }

    // 4. Batch INSERT de movimientos de egreso + batch UPDATE de existencia
    if (arts.length > 0) {
      const hoy = fecha_entrega

      // 4a. Insertar todos los movimientos en un solo INSERT
      const movRows = arts.map((art) => ({
        item_id: art.item_id,
        item_nombre: art.item_nombre,
        categoria: art.categoria || null,
        tipo: "egreso",
        cantidad: Number(art.cantidad),
        motivo: `Entrega ayuda social - Caso #${caso_id}`,
        fecha: hoy,
        usuario_id: usuarioId,
        usuario_nombre: usuarioNombre,
      }))

      const { error: movErr } = await db
        .from("existencia_ayuda_movimientos")
        .insert(movRows)

      if (movErr) {
        // Rollback: eliminar la entrega recién creada
        await db.from("entregas_redil").delete().eq("id", entrega.id)
        throw new Error("Error registrando egresos: " + movErr.message)
      }

      // 4b. Actualizar cantidad_actual de cada item en paralelo
      //     (Promise.all en vez de loop secuencial)
      const updatePromises = arts.map((art) =>
        db.rpc("decrementar_existencia_ayuda", {
          p_item_id: art.item_id,
          p_cantidad: Number(art.cantidad),
        }).then(({ error }) => {
          if (error) throw new Error(`Error actualizando "${art.item_nombre}": ${error.message}`)
        })
      )

      try {
        await Promise.all(updatePromises)
      } catch (rpcErr: any) {
        // Si falla el RPC, intentar con UPDATE directo en paralelo como fallback
        // (para cuando el RPC no esté instalado aún)
        const fallbackPromises = arts.map(async (art) => {
          const { data: item } = await db
            .from("existencia_ayuda_items")
            .select("cantidad_actual")
            .eq("id", art.item_id)
            .single()

          const nueva = Math.max(0, Number(item?.cantidad_actual ?? 0) - Number(art.cantidad))
          const { error } = await db
            .from("existencia_ayuda_items")
            .update({ cantidad_actual: nueva, updated_at: new Date().toISOString() })
            .eq("id", art.item_id)

          if (error) throw new Error(`Error actualizando "${art.item_nombre}": ${error.message}`)
        })
        await Promise.all(fallbackPromises)
      }
    }

    // 5. Cerrar el caso
    const { error: updateErr } = await db
      .from("casos_redil")
      .update({
        estado: "cerrado",
        fecha_cierre: new Date().toISOString(),
      })
      .eq("id", caso_id)

    if (updateErr) throw new Error("Error cerrando el caso: " + updateErr.message)

    // 6. Audit log (fire-and-forget, no bloquea la respuesta)
    Promise.resolve(
      db.from("audit_logs").insert({
        user_id: usuarioId,
        user_name: usuarioNombre,
        module: "redil_ayuda_social",
        action: "editar",
        description: `Entrega registrada - Caso #${caso_id}`,
        details: {
          caso_id,
          fecha_entrega,
          observaciones,
          incluye_canasta: !!incluye_canasta,
          articulos: arts.map((a) => ({ item: a.item_nombre, cantidad: a.cantidad })),
          antes: { estado: "pendiente_entrega" },
          despues: { estado: "cerrado" },
        },
        is_ai: false,
        ai_authorized_by: null,
      })
    ).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[registrar-entrega]", error.message)
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 })
  }
}
