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
 * Headers para llamadas server-to-server (lib/ services que llaman a API routes).
 * Usa el INTERNAL_API_SECRET para autenticarse.
 */
export function getInternalHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || "iglesia-cron-secret-2024"
  return {
    "Content-Type": "application/json",
    "X-Internal-Secret": secret,
  }
}
