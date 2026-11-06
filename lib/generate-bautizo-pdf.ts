import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { ajustarTamano, textoCentrado, separadorDorado, crearYDesdeArriba } from "./pdf-utils"

export interface BautizoPDFData {
  nombre: string
  cedula: string
  fecha_bautizo: string
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

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

// Colores medidos de la plantilla
const AZUL = rgb(0, 0.216, 0.4) // texto del versículo
const TEXTO = rgb(0.05, 0.05, 0.05) // firmas
const BLANCO = rgb(1, 1, 1)

/**
 * Eje de simetría del texto de la plantilla: el título y el versículo están centrados en
 * x≈441, no en el centro de la página (421). El nombre y la fecha se alinean a ese eje.
 */
const EJE = 441

/**
 * Certificado de bautizo sobre /public/certificado-bautizo.pdf.
 *
 * Medidas de la plantilla (pt, desde el borde superior visible; su MediaBox empieza en y≈8.58):
 *   - título "Bautizo" (script dorado)  termina en y≈182
 *   - versículo                          y 274–400, centrado en x≈441
 *   - firmas (líneas y=490)              x 240–603; nombres y cargos hasta y≈530
 *   - olas inferiores                    desde y≈537 (x>600) y y≈547 (centro)
 * Las firmas de la plantilla se tapan y se redibujan simétricas sobre el mismo eje (441).
 */
export async function generateBautizoPDF(data: BautizoPDFData): Promise<Uint8Array> {
  const templateResponse = await fetch("/certificado-bautizo.pdf")
  const templateBytes = await templateResponse.arrayBuffer()

  const doc = await PDFDocument.load(templateBytes)
  const timesBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const timesRegular = await doc.embedFont(StandardFonts.TimesRoman)

  const page = doc.getPages()[0]
  const yDesdeArriba = crearYDesdeArriba(page)

  // ---------- Nombre: protagonista, entre el título y el versículo ----------
  const nombreSize = ajustarTamano(timesBoldItalic, data.nombre, 32, 16, 440)
  const nombreAncho = timesBoldItalic.widthOfTextAtSize(data.nombre, nombreSize)
  textoCentrado(page, data.nombre, { font: timesBoldItalic, size: nombreSize, y: yDesdeArriba(232), cx: EJE, color: AZUL })
  separadorDorado(page, EJE, yDesdeArriba(247), Math.min(Math.max(nombreAncho / 2 + 28, 120), 240))

  // ---------- Fecha: centrada, a medio camino entre el versículo y las firmas ----------
  const { dia, mes, anio } = parseFechaComponents(data.fecha_bautizo)
  if (dia && mes && anio) {
    textoCentrado(page, `${dia} de ${mes} del ${anio}`, {
      font: timesItalic, size: 15, y: yDesdeArriba(450), cx: EJE, color: TEXTO,
    })
  }

  // ---------- Firmas: se tapan las de la plantilla y se redibujan simétricas sobre el eje ----------
  page.drawRectangle({ x: 228, y: yDesdeArriba(536), width: 380, height: 536 - 484, color: BLANCO })

  const lineaAncho = 150
  const separacion = 70
  const firmas = [
    { nombre: "Jamil Machuca", cargo: "Pastor Principal", x0: EJE - separacion / 2 - lineaAncho },
    { nombre: "Christian Mendoza", cargo: "Pastor Líder de Curso", x0: EJE + separacion / 2 },
  ]
  for (const f of firmas) {
    page.drawLine({
      start: { x: f.x0, y: yDesdeArriba(490) },
      end: { x: f.x0 + lineaAncho, y: yDesdeArriba(490) },
      thickness: 0.9,
      color: TEXTO,
    })
    const centro = f.x0 + lineaAncho / 2
    textoCentrado(page, f.nombre, { font: timesBold, size: 13, y: yDesdeArriba(506), cx: centro, color: TEXTO })
    textoCentrado(page, f.cargo, { font: timesRegular, size: 11.5, y: yDesdeArriba(520), cx: centro, color: TEXTO })
  }

  return await doc.save()
}
