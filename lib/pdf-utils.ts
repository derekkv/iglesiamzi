import { rgb } from "pdf-lib"
import type { PDFFont, PDFPage } from "pdf-lib"

/**
 * Utilidades compartidas por todos los generadores de PDF de la app
 * (certificados, bautizo, matrimonio, cumpleaños, presentación de niños).
 */

export type PdfColor = ReturnType<typeof rgb>

/** Dorado de las plantillas (medido de "Confiere el siguiente Diploma a:"). */
export const COLOR_DORADO = rgb(0.875, 0.722, 0.306)

/** Reduce el tamaño de la fuente hasta que el texto quepa en `maxWidth` (sin bajar de `minSize`). */
export function ajustarTamano(font: PDFFont, text: string, maxSize: number, minSize: number, maxWidth: number): number {
  let size = maxSize
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5
  return size
}

/** Dibuja un texto centrado horizontalmente en `cx` (con `y` como línea base, en coordenadas PDF). */
export function textoCentrado(
  page: PDFPage,
  text: string,
  opts: { font: PDFFont; size: number; y: number; cx: number; color: PdfColor }
) {
  const w = opts.font.widthOfTextAtSize(text, opts.size)
  page.drawText(text, { x: opts.cx - w / 2, y: opts.y, size: opts.size, font: opts.font, color: opts.color })
}

/**
 * Igual que `textoCentrado`, pero con trazo más grueso ("negrita reforzada").
 * Las fuentes estándar de PDF solo tienen un peso en negrita; para darle más cuerpo se dibuja
 * el mismo texto cuatro veces con un desplazamiento mínimo (`grosor`, en pt). El conjunto
 * sigue centrado en `cx`.
 */
export function textoCentradoNegrita(
  page: PDFPage,
  text: string,
  opts: { font: PDFFont; size: number; y: number; cx: number; color: PdfColor; grosor?: number }
) {
  const g = opts.grosor ?? 0.5
  const w = opts.font.widthOfTextAtSize(text, opts.size)
  const x0 = opts.cx - w / 2 - g / 2
  const y0 = opts.y - g / 2
  for (const [dx, dy] of [[0, 0], [g, 0], [0, g], [g, g]]) {
    page.drawText(text, { x: x0 + dx, y: y0 + dy, size: opts.size, font: opts.font, color: opts.color })
  }
}

/** Separador dorado: dos líneas con un rombo en el centro. `y` en coordenadas PDF. */
export function separadorDorado(page: PDFPage, cx: number, y: number, mitad: number, color: PdfColor = COLOR_DORADO) {
  const hueco = 9
  page.drawLine({ start: { x: cx - mitad, y }, end: { x: cx - hueco, y }, thickness: 1, color })
  page.drawLine({ start: { x: cx + hueco, y }, end: { x: cx + mitad, y }, thickness: 1, color })
  page.drawSvgPath("M 0 -4.5 L 4.5 0 L 0 4.5 L -4.5 0 Z", { x: cx, y, color })
}

/**
 * Devuelve una función que convierte "distancia desde el borde SUPERIOR visible" a la
 * coordenada Y del PDF. Necesaria porque algunas plantillas tienen un MediaBox que no
 * empieza en y=0 (p. ej. las de certificado y bautizo empiezan en y≈8.58).
 */
export function crearYDesdeArriba(page: PDFPage): (t: number) => number {
  const mb = page.getMediaBox()
  return (t: number) => mb.y + mb.height - t
}

/** Divide un texto en dos líneas lo más parejas posible, cortando por espacios. */
export function dividirEnDosLineas(text: string): [string, string] {
  const palabras = text.trim().split(/\s+/)
  if (palabras.length < 2) return [text.trim(), ""]
  let mejor = 1
  let mejorDif = Infinity
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(" ").length
    const b = palabras.slice(i).join(" ").length
    if (Math.abs(a - b) < mejorDif) {
      mejorDif = Math.abs(a - b)
      mejor = i
    }
  }
  return [palabras.slice(0, mejor).join(" "), palabras.slice(mejor).join(" ")]
}
