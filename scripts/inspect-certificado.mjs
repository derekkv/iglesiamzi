import { PDFDocument } from "pdf-lib"
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

  // Extraer los content streams para ver las operaciones de texto
  const contentStreams = firstPage.node.Contents()
  if (contentStreams) {
    // Intentar obtener el contenido raw
    const ref = firstPage.node.get(firstPage.node.context.obj("Contents"))
    console.log("Contents type:", ref?.constructor?.name)
  }

  // Método alternativo: parsear el raw content stream
  const rawPage = firstPage.node
  const resources = rawPage.get(rawPage.context.obj("Resources"))
  console.log("Has resources:", !!resources)

  // Obtener el stream de contenido decodificado
  const contentsRef = rawPage.get(rawPage.context.obj("Contents"))
  if (contentsRef) {
    const context = rawPage.context
    // Si es un array de streams
    if (contentsRef.constructor.name === "PDFArray") {
      console.log("Contents is array with", contentsRef.size(), "streams")
      for (let i = 0; i < contentsRef.size(); i++) {
        const streamRef = contentsRef.get(i)
        const stream = context.lookup(streamRef)
        if (stream && stream.getContentsString) {
          const content = stream.getContentsString()
          console.log(`\n--- Stream ${i} (first 3000 chars) ---`)
          console.log(content.substring(0, 3000))
        } else if (stream && stream.decodeText) {
          console.log(`Stream ${i} decodeText:`, stream.decodeText().substring(0, 3000))
        }
      }
    } else {
      // Es un solo stream
      const stream = context.lookup(contentsRef)
      if (stream && stream.getContentsString) {
        const content = stream.getContentsString()
        console.log("\n--- Content stream (first 5000 chars) ---")
        console.log(content.substring(0, 5000))
      }
    }
  }
}

main().catch(console.error)
