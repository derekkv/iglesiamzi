import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { emailService } from "@/lib/mod/email-service"
import crypto from "crypto"

const SUPABASE_URL = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Almacén temporal de tokens de recuperación (en memoria, TTL 15 min)
// En producción con múltiples instancias usar BD, pero para una sola instancia es suficiente
const recoveryTokens = new Map<string, { userId: string; expiresAt: number }>()

// Limpiar tokens expirados cada 5 minutos
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of recoveryTokens.entries()) {
    if (now > data.expiresAt) recoveryTokens.delete(token)
  }
}, 5 * 60 * 1000)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === "request") {
      return handleRequest(body)
    } else if (action === "verify") {
      return handleVerify(body)
    } else if (action === "reset") {
      return handleReset(body)
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
  } catch (error: any) {
    console.error("Error en recover-password:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// Paso 1: Solicitar recuperación (envía código por email)
async function handleRequest(body: any) {
  const { identifier } = body
  if (!identifier?.trim()) {
    return NextResponse.json({ error: "Ingrese su usuario, correo o teléfono" }, { status: 400 })
  }

  const trimmed = identifier.trim().toLowerCase()
  console.log("[recover-password] Buscando usuario con identifier:", trimmed)

  // Buscar usuario (case-insensitive)
  const { data: user, error: dbError } = await supabase
    .from("users")
    .select("id, email, username, displayName")
    .eq("is_active", true)
    .or(`username.ilike.${trimmed},email.ilike.${trimmed},phone.eq.${trimmed}`)
    .single()

  console.log("[recover-password] Resultado búsqueda:", { user: user ? { id: user.id, email: user.email, username: user.username } : null, error: dbError?.message })

  // Siempre responder OK para no revelar si el usuario existe
  if (!user || !user.email) {
    console.log("[recover-password] Usuario no encontrado o sin email")
    return NextResponse.json({ success: true, message: "Si el usuario existe, se enviará un código al correo registrado." })
  }

  // Generar código de 6 dígitos
  const code = crypto.randomInt(100000, 999999).toString()
  const expiresAt = Date.now() + 15 * 60 * 1000 // 15 minutos

  // Guardar token
  recoveryTokens.set(code, { userId: user.id, expiresAt })
  console.log("[recover-password] Código generado:", code, "para usuario:", user.username, "email:", user.email)

  // Enviar email
  const nombre = user.displayName || user.username
  try {
    const result = await emailService.sendRawEmail({
      to: user.email,
      subject: "Código de recuperación de contraseña — IRDD",
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <div style="background:#2563eb;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
            <h2 style="margin:0;">Recuperar Contraseña</h2>
          </div>
          <div style="background:white;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 12px 12px;">
            <p>Hola <strong>${nombre}</strong>,</p>
            <p>Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>
            <div style="background:#f0f9ff;border:2px solid #2563eb;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
              <p style="margin:0;font-size:36px;font-weight:800;letter-spacing:8px;color:#2563eb;">${code}</p>
            </div>
            <p style="color:#6b7280;font-size:13px;">Este código expira en <strong>15 minutos</strong>.</p>
            <p style="color:#6b7280;font-size:13px;">Si no solicitaste esto, ignora este correo.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
            <p style="color:#9ca3af;font-size:11px;text-align:center;">Iglesia Regalo de Dios — Sistema Administrativo</p>
          </div>
        </div>
      `,
    })
    console.log("[recover-password] Resultado envío email:", result)
  } catch (emailError: any) {
    console.error("[recover-password] Error enviando email:", emailError.message, emailError.stack)
  }

  return NextResponse.json({ success: true, message: "Si el usuario existe, se enviará un código al correo registrado." })
}

// Paso 2: Verificar código
async function handleVerify(body: any) {
  const { code } = body
  if (!code?.trim()) {
    return NextResponse.json({ error: "Ingrese el código" }, { status: 400 })
  }

  const tokenData = recoveryTokens.get(code.trim())
  if (!tokenData || Date.now() > tokenData.expiresAt) {
    return NextResponse.json({ error: "Código inválido o expirado" }, { status: 400 })
  }

  return NextResponse.json({ success: true, valid: true })
}

// Paso 3: Cambiar contraseña con el código
async function handleReset(body: any) {
  const { code, newPassword } = body
  if (!code?.trim() || !newPassword) {
    return NextResponse.json({ error: "Código y nueva contraseña son requeridos" }, { status: 400 })
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
  }

  const tokenData = recoveryTokens.get(code.trim())
  if (!tokenData || Date.now() > tokenData.expiresAt) {
    return NextResponse.json({ error: "Código inválido o expirado" }, { status: 400 })
  }

  // Hashear nueva contraseña
  const bcrypt = (await import("bcryptjs")).default
  const newHash = await bcrypt.hash(newPassword, 10)

  const { error } = await supabase
    .from("users")
    .update({ password_hash: newHash })
    .eq("id", tokenData.userId)

  if (error) {
    return NextResponse.json({ error: "Error actualizando contraseña" }, { status: 500 })
  }

  // Eliminar token usado
  recoveryTokens.delete(code.trim())

  return NextResponse.json({ success: true, message: "Contraseña actualizada correctamente" })
}
