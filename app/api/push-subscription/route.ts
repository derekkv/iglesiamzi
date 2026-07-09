import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyToken } from "@/lib/jwt"

const SUPABASE_URL = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * POST: Guardar o actualizar una suscripción push
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      token?: string
      user_id?: string
      endpoint?: string
      p256dh?: string
      auth?: string
    }

    const { token, user_id, endpoint, p256dh, auth } = body

    // Verificar autenticación
    if (!token) {
      return NextResponse.json({ error: "Token de autenticación requerido" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 })
    }

    // Verificar que el user_id coincide con el usuario autenticado
    if (!user_id || payload.userId !== user_id) {
      return NextResponse.json({ error: "No autorizado para este usuario" }, { status: 403 })
    }

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Campos requeridos: endpoint, p256dh, auth" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { user_id, endpoint, p256dh, auth },
        { onConflict: "user_id,endpoint" }
      )

    if (error) {
      console.error("Error guardando suscripción push:", error)
      return NextResponse.json(
        { error: "Error guardando suscripción" },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: "Suscripción guardada" })
  } catch (error: any) {
    console.error("Error en push-subscription:", error)
    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Eliminar una suscripción push
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as {
      token?: string
      user_id?: string
      endpoint?: string
    }

    const { token, user_id, endpoint } = body

    // Verificar autenticación
    if (!token) {
      return NextResponse.json({ error: "Token de autenticación requerido" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 })
    }

    if (!user_id || payload.userId !== user_id) {
      return NextResponse.json({ error: "No autorizado para este usuario" }, { status: 403 })
    }

    if (!endpoint) {
      return NextResponse.json(
        { error: "Campo requerido: endpoint" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user_id)
      .eq("endpoint", endpoint)

    if (error) {
      console.error("Error eliminando suscripción push:", error)
      return NextResponse.json(
        { error: "Error eliminando suscripción" },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: "Suscripción eliminada" })
  } catch (error: any) {
    console.error("Error en push-subscription DELETE:", error)
    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    )
  }
}
