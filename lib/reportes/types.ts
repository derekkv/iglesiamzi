/**
 * Contratos del generador de reportes del módulo "listados".
 *
 * Un reporte se declara una sola vez (columnas, filtros, fuentes y cómo obtener
 * los datos) y la interfaz se construye sola a partir de esa declaración. El
 * selector de columnas, el armado del Excel y la descarga son genéricos.
 *
 * Regla de diseño: la selección de columnas y los filtros se pasan SIEMPRE como
 * argumento a `obtener()` / `ejecutarReporte()`. Nunca se leen desde el estado
 * de React dentro de una función diferida, porque ese patrón producía archivos
 * vacíos (la función capturaba la selección anterior al abrirse el diálogo).
 */

export type ValorCelda = string | number | boolean | Date | null | undefined

/** Cómo se formatea una columna en la hoja de cálculo. */
export type TipoColumna =
  | "texto"
  | "numero"
  | "moneda"
  | "fecha"
  | "fechaHora"
  | "booleano"
  | "lista"
  | "porcentaje"

export interface ColumnaReporte<T = Record<string, unknown>> {
  /** Clave de la fila, o un identificador propio si usa `valor`. */
  key: string
  /** Encabezado tal como debe salir en el Excel. */
  label: string
  tipo?: TipoColumna
  /** Ancho en caracteres. Si se omite se calcula desde el encabezado. */
  ancho?: number
  /**
   * Columna accesoria (identificadores internos, metadatos). Va marcada como
   * todas las demás; el indicador sirve para distinguirlas en el selector.
   */
  opcional?: boolean
  /**
   * Dato personal sensible. Va marcada como todas las demás, pero se señala en
   * la interfaz para que quien exporta decida si la incluye.
   */
  sensible?: boolean
  /** Añade esta columna a la fila de totales al pie de la hoja. */
  totalizar?: boolean
  /** Nota que se muestra junto a la columna en el selector. */
  ayuda?: string
  /** Derivación del valor. Si se omite se usa `fila[key]`. */
  valor?: (fila: T) => ValorCelda | unknown
}

/**
 * Origen combinable de un reporte (p. ej. los cuatro censos). El usuario marca
 * cuáles entran y `obtener()` recibe la lista en `ctx.fuentes`.
 */
export interface FuenteReporte {
  id: string
  label: string
  /** Marcada al abrir el reporte. Por omisión, sí. */
  default?: boolean
  descripcion?: string
}

export type TipoFiltro = "mes" | "anio" | "rangoFechas" | "rangoNumeros" | "opcion" | "texto"

export interface OpcionFiltro {
  value: string
  label: string
}

export interface FiltroReporte {
  id: string
  label: string
  tipo: TipoFiltro
  /** Opciones fijas para `tipo: "opcion"`. */
  opciones?: OpcionFiltro[]
  /** Opciones que se consultan a la base al seleccionar el reporte. */
  cargarOpciones?: () => Promise<OpcionFiltro[]>
  /** Valor inicial. Para "mes" se usa el mes activo si se omite. */
  valorInicial?: string
  /** Si no tiene valor, el reporte no se puede generar. */
  requerido?: boolean
  ayuda?: string
  /** Opción que representa "sin filtrar". Se añade al inicio de la lista. */
  opcionTodos?: string
}

export interface MesRef {
  id: string
  nombre: string
  anio: number
  mes: number
  activo: boolean
}

/** Todo lo que el usuario eligió en la interfaz, listo para consultar datos. */
export interface ContextoReporte {
  /** Valores de los filtros declarados, por `id`. */
  filtros: Record<string, string>
  /** Ids de las fuentes marcadas. */
  fuentes: string[]
  /** Catálogo de meses de trabajo, del más reciente al más antiguo. */
  meses: MesRef[]
  mesActivo: MesRef | null
}

/** Hoja construida a mano (resúmenes, matrices de asistencia, anexos). */
export interface HojaReporte {
  nombre: string
  encabezados: string[]
  filas: ValorCelda[][]
  /** Anchos por columna, en caracteres. */
  anchos?: number[]
  /** Formato de celda por columna (misma longitud que `encabezados`). */
  tipos?: (TipoColumna | undefined)[]
  /** Fila de totales al pie. Debe tener la misma longitud que `encabezados`. */
  totales?: ValorCelda[]
  /** Criterios aplicados; se escriben al pie de la hoja. */
  notas?: string[]
  /** No añadir autofiltro (útil en hojas de resumen). */
  sinAutofiltro?: boolean
  /** No escribir fila de encabezados (hojas de resumen libres). */
  sinEncabezados?: boolean
}

export interface ResultadoReporte<T = Record<string, unknown>> {
  /** Filas de la hoja principal. Se formatean con las columnas seleccionadas. */
  filas?: T[]
  /** Hojas adicionales ya construidas. Se añaden después de la principal. */
  hojas?: HojaReporte[]
  /** Reemplaza por completo la hoja principal (para matrices dinámicas). */
  hojaPrincipal?: HojaReporte
  /** Avisos para mostrar al usuario después de generar. */
  advertencias?: string[]
  /** Criterios aplicados; se anexan al pie de la hoja principal. */
  notas?: string[]
}

export type GrupoReporte =
  | "Miembros y membresía"
  | "Vida ministerial"
  | "Formación"
  | "Asistencia"
  | "Cronogramas y comunicación interna"
  | "Finanzas"
  | "Eventos"
  | "Acción social e inventarios"

/** Acción extra del reporte, normalmente generación de PDF. */
export interface AccionReporte {
  id: string
  label: string
  icono?: "pdf" | "excel"
  ejecutar: (ctx: ContextoReporte) => Promise<{
    contenido: Blob | Uint8Array
    nombre: string
    mensaje?: string
  }>
}

export interface DefinicionReporte<T = Record<string, unknown>> {
  id: string
  grupo: GrupoReporte
  titulo: string
  descripcion: string
  /**
   * Tablas que lee el reporte. Se usa para explicar un 403 al usuario y para
   * auditar `TABLE_ACCESS_MAP`.
   */
  tablas: string[]
  /**
   * Módulos de permiso que habilitan el reporte: basta tener `can_view` en uno.
   * Debe coincidir con lo que `TABLE_ACCESS_MAP` permite para sus tablas, o el
   * reporte se ofrecerá y luego fallará con 403 en `/api/db`.
   */
  modulos: string[]
  /** Nombre de la hoja principal. Excel admite 31 caracteres. */
  hoja?: string
  /** Prefijo del archivo. Por omisión se deriva del título. */
  archivo?: string
  filtros?: FiltroReporte[]
  fuentes?: FuenteReporte[]
  columnas: ColumnaReporte<T>[]
  /**
   * Columnas que solo se conocen consultando los datos, como una columna por
   * hijo. Se consultan al abrir el reporte y se añaden después de las
   * declaradas; participan del selector igual que las demás.
   */
  cargarColumnas?: () => Promise<ColumnaReporte<T>[]>
  obtener: (ctx: ContextoReporte) => Promise<ResultadoReporte<T>>
  /** Hojas derivadas de las filas ya obtenidas (resúmenes, conteos). */
  hojasExtra?: (ctx: ContextoReporte, filas: T[]) => Promise<HojaReporte[]> | HojaReporte[]
  acciones?: AccionReporte[]
  /** Advertencias de interpretación que conviene leer antes de exportar. */
  notas?: string[]
}
