import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

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

  const fechaX = width * 0.21
  const fechaY = height - 236
  page.drawText(fechaLarga, {
    x: fechaX,
    y: fechaY,
    size: fontSize,
    font: font,
    color: black,
  })

  page.drawText(horaFormateada, {
    x: fechaX,
    y: fechaY - 27,
    size: fontSize,
    font: font,
    color: black,
  })

  const rightX = width * 0.51
  const esposoY = height - 274
  page.drawText(data.nombre, {
    x: rightX,
    y: esposoY,
    size: fontSize + 3,
    font: font,
    color: darkGold,
  })

  page.drawText(data.conyuge, {
    x: rightX,
    y: esposoY - 46,
    size: fontSize + 2,
    font: font,
    color: darkGold,
  })

  page.drawText(data.oficio, {
    x: rightX - 225,
    y: esposoY - 152,
    size: smallFont + 5,
    font: fontRegular,
    color: black,
  })

  const padrinosX = rightX - 76
  const padrinosY = esposoY - 142
  page.drawText(data.padrino1, {
    x: padrinosX,
    y: padrinosY,
    size: smallFont + 2,
    font: fontRegular,
    color: black,
  })
  page.drawText(data.padrino2, {
    x: padrinosX,
    y: padrinosY - 17,
    size: smallFont + 2,
    font: fontRegular,
    color: black,
  })

  const declY = height - 459
  const declFontSize = 12

  
    page.drawText(`En Manta, a los ${dia} dias del mes de ${mes} del ${anio}`, {
    x: width / 2 - 135,
    y: declY,
    size: declFontSize - 2.5,
    font: fontRegular,
    color: black,
  })


  return await doc.save()
}
