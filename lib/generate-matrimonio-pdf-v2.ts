import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { ajustarTamano, textoCentrado } from "./pdf-utils"

export interface MatrimonioPDFv2Data {
  nombre: string
  conyuge: string
  oficio: string
  fecha: string
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/**
 * Formatea fecha YYYY-MM-DD a "12 de julio del 2024"
 */
function formatFechaLarga(fecha: string): string {
  if (!fecha) return ""
  const [year, month, day] = fecha.split("-")
  const mesIdx = parseInt(month, 10) - 1
  return `${parseInt(day, 10)} de ${MESES[mesIdx] || month} del ${year}`
}

/**
 * Medidas de la plantilla /public/certificado-matrimonio-v2.pdf (pt, MediaBox desde y=0):
 *   - eje del título, "ESPOSO"/"ESPOSA" y el versículo     x≈427  (no el centro de la página, 421)
 *   - raya del oficiante                                    x 333–521  (centro 427)
 *   - raya de la fecha (bajo "FECHA")                       x 135–262  (centro 199, ancho 127)
 * Antes la fecha quedaba pegada al extremo derecho de su raya y el oficiante se centraba
 * midiendo el ancho con un tamaño (14) distinto al que se dibujaba (18).
 */
const EJE = 427
const CENTRO_FECHA = 199
const ANCHO_FECHA = 124
const ANCHO_OFICIANTE = 180
const ANCHO_NOMBRES = 420

/**
 * Genera un PDF de certificado de matrimonio versión 2 (simplificada).
 * Solo incluye: nombres de los esposos, quién ofició la ceremonia y la fecha.
 * Usa la plantilla certificado-matrimonio-v2.pdf
 */
export async function generateMatrimonioPDFv2(data: MatrimonioPDFv2Data): Promise<Uint8Array> {
  // Cargar la plantilla v2
  const templateResponse = await fetch("/certificado-matrimonio-v2.pdf")
  const templateBytes = await templateResponse.arrayBuffer()

  const doc = await PDFDocument.load(templateBytes)
  const font = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)
  const fontRegular = await doc.embedFont(StandardFonts.TimesRoman)

  const pages = doc.getPages()
  const page = pages[0]
  const { height } = page.getSize()

  const black = rgb(0.05, 0.05, 0.05)
  const darkGold = rgb(0.4, 0.3, 0.0)

  const fechaLarga = formatFechaLarga(data.fecha)

  // Esposo y esposa: centrados en el eje de la plantilla, reducidos si son muy largos
  textoCentrado(page, data.nombre, {
    font, size: ajustarTamano(font, data.nombre, 24, 14, ANCHO_NOMBRES),
    y: height - 278, cx: EJE, color: darkGold,
  })

  textoCentrado(page, data.conyuge, {
    font, size: ajustarTamano(font, data.conyuge, 24, 14, ANCHO_NOMBRES),
    y: height - 353, cx: EJE, color: darkGold,
  })

  // Oficiante: centrado sobre su raya, con el mismo tamaño con el que se mide y se dibuja
  textoCentrado(page, data.oficio, {
    font: fontRegular, size: ajustarTamano(fontRegular, data.oficio, 18, 10, ANCHO_OFICIANTE),
    y: height - 535, cx: EJE, color: black,
  })

  // Fecha: centrada sobre su raya y su etiqueta "FECHA"
  textoCentrado(page, fechaLarga, {
    font, size: ajustarTamano(font, fechaLarga, 13, 9, ANCHO_FECHA),
    y: height - 530, cx: CENTRO_FECHA, color: black,
  })

  return await doc.save()
}
