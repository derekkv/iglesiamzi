import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { ajustarTamano, textoCentrado } from "./pdf-utils"

export interface MatrimonioPDFData {
  nombre: string
  cedula: string
  conyuge: string
  cedula_conyugue: string
  fecha: string
  hora: string
  oficio: string
  padrino1: string
  padrino2: string
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/**
 * Convierte hora 24h (HH:MM) a formato 12h con AM/PM
 */
function formatHora12(hora24: string): string {
  if (!hora24) return ""
  const [h, m] = hora24.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return hora24
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}

/**
 * Formatea fecha YYYY-MM-DD a "12 de julio del 2024"
 */
function formatFechaLarga(fecha: string): string {
  if (!fecha) return ""
  const [year, month, day] = fecha.split("-")
  const mesIdx = parseInt(month, 10) - 1
  return `${parseInt(day, 10)} de ${MESES[mesIdx] || month} del ${year}`
}

function parseFechaComponents(fecha: string): { dia: string; mes: string; anio: string } {
  if (!fecha) return { dia: "", mes: "", anio: "" }
  const [year, month, day] = fecha.split("-")
  const mesIdx = parseInt(month, 10) - 1
  return {
    dia: String(parseInt(day, 10)),
    mes: MESES[mesIdx] || month,
    anio: year,
  }
}

/**
 * Medidas de la plantilla /public/certificado-matrimonio-completo2.pdf (pt, MediaBox desde y=0):
 *   - raya de la fecha        x 174–328   (y 240)      · raya de la hora  x 174–246 (y 265)
 *   - rayas esposo / esposa   x 426–707   (y 278 / 322) · centro x≈567
 *   - raya del oficiante      x 140–307   (y 428)      · centro x≈223   (a la izquierda del divisor vertical)
 *   - rayas de los padrinos   x 350–616   (y 418 / 435)
 *   - parte inferior ("Y para constancia...", corazones) centrada en x≈396, no en el centro de la página
 * Los textos se ajustan al ancho de su raya y los de nombre/oficiante se centran sobre ella.
 */
const CENTRO_RAYA_PAREJA = 567
const ANCHO_RAYA_PAREJA = 270
const CENTRO_RAYA_OFICIANTE = 223.5
const ANCHO_RAYA_OFICIANTE = 160
const EJE_INFERIOR = 396

export async function generateMatrimonioPDF(data: MatrimonioPDFData): Promise<Uint8Array> {
  const templateResponse = await fetch("/certificado-matrimonio-completo2.pdf")
  const templateBytes = await templateResponse.arrayBuffer()

  const doc = await PDFDocument.load(templateBytes)
  const font = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)
  const fontRegular = await doc.embedFont(StandardFonts.TimesRoman)

  const pages = doc.getPages()
  const page = pages[0]
  const { width, height } = page.getSize()

  const black = rgb(0.05, 0.05, 0.05)
  const darkGold = rgb(0.4, 0.3, 0.0)

  const fechaLarga = formatFechaLarga(data.fecha)
  const horaFormateada = formatHora12(data.hora)
  const { dia, mes, anio } = parseFechaComponents(data.fecha)

  const fontSize = 13
  const smallFont = 11

  // Fecha y hora: alineadas al inicio de su raya, ajustadas a su ancho
  const fechaX = width * 0.21
  const fechaY = height - 236
  page.drawText(fechaLarga, {
    x: fechaX,
    y: fechaY,
    size: ajustarTamano(font, fechaLarga, fontSize, 9, 150),
    font: font,
    color: black,
  })

  page.drawText(horaFormateada, {
    x: fechaX,
    y: fechaY - 27,
    size: ajustarTamano(font, horaFormateada, fontSize, 9, 68),
    font: font,
    color: black,
  })

  // Esposo y esposa: centrados sobre sus rayas, con ajuste para nombres largos
  const esposoY = height - 274
  textoCentrado(page, data.nombre, {
    font, size: ajustarTamano(font, data.nombre, fontSize + 3, 9, ANCHO_RAYA_PAREJA),
    y: esposoY, cx: CENTRO_RAYA_PAREJA, color: darkGold,
  })

  textoCentrado(page, data.conyuge, {
    font, size: ajustarTamano(font, data.conyuge, fontSize + 2, 9, ANCHO_RAYA_PAREJA),
    y: esposoY - 46, cx: CENTRO_RAYA_PAREJA, color: darkGold,
  })

  // Oficiante: centrado sobre su raya (antes arrancaba en x=205 y cruzaba el divisor vertical)
  textoCentrado(page, data.oficio, {
    font: fontRegular, size: ajustarTamano(fontRegular, data.oficio, smallFont + 5, 8, ANCHO_RAYA_OFICIANTE),
    y: esposoY - 152, cx: CENTRO_RAYA_OFICIANTE, color: black,
  })

  // Padrinos: a la izquierda de su raya (junto a "1." y "2."), ajustados a su ancho
  const rightX = width * 0.51
  const padrinosX = rightX - 76
  const padrinosY = esposoY - 142
  page.drawText(data.padrino1, {
    x: padrinosX,
    y: padrinosY,
    size: ajustarTamano(fontRegular, data.padrino1, smallFont + 2, 8, 258),
    font: fontRegular,
    color: black,
  })
  page.drawText(data.padrino2, {
    x: padrinosX,
    y: padrinosY - 17,
    size: ajustarTamano(fontRegular, data.padrino2, smallFont + 2, 8, 258),
    font: fontRegular,
    color: black,
  })

  // Constancia: centrada en el eje inferior de la plantilla (antes arrancaba en un punto fijo)
  textoCentrado(page, `En Manta, a los ${dia} días del mes de ${mes} del ${anio}`, {
    font: fontRegular, size: 9.5, y: height - 459, cx: EJE_INFERIOR, color: black,
  })

  return await doc.save()
}
