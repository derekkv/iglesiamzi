/**
 * Formatea un número de teléfono al formato internacional para WhatsApp.
 * 
 * Casos manejados:
 * - "0980932062"     → "593980932062" (quita el 0 inicial, agrega 593)
 * - "+593980932062"  → "593980932062" (quita el +)
 * - "+5939 8093 2062" → "593980932062" (quita + y espacios)
 * - "593980932062"   → "593980932062" (ya correcto)
 * - "09 8093 2062"   → "593980932062" (quita espacios, formatea)
 * - "980932062"      → "593980932062" (9 dígitos, agrega 593)
 * 
 * @param phone Número en cualquier formato
 * @returns Número limpio listo para WhatsApp (ej: "593980932062")
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Limpiar: quitar +, espacios, guiones, paréntesis, puntos
  let cleaned = phone.replace(/[\s\-\+\(\)\.]/g, "")

  // Si empieza con 0 y tiene 10 dígitos (formato local Ecuador: 09XXXXXXXX)
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "593" + cleaned.substring(1)
  }

  // Si tiene 9 dígitos y empieza con 9 (solo el número sin código de país ni 0)
  if (cleaned.length === 9 && cleaned.startsWith("9")) {
    cleaned = "593" + cleaned
  }

  return cleaned
}

/**
 * Muestra un número formateado de forma legible: +593 98 093 2062
 */
export function formatPhoneDisplay(phone: string): string {
  const clean = formatPhoneForWhatsApp(phone)
  if (clean.startsWith("593") && clean.length === 12) {
    return `+593 ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`
  }
  return `+${clean}`
}
