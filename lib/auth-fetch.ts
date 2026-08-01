/**
 * Wrapper para fetch que automáticamente incluye el JWT token de autenticación.
 * Usar en llamadas desde el cliente (browser) a las API routes protegidas.
 */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json")
  }

  return fetch(url, { ...options, headers })
}

/**
 * Headers para llamadas internas servidor-a-servidor.
 * 
 * - En el servidor: usa INTERNAL_API_SECRET (disponible via process.env).
 * - En el browser: process.env.INTERNAL_API_SECRET es undefined para variables
 *   sin prefijo NEXT_PUBLIC_. En ese caso se usa el JWT del usuario desde
 *   localStorage como fallback, para que el API route lo acepte por la rama Bearer.
 */
export function getInternalHeaders(): Record<string, string> {
  // Contexto servidor: process.env tiene acceso completo
  if (typeof window === "undefined") {
    const secret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || ""
    return {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    }
  }

  // Contexto browser: INTERNAL_API_SECRET no está disponible sin NEXT_PUBLIC_.
  // Usar el JWT del usuario autenticado como alternativa.
  const token = localStorage.getItem("authToken")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}
