import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"

export interface PresentacionNinoPDFData {
  nombre_presentado: string
  nombre_padre: string
  nombre_madre: string
  fecha: string
  nombre_pastor: string
  testigo1: string
  testigo2: string
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

async function loadBemdayniFont(doc: PDFDocument): Promise<PDFFont> {
  const fontResponse = await fetch("/Bemdayni-Demo.otf")
  const fontBytes = await fontResponse.arrayBuffer()
  return await doc.embedFont(fontBytes)
}

export async function generatePresentacionNinoPDF(data: PresentacionNinoPDFData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const page = doc.addPage([612, 792])
  const { width, height } = page.getSize()

  const serifRegular = await doc.embedFont(StandardFonts.TimesRoman)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const scriptFont = await loadBemdayniFont(doc)
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)

  const textColor = rgb(0.133, 0.133, 0.133)       // #222222
  const borderColor = rgb(0.847, 0.847, 0.847)     // #D8D8D8
  const grayText = rgb(0.3, 0.3, 0.3)

  const borderInset = 25
  page.drawRectangle({
    x: borderInset,
    y: borderInset,
    width: width - borderInset * 2,
    height: height - borderInset * 2,
    borderColor,
    borderWidth: 0.5,
  })

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
  }

  const contentOffset = 80 // Aumentar para bajar, disminuir para subir
  let yPos = height - contentOffset

  drawCentered(page, "CERTIFICADO DE", yPos, serifRegular, 16, textColor)
  yPos -= 44

  drawCentered(page, "Dedicación de Niño", yPos, scriptFont, 38, textColor)
  yPos -= 62

  drawCentered(page, "ESTO CERTIFICA QUE", yPos, serifRegular, 14, textColor)
  yPos -= 46

  drawCentered(page, data.nombre_presentado, yPos, scriptFont, 34, textColor)
  yPos -= 14
  drawCenteredLine(page, yPos, 0.60, 0.75)
  yPos -= 12
  drawCentered(page, "NOMBRE DEL NIÑO", yPos, serifRegular, 9, grayText)
  yPos -= 48

  const padresText = `${data.nombre_padre} y ${data.nombre_madre}`
  drawCentered(page, padresText, yPos, scriptFont, 24, textColor)
  yPos -= 14
  drawCenteredLine(page, yPos, 0.55, 0.75)
  yPos -= 12
  drawCentered(page, "NOMBRES DE LOS PADRES", yPos, serifRegular, 9, grayText)
  yPos -= 48

  const testigosText = `${data.testigo1 || "—"} y ${data.testigo2 || "—"}`
  drawCentered(page, testigosText, yPos, scriptFont, 24, textColor)
  yPos -= 14
  drawCenteredLine(page, yPos, 0.55, 0.75)
  yPos -= 12
  drawCentered(page, "TESTIGOS", yPos, serifRegular, 9, grayText)
  yPos -= 56

  drawCentered(page, "FUE DEDICADO AL SEÑOR", yPos, serifRegular, 13, textColor)
  yPos -= 40

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
  yPos -= 72

  drawCenteredLine(page, yPos, 0.40, 0.75)
  yPos -= 16
  const pastorText = `Pastor ${data.nombre_pastor}`
  drawCentered(page, pastorText, yPos, serifRegular, 11, textColor)
  yPos -= 55

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
