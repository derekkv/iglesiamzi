import { rgb } from "pdf-lib"
import type { PDFFont, PDFPage } from "pdf-lib"
import { ajustarTamano, dividirEnDosLineas, textoCentrado } from "./pdf-utils"

/**
 * Dibuja el nombre del cumpleañero sobre la plantilla "plantilla de cumpleaños (1).pdf".
 * Lo usan el PDF (navegador) y la imagen/video de WhatsApp (servidor), así ambos se ven igual.
 *
 * Medidas de la plantilla (pt, 595 x 842):
 *   - "FELIZ CUMPLE" termina en y≈259 y el texto del cuerpo empieza en y≈392: la franja del
 *     nombre (y 262–390) está libre.
 *   - hay globos a los lados: el de la derecha empieza en x≈524 (desde y≈331) y el de la
 *     izquierda en y≈353 (hasta x≈118). Por eso el ancho máximo es 430 pt, centrado en la página.
 * Antes el nombre se dibujaba a 28 pt sin límite, y un nombre de 4–5 palabras se salía por ambos
 * lados de la hoja.
 */
const COLOR_NOMBRE = rgb(0.72, 0.53, 0.04)
const ANCHO_MAX = 430
const TAMANO_MAX = 28
const TAMANO_MIN_UNA_LINEA = 22

export function dibujarNombreCumpleanos(page: PDFPage, font: PDFFont, nombre: string) {
  const { width, height } = page.getSize()
  const texto = nombre.toUpperCase()
  const cx = width / 2
  const baseUnica = height / 2 + 80 // línea base original (coordenadas PDF)

  // 1) Una sola línea, reduciendo el tamaño hasta un mínimo legible
  const sizeUna = ajustarTamano(font, texto, TAMANO_MAX, TAMANO_MIN_UNA_LINEA, ANCHO_MAX)
  if (font.widthOfTextAtSize(texto, sizeUna) <= ANCHO_MAX) {
    textoCentrado(page, texto, { font, size: sizeUna, y: baseUnica, cx, color: COLOR_NOMBRE })
    return
  }

  // 2) Nombre largo: dos líneas centradas, del mismo tamaño, alrededor del centro óptico de la línea única
  const [l1, l2] = dividirEnDosLineas(texto)
  const size = Math.min(
    ajustarTamano(font, l1, 26, 12, ANCHO_MAX),
    ajustarTamano(font, l2, 26, 12, ANCHO_MAX)
  )
  const interlineado = size * 1.15
  const centro = baseUnica + 10
  textoCentrado(page, l1, { font, size, y: centro + interlineado / 2 - size * 0.36, cx, color: COLOR_NOMBRE })
  if (l2) {
    textoCentrado(page, l2, { font, size, y: centro - interlineado / 2 - size * 0.36, cx, color: COLOR_NOMBRE })
  }
}
