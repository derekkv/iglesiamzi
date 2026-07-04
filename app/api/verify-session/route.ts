import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body as { token?: string }

    if (!token) {
      return NextResponse.json({ valid: false, error: "Token requerido" }, { status: 401 })
    }

    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json({ valid: false, error: "Token inválido o expirado" }, { status: 401 })
    }

    // Retornar datos del usuario desde el token (sin consulta a DB)
    return NextResponse.json({
      valid: true,
      user: {
        id: payload.userId,
        username: payload.username,
        displayName: payload.displayName,
        accountType: payload.accountType,
        email: payload.email,
        ministerioName: payload.ministerioName,
        cedula: payload.cedula,
      },
    })
  } catch (error: any) {
    console.error("Error verificando sesión:", error)
    return NextResponse.json({ valid: false, error: "Error interno" }, { status: 500 })
  }
}
