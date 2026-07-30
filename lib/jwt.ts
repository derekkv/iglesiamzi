import { SignJWT, jwtVerify, type JWTPayload } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret-change-in-production"
)

const TOKEN_EXPIRATION = "24h"

export interface SessionPayload extends JWTPayload {
  userId: string
  username: string
  displayName: string
  accountType: "personal" | "ministerio"
  email?: string
  ministerioName?: string
  cedula?: string
}

export async function signToken(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as SessionPayload
  } catch (error) {
    return null
  }
}
