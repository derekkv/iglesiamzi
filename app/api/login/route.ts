import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"
import { signToken } from "@/lib/jwt"

const SUPABASE_URL = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

// Cliente de supabase server-side con service role (acceso completo)
const supabaseServer = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ============ RATE LIMITING ============
// Almacén en memoria de intentos por IP
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = request.headers.get("x-real-ip")
  if (real) return real
  return "unknown"
}

function checkRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; retryAfterMs?: number } {
  const now = Date.now()
  const record = loginAttempts.get(ip)

  if (!record) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now })
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 }
  }

  // Si la ventana expiró, resetear
  if (now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now })
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 }
  }

  // Dentro de la ventana
  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (now - record.firstAttempt)
    return { allowed: false, remainingAttempts: 0, retryAfterMs }
  }

  record.count++
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.count }
}

function clearRateLimit(ip: string) {
  loginAttempts.delete(ip)
}

// Limpiar entradas viejas cada 5 minutos para no acumular memoria
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of loginAttempts.entries()) {
    if (now - record.firstAttempt > WINDOW_MS) {
      loginAttempts.delete(ip)
    }
  }
}, 5 * 60 * 1000)

// ============ LOGIN ENDPOINT ============
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)

    // Verificar rate limit
    const rateCheck = checkRateLimit(ip)
    if (!rateCheck.allowed) {
      const retryMinutes = Math.ceil((rateCheck.retryAfterMs || 0) / 60000)
      return NextResponse.json(
        { error: `Demasiados intentos. Intente de nuevo en ${retryMinutes} minuto(s).` },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs || 0) / 1000)) },
        }
      )
    }

    const body = await request.json()
    const { identifier, password } = body as { identifier?: string; password?: string }

    if (!identifier?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      )
    }

    const trimmedId = identifier.trim()

    // Buscar usuario por username, email o phone
    const { data: user, error } = await supabaseServer
      .from("users")
      .select("*")
      .eq("is_active", true)
      .or(`username.eq.${trimmedId},email.eq.${trimmedId},phone.eq.${trimmedId}`)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos", remainingAttempts: rateCheck.remainingAttempts },
        { status: 401 }
      )
    }

    // Verificar contraseña server-side
    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos", remainingAttempts: rateCheck.remainingAttempts },
        { status: 401 }
      )
    }

    // Login exitoso - limpiar rate limit para esta IP
    clearRateLimit(ip)

    // Registrar sesión
    await supabaseServer.from("user_sessions").insert({
      user_id: user.id,
      login_at: new Date().toISOString(),
    })

    // Generar JWT
    const token = await signToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      accountType: user.account_type,
      email: user.email || undefined,
      ministerioName: user.ministerio_name || undefined,
      cedula: user.cedula || undefined,
    })

    // Retornar token + datos del usuario (sin password_hash)
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        accountType: user.account_type,
        email: user.email,
        ministerioName: user.ministerio_name,
        cedula: user.cedula,
      },
    })
  } catch (error: any) {
    console.error("Error en login:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
