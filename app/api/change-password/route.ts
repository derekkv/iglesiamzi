import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"
import { verifyToken } from "@/lib/jwt"

const SUPABASE_URL = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      currentPassword?: string
      newPassword?: string
    }

    // Verificar autenticación via Authorization header
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 })
    }

    const userId = payload.userId
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Contraseña actual y nueva son requeridas" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    // Obtener hash actual del usuario (server-side, nunca se envía al cliente)
    const { data: userData, error: selErr } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", userId)
      .single()

    if (selErr || !userData) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    // Verificar contraseña actual
    const isValid = await bcrypt.compare(currentPassword, userData.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 403 })
    }

    // Hashear nueva contraseña y guardar
    const newHash = await bcrypt.hash(newPassword, 10)
    const { error: updErr } = await supabase
      .from("users")
      .update({ password_hash: newHash })
      .eq("id", userId)

    if (updErr) {
      return NextResponse.json({ error: "Error actualizando contraseña" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Contraseña actualizada" })
  } catch (error: any) {
    console.error("Error en change-password:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
