/**
 * Catálogo de reportes del módulo de listados.
 *
 * Para añadir un reporte: decláralo en el archivo de su dominio dentro de
 * `catalogo/` y expórtalo en el arreglo correspondiente. La interfaz, el
 * selector de columnas y el armado del Excel no requieren cambios.
 *
 * Si el reporte lee una tabla nueva, añade el módulo `listados` a
 * `readOnlyModules` de esa tabla en `lib/module-table-map.ts`; si no, `/api/db`
 * responderá 403 a quien solo tenga permiso de listados.
 */

import { reportesMiembros } from "./catalogo/miembros"
import { reportesVidaMinisterial } from "./catalogo/vida-ministerial"
import { reportesFormacion } from "./catalogo/formacion"
import { reportesAsistencia } from "./catalogo/asistencia"
import { reportesFinanzas } from "./catalogo/finanzas"
import { reportesSocialInventario } from "./catalogo/social-inventario"
import type { DefinicionReporte, GrupoReporte } from "./types"

export const REPORTES: DefinicionReporte<any>[] = [
  ...reportesMiembros,
  ...reportesVidaMinisterial,
  ...reportesFormacion,
  ...reportesAsistencia,
  ...reportesFinanzas,
  ...reportesSocialInventario,
]

/** Orden en que se muestran los grupos en la interfaz. */
export const ORDEN_GRUPOS: GrupoReporte[] = [
  "Miembros y membresía",
  "Vida ministerial",
  "Formación",
  "Asistencia",
  "Cronogramas y comunicación interna",
  "Finanzas",
  "Eventos",
  "Acción social e inventarios",
]

export function buscarReporte(id: string): DefinicionReporte<any> | undefined {
  return REPORTES.find((r) => r.id === id)
}

/** Reportes agrupados y ordenados, opcionalmente filtrados por texto. */
export function reportesPorGrupo(busqueda = ""): Array<{ grupo: GrupoReporte; reportes: DefinicionReporte<any>[] }> {
  const termino = busqueda.trim().toLowerCase()
  const coincide = (r: DefinicionReporte<any>) =>
    termino === "" ||
    r.titulo.toLowerCase().includes(termino) ||
    r.descripcion.toLowerCase().includes(termino) ||
    r.grupo.toLowerCase().includes(termino) ||
    r.tablas.some((t) => t.includes(termino))

  return ORDEN_GRUPOS.map((grupo) => ({
    grupo,
    reportes: REPORTES.filter((r) => r.grupo === grupo && coincide(r)),
  })).filter((g) => g.reportes.length > 0)
}

/** Tablas que lee el catálogo completo. Útil para auditar el mapa de accesos. */
export function tablasDelCatalogo(): string[] {
  return [...new Set(REPORTES.flatMap((r) => r.tablas))].sort()
}
