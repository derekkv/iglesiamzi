"use client"

import { useEffect } from "react"

export function ErrorReporter() {
  useEffect(() => {
    // Anti-flood: evita que un mismo error en bucle sature /api/report-error.
    // - Deduplica por firma (contexto+mensaje) durante una ventana de tiempo.
    // - Cap global de envíos por sesión de página.
    const recent = new Map<string, number>()
    const DEDUPE_MS = 60_000 // no repetir el mismo error más de 1 vez/minuto
    const MAX_REPORTS = 50 // tope duro por carga de página
    let sent = 0

    function reportError(context: string, error: string, details?: string) {
      try {
        const key = `${context}:${(error || "").slice(0, 120)}`
        const now = Date.now()
        const last = recent.get(key)
        if (last && now - last < DEDUPE_MS) return
        if (sent >= MAX_REPORTS) return
        recent.set(key, now)
        sent++

        fetch("/api/report-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context,
            error,
            details,
            url: window.location.href,
          }),
        }).catch(() => {})
      } catch {}
    }

    function handleError(event: ErrorEvent) {
      reportError(
        "window.onerror",
        event.message || "Error desconocido",
        `${event.filename}:${event.lineno}:${event.colno}`
      )
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const msg = event.reason?.message || event.reason?.toString() || "Promise rejection"
      const stack = event.reason?.stack?.split("\n").slice(0, 3).join(" | ") || ""
      reportError("unhandledrejection", msg, stack)
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

  return null
}
