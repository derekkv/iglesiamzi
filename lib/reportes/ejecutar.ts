/**
 * Ejecución de un reporte: valida la selección, obtiene los datos, arma el
 * libro y devuelve el archivo listo para descargar.
 *
 * La selección de columnas, los filtros y las fuentes llegan como argumentos.
 * Esto es deliberado: el exportador anterior guardaba la función de export en
 * un `useState` y esa función capturaba la selección de columnas de un render
 * anterior —vacía la primera vez—, así que el Excel salía sin ninguna columna.
 */

import { construirLibro, hojaDesdeFilas, nombreArchivo, textoFecha } from "./excel"
import type {
  ColumnaReporte,
  ContextoReporte,
  DefinicionReporte,
  HojaReporte,
} from "./types"

export class ErrorReporte extends Error {}

export interface ResultadoEjecucion {
  archivo: Blob
  nombre: string
  filas: number
  hojas: string[]
  advertencias: string[]
}

/** Al abrir un reporte vienen marcadas todas sus columnas. */
export function columnasPorDefecto<T>(columnas: ColumnaReporte<T>[]): string[] {
  return columnas.map((c) => c.key)
}

/** Descripción legible de lo que se aplicó, para el pie de la hoja. */
export function notasDeContexto<T>(def: DefinicionReporte<T>, ctx: ContextoReporte): string[] {
  const notas: string[] = [
    `Reporte: ${def.titulo}`,
    `Generado: ${textoFecha(new Date())}`,
  ]

  for (const filtro of def.filtros ?? []) {
    if (filtro.tipo === "rangoFechas") {
      const desde = ctx.filtros[`${filtro.id}_desde`]
      const hasta = ctx.filtros[`${filtro.id}_hasta`]
      if (desde || hasta) {
        notas.push(`${filtro.label}: ${desde ? textoFecha(desde) : "sin inicio"} — ${hasta ? textoFecha(hasta) : "sin fin"}`)
      }
      continue
    }
    if (filtro.tipo === "rangoNumeros") {
      const desde = ctx.filtros[`${filtro.id}_desde`]
      const hasta = ctx.filtros[`${filtro.id}_hasta`]
      if (desde || hasta) {
        notas.push(`${filtro.label}: ${desde || "sin mínimo"} — ${hasta || "sin máximo"}`)
      }
      continue
    }
    const valor = ctx.filtros[filtro.id]
    if (!valor) continue
    if (filtro.tipo === "mes") {
      const mes = ctx.meses.find((m) => m.id === valor)
      notas.push(`${filtro.label}: ${mes?.nombre ?? valor}`)
      continue
    }
    const opcion = filtro.opciones?.find((o) => o.value === valor)
    notas.push(`${filtro.label}: ${opcion?.label ?? valor}`)
  }

  if (def.fuentes && def.fuentes.length > 0) {
    const etiquetas = def.fuentes.filter((f) => ctx.fuentes.includes(f.id)).map((f) => f.label)
    notas.push(`Fuentes incluidas: ${etiquetas.length > 0 ? etiquetas.join(", ") : "ninguna"}`)
  }

  return notas.concat(def.notas ?? [])
}

function validar<T>(def: DefinicionReporte<T>, ctx: ContextoReporte, columnas: string[]) {
  for (const filtro of def.filtros ?? []) {
    if (!filtro.requerido) continue
    const tiene =
      filtro.tipo === "rangoFechas" || filtro.tipo === "rangoNumeros"
        ? ctx.filtros[`${filtro.id}_desde`] || ctx.filtros[`${filtro.id}_hasta`]
        : ctx.filtros[filtro.id]
    if (!tiene) throw new ErrorReporte(`Falta seleccionar "${filtro.label}".`)
  }

  if (def.fuentes && def.fuentes.length > 0 && ctx.fuentes.length === 0) {
    throw new ErrorReporte("Seleccione al menos una fuente de datos.")
  }

  if (columnas.length === 0) {
    throw new ErrorReporte("Seleccione al menos una columna para exportar.")
  }
}

export async function ejecutarReporte<T>(
  def: DefinicionReporte<T>,
  ctx: ContextoReporte,
  columnasSeleccionadas: string[],
  /**
   * Columnas efectivas del reporte: las declaradas más las que se cargaron de
   * los datos (`cargarColumnas`). La pantalla ya las tiene resueltas y las pasa
   * aquí para que el archivo salga con exactamente lo que se marcó.
   */
  columnasEfectivas?: ColumnaReporte<T>[],
): Promise<ResultadoEjecucion> {
  validar(def, ctx, columnasSeleccionadas)

  const disponibles = columnasEfectivas ?? def.columnas
  const seleccion = new Set(columnasSeleccionadas)
  // Se respeta el orden de declaración, no el orden en que se marcaron.
  const columnas = disponibles.filter((c) => seleccion.has(c.key))

  const resultado = await def.obtener(ctx)
  const filas = resultado.filas ?? []
  const hojas: HojaReporte[] = []

  const notas = [...notasDeContexto(def, ctx), ...(resultado.notas ?? [])]

  if (resultado.hojaPrincipal) {
    hojas.push({ ...resultado.hojaPrincipal, notas: [...(resultado.hojaPrincipal.notas ?? []), ...notas] })
  } else if (columnas.length > 0) {
    hojas.push(hojaDesdeFilas(def.hoja ?? def.titulo, filas, columnas, { notas }))
  }

  if (resultado.hojas) hojas.push(...resultado.hojas)

  if (def.hojasExtra) {
    hojas.push(...(await def.hojasExtra(ctx, filas)))
  }

  const totalFilas = hojas.reduce((suma, h) => suma + h.filas.length, 0)
  if (totalFilas === 0) {
    throw new ErrorReporte(
      "No hay datos que coincidan con los filtros seleccionados, así que no se generó ningún archivo.",
    )
  }

  const sufijos = (def.filtros ?? []).map((filtro) => {
    const valor = ctx.filtros[filtro.id]
    if (!valor) return undefined
    if (filtro.tipo === "mes") return ctx.meses.find((m) => m.id === valor)?.nombre
    if (filtro.tipo === "opcion") return filtro.opciones?.find((o) => o.value === valor)?.label
    if (filtro.tipo === "anio") return valor
    return undefined
  })

  return {
    archivo: await construirLibro(hojas),
    nombre: nombreArchivo(def.archivo ?? def.titulo, sufijos),
    filas: totalFilas,
    hojas: hojas.map((h) => h.nombre),
    advertencias: resultado.advertencias ?? [],
  }
}
