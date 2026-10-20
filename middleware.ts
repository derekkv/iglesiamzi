import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

// Debe coincidir con el fallback de lib/jwt.ts para que el token firmado y el
// verificado usen el MISMO secreto si process.env.JWT_SECRET no estuviera cargado.
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "IglesiaMZIuwuXDDDDDDDDD"
)

/**
 * Middleware de Next.js para proteger rutas del dashboard.
 * Verifica que exista un JWT válido antes de servir cualquier página protegida.
 * El token se envía como cookie "authToken" o como query param para la verificación inicial.
 */
/**
 * Construye la URL base pública respetando el proxy inverso (Nginx).
 * Detrás de un proxy, request.nextUrl apunta al host interno (localhost:3712),
 * por lo que debemos usar los headers X-Forwarded-* / Host que reenvía Nginx
 * para que los redirects apunten al dominio real.
 */
function getPublicBaseUrl(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host
  const proto =
    request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "")
  return `${proto}://${host}`
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas protegidas: todo bajo /dashboard
  if (pathname.startsWith("/dashboard")) {
    // Intentar obtener el token de la cookie
    const token = request.cookies.get("authToken")?.value

    const buildLoginUrl = () => {
      const url = new URL("/login", getPublicBaseUrl(request))
      url.searchParams.set("from", pathname)
      return url
    }

    if (!token) {
      // Sin cookie, verificar si hay token en el header (para requests internos)
      // Para navegación normal sin cookie, redirigir a login
      return NextResponse.redirect(buildLoginUrl())
    }

    // Verificar que el JWT sea válido
    try {
      await jwtVerify(token, JWT_SECRET)
      return NextResponse.next()
    } catch {
      // Token inválido o expirado — limpiar cookie y redirigir
      const response = NextResponse.redirect(buildLoginUrl())
      response.cookies.delete("authToken")
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
