import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

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
  const { width, height } = page.getSize()

  const black = rgb(0.05, 0.05, 0.05)
  const darkGold = rgb(0.4, 0.3, 0.0)

  // Preparar datos
  const fechaLarga = formatFechaLarga(data.fecha)

  // === ESPOSO (centrado, zona superior) ===
  const esposoText = data.nombre
  const esposoWidth = font.widthOfTextAtSize(esposoText, 24)
  page.drawText(esposoText, {
    x: (width - esposoWidth) / 2,
    y: height - 278,
    size: 24,
    font: font,
    color: darkGold,
  })

  // === ESPOSA (centrado, debajo del esposo) ===
  const esposaText = data.conyuge
  const esposaWidth = font.widthOfTextAtSize(esposaText, 24)
  page.drawText(esposaText, {
    x: (width - esposaWidth) / 2,
    y: height - 353,
    size: 24,
    font: font,
    color: darkGold,
  })

  // === QUIÉN OFICIÓ LA CEREMONIA (centrado, más abajo) ===
  const oficioText = data.oficio
  const oficioWidth = fontRegular.widthOfTextAtSize(oficioText, 14)
  page.drawText(oficioText, {
    x: (width - oficioWidth) / 2,
    y: height - 535,
    size: 18,
    font: fontRegular,
    color: black,
  })

  // === FECHA (centrado, zona inferior) ===
  const fechaText = fechaLarga
  const fechaWidth = font.widthOfTextAtSize(fechaText, 13)
  page.drawText(fechaText, {
    x: (width - fechaWidth) - 578,
    y: height - 530,
    size: 13,
    font: font,
    color: black,
  })

  return await doc.save()
}
