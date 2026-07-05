/**
 * Helper de zona horaria para Ecuador (America/Guayaquil, UTC-5)
 * Usar en todo el sistema para fechas consistentes.
 */

export const TIMEZONE = "America/Guayaquil"

/** Obtiene la fecha/hora actual en Ecuador como objeto Date */
export function nowEcuador(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }))
}

/** Retorna la fecha actual en Ecuador como string ISO (YYYY-MM-DD) */
export function todayEcuador(): string {
  const now = nowEcuador()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Retorna fecha+hora actual en Ecuador como ISO string completo */
export function nowEcuadorISO(): string {
  return nowEcuador().toISOString()
}

/** Retorna el mes actual (1-12) en Ecuador */
export function currentMonthEcuador(): number {
  return nowEcuador().getMonth() + 1
}

/** Retorna el año actual en Ecuador */
export function currentYearEcuador(): number {
  return nowEcuador().getFullYear()
}

/** Nombres de meses en español */
export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

/** Retorna el nombre del mes actual en Ecuador (ej: "Julio 2026") */
export function currentMonthNameEcuador(): string {
  const now = nowEcuador()
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
}
