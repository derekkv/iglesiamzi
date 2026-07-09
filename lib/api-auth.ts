import { NextRequest } from "next/server"
import { verifyToken, type SessionPayload } from "./jwt"

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || "iglesia-cron-secret-2024"

export interface AuthResult {
  authenticated: boolean
  userId?: string
  isInternal?: boolean
  error?: string
}

/**
 * Verifica autenticación en API routes.
 * Soporta dos modos:
 * 1. JWT token del usuario (desde el frontend) — via header "Authorization: Bearer <jwt>" o campo "token" en body
 * 2. Secreto interno (server-to-server) — via header "X-Internal-Secret: <secret>"
 * 
 * Para cron jobs se usa el CRON_SECRET existente via "Authorization: Bearer <cron_secret>"
 */
export async function verifyApiAuth(request: NextRequest, options?: { bodyToken?: string }): Promise<AuthResult> {
  // 1. Check X-Internal-Secret header (server-to-server calls)
  const internalSecret = request.headers.get("x-internal-secret")
  if (internalSecret === INTERNAL_API_SECRET) {
    return { authenticated: true, isInternal: true }
  }

  // 2. Check Authorization header (Bearer <jwt>)
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (payload) {
      return { authenticated: true, userId: payload.userId, isInternal: false }
    }
    return { authenticated: false, error: "Token inválido o expirado" }
  }

  // 3. Check token in body (for backwards compatibility with frontend calls)
  if (options?.bodyToken) {
    const payload = await verifyToken(options.bodyToken)
    if (payload) {
      return { authenticated: true, userId: payload.userId, isInternal: false }
    }
    return { authenticated: false, error: "Token inválido o expirado" }
  }

  return { authenticated: false, error: "Autenticación requerida" }
}
