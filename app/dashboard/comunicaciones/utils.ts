/**
 * Utilidades compartidas por los tabs de WhatsApp y Email.
 */
import { formatPhoneDisplay } from "@/lib/format-phone"
import type { WaContact, WaMessage } from "./types"

/** Nombre a mostrar de un contacto, con varios respaldos. */
export function contactName(contact: Pick<WaContact, "display_name" | "profile_name" | "wa_id">): string {
  return contact.display_name || contact.profile_name || formatPhoneDisplay(contact.wa_id)
}

/** ¿La ventana de servicio de 24 h está abierta? */
export function isWindowOpen(contact: Pick<WaContact, "window_expires_at"> | null | undefined): boolean {
  if (!contact?.window_expires_at) return false
  return new Date(contact.window_expires_at).getTime() > Date.now()
}

/** Tiempo restante de la ventana en formato "5h 12m". */
export function windowRemaining(contact: Pick<WaContact, "window_expires_at"> | null | undefined): string | null {
  if (!contact?.window_expires_at) return null
  const ms = new Date(contact.window_expires_at).getTime() - Date.now()
  if (ms <= 0) return null
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

/** Fecha corta con hora, en horario de Ecuador. */
export function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Solo la hora, para las burbujas del chat. */
export function formatTime(value?: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })
}

/** "hace 5 min", "ayer", "12/07/2026" según la antigüedad. */
export function formatRelative(value?: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""

  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60_000)

  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`

  const days = Math.floor(hours / 24)
  if (days === 1) return "ayer"
  if (days < 7) return `hace ${days} días`

  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/** Separador de días en el chat. */
export function dayLabel(value: string): string {
  const d = new Date(value)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)

  const same = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()

  if (same(d, today)) return "Hoy"
  if (same(d, yesterday)) return "Ayer"
  return d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })
}

/** Marca de estado del mensaje saliente (los checks de WhatsApp). */
export function statusMark(status: string): { icon: string; className: string; label: string } {
  switch (status) {
    case "pending":
      return { icon: "🕘", className: "text-gray-400", label: "Pendiente" }
    case "sent":
      return { icon: "✓", className: "text-gray-400", label: "Enviado" }
    case "delivered":
      return { icon: "✓✓", className: "text-gray-500", label: "Entregado" }
    case "read":
      return { icon: "✓✓", className: "text-blue-500", label: "Leído" }
    case "failed":
      return { icon: "⚠", className: "text-red-500", label: "Fallido" }
    case "skipped":
      return { icon: "⃠", className: "text-amber-500", label: "Omitido" }
    default:
      return { icon: "", className: "text-gray-400", label: status }
  }
}

/** Texto legible del contenido de un mensaje, según su tipo. */
export function messagePreview(msg: Pick<WaMessage, "type" | "body" | "caption" | "media_filename">): string {
  if (msg.body) return msg.body
  if (msg.caption) return msg.caption
  switch (msg.type) {
    case "image": return "📷 Imagen"
    case "audio": return "🎤 Audio"
    case "video": return "🎬 Video"
    case "document": return `📄 ${msg.media_filename || "Documento"}`
    case "sticker": return "Sticker"
    case "location": return "📍 Ubicación"
    case "contacts": return "👤 Contacto"
    default: return "Mensaje"
  }
}

/** Tamaño legible: 1.2 MB */
export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/** Color de la insignia de calidad que reporta Meta. */
export function qualityColor(quality?: string | null): string {
  switch ((quality || "").toUpperCase()) {
    case "GREEN": return "bg-green-600"
    case "YELLOW": return "bg-amber-500"
    case "RED": return "bg-red-600"
    default: return "bg-gray-400"
  }
}

export function qualityLabel(quality?: string | null): string {
  switch ((quality || "").toUpperCase()) {
    case "GREEN": return "Buena"
    case "YELLOW": return "Media"
    case "RED": return "Baja"
    case "UNKNOWN": return "Sin datos"
    default: return quality || "Sin datos"
  }
}

/** Extrae las variables {{n}} de un texto de plantilla de Meta. */
export function templateVariables(bodyPreview?: string | null): number[] {
  if (!bodyPreview) return []
  const found = new Set<number>()
  for (const match of bodyPreview.matchAll(/\{\{(\d+)\}\}/g)) {
    found.add(Number(match[1]))
  }
  return [...found].sort((a, b) => a - b)
}

/** Sustituye {{n}} por los valores dados, para previsualizar. */
export function fillTemplatePreview(bodyPreview: string, values: Record<string, string>): string {
  return bodyPreview.replace(/\{\{(\d+)\}\}/g, (_, n: string) => values[n] || `{{${n}}}`)
}
