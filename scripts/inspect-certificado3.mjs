import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib"
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

  const pageDict = firstPage.node
  const context = pdfDoc.context
  const contentsRef = pageDict.get(PDFName.of("Contents"))
  const contentsObj = context.lookup(contentsRef)

  if (contentsObj) {
    const decoded = decodePDFRawStream(contentsObj)
    const bytes = decoded.decode()
    const text = Buffer.from(bytes).toString("latin1")
    
    // Buscar todos los bloques BT...ET (text blocks)
    const btEtRegex = /BT\n([\s\S]*?)ET/g
    let match
    let blockNum = 0
    
    while ((match = btEtRegex.exec(text)) !== null) {
      blockNum++
      const block = match[1]
      
      // Buscar la transformación Tm para obtener posición
      const tmMatch = block.match(/([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)\s+Tm/)
      
      if (tmMatch) {
        const [, a, b, c, d, tx, ty] = tmMatch
        // En PDF, Tm establece la text matrix: [a b c d tx ty]
        // tx, ty son las coordenadas de posición
        
        // Intentar decodificar el texto dentro del bloque
        const tjMatch = block.match(/\(([^)]*)\)\s*Tj/)
        const tjArrayMatch = block.match(/\[([^\]]*)\]\s*TJ/)
        
        let textContent = ""
        if (tjMatch) textContent = tjMatch[1]
        else if (tjArrayMatch) {
          // Extraer solo los textos entre paréntesis del array TJ
          const parts = tjArrayMatch[1].match(/\(([^)]*)\)/g)
          if (parts) textContent = parts.map(p => p.replace(/[()]/g, '')).join('')
        }
        
        console.log(`Block ${blockNum}: pos(${parseFloat(tx).toFixed(1)}, ${parseFloat(ty).toFixed(1)}) scale(${parseFloat(a).toFixed(3)}, ${parseFloat(d).toFixed(3)}) text="${textContent.substring(0, 80)}"`)
      }
    }
  }
}

main().catch(console.error)
