import type { ProyectoMarioCicloTipo } from "./mod/proyecto-mario-ciclos-service"
import { generarCertificadosDesdePlantilla, descargarPdf } from "./certificado-plantilla"

const MODULO_LABELS: Record<ProyectoMarioCicloTipo, string> = {
  belleza_integral_sabados: "BELLEZA INTEGRAL - SABADOS",
  belleza_integral_viernes: "BELLEZA INTEGRAL - VIERNES",
  manualidades: "MANUALIDADES",
  belleza_cejas: "BELLEZA CEJAS",
  gastronomia: "GASTRONOMÍA",
}

/**
 * Genera un PDF con una página de certificado por cada nombre aprobado de
 * Proyecto Mario. El diseño vive en ./certificado-plantilla (compartido con Discipulado).
 */
export async function generateCertificadosProyectoMarioPDF(
  aprobados: string[],
  tipo: ProyectoMarioCicloTipo
): Promise<Uint8Array> {
  return generarCertificadosDesdePlantilla(aprobados, {
    programa: "Proyecto Mario",
    frase: "DANDO A CONOCER QUE HA CURSADO Y CULMINADO SATISFACTORIAMENTE EL CURSO DE:",
    cursoLineas: [MODULO_LABELS[tipo]],
    firmas: [{ cargo: "Coordinador(a)" }, { cargo: "Director(a)" }],
  })
}

export async function downloadCertificadosProyectoMario(aprobados: string[], tipo: ProyectoMarioCicloTipo) {
  const pdfBytes = await generateCertificadosProyectoMarioPDF(aprobados, tipo)
  descargarPdf(pdfBytes, `Certificados_ProyectoMario_${tipo}_${new Date().toISOString().split("T")[0]}.pdf`)
}
