"use client"

import { useEffect } from "react"

export function ErrorReporter() {
  useEffect(() => {
    function reportError(context: string, error: string, details?: string) {
      try {
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
