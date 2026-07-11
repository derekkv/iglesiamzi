import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"

export interface PresentacionNinoPDFData {
  nombre_presentado: string
  nombre_padre: string
  nombre_madre: string
  fecha: string
  nombre_pastor: string
}

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function parseFecha(fecha: string): { dia: number; mes: string; anio: string } {
  if (!fecha) return { dia: 1, mes: "Enero", anio: "2025" }
  const [year, month, day] = fecha.split("-")
  return {
    dia: parseInt(day, 10),
    mes: MESES_ES[parseInt(month, 10) - 1] || "Enero",
    anio: year,
  }
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = rgb(0.133, 0.133, 0.133)) {
  const { width } = page.getSize()
  const textWidth = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color })
}

function drawCenteredLine(page: PDFPage, y: number, widthPercent: number, thickness = 0.75) {
  const { width } = page.getSize()
  const lineWidth = width * widthPercent
  const startX = (width - lineWidth) / 2
  page.drawLine({
    start: { x: startX, y },
    end: { x: startX + lineWidth, y },
    thickness,
    color: rgb(0.267, 0.267, 0.267), // #444444
  })
}

/**
 * Carga y embebe la fuente Bemdayni-Demo.otf desde /public
 */
async function loadBemdayniFont(doc: PDFDocument): Promise<PDFFont> {
  const fontResponse = await fetch("/Bemdayni-Demo.otf")
  const fontBytes = await fontResponse.arrayBuffer()
  return await doc.embedFont(fontBytes)
}

/**
 * Genera un certificado de dedicación de niño con estilo elegante, clásico y minimalista.
 * Tamaño Carta (Letter 8.5 × 11 in), orientación vertical.
 * Usa Bemdayni-Demo.otf como fuente script para nombres y elementos elegantes.
 */
export async function generatePresentacionNinoPDF(data: PresentacionNinoPDFData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  // Letter size: 612 x 792 points
  const page = doc.addPage([612, 792])
  const { width, height } = page.getSize()

  // Fonts
  const serifRegular = await doc.embedFont(StandardFonts.TimesRoman)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const scriptFont = await loadBemdayniFont(doc)
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)

  // Colors
  const textColor = rgb(0.133, 0.133, 0.133)       // #222222
  const borderColor = rgb(0.847, 0.847, 0.847)     // #D8D8D8
  const grayText = rgb(0.3, 0.3, 0.3)

  // === BORDE fino ===
  const borderInset = 25 // ~0.35 in
  page.drawRectangle({
    x: borderInset,
    y: borderInset,
    width: width - borderInset * 2,
    height: height - borderInset * 2,
    borderColor,
    borderWidth: 0.5,
  })

  // === LOGO esquina superior derecha ===
  try {
    const logoResponse = await fetch("/logo.png")
    const logoBytes = await logoResponse.arrayBuffer()
    const logoImage = await doc.embedPng(logoBytes)
    const logoSize = 70
    page.drawImage(logoImage, {
      x: width - borderInset - logoSize - 12,
      y: height - borderInset - logoSize - 12,
      width: logoSize,
      height: logoSize,
    })
  } catch (e) {
    // Si no se puede cargar el logo, continuar sin él
  }

  // Centrar contenido verticalmente
  let yPos = height - 135

  // === ENCABEZADO ===
  // "CERTIFICADO DE" — serif regular, mayúsculas, 16pt
  drawCentered(page, "CERTIFICADO DE", yPos, serifRegular, 16, textColor)
  yPos -= 44

  // "Dedicación de Niño" — Bemdayni script, 38pt
  drawCentered(page, "Dedicación de Niño", yPos, scriptFont, 38, textColor)
  yPos -= 62

  // === "ESTO CERTIFICA QUE" ===
  drawCentered(page, "ESTO CERTIFICA QUE", yPos, serifRegular, 14, textColor)
  yPos -= 46

  // === NOMBRE DEL NIÑO (elemento principal) ===
  drawCentered(page, data.nombre_presentado, yPos, scriptFont, 34, textColor)
  yPos -= 14
  drawCenteredLine(page, yPos, 0.60, 0.75)
  yPos -= 12
  drawCentered(page, "NOMBRE DEL NIÑO", yPos, serifRegular, 9, grayText)
  yPos -= 48

  // === PADRES ===
  const padresText = `${data.nombre_padre} y ${data.nombre_madre}`
  drawCentered(page, padresText, yPos, scriptFont, 24, textColor)
  yPos -= 14
  drawCenteredLine(page, yPos, 0.55, 0.75)
  yPos -= 12
  drawCentered(page, "NOMBRES DE LOS PADRES", yPos, serifRegular, 9, grayText)
  yPos -= 56

  // === TEXTO CENTRAL ===
  // "FUE DEDICADO AL SEÑOR"
  drawCentered(page, "FUE DEDICADO AL SEÑOR", yPos, serifRegular, 13, textColor)
  yPos -= 40

  // "EL DÍA 13 DE Junio" — día bold, mes en script
  const { dia, mes, anio } = parseFecha(data.fecha)
  const diaStr = String(dia)

  const parts = [
    { text: "EL DÍA ", font: serifRegular, size: 13 },
    { text: diaStr, font: serifBold, size: 18 },
    { text: " DE ", font: serifRegular, size: 13 },
    { text: mes, font: scriptFont, size: 30 },
  ]

  let totalWidth = 0
  for (const part of parts) {
    totalWidth += part.font.widthOfTextAtSize(part.text, part.size)
  }
  let xPos = (width - totalWidth) / 2
  for (const part of parts) {
    page.drawText(part.text, { x: xPos, y: yPos, size: part.size, font: part.font, color: textColor })
    xPos += part.font.widthOfTextAtSize(part.text, part.size)
  }
  yPos -= 38

  // "DEL AÑO DE NUESTRO SEÑOR, 2026."
  const anioLine = [
    { text: "DEL AÑO DE NUESTRO SEÑOR, ", font: serifRegular, size: 13 },
    { text: `${anio}.`, font: serifBold, size: 18 },
  ]

  let totalWidth2 = 0
  for (const part of anioLine) {
    totalWidth2 += part.font.widthOfTextAtSize(part.text, part.size)
  }
  let xPos2 = (width - totalWidth2) / 2
  for (const part of anioLine) {
    page.drawText(part.text, { x: xPos2, y: yPos, size: part.size, font: part.font, color: textColor })
    xPos2 += part.font.widthOfTextAtSize(part.text, part.size)
  }
  yPos -= 76

  // === FIRMA ===
  drawCenteredLine(page, yPos, 0.40, 0.75)
  yPos -= 18
  // "Pastor [Nombre]"
  const pastorText = `Pastor ${data.nombre_pastor}`
  drawCentered(page, pastorText, yPos, serifRegular, 12, textColor)
  yPos -= 62

  // === VERSÍCULO — con la fuente Bemdayni ===
  const versLine1 = "Él les dijo: \"Dejen que los niños vengan a mí,"
  const versLine2 = "y no se lo impidan, porque el reino de Dios"
  const versLine3 = "es de quienes son como ellos\"."
  drawCentered(page, versLine1, yPos, scriptFont, 17, grayText)
  yPos -= 20
  drawCentered(page, versLine2, yPos, scriptFont, 17, grayText)
  yPos -= 20
  drawCentered(page, versLine3, yPos, scriptFont, 17, grayText)
  yPos -= 18
  drawCentered(page, "Mateo 19:14", yPos, serifItalic, 11, grayText)

  return await doc.save()
}

/**
 * Genera un PDF con múltiples certificados (uno por página)
 */
export async function generatePresentacionNinosBulkPDF(records: PresentacionNinoPDFData[]): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create()

  for (const record of records) {
    const singlePdfBytes = await generatePresentacionNinoPDF(record)
    const singleDoc = await PDFDocument.load(singlePdfBytes)
    const [page] = await mergedDoc.copyPages(singleDoc, [0])
    mergedDoc.addPage(page)
  }

  return await mergedDoc.save()
}
