import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

export interface BautizoPDFData {
  nombre: string
  cedula: string
  fecha_bautizo: string
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
 * Extrae componentes de la fecha
 */
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
 * Genera un PDF de certificado de bautizo usando la plantilla
 * certificado-bautizo.pdf y escribiendo los datos encima.
 */
export async function generateBautizoPDF(data: BautizoPDFData): Promise<Uint8Array> {
  const templateResponse = await fetch("/certificado-bautizo.pdf")
  const templateBytes = await templateResponse.arrayBuffer()

  const doc = await PDFDocument.load(templateBytes)
  const font = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)
  const fontRegular = await doc.embedFont(StandardFonts.TimesRoman)

  const pages = doc.getPages()
  const page = pages[0]
  const { width, height } = page.getSize()

  const black = rgb(0.05, 0.05, 0.05)
  const darkGold = rgb(0.4, 0.3, 0.0)

  const fechaLarga = formatFechaLarga(data.fecha_bautizo)
  const { dia, mes, anio } = parseFechaComponents(data.fecha_bautizo)

  const fontSize = 14
  const centerX = width / 2

  // === NOMBRE (centrado, zona media-superior) ===
  const nombreWidth = font.widthOfTextAtSize(data.nombre, fontSize + 5)
  page.drawText(data.nombre, {
    x: centerX - nombreWidth / 2,
    y: height - 220,
    size: fontSize + 5,
    font: font,
    color: darkGold,
  })



  // === DECLARACIÓN AL PIE: día, mes y año por separado ===
  const declY = height - 550
  const declFontSize = 12


    page.drawText(`${dia} de ${mes} del ${anio}`, {
    x: width * 0.05,
    y: declY,
    size: declFontSize + 2,
    font: font,
    color: black,
  })

  return await doc.save()
}
