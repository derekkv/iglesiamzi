/**
 * Motor de hojas de cálculo del módulo de listados.
 *
 * Responsabilidades: convertir filas de datos en hojas con encabezados legibles,
 * aplicar formato real de Excel (fechas como fechas, montos como moneda),
 * totalizar, anexar notas de criterio y descargar el archivo.
 *
 * `xlsx` se carga con `import()` dinámico: es una dependencia pesada que solo
 * hace falta al momento de exportar, y así se evita el `require()` dentro de un
 * componente de cliente que usaba el código anterior.
 */

import type { ColumnaReporte, HojaReporte, TipoColumna, ValorCelda } from "./types"

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

const FORMATO_POR_TIPO: Record<string, string> = {
  fecha: "dd/mm/yyyy",
  fechaHora: "dd/mm/yyyy hh:mm",
  moneda: '"$"#,##0.00',
  numero: "#,##0.##",
  porcentaje: "0.0%",
}

/** Claves cuyo contenido es una fecha aunque la columna no declare el tipo. */
const CLAVES_FECHA = /^(fecha|fecha_[a-z_]+|created_at|updated_at|[a-z_]+_at|semana_inicio)$/

// ─── Conversión de valores ────────────────────────────────────────────────────

/** Convierte "YYYY-MM-DD" o ISO a Date al mediodía local (evita corrimientos). */
export function aFecha(valor: unknown): Date | null {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor
  if (typeof valor !== "string" || valor.trim() === "") return null

  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soloFecha) {
    const [, a, m, d] = soloFecha
    return new Date(Number(a), Number(m) - 1, Number(d), 12, 0, 0)
  }

  if (valor.includes("T")) {
    const d = new Date(valor)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

/** Fecha en dd/mm/aaaa, el formato que usa el resto del sistema. */
export function textoFecha(valor: unknown): string {
  const d = aFecha(valor)
  if (!d) return typeof valor === "string" ? valor : ""
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

export function aNumero(valor: unknown): number {
  const n = Number(valor)
  return isNaN(n) ? 0 : n
}

/** Aplana arrays y objetos a texto legible, con el mismo criterio que la UI. */
function aplanar(valor: unknown): string {
  if (Array.isArray(valor)) {
    return valor
      .map((item) => {
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>
          if (obj.nombre) return obj.edad ? `${obj.nombre} (${obj.edad})` : String(obj.nombre)
          return Object.values(obj).join(", ")
        }
        return String(item)
      })
      .filter((t) => t !== "")
      .join(", ")
  }
  if (valor && typeof valor === "object") return JSON.stringify(valor)
  return String(valor)
}

/** Normaliza un valor crudo al tipo nativo que debe escribirse en la celda. */
export function valorDeCelda(valor: unknown, tipo: TipoColumna | undefined, clave?: string): ValorCelda {
  if (valor === null || valor === undefined || valor === "") return ""

  switch (tipo) {
    case "booleano":
      return valor === true || valor === "true" ? "Sí" : "No"
    case "fecha":
    case "fechaHora":
      return aFecha(valor) ?? aplanar(valor)
    case "moneda":
    case "numero":
      return aNumero(valor)
    case "porcentaje":
      return aNumero(valor) / 100
    case "lista":
      return aplanar(valor)
    case "texto":
      return aplanar(valor)
    default:
      // Sin tipo declarado: se infiere lo mínimo para no estropear el archivo.
      if (typeof valor === "boolean") return valor ? "Sí" : "No"
      if (typeof valor === "number") return valor
      if (clave && CLAVES_FECHA.test(clave)) {
        const f = aFecha(valor)
        if (f) return f
      }
      return aplanar(valor)
  }
}

// ─── Construcción de hojas ────────────────────────────────────────────────────

function anchoColumna(col: ColumnaReporte<never>): number {
  if (col.ancho) return col.ancho
  const base = col.label.length + 4
  if (col.tipo === "fecha") return 13
  if (col.tipo === "fechaHora") return 18
  if (col.tipo === "moneda" || col.tipo === "numero") return Math.max(base, 14)
  return Math.min(Math.max(base, 14), 48)
}

/**
 * Convierte filas de datos en una hoja, usando solo las columnas indicadas y
 * respetando su orden de declaración.
 */
export function hojaDesdeFilas<T>(
  nombre: string,
  datos: T[],
  columnas: ColumnaReporte<T>[],
  opciones: { notas?: string[]; totalizar?: boolean } = {},
): HojaReporte {
  const encabezados = columnas.map((c) => c.label)
  const tipos = columnas.map((c) => c.tipo)

  const filas = datos.map((fila) =>
    columnas.map((col) => {
      const crudo = col.valor
        ? col.valor(fila)
        : (fila as Record<string, unknown>)[col.key]
      return valorDeCelda(crudo, col.tipo, col.key)
    }),
  )

  let totales: ValorCelda[] | undefined
  const hayTotales = opciones.totalizar !== false && columnas.some((c) => c.totalizar)
  if (hayTotales && datos.length > 0) {
    totales = columnas.map((col, i) => {
      if (i === 0) return "TOTAL"
      if (!col.totalizar) return ""
      return filas.reduce((suma, f) => suma + (typeof f[i] === "number" ? (f[i] as number) : 0), 0)
    })
  }

  return {
    nombre,
    encabezados,
    filas,
    tipos,
    totales,
    anchos: columnas.map((c) => anchoColumna(c as ColumnaReporte<never>)),
    notas: opciones.notas,
  }
}

/** Hoja de resumen de dos columnas (concepto / valor), sin autofiltro. */
export function hojaResumen(
  nombre: string,
  bloques: Array<{ titulo?: string; filas: Array<[string, ValorCelda, TipoColumna?]> }>,
  notas?: string[],
): HojaReporte {
  const filas: ValorCelda[][] = []
  const tiposPorFila: (TipoColumna | undefined)[] = []

  bloques.forEach((bloque, i) => {
    if (i > 0) {
      filas.push(["", ""])
      tiposPorFila.push(undefined)
    }
    if (bloque.titulo) {
      filas.push([bloque.titulo.toUpperCase(), ""])
      tiposPorFila.push(undefined)
    }
    for (const [etiqueta, valor, tipo] of bloque.filas) {
      filas.push([etiqueta, valorDeCelda(valor, tipo)])
      tiposPorFila.push(tipo)
    }
  })

  return {
    nombre,
    encabezados: ["Concepto", "Valor"],
    filas,
    anchos: [42, 20],
    sinAutofiltro: true,
    notas,
    // El formato de la columna de valores varía por fila, así que se aplica
    // celda por celda al escribir.
    tipos: [undefined, undefined],
    ...(tiposPorFila.some(Boolean) ? { tiposPorFila } : {}),
  } as HojaReporte & { tiposPorFila?: (TipoColumna | undefined)[] }
}

// ─── Escritura del libro ──────────────────────────────────────────────────────

function nombreHojaValido(nombre: string, usados: Set<string>): string {
  // Excel: 31 caracteres y sin : \ / ? * [ ]
  let limpio = nombre.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Hoja"
  if (usados.has(limpio)) {
    let n = 2
    const base = limpio.slice(0, 28)
    while (usados.has(`${base} (${n})`)) n++
    limpio = `${base} (${n})`
  }
  usados.add(limpio)
  return limpio
}

/** Arma el libro completo y devuelve el Blob listo para descargar. */
export async function construirLibro(hojas: HojaReporte[]): Promise<Blob> {
  const XLSX = await import("xlsx")
  const wb = XLSX.utils.book_new()
  const usados = new Set<string>()

  for (const hoja of hojas) {
    const aoa: ValorCelda[][] = []
    if (!hoja.sinEncabezados) aoa.push(hoja.encabezados)
    aoa.push(...hoja.filas)
    if (hoja.totales) aoa.push(hoja.totales)

    const primeraFilaNotas = aoa.length + 1 // +1 por la fila en blanco
    if (hoja.notas && hoja.notas.length > 0) {
      aoa.push([])
      aoa.push(["Criterios aplicados"])
      for (const nota of hoja.notas) aoa.push([nota])
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa as unknown[][], { cellDates: true })

    // Anchos
    const nCols = Math.max(hoja.encabezados.length, ...hoja.filas.map((f) => f.length), 1)
    ws["!cols"] = Array.from({ length: nCols }, (_, i) => ({
      wch: hoja.anchos?.[i] ?? Math.min(Math.max((hoja.encabezados[i]?.length ?? 10) + 4, 14), 48),
    }))

    // Formato por columna
    const tiposPorFila = (hoja as HojaReporte & { tiposPorFila?: (TipoColumna | undefined)[] }).tiposPorFila
    const filaInicio = hoja.sinEncabezados ? 0 : 1
    const filaFin = filaInicio + hoja.filas.length + (hoja.totales ? 1 : 0)

    for (let r = filaInicio; r < filaFin; r++) {
      for (let c = 0; c < nCols; c++) {
        const tipo = tiposPorFila ? tiposPorFila[r - filaInicio] : hoja.tipos?.[c]
        const formato = tipo ? FORMATO_POR_TIPO[tipo] : undefined
        if (!formato) continue
        const ref = XLSX.utils.encode_cell({ r, c })
        const celda = ws[ref]
        if (celda && celda.v !== "" && celda.v !== null && celda.v !== undefined) {
          celda.z = formato
        }
      }
    }

    // Autofiltro solo sobre el rango de datos, nunca sobre las notas
    if (!hoja.sinAutofiltro && !hoja.sinEncabezados && hoja.encabezados.length > 0 && hoja.filas.length > 0) {
      const ultimaCol = XLSX.utils.encode_col(hoja.encabezados.length - 1)
      ws["!autofilter"] = { ref: `A1:${ultimaCol}${hoja.filas.length + 1}` }
    }

    // Las notas van en negrita implícita por estar aisladas; se marcan como texto
    if (hoja.notas && hoja.notas.length > 0) {
      const ref = XLSX.utils.encode_cell({ r: primeraFilaNotas, c: 0 })
      if (ws[ref]) ws[ref].t = "s"
    }

    XLSX.utils.book_append_sheet(wb, ws, nombreHojaValido(hoja.nombre, usados))
  }

  const salida = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  return new Blob([salida], { type: MIME_XLSX })
}

export function descargarArchivo(contenido: Blob | Uint8Array, nombre: string, mime?: string) {
  const blob =
    contenido instanceof Blob
      ? contenido
      : new Blob([contenido.buffer as ArrayBuffer], { type: mime ?? "application/pdf" })

  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

/** Sufijo de fecha para los nombres de archivo: 2026-11-12. */
export function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function nombreArchivo(base: string, sufijos: Array<string | undefined> = []): string {
  const partes = [base, ...sufijos.filter((s): s is string => !!s), hoyISO()]
  return `${partes.join("_").replace(/[^\w\-.()]+/g, "_")}.xlsx`
}
