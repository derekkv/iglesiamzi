import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "IglesiaMZIuwuXDDDDDDDDD"
)

/**
 * Middleware de Next.js para proteger rutas del dashboard.
 * Verifica que exista un JWT válido antes de servir cualquier página protegida.
 * El token se envía como cookie "authToken" o como query param para la verificación inicial.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas protegidas: todo bajo /dashboard
  if (pathname.startsWith("/dashboard")) {
    // Intentar obtener el token de la cookie
    const token = request.cookies.get("authToken")?.value

    if (!token) {
      // Sin cookie, verificar si hay token en el header (para requests internos)
      // Para navegación normal sin cookie, redirigir a login
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("from", pathname)
      return NextResponse.redirect(url)
    }

    // Verificar que el JWT sea válido
    try {
      await jwtVerify(token, JWT_SECRET)
      return NextResponse.next()
    } catch {
      // Token inválido o expirado — limpiar cookie y redirigir
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("from", pathname)
      const response = NextResponse.redirect(url)
      response.cookies.delete("authToken")
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
