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
  let cleaned = phone.replace(/[\s\-\+\(\)\.]/g, "")

  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "593" + cleaned.substring(1)
  }

  if (cleaned.length === 9 && cleaned.startsWith("9")) {
    cleaned = "593" + cleaned
  }

  return cleaned
}

export function formatPhoneDisplay(phone: string): string {
  const clean = formatPhoneForWhatsApp(phone)
  if (clean.startsWith("593") && clean.length === 12) {
    return `+593 ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`
  }
  return `+${clean}`
}
