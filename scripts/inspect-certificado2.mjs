import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, PDFRawStream, decodePDFRawStream } from "pdf-lib"
import fs from "fs"
import path from "path"

const pdfPath = path.resolve("public/MODELO CERTIFICADO.pdf")

async function main() {
  const pdfBytes = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()
  console.log(`Dimensiones: ${width} x ${height}`)

  // Get the content stream(s)
  const pageDict = firstPage.node
  const context = pdfDoc.context

  const contentsRef = pageDict.get(PDFName.of("Contents"))
  console.log("Contents ref:", contentsRef?.constructor?.name, contentsRef?.toString?.())

  // Try to lookup and decode
  const contentsObj = context.lookup(contentsRef)
  console.log("Contents obj type:", contentsObj?.constructor?.name)

  if (contentsObj instanceof PDFRawStream || contentsObj?.constructor?.name === "PDFRawStream") {
    try {
      const decoded = decodePDFRawStream(contentsObj)
      const text = Buffer.from(decoded.decode()).toString("latin1")
      // Search for text operations (Tj, TJ, etc.)
      const lines = text.split("\n")
      const textOps = lines.filter(l => l.includes("Tj") || l.includes("TJ") || l.includes("Tm") || l.includes("Td") || l.includes("BT") || l.includes("ET"))
      console.log(`\nFound ${textOps.length} text-related operations`)
      textOps.forEach((op, i) => {
        if (i < 100) console.log(op.substring(0, 200))
      })
    } catch (e) {
      console.log("Error decoding:", e.message)
    }
  } else if (contentsObj?.constructor?.name === "PDFFlateStream" || contentsObj?.getContents) {
    try {
      const contents = contentsObj.getContents()
      const text = Buffer.from(contents).toString("latin1")
      const lines = text.split("\n")
      const textOps = lines.filter(l => l.includes("Tj") || l.includes("TJ") || l.includes("Tm") || l.includes("Td") || l.includes("BT") || l.includes("ET"))
      console.log(`\nFound ${textOps.length} text-related operations`)
      textOps.forEach((op, i) => {
        if (i < 100) console.log(op.substring(0, 200))
      })
    } catch (e) {
      console.log("Error getting contents:", e.message)
    }
  }

  // Another approach: enumerate all indirect objects looking for streams
  const allObjects = context.enumerateIndirectObjects()
  let streamCount = 0
  for (const [ref, obj] of allObjects) {
    if (obj?.constructor?.name?.includes("Stream")) {
      streamCount++
    }
  }
  console.log(`\nTotal streams in PDF: ${streamCount}`)
}

main().catch(console.error)
