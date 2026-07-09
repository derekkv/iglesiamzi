import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyToken } from "@/lib/jwt"

const SUPABASE_URL = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * GET: Obtener datos del perfil del usuario autenticado (sin password_hash)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, username, displayName, email, phone, cedula, account_type, ministerio_name")
      .eq("id", payload.userId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true, user: data })
  } catch (error: any) {
    console.error("Error en user-profile GET:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

/**
 * PUT: Actualizar datos del perfil (solo campos seguros, nunca password)
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 })
    }

    const body = await request.json() as {
      displayName?: string
      email?: string
      phone?: string
      cedula?: string
    }

    const { displayName, email, phone, cedula } = body

    if (!displayName?.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 })
    }

    const updateData: Record<string, any> = {
      displayName: displayName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      cedula: cedula?.trim() || null,
    }

    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", payload.userId)

    if (error) {
      return NextResponse.json({ error: "Error actualizando perfil" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Perfil actualizado" })
  } catch (error: any) {
    console.error("Error en user-profile PUT:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
