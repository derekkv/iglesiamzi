import type { CicloTipo } from "./mod/discipulado-ciclos-service"
import { generarCertificadosDesdePlantilla, descargarPdf } from "./certificado-plantilla"

const MODULOS: Record<CicloTipo, { etiqueta: string; lineas: string[] }> = {
  primeros_pasos: { etiqueta: "MÓDULO 1", lineas: ["PRIMEROS PASOS DE LA VIDA CRISTIANA"] },
  seguimos_avanzando: { etiqueta: "MÓDULO 2", lineas: ["SEGUIMOS AVANZANDO"] },
  siendo_iglesia: { etiqueta: "MÓDULO 3", lineas: ["SIENDO IGLESIA,", "VIVIENDO JUNTOS LOS UNOS CON LOS OTROS"] },
}

/**
 * Genera un PDF con una página de certificado por cada nombre aprobado de Discipulado.
 * El diseño vive en ./certificado-plantilla (compartido con Proyecto Mario).
 */
export async function generateCertificadosPDF(
  aprobados: string[],
  tipo: CicloTipo
): Promise<Uint8Array> {
  const modulo = MODULOS[tipo]
  return generarCertificadosDesdePlantilla(aprobados, {
    // La plantilla trae "DiscipuladoTransformando Vidas" (sin espacio); aquí se corrige.
    programa: "Discipulado Transformando Vidas",
    frase: "DANDO A CONOCER QUE HA CURSADO Y CULMINADO SATISFACTORIAMENTE EL DISCIPULADO:",
    cursoEtiqueta: modulo.etiqueta,
    cursoLineas: modulo.lineas,
    firmas: [
      { nombre: "Jamil Machuca", cargo: "Pastor Principal" },
      { nombre: "Christian Mendoza", cargo: "Pastor Líder de Curso" },
    ],
  })
}

export async function downloadCertificados(aprobados: string[], tipo: CicloTipo) {
  const pdfBytes = await generateCertificadosPDF(aprobados, tipo)
  descargarPdf(pdfBytes, `Certificados_${tipo}_${new Date().toISOString().split("T")[0]}.pdf`)
}
