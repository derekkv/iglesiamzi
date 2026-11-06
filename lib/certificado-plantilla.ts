import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { ajustarTamano, textoCentrado, textoCentradoNegrita, separadorDorado, crearYDesdeArriba, COLOR_DORADO } from "./pdf-utils"
import type { PdfColor } from "./pdf-utils"

/**
 * Motor común de los certificados de curso (Discipulado y Proyecto Mario).
 *
 * Usa la plantilla /public/MODELO CERTIFICADO.pdf (olas, logo y mano con biblia) y
 * reorganiza los textos para que queden centrados, con aire entre ellos y una
 * jerarquía de tamaños clara. Los textos que la plantilla trae impresos (y que no
 * están centrados o son propios de un solo curso) se tapan con blanco —el fondo ahí
 * es blanco liso— y se reescriben.
 *
 * NOTA: el MediaBox de la plantilla NO empieza en y=0 (empieza en y≈8.58), por eso
 * todo se posiciona con `yDesdeArriba`, que mide desde el borde superior visible.
 *
 * Medidas de la plantilla (pt, desde arriba), obtenidas analizando los píxeles:
 *   - "Confiere el siguiente Diploma a:"  y 80–120
 *   - "Graduado en:"                       x 346–495, y 210–228   (se tapa y reescribe)
 *   - "DiscipuladoTransformando Vidas"     x 287–581, y 241–262   (se tapa)
 *   - "DANDO A CONOCER ... DISCIPULADO:"   x 149–675, y 274–284   (se tapa)
 *   - firmas (línea, nombre, cargo)        x 226–591, y 504–546   (se tapan)
 *   - ilustración mano/biblia              x 696–827, y 364–487   (se conserva)
 *   - olas inferiores: sin tinta por encima de y≈560 entre x 200 y 650
 */

// Paleta tomada de la propia plantilla (medida de los píxeles renderizados)
const AZUL = rgb(0.05, 0.23, 0.4) // "Graduado en:", "DANDO A CONOCER..."
const DORADO = COLOR_DORADO // "Confiere el siguiente Diploma a:"
const TEXTO = rgb(0.16, 0.16, 0.16) // firmas y fecha
const BLANCO = rgb(1, 1, 1)

type Color = PdfColor

export interface FirmaCertificado {
  /** Nombre de quien firma (opcional). Si falta, solo se muestra el cargo, en negrita. */
  nombre?: string
  cargo: string
}

export interface CertificadoConfig {
  /** Programa, bajo "Graduado en:". Ej: "Proyecto Mario". */
  programa: string
  /** Frase centrada bajo el programa. Termina en ":" porque introduce el curso. */
  frase: string
  /** Texto pequeño sobre el nombre del curso (opcional). Ej: "MÓDULO 1". */
  cursoEtiqueta?: string
  /** Nombre del curso, en 1 o 2 líneas. */
  cursoLineas: string[]
  /** Firma izquierda y derecha. */
  firmas: [FirmaCertificado, FirmaCertificado]
}

// ---------- Distribución vertical (pt desde el borde superior visible) ----------
const Y = {
  nombre: 178, // línea base del nombre
  nombreSeparador: 198,
  graduado: 236,
  programa: 270,
  frase: 304,
  cursoTop: 340, // tope de las mayúsculas de la primera línea del curso
  firmaLinea: 510,
}

// Ancho máximo del bloque del curso: así nunca se acerca a la ilustración (que empieza en x=696).
const CURSO_ANCHO_MAX = 500
const NOMBRE_ANCHO_MAX = 560 // para no invadir el logo (arriba a la derecha)

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/**
 * Genera un PDF con una página de certificado por cada nombre.
 * Debe ejecutarse en el navegador (usa fetch para cargar la plantilla desde /public).
 */
export async function generarCertificadosDesdePlantilla(
  nombres: string[],
  cfg: CertificadoConfig
): Promise<Uint8Array> {
  const templateResponse = await fetch("/MODELO CERTIFICADO.pdf")
  const templateBytes = await templateResponse.arrayBuffer()

  const finalDoc = await PDFDocument.create()

  const helvetica = await finalDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await finalDoc.embedFont(StandardFonts.HelveticaBold)
  // Misma familia que los certificados de bautizo y matrimonio
  const timesBoldItalic = await finalDoc.embedFont(StandardFonts.TimesRomanBoldItalic)
  const timesItalic = await finalDoc.embedFont(StandardFonts.TimesRomanItalic)
  const timesBold = await finalDoc.embedFont(StandardFonts.TimesRomanBold)
  const timesRegular = await finalDoc.embedFont(StandardFonts.TimesRoman)

  const hoy = new Date()
  const fechaText = `Manta, ${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`

  // Tamaño común para las líneas del curso (la más larga manda), así se ven parejas.
  const cursoSize = Math.min(
    ...cfg.cursoLineas.map((l) =>
      ajustarTamano(helveticaBold, l, cfg.cursoLineas.length > 1 ? 24 : 28, 14, CURSO_ANCHO_MAX)
    )
  )
  const cursoAnchoMax = Math.max(...cfg.cursoLineas.map((l) => helveticaBold.widthOfTextAtSize(l, cursoSize)))

  for (const nombre of nombres) {
    const templateDoc = await PDFDocument.load(templateBytes)
    const [page] = await finalDoc.copyPages(templateDoc, [0])

    const { width } = page.getSize()
    const cx = width / 2 // eje de simetría de la página

    const yDesdeArriba = crearYDesdeArriba(page)

    /** Tapa con blanco un área medida desde arriba (x0..x1, t0..t1). */
    const tapar = (x0: number, x1: number, t0: number, t1: number) =>
      page.drawRectangle({ x: x0, y: yDesdeArriba(t1), width: x1 - x0, height: t1 - t0, color: BLANCO })

    // ---------- 1. Tapar los textos de la plantilla que se reescriben ----------
    tapar(338, 504, 206, 233) // "Graduado en:"
    tapar(282, 586, 238, 265) // "DiscipuladoTransformando Vidas"
    tapar(140, 690, 270, 289) // "DANDO A CONOCER ... EL DISCIPULADO:"
    tapar(215, 600, 500, 551) // firmas de los pastores (líneas + nombres + cargos)

    // ---------- 2. Nombre (protagonista) + separador dorado ----------
    const nombreSize = ajustarTamano(timesBoldItalic, nombre, 38, 18, NOMBRE_ANCHO_MAX)
    const nombreAncho = timesBoldItalic.widthOfTextAtSize(nombre, nombreSize)
    textoCentrado(page, nombre, { font: timesBoldItalic, size: nombreSize, y: yDesdeArriba(Y.nombre), cx, color: AZUL })
    separadorDorado(page, cx, yDesdeArriba(Y.nombreSeparador), Math.min(Math.max(nombreAncho / 2 + 30, 150), 300))

    // ---------- 3. "Graduado en:" + programa + frase ----------
    textoCentradoNegrita(page, "Graduado en:", { font: helveticaBold, size: 22, y: yDesdeArriba(Y.graduado), cx, color: AZUL })
    textoCentrado(page, cfg.programa, { font: helveticaBold, size: 20, y: yDesdeArriba(Y.programa), cx, color: AZUL })
    textoCentrado(page, cfg.frase, { font: helvetica, size: 11.5, y: yDesdeArriba(Y.frase), cx, color: AZUL })

    // ---------- 4. Curso (texto destacado) + separador ----------
    let top = Y.cursoTop
    let ultimaBase = top
    if (cfg.cursoEtiqueta) {
      const base = top + 14 * 0.72
      textoCentrado(page, cfg.cursoEtiqueta, { font: helveticaBold, size: 14, y: yDesdeArriba(base), cx, color: AZUL })
      ultimaBase = base
      top = base + 14
    }
    cfg.cursoLineas.forEach((linea, i) => {
      const base = top + cursoSize * 0.72
      textoCentrado(page, linea, { font: helveticaBold, size: cursoSize, y: yDesdeArriba(base), cx, color: AZUL })
      ultimaBase = base
      top = base + (i < cfg.cursoLineas.length - 1 ? 12 : 0)
    })
    const separadorY = ultimaBase + 20
    separadorDorado(page, cx, yDesdeArriba(separadorY), Math.min(Math.max(cursoAnchoMax / 2 + 20, 90), 250))

    // ---------- 5. Fecha: a medio camino entre el separador del curso y las firmas ----------
    const fechaBase = (separadorY + Y.firmaLinea) / 2 + 5
    textoCentrado(page, fechaText, { font: timesItalic, size: 15, y: yDesdeArriba(fechaBase), cx, color: TEXTO })

    // ---------- 6. Firmas simétricas respecto al eje de la página ----------
    const lineaAncho = 170
    const separacion = 70
    const posiciones = [cx - separacion / 2 - lineaAncho, cx + separacion / 2]
    cfg.firmas.forEach((firma, i) => {
      const x0 = posiciones[i]
      page.drawLine({
        start: { x: x0, y: yDesdeArriba(Y.firmaLinea) },
        end: { x: x0 + lineaAncho, y: yDesdeArriba(Y.firmaLinea) },
        thickness: 0.9,
        color: TEXTO,
      })
      const centro = x0 + lineaAncho / 2
      if (firma.nombre) {
        textoCentrado(page, firma.nombre, { font: timesBold, size: 13, y: yDesdeArriba(Y.firmaLinea + 16), cx: centro, color: TEXTO })
        textoCentrado(page, firma.cargo, { font: timesRegular, size: 11.5, y: yDesdeArriba(Y.firmaLinea + 30), cx: centro, color: TEXTO })
      } else {
        textoCentrado(page, firma.cargo, { font: timesBold, size: 13, y: yDesdeArriba(Y.firmaLinea + 16), cx: centro, color: TEXTO })
      }
    })

    finalDoc.addPage(page)
  }

  return await finalDoc.save()
}

/** Descarga un PDF (Uint8Array) en el navegador. */
export function descargarPdf(pdfBytes: Uint8Array, nombreArchivo: string) {
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = nombreArchivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
