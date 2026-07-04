import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib"
import fs from "fs"
import path from "path"

const pdfPath = path.resolve("public/MODELO CERTIFICADO.pdf")

// Caesar cipher decoder (shift -3)
function decodeCaesar(text, shift = 3) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0)
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65)
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 - shift + 26) % 26) + 97)
    return c
  }).join('')
}

async function main() {
  const pdfBytes = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()
  console.log(`Dimensiones: ${width} x ${height}\n`)

  const pageDict = firstPage.node
  const context = pdfDoc.context
  const contentsRef = pageDict.get(PDFName.of("Contents"))
  const contentsObj = context.lookup(contentsRef)

  if (contentsObj) {
    const decoded = decodePDFRawStream(contentsObj)
    const bytes = decoded.decode()
    const text = Buffer.from(bytes).toString("latin1")
    
    // Imprimir todo el contenido decodificado, solo las líneas con operadores de texto/gráficos clave
    const lines = text.split("\n")
    console.log(`Total lines in content stream: ${lines.length}\n`)
    
    // Buscar patrones de texto con contexto de posición
    let inTextBlock = false
    let currentTm = null
    let lineIdx = 0
    
    for (const line of lines) {
      lineIdx++
      const trimmed = line.trim()
      
      if (trimmed === "BT") {
        inTextBlock = true
        continue
      }
      if (trimmed === "ET") {
        inTextBlock = false
        currentTm = null
        continue
      }
      
      if (inTextBlock) {
        // Capture Tm (text matrix)
        const tmMatch = trimmed.match(/([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)\s+Tm/)
        if (tmMatch) {
          currentTm = {
            a: parseFloat(tmMatch[1]),
            b: parseFloat(tmMatch[2]),
            c: parseFloat(tmMatch[3]),
            d: parseFloat(tmMatch[4]),
            tx: parseFloat(tmMatch[5]),
            ty: parseFloat(tmMatch[6]),
          }
        }
        
        // Capture text operations
        if (trimmed.includes("Tj") || trimmed.includes("TJ")) {
          // Extract visible text
          const parts = trimmed.match(/\(([^)]*)\)/g)
          if (parts && currentTm) {
            const rawText = parts.map(p => p.slice(1, -1)).join('')
            const cleaned = rawText.replace(/\s+/g, ' ').trim()
            if (cleaned.length > 1) {
              const decoded3 = decodeCaesar(cleaned, 3)
              console.log(`Line ${lineIdx} | Tm(${currentTm.tx.toFixed(1)}, ${currentTm.ty.toFixed(1)}) scale(${currentTm.a.toFixed(3)}) | raw="${cleaned.substring(0, 60)}" | decoded="${decoded3.substring(0, 60)}"`)
            }
          }
        }
      }
    }
    
    // También buscar cm (transformaciones de contexto gráfico)
    console.log("\n--- Graphics state transforms (cm) ---")
    let cmCount = 0
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.endsWith(" cm")) {
        cmCount++
        if (cmCount <= 20) console.log(trimmed)
      }
    }
    console.log(`Total cm operations: ${cmCount}`)
  }
}

main().catch(console.error)
