/**
 * Reportes de formación (discipulado, Herederos del Reino, Proyecto Mario) y de
 * eventos (eventos con pestaña propia y el encuentro del modelo anterior).
 *
 * Reglas de origen de datos que estos reportes replican de los módulos
 * operativos, verificadas contra el código:
 *
 * - **Solo se lee el modelo nuevo de discipulado** (`discipulado_ciclos` y sus
 *   tablas hijas). Las tablas `discipulado_participantes`, `discipulado_fechas`
 *   y `discipulado_asistencia` son el modelo anterior, indexado por `mes_id`:
 *   `lib/mod/discipulado-service.ts` ya no se importa desde ningún componente y
 *   esas filas no se pueden atribuir a un módulo concreto (`mes_id` no
 *   distingue "Primeros pasos" de "Siendo iglesia"). Unirlas falsearía los
 *   totales, así que no se leen.
 * - **Ausencia de fila de asistencia no es falta.** El valor `"none"` de la UI
 *   borra la fila (`discipulado-ciclos-service.ts:452-461`,
 *   `herederos-ciclos-service.ts:480-487`,
 *   `proyecto-mario-ciclos-service.ts:741-750`), así que una clase sin marca
 *   queda vacía y se cuenta aparte en "Clases sin registrar".
 * - **El estatus aprobado/reprobado se lee, nunca se recalcula.** El umbral de
 *   faltas lo teclea el usuario al cerrar el ciclo y no se guarda en el ciclo
 *   (solo en `audit_logs`), de modo que dos ciclos pueden haberse cerrado con
 *   reglas distintas (`discipulado-ciclos-service.ts:288-298`).
 * - **Las clases se numeran por orden de fecha, no por `numero_clase`.** En
 *   Proyecto Mario esa columna se renumera al reordenar o quitar fechas
 *   (`proyecto-mario-ciclos-service.ts:545-568`), así que no es estable.
 * - **El dinero de eventos sale de `evento_participantes.abono`.** La tabla
 *   `ingresos` es un espejo que la aplicación genera con
 *   `concepto = 'auto-evento'` (`app/api/finanzas/eventos/route.ts`); sumar las
 *   dos duplicaría el recaudo, por eso aquí no se lee `ingresos`.
 *
 * Puntos DUDOSOS (no hay DDL de estas tablas en el repo; todo se verificó
 * contra las interfaces y las consultas de los servicios):
 *
 * - El valor por omisión de `estatus` en los participantes de discipulado y de
 *   Proyecto Mario. El alta omite la columna y la interfaz asume "en_curso",
 *   así que una fila podría exportarse con el estado vacío; la etiqueta deja
 *   pasar el valor crudo si aparece algo distinto de los tres conocidos.
 * - Qué índice único rige hoy en `ingresos` para los abonos de eventos. No
 *   afecta a estos reportes porque no se lee esa tabla, pero sí a cualquier
 *   intento de conciliar los totales con contabilidad.
 */

import {
  ESTADOS_ASISTENCIA,
  ESTATUS_PARTICIPANTE,
  calcularEdad,
  etiqueta,
  seleccionar,
  seleccionarTodo,
} from "../data"
import { textoFecha, hoyISO, valorDeCelda } from "../excel"
import { ErrorReporte } from "../ejecutar"
import { unirPdfs } from "../pdf"
import { generateCertificadosPDF } from "@/lib/generate-certificados"
import { generateCertificadosProyectoMarioPDF } from "@/lib/generate-certificados-proyecto-mario"
import type { CicloTipo } from "@/lib/mod/discipulado-ciclos-service"
import type { ProyectoMarioCicloTipo } from "@/lib/mod/proyecto-mario-ciclos-service"
import type {
  ColumnaReporte,
  DefinicionReporte,
  FiltroReporte,
  HojaReporte,
  OpcionFiltro,
  ResultadoReporte,
  TipoColumna,
  ValorCelda,
} from "../types"

type Fila = Record<string, unknown>

// ─── Catálogos de etiquetas ───────────────────────────────────────────────────

/** `discipulado_ciclos.tipo` (`discipulado-ciclos-service.ts:8-12`). */
const MODULOS_DISCIPULADO: Record<string, string> = {
  primeros_pasos: "Primeros pasos de la vida cristiana",
  seguimos_avanzando: "Seguimos avanzando",
  siendo_iglesia: "Siendo iglesia",
}

/**
 * `herederos_ciclos.tipo` (`herederos-ciclos-service.ts:10-15`). El mismo mapa
 * sirve para normalizar `consolidacion_herederos.salon`, que unas veces guarda
 * la etiqueta legible y otras la clave.
 */
const SALONES_HEREDEROS: Record<string, string> = {
  herederos_baby: "Herederos Baby",
  herederos_kids: "Herederos Kids",
  herederos_explores: "Herederos Explores",
  herederos_champions: "Herederos Champions",
}

const RANGOS_HEREDEROS: Record<string, string> = {
  herederos_baby: "0-2 años",
  herederos_kids: "3-5 años",
  herederos_explores: "6-8 años",
  herederos_champions: "9-11 años",
}

/**
 * `proyecto_mario_ciclos.tipo`. Se usan las etiquetas del exportador de
 * listados, no las de `PROYECTO_MARIO_CICLO_CONFIG`: las del servicio llevan
 * "Sabados" y "Belleza Cejas" sin acentuar ni separar.
 */
const CURSOS_PROYECTO_MARIO: Record<string, string> = {
  belleza_integral_sabados: "Belleza Integral (Sábados)",
  belleza_integral_viernes: "Belleza Integral (Viernes)",
  manualidades: "Manualidades",
  belleza_cejas: "Belleza — Cejas",
  gastronomia: "Gastronomía",
}

const GENEROS: Record<string, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
}

const CONTEXTURAS: Record<string, string> = {
  delgada: "Delgada",
  media: "Media",
  robusta: "Robusta",
}

const EQUIPOS: Record<string, string> = {
  amarillo: "Amarillo",
  azul: "Azul",
  verde: "Verde",
  naranja: "Naranja",
}

const MESES_CALENDARIO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

/** Leyenda de los códigos de asistencia, para el pie de las hojas. */
const LEYENDA_ASISTENCIA = `Códigos de asistencia: ${Object.entries(ESTADOS_ASISTENCIA)
  .map(([clave, texto]) => `${clave} = ${texto}`)
  .join("; ")}.`

const NOTA_PORCENTAJE =
  "El % de asistencia es (A + AT) ÷ clases con registro: el atraso cuenta como presencia y las clases sin marca quedan fuera del cálculo, nunca como falta. El sistema no guarda ningún porcentaje: se calcula al exportar."

const NOTA_ESTATUS =
  "El estado aprobado/reprobado se exporta tal como está guardado. No se recalcula porque el umbral de faltas lo elige quien cierra el ciclo y no queda registrado en el ciclo."

// ─── Modelo común de los tres módulos de ciclos ───────────────────────────────

interface FilaCiclo {
  id: number
  tipo: string
  fecha_inicio: string
  total_clases: number
  activo: boolean
}

interface FilaFecha {
  id: number
  ciclo_id: number
  numero_clase: number
  fecha: string
}

interface FilaAsistencia {
  participante_id: number
  fecha_id: number
  status: string
}

/** Declaración de un módulo ciclo → participantes → fechas → asistencia. */
interface ModuloCiclos {
  ciclos: string
  participantes: string
  fechas: string
  asistencia: string
  /** Etiquetas de `ciclos.tipo`. */
  tipos: Record<string, string>
  /** Encabezado de la columna que describe el tipo de ciclo. */
  labelTipo: string
  /** Prefijo de las columnas de clase en la matriz: C1, D1… */
  prefijoClase: string
  /** Los participantes tienen columna `estatus` (no la tienen en herederos). */
  conEstatus: boolean
  /** Campos a leer de la tabla de participantes. */
  camposParticipante: string
}

const DISCIPULADO: ModuloCiclos = {
  ciclos: "discipulado_ciclos",
  participantes: "discipulado_ciclo_participantes",
  fechas: "discipulado_ciclo_fechas",
  asistencia: "discipulado_ciclo_asistencia",
  tipos: MODULOS_DISCIPULADO,
  labelTipo: "Módulo",
  prefijoClase: "C",
  conEstatus: true,
  camposParticipante: "id, ciclo_id, nombre, estatus, created_at, updated_at",
}

const HEREDEROS: ModuloCiclos = {
  ciclos: "herederos_ciclos",
  participantes: "herederos_ciclo_participantes",
  fechas: "herederos_ciclo_fechas",
  asistencia: "herederos_ciclo_asistencia",
  tipos: SALONES_HEREDEROS,
  labelTipo: "Salón",
  // En herederos las clases son los domingos del mes, por eso "D".
  prefijoClase: "D",
  conEstatus: false,
  camposParticipante:
    "id, ciclo_id, nombre, fecha_nacimiento, edad, salon, nuevo, nombre_representante, celular, fecha_registro, alergias, observaciones, created_at, updated_at",
}

const PROYECTO_MARIO: ModuloCiclos = {
  ciclos: "proyecto_mario_ciclos",
  participantes: "proyecto_mario_ciclo_participantes",
  fechas: "proyecto_mario_ciclo_fechas",
  asistencia: "proyecto_mario_ciclo_asistencia",
  tipos: CURSOS_PROYECTO_MARIO,
  labelTipo: "Tipo de curso",
  prefijoClase: "C",
  conEstatus: true,
  camposParticipante: "id, ciclo_id, nombre, estatus, created_at, updated_at",
}

const CAMPOS_CICLO = "id, tipo, fecha_inicio, total_clases, activo"
const CAMPOS_FECHA = "id, ciclo_id, numero_clase, fecha"
const CAMPOS_ASISTENCIA = "participante_id, fecha_id, status"

/** Día y mes para los encabezados de clase de la matriz: "05/01". */
function diaMes(fecha: unknown): string {
  const texto = typeof fecha === "string" ? fecha.slice(0, 10) : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return ""
  return `${texto.slice(8, 10)}/${texto.slice(5, 7)}`
}

function porFecha(a: FilaFecha, b: FilaFecha): number {
  return String(a.fecha ?? "").localeCompare(String(b.fecha ?? ""))
}

function porNombre(a: Fila, b: Fila): number {
  return String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""))
}

interface ConteoAsistencia {
  registradas: number
  asistencias: number
  justificadas: number
  faltas: number
  atrasos: number
}

function conteoVacio(): ConteoAsistencia {
  return { registradas: 0, asistencias: 0, justificadas: 0, faltas: 0, atrasos: 0 }
}

function acumular(conteo: ConteoAsistencia, status: unknown): void {
  conteo.registradas++
  if (status === "A") conteo.asistencias++
  else if (status === "J") conteo.justificadas++
  else if (status === "F") conteo.faltas++
  else if (status === "AT") conteo.atrasos++
}

/**
 * Porcentaje de asistencia sobre las clases con registro. Se devuelve en escala
 * 0-100: la conversión a fracción la hace el formateador de celdas.
 */
function porcentajeAsistencia(conteo: ConteoAsistencia): number | "" {
  if (conteo.registradas === 0) return ""
  return ((conteo.asistencias + conteo.atrasos) / conteo.registradas) * 100
}

/** Lee los ciclos de un módulo, del más reciente al más antiguo. */
async function cargarCiclos(modulo: ModuloCiclos): Promise<FilaCiclo[]> {
  return seleccionarTodo<FilaCiclo>(
    modulo.ciclos,
    (q) => q.order("fecha_inicio", { ascending: false }).order("id"),
    { select: CAMPOS_CICLO },
  )
}

/** Opciones del filtro de ciclo concreto: "tipo — fecha (activo/cerrado)". */
function opcionesDeCiclos(modulo: ModuloCiclos): () => Promise<OpcionFiltro[]> {
  return async () => {
    const ciclos = await cargarCiclos(modulo)
    return ciclos.map((c) => ({
      value: String(c.id),
      label: `${etiqueta(modulo.tipos, c.tipo)} — ${textoFecha(c.fecha_inicio)} (${c.activo ? "activo" : "cerrado"})`,
    }))
  }
}

/** Filtro de estado administrativo del ciclo, común a los tres módulos. */
function filtroEstadoCiclo(): FiltroReporte {
  return {
    id: "estadoCiclo",
    label: "Estado del ciclo",
    tipo: "opcion",
    opcionTodos: "Todos los ciclos",
    opciones: [
      { value: "activo", label: "Solo ciclos activos" },
      { value: "cerrado", label: "Solo ciclos cerrados" },
    ],
    ayuda:
      "Es la marca administrativa del ciclo (columna activo), no si ya pasó la última clase: al iniciar un ciclo nuevo el anterior se desactiva aunque le falten fechas por dictar.",
  }
}

function filtroEstatusParticipante(): FiltroReporte {
  return {
    id: "estatus",
    label: "Estado del participante",
    tipo: "opcion",
    opcionTodos: "Todos los estados",
    opciones: [
      { value: "en_curso", label: "En curso" },
      { value: "aprobado", label: "Aprobado" },
      { value: "reprobado", label: "Reprobado" },
    ],
  }
}

/** Aplica los filtros de tipo y de estado del ciclo en memoria. */
function filtrarCiclos(ciclos: FilaCiclo[], filtros: Record<string, string>): FilaCiclo[] {
  return ciclos.filter((c) => {
    if (filtros.tipo && c.tipo !== filtros.tipo) return false
    if (filtros.estadoCiclo === "activo" && c.activo !== true) return false
    if (filtros.estadoCiclo === "cerrado" && c.activo === true) return false
    return true
  })
}

/**
 * Certificados en PDF de los participantes aprobados de los ciclos que
 * coincidan con los filtros.
 *
 * El generador recibe un solo tipo de ciclo porque el diseño del certificado
 * cambia con el módulo (texto del programa, firmas). Si los filtros abarcan
 * varios tipos se emite un documento por tipo y se unen en un solo archivo.
 */
async function certificadosDeAprobados(
  modulo: ModuloCiclos,
  filtros: Record<string, string>,
  generar: (nombres: string[], tipo: string) => Promise<Uint8Array>,
  base: string,
): Promise<{ contenido: Uint8Array; nombre: string; mensaje: string }> {
  const ciclos = filtrarCiclos(await cargarCiclos(modulo), filtros)
  if (ciclos.length === 0) {
    throw new ErrorReporte("Ningún ciclo coincide con los filtros seleccionados.")
  }

  const participantes = await seleccionarTodo<Fila>(
    modulo.participantes,
    (q) =>
      q
        .in("ciclo_id", ciclos.map((c) => c.id))
        .eq("estatus", "aprobado")
        .order("nombre", { ascending: true }),
    { select: "id, ciclo_id, nombre, estatus" },
  )

  const tipoPorCiclo = new Map(ciclos.map((c) => [Number(c.id), c.tipo]))
  const nombresPorTipo = new Map<string, string[]>()

  for (const participante of participantes) {
    const tipo = tipoPorCiclo.get(Number(participante.ciclo_id))
    const nombre = String(participante.nombre ?? "").trim()
    if (!tipo || !nombre) continue
    nombresPorTipo.set(tipo, [...(nombresPorTipo.get(tipo) ?? []), nombre])
  }

  if (nombresPorTipo.size === 0) {
    throw new ErrorReporte(
      "No hay participantes aprobados en los ciclos seleccionados. Un ciclo se cierra marcando quién aprueba.",
    )
  }

  const documentos: Uint8Array[] = []
  for (const [tipo, nombres] of nombresPorTipo) {
    documentos.push(await generar(nombres, tipo))
  }

  const total = [...nombresPorTipo.values()].reduce((suma, lista) => suma + lista.length, 0)
  return {
    contenido: await unirPdfs(documentos),
    nombre: `${base}_${hoyISO()}.pdf`,
    mensaje: `PDF con ${total} certificado${total === 1 ? "" : "s"}.`,
  }
}

/**
 * Participantes de varios ciclos con su resumen de asistencia ya calculado.
 *
 * La asistencia se filtra por `ciclo_id` —columna desnormalizada pero presente
 * en las tres tablas, y es por donde consultan todos los `getAsistencia`— y se
 * cruza por `fecha_id`, no por `numero_clase`.
 */
async function filasConResumen(modulo: ModuloCiclos, filtros: Record<string, string>): Promise<Fila[]> {
  const ciclos = filtrarCiclos(await cargarCiclos(modulo), filtros)
  const ids = ciclos.map((c) => c.id)
  if (ids.length === 0) return []

  const [participantes, fechas, asistencia] = await Promise.all([
    // Todas las consultas se ordenan por id: `seleccionarTodo` pagina de 1000
    // en 1000 y sin un orden estable una página puede repetir u omitir filas.
    seleccionarTodo<Fila>(modulo.participantes, (q) => q.in("ciclo_id", ids).order("id"), {
      select: modulo.camposParticipante,
    }),
    seleccionarTodo<FilaFecha>(modulo.fechas, (q) => q.in("ciclo_id", ids).order("id"), {
      select: CAMPOS_FECHA,
    }),
    seleccionarTodo<FilaAsistencia>(modulo.asistencia, (q) => q.in("ciclo_id", ids).order("id"), {
      select: CAMPOS_ASISTENCIA,
    }),
  ])

  // Clases realmente registradas por ciclo. No se usa `total_clases`: en
  // herederos se reduce al mover fechas y en Proyecto Mario puede quedar por
  // encima o por debajo del número real de filas en la tabla de fechas.
  const clasesPorCiclo = new Map<number, number>()
  for (const f of fechas) {
    clasesPorCiclo.set(f.ciclo_id, (clasesPorCiclo.get(f.ciclo_id) ?? 0) + 1)
  }

  const conteos = new Map<number, ConteoAsistencia>()
  for (const marca of asistencia) {
    const actual = conteos.get(marca.participante_id) ?? conteoVacio()
    acumular(actual, marca.status)
    conteos.set(marca.participante_id, actual)
  }

  const porId = new Map<number, FilaCiclo>(ciclos.map((c) => [c.id, c]))

  const filas = participantes
    .filter((p) => !filtros.estatus || p.estatus === filtros.estatus)
    .map((p) => {
      const ciclo = porId.get(Number(p.ciclo_id))
      const conteo = conteos.get(Number(p.id)) ?? conteoVacio()
      const clases = ciclo ? (clasesPorCiclo.get(ciclo.id) ?? 0) : 0

      return {
        ...p,
        tipo_ciclo: ciclo ? etiqueta(modulo.tipos, ciclo.tipo) : "",
        ciclo_fecha_inicio: ciclo?.fecha_inicio ?? "",
        ciclo_activo: ciclo?.activo ?? "",
        clases_ciclo: clases,
        clases_registradas: conteo.registradas,
        sin_registrar: Math.max(0, clases - conteo.registradas),
        asistencias: conteo.asistencias,
        justificadas: conteo.justificadas,
        faltas: conteo.faltas,
        atrasos: conteo.atrasos,
        porcentaje_asistencia: porcentajeAsistencia(conteo),
      } satisfies Fila
    })

  filas.sort(
    (a, b) =>
      String(b.ciclo_fecha_inicio ?? "").localeCompare(String(a.ciclo_fecha_inicio ?? "")) ||
      String(a.tipo_ciclo ?? "").localeCompare(String(b.tipo_ciclo ?? "")) ||
      porNombre(a, b),
  )

  return filas
}

// ─── Columnas compartidas de los reportes de ciclos ───────────────────────────

function colTipoCiclo(modulo: ModuloCiclos): ColumnaReporte<Fila> {
  return { key: "tipo_ciclo", label: modulo.labelTipo, ancho: 30 }
}

const COLS_CICLO: ColumnaReporte<Fila>[] = [
  { key: "ciclo_fecha_inicio", label: "Fecha de inicio del ciclo", tipo: "fecha" },
  { key: "ciclo_activo", label: "¿Ciclo activo?", tipo: "booleano", ancho: 14 },
]

const COL_ESTATUS: ColumnaReporte<Fila> = {
  key: "estatus",
  label: "Estado del participante",
  ancho: 20,
  ayuda: "Tal como quedó guardado al cerrar el ciclo; no se recalcula.",
  valor: (f) => etiqueta(ESTATUS_PARTICIPANTE, f.estatus),
}

const COLS_RESUMEN_ASISTENCIA: ColumnaReporte<Fila>[] = [
  {
    key: "clases_ciclo",
    label: "Clases del ciclo",
    tipo: "numero",
    ancho: 15,
    ayuda: "Fechas registradas en el ciclo. No se usa total_clases porque puede no coincidir con las fechas reales.",
  },
  {
    key: "clases_registradas",
    label: "Clases con registro",
    tipo: "numero",
    ancho: 18,
    ayuda: "Clases en las que esta persona quedó marcada con algún código.",
  },
  {
    key: "sin_registrar",
    label: "Clases sin registrar",
    tipo: "numero",
    ancho: 18,
    ayuda: "Clases del ciclo sin ninguna marca para esta persona. No cuentan como falta.",
  },
  { key: "asistencias", label: "Asistió (A)", tipo: "numero", ancho: 12 },
  { key: "justificadas", label: "Justificó (J)", tipo: "numero", ancho: 14 },
  { key: "faltas", label: "Faltas (F)", tipo: "numero", ancho: 12 },
  { key: "atrasos", label: "Atrasos (AT)", tipo: "numero", ancho: 13 },
  {
    key: "porcentaje_asistencia",
    label: "% de asistencia",
    tipo: "porcentaje",
    ancho: 15,
    ayuda: "(A + AT) ÷ clases con registro.",
  },
]

const COLS_METADATOS_CICLO: ColumnaReporte<Fila>[] = [
  { key: "id", label: "ID del participante", tipo: "numero", ancho: 16, opcional: true },
  { key: "ciclo_id", label: "ID del ciclo", tipo: "numero", ancho: 12, opcional: true },
  { key: "created_at", label: "Fecha de registro", tipo: "fecha", opcional: true },
  { key: "updated_at", label: "Última modificación", tipo: "fechaHora", opcional: true },
]

/** Columnas fijas que la matriz escribe siempre, al margen de la selección. */
function columnasDeMatriz(conEstatus: boolean): ColumnaReporte<Fila>[] {
  return [
    {
      key: "nombre",
      label: "Participante",
      ancho: 34,
      ayuda: "La matriz se arma completa: a estas columnas se suma una por cada clase del ciclo elegido.",
    },
    ...(conEstatus ? [COL_ESTATUS] : []),
    ...COLS_RESUMEN_ASISTENCIA.filter((c) => c.key !== "clases_ciclo" && c.key !== "sin_registrar"),
  ]
}

// ─── Matriz de asistencia de un ciclo ─────────────────────────────────────────

/**
 * Hoja con una fila por participante y una columna por clase.
 *
 * Se construye a mano (`hojaPrincipal`) porque el número de columnas depende de
 * las fechas del ciclo y no se puede declarar de antemano.
 */
async function matrizDeCiclo(modulo: ModuloCiclos, valorFiltro: string): Promise<ResultadoReporte<Fila>> {
  const idCiclo = Number(valorFiltro)
  if (!Number.isInteger(idCiclo)) {
    throw new ErrorReporte("El ciclo seleccionado no es válido. Vuelva a elegirlo en la lista.")
  }

  const ciclos = await seleccionar<FilaCiclo>(modulo.ciclos, (q) => q.eq("id", idCiclo), CAMPOS_CICLO)
  const ciclo = ciclos[0]
  if (!ciclo) {
    throw new ErrorReporte(
      "El ciclo seleccionado ya no existe. Recargue la página para actualizar la lista de ciclos.",
    )
  }

  const [participantes, fechas, asistencia] = await Promise.all([
    seleccionarTodo<Fila>(modulo.participantes, (q) => q.eq("ciclo_id", idCiclo).order("id"), {
      select: modulo.camposParticipante,
    }),
    seleccionarTodo<FilaFecha>(modulo.fechas, (q) => q.eq("ciclo_id", idCiclo).order("id"), {
      select: CAMPOS_FECHA,
    }),
    seleccionarTodo<FilaAsistencia>(modulo.asistencia, (q) => q.eq("ciclo_id", idCiclo).order("id"), {
      select: CAMPOS_ASISTENCIA,
    }),
  ])

  if (fechas.length === 0) {
    throw new ErrorReporte(
      "El ciclo elegido no tiene fechas de clase registradas, así que no hay matriz de asistencia que generar.",
    )
  }
  if (participantes.length === 0) {
    throw new ErrorReporte("El ciclo elegido no tiene participantes registrados.")
  }

  // Las clases se numeran por orden cronológico: `numero_clase` se renumera en
  // Proyecto Mario al reordenar o quitar fechas, así que no sirve de ancla.
  const clases = [...fechas].sort(porFecha)
  const marcas = new Map<string, string>()
  for (const m of asistencia) {
    marcas.set(`${m.participante_id}:${m.fecha_id}`, String(m.status ?? ""))
  }

  const encabezados = [
    "Participante",
    ...(modulo.conEstatus ? ["Estado del participante"] : []),
    ...clases.map((c, i) => `${modulo.prefijoClase}${i + 1} ${diaMes(c.fecha)}`),
    "Clases con registro",
    "Asistió (A)",
    "Justificó (J)",
    "Faltas (F)",
    "Atrasos (AT)",
    "% de asistencia",
  ]

  const tipos: (TipoColumna | undefined)[] = [
    undefined,
    ...(modulo.conEstatus ? [undefined] : []),
    ...clases.map(() => undefined),
    "numero",
    "numero",
    "numero",
    "numero",
    "numero",
    "porcentaje",
  ]

  const anchos = [
    34,
    ...(modulo.conEstatus ? [20] : []),
    ...clases.map(() => 10),
    18,
    12,
    14,
    12,
    13,
    15,
  ]

  // Presentes por clase, para la fila de totales al pie.
  const presentesPorClase = clases.map(() => 0)
  const filas: ValorCelda[][] = []

  for (const p of [...participantes].sort(porNombre)) {
    const conteo = conteoVacio()
    const celdas: ValorCelda[] = clases.map((clase, i) => {
      const status = marcas.get(`${p.id}:${clase.id}`)
      // Sin fila de asistencia la celda queda vacía: no se registró nada, que
      // no es lo mismo que haber faltado.
      if (!status) return ""
      acumular(conteo, status)
      if (status === "A" || status === "AT") presentesPorClase[i]++
      return status
    })

    filas.push([
      String(p.nombre ?? ""),
      ...(modulo.conEstatus ? [etiqueta(ESTATUS_PARTICIPANTE, p.estatus)] : []),
      ...celdas,
      conteo.registradas,
      conteo.asistencias,
      conteo.justificadas,
      conteo.faltas,
      conteo.atrasos,
      valorDeCelda(porcentajeAsistencia(conteo), "porcentaje"),
    ])
  }

  const sumar = (indice: number) =>
    filas.reduce((suma, f) => suma + (typeof f[indice] === "number" ? (f[indice] as number) : 0), 0)

  // Las seis últimas columnas son los totales por participante.
  const primeraNumerica = encabezados.length - 6
  const totalRegistradas = sumar(primeraNumerica)
  const totalPresentes = sumar(primeraNumerica + 1) + sumar(primeraNumerica + 4)

  const totales: ValorCelda[] = [
    "TOTAL",
    ...(modulo.conEstatus ? [""] : []),
    ...presentesPorClase,
    totalRegistradas,
    sumar(primeraNumerica + 1),
    sumar(primeraNumerica + 2),
    sumar(primeraNumerica + 3),
    sumar(primeraNumerica + 4),
    valorDeCelda(
      totalRegistradas === 0 ? "" : (totalPresentes / totalRegistradas) * 100,
      "porcentaje",
    ),
  ]

  const hojaPrincipal: HojaReporte = {
    nombre: `${etiqueta(modulo.tipos, ciclo.tipo)} ${textoFecha(ciclo.fecha_inicio)}`.slice(0, 31),
    encabezados,
    filas,
    anchos,
    tipos,
    totales,
    notas: [
      `Ciclo: ${etiqueta(modulo.tipos, ciclo.tipo)}, inicio ${textoFecha(ciclo.fecha_inicio)}, ${ciclo.activo ? "activo" : "cerrado"}.`,
      LEYENDA_ASISTENCIA,
      "Una celda vacía significa que esa clase no se registró para esa persona; no equivale a una falta.",
      `Las clases se numeran ${modulo.prefijoClase}1…${modulo.prefijoClase}${clases.length} por orden de fecha.`,
      "La fila TOTAL cuenta, en cada clase, cuántas personas quedaron marcadas A o AT.",
      NOTA_PORCENTAJE,
    ],
  }

  return { hojaPrincipal }
}

// ─── Discipulado ──────────────────────────────────────────────────────────────

const MODULOS_DISCIPULADO_PERMISO = [
  "listados",
  "discipulado_primeros_pasos",
  "discipulado_seguimos_avanzando",
  "discipulado_siendo_iglesia",
  "historial_discipulado",
  "control_mensual",
  "resumen-pastoral",
]

const TABLAS_DISCIPULADO = [
  "discipulado_ciclos",
  "discipulado_ciclo_participantes",
  "discipulado_ciclo_fechas",
  "discipulado_ciclo_asistencia",
]

const NOTA_LEGADO_DISCIPULADO =
  "Solo se leen las tablas del modelo vigente (discipulado_ciclos y sus hijas). Las tablas anteriores (discipulado_participantes, discipulado_fechas, discipulado_asistencia) están indexadas por mes y no guardan ni el módulo ni el estado del participante, así que no se pueden unir a este reporte sin falsear los totales."

const discipuladoParticipantes: DefinicionReporte<Fila> = {
  id: "discipulado-participantes",
  grupo: "Formación",
  titulo: "Discipulado — participantes",
  descripcion:
    "Participantes de todos los ciclos de discipulado, con su estado y el resumen de asistencia de su ciclo.",
  tablas: TABLAS_DISCIPULADO,
  modulos: MODULOS_DISCIPULADO_PERMISO,
  hoja: "Participantes",
  archivo: "Discipulado_Participantes",
  filtros: [
    {
      id: "tipo",
      label: "Módulo de discipulado",
      tipo: "opcion",
      opcionTodos: "Los tres módulos",
      opciones: Object.entries(MODULOS_DISCIPULADO).map(([value, label]) => ({ value, label })),
    },
    filtroEstadoCiclo(),
    filtroEstatusParticipante(),
  ],
  columnas: [
    { key: "nombre", label: "Nombre", ancho: 34 },
    colTipoCiclo(DISCIPULADO),
    ...COLS_CICLO,
    COL_ESTATUS,
    ...COLS_RESUMEN_ASISTENCIA,
    ...COLS_METADATOS_CICLO,
  ],
  notas: [
    NOTA_LEGADO_DISCIPULADO,
    "Una persona inscrita en dos módulos aparece una vez por ciclo: los participantes se guardan por ciclo y no hay vínculo con el censo, solo el nombre escrito a mano.",
    NOTA_PORCENTAJE,
    NOTA_ESTATUS,
  ],
  obtener: async (ctx) => ({ filas: await filasConResumen(DISCIPULADO, ctx.filtros) }),
  acciones: [
    {
      id: "certificados-discipulado",
      label: "Certificados de aprobados (PDF)",
      icono: "pdf",
      ejecutar: (ctx) =>
        certificadosDeAprobados(
          DISCIPULADO,
          ctx.filtros,
          (nombres, tipo) => generateCertificadosPDF(nombres, tipo as CicloTipo),
          "Certificados_Discipulado",
        ),
    },
  ],
}

const discipuladoAsistencia: DefinicionReporte<Fila> = {
  id: "discipulado-asistencia",
  grupo: "Formación",
  titulo: "Discipulado — asistencia por ciclo",
  descripcion:
    "Matriz de asistencia de un ciclo: una fila por participante y una columna por clase, con los códigos A, J, F y AT.",
  tablas: TABLAS_DISCIPULADO,
  modulos: MODULOS_DISCIPULADO_PERMISO,
  hoja: "Asistencia",
  archivo: "Discipulado_Asistencia",
  filtros: [
    {
      id: "ciclo",
      label: "Ciclo",
      tipo: "opcion",
      requerido: true,
      cargarOpciones: opcionesDeCiclos(DISCIPULADO),
      ayuda: "La matriz es de un solo ciclo: sus columnas son las clases de ese ciclo.",
    },
  ],
  columnas: columnasDeMatriz(true),
  notas: [
    NOTA_LEGADO_DISCIPULADO,
    "Esta hoja se arma completa, con una columna por clase; el selector de columnas no recorta la matriz.",
    "Una celda vacía significa que esa clase no se registró para esa persona; no equivale a una falta.",
    NOTA_PORCENTAJE,
  ],
  obtener: async (ctx) => matrizDeCiclo(DISCIPULADO, ctx.filtros.ciclo ?? ""),
}

// ─── Herederos del Reino ──────────────────────────────────────────────────────

const MODULOS_HEREDEROS_PERMISO = [
  "listados",
  "herederos_baby",
  "herederos_kids",
  "herederos_explores",
  "herederos_champions",
  "historial_herederos",
  "consolidacion_herederos",
]

const TABLAS_HEREDEROS = [
  "herederos_ciclos",
  "herederos_ciclo_participantes",
  "herederos_ciclo_fechas",
  "herederos_ciclo_asistencia",
]

const FILTRO_NIVEL_HEREDEROS: FiltroReporte = {
  id: "tipo",
  label: "Nivel",
  tipo: "opcion",
  opcionTodos: "Todos los niveles",
  opciones: Object.entries(SALONES_HEREDEROS).map(([value, label]) => ({
    value,
    label: `${label} (${RANGOS_HEREDEROS[value]})`,
  })),
}

const herederosParticipantes: DefinicionReporte<Fila> = {
  id: "herederos-participantes",
  grupo: "Formación",
  titulo: "Herederos del Reino — participantes",
  descripcion:
    "Niños inscritos en los ciclos de Herederos del Reino, con representante, datos de salud y resumen de asistencia.",
  tablas: TABLAS_HEREDEROS,
  modulos: MODULOS_HEREDEROS_PERMISO,
  hoja: "Participantes",
  archivo: "Herederos_Participantes",
  filtros: [FILTRO_NIVEL_HEREDEROS, filtroEstadoCiclo()],
  columnas: [
    { key: "nombre", label: "Nombre y apellido", ancho: 34 },
    colTipoCiclo(HEREDEROS),
    {
      key: "salon",
      label: "Salón en la ficha",
      ancho: 22,
      opcional: true,
      ayuda: "Copia del salón guardada en la ficha del niño; puede diferir del nivel del ciclo si se lo cambiaron de grupo.",
      valor: (f) => etiqueta(SALONES_HEREDEROS, f.salon),
    },
    { key: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "fecha" },
    {
      key: "edad",
      label: "Edad",
      tipo: "numero",
      ancho: 8,
      ayuda: "Recalculada desde la fecha de nacimiento, como hace el módulo al leer: la edad guardada queda vencida.",
      valor: (f) => calcularEdad(f.fecha_nacimiento) ?? f.edad ?? "",
    },
    { key: "nuevo", label: "Nuevo", tipo: "booleano", ancho: 9 },
    {
      key: "nombre_representante",
      label: "Representante",
      ancho: 30,
      ayuda: "Al importar desde el censo de niños se toma la madre y, si no hay, el padre.",
    },
    { key: "celular", label: "Celular", ancho: 15 },
    { key: "fecha_registro", label: "Fecha de registro", tipo: "fecha" },
    ...COLS_CICLO,
    ...COLS_RESUMEN_ASISTENCIA,
    {
      key: "alergias",
      label: "Alergias",
      ancho: 30,
      sensible: true,
      ayuda: "Dato de salud de un menor.",
    },
    {
      key: "observaciones",
      label: "Observaciones",
      ancho: 36,
      sensible: true,
      ayuda: "Puede contener datos de salud o de conducta de un menor.",
    },
    ...COLS_METADATOS_CICLO,
  ],
  notas: [
    "Herederos no maneja aprobado ni reprobado: el ciclo es mensual y no tiene estado de participante.",
    "Un ciclo de Herederos cubre los domingos de un mes, así que un mismo niño aparece una vez por mes en el que estuvo inscrito.",
    "Al entrar al módulo se desactivan automáticamente los ciclos cuya última clase quedó en un mes anterior, de modo que \"ciclo activo\" normalmente se limita al mes en curso.",
    "Los participantes no están enlazados al censo de niños por id: el único vínculo es el nombre normalizado en mayúsculas, y un nombre reescrito rompe la correspondencia.",
    NOTA_PORCENTAJE,
  ],
  obtener: async (ctx) => ({ filas: await filasConResumen(HEREDEROS, ctx.filtros) }),
}

const herederosAsistencia: DefinicionReporte<Fila> = {
  id: "herederos-asistencia",
  grupo: "Formación",
  titulo: "Herederos del Reino — asistencia por ciclo",
  descripcion:
    "Matriz de asistencia de un ciclo mensual de Herederos: una fila por niño y una columna por domingo.",
  tablas: TABLAS_HEREDEROS,
  modulos: MODULOS_HEREDEROS_PERMISO,
  hoja: "Asistencia",
  archivo: "Herederos_Asistencia",
  filtros: [
    {
      id: "ciclo",
      label: "Ciclo",
      tipo: "opcion",
      requerido: true,
      cargarOpciones: opcionesDeCiclos(HEREDEROS),
      ayuda: "Cada ciclo corresponde a un nivel y a un mes; sus clases son los domingos de ese mes.",
    },
  ],
  columnas: columnasDeMatriz(false),
  notas: [
    "Esta hoja se arma completa, con una columna por domingo; el selector de columnas no recorta la matriz.",
    "Las clases que quedaron fuera del mes al mover una fecha se eliminan con su asistencia, así que un ciclo puede tener 4 o 5 domingos.",
    "Una celda vacía significa que ese domingo no se registró para ese niño; no equivale a una falta.",
    NOTA_PORCENTAJE,
  ],
  obtener: async (ctx) => matrizDeCiclo(HEREDEROS, ctx.filtros.ciclo ?? ""),
}

// ─── Consolidación de Herederos ───────────────────────────────────────────────

const consolidacionHerederos: DefinicionReporte<Fila> = {
  id: "consolidacion-herederos",
  grupo: "Formación",
  titulo: "Consolidación de Herederos",
  descripcion:
    "Niños con tres o más faltas en el mes y la gestión de seguimiento hecha con su representante.",
  tablas: ["consolidacion_herederos"],
  modulos: [
    "listados",
    "consolidacion_herederos",
    "herederos_baby",
    "herederos_kids",
    "herederos_explores",
    "herederos_champions",
  ],
  hoja: "Consolidación",
  archivo: "Consolidacion_Herederos",
  filtros: [
    { id: "anio", label: "Año", tipo: "anio", opcionTodos: "Todos los años" },
    {
      id: "mes",
      label: "Mes",
      tipo: "opcion",
      opcionTodos: "Todo el año",
      opciones: MESES_CALENDARIO.map((nombre, i) => ({ value: String(i + 1), label: nombre })),
    },
    {
      id: "gestion",
      label: "Estado de la gestión",
      tipo: "opcion",
      opcionTodos: "Todos",
      opciones: [
        { value: "pendiente", label: "Pendientes" },
        { value: "gestionado", label: "Gestionados" },
      ],
    },
  ],
  columnas: [
    { key: "participante_nombre", label: "Nombre", ancho: 34 },
    {
      key: "salon",
      label: "Salón",
      ancho: 22,
      ayuda: "La columna guarda unas veces la etiqueta y otras la clave del nivel; aquí se normaliza a la etiqueta.",
      valor: (f) => etiqueta(SALONES_HEREDEROS, f.salon),
    },
    {
      key: "mesNombre",
      label: "Mes",
      ancho: 12,
      valor: (f) => MESES_CALENDARIO[Number(f.mes) - 1] ?? "",
    },
    { key: "anio", label: "Año", tipo: "numero", ancho: 8 },
    {
      key: "total_faltas",
      label: "Faltas",
      tipo: "numero",
      ancho: 9,
      ayuda: "Solo faltas F del mes. En las filas ya gestionadas es la foto del momento de la gestión; en las pendientes se refresca.",
    },
    {
      key: "gestionado",
      label: "Estado",
      ancho: 13,
      valor: (f) => (f.gestionado === true ? "Gestionado" : "Pendiente"),
    },
    { key: "respuesta", label: "Respuesta", ancho: 40 },
    { key: "nombre_representante", label: "Representante", ancho: 30 },
    { key: "celular_representante", label: "Celular", ancho: 15 },
    { key: "gestionado_por_nombre", label: "Gestionado por", ancho: 26 },
    { key: "fecha_gestion", label: "Fecha de gestión", tipo: "fechaHora" },
    { key: "participante_id", label: "ID del participante", tipo: "numero", ancho: 16, opcional: true },
    { key: "gestionado_por", label: "ID del usuario que gestionó", ancho: 20, opcional: true },
    { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Fecha de registro", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Última modificación", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "Entran al listado los niños con tres o más faltas F en los domingos del mes de los ciclos activos. Los atrasos (AT) no cuentan como falta para este umbral.",
    "Hay una fila por niño y mes. El id del participante solo identifica a la persona dentro de su ciclo mensual: la tabla de participantes se repuebla cada mes al iniciar el ciclo.",
  ],
  obtener: async (ctx) => ({
    filas: await seleccionarTodo<Fila>("consolidacion_herederos", (q) => {
      let consulta = q
        .order("anio", { ascending: false })
        .order("mes", { ascending: false })
        .order("participante_nombre", { ascending: true })
      if (ctx.filtros.anio) consulta = consulta.eq("anio", Number(ctx.filtros.anio))
      if (ctx.filtros.mes) consulta = consulta.eq("mes", Number(ctx.filtros.mes))
      if (ctx.filtros.gestion) consulta = consulta.eq("gestionado", ctx.filtros.gestion === "gestionado")
      // El id cierra el orden: sin desempate estable la paginación puede
      // repetir filas entre páginas.
      return consulta.order("id")
    }),
  }),
}

// ─── Incidencias de Herederos ─────────────────────────────────────────────────

const incidenciasHerederos: DefinicionReporte<Fila> = {
  id: "incidencias-herederos",
  grupo: "Formación",
  titulo: "Incidencias de Herederos",
  descripcion: "Incidencias ocurridas en los salones de Herederos, con el maestro presente en cada caso.",
  tablas: ["reporte_incidencias_herederos"],
  modulos: [
    "listados",
    "reporte_incidencias_herederos",
    "herederos_baby",
    "herederos_kids",
    "herederos_explores",
    "herederos_champions",
  ],
  hoja: "Incidencias",
  archivo: "Incidencias_Herederos",
  filtros: [{ id: "rango", label: "Fecha de la incidencia", tipo: "rangoFechas" }],
  columnas: [
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    { key: "hora", label: "Hora", ancho: 9 },
    { key: "nombre_nino", label: "Nombre del niño o niña", ancho: 32 },
    {
      key: "detalle_incidencia",
      label: "Detalle de la incidencia",
      ancho: 48,
      sensible: true,
      ayuda: "Texto libre que describe lo ocurrido a un menor; puede incluir datos de salud o de conducta.",
    },
    { key: "maestro_presente", label: "Maestro presente", ancho: 28 },
    { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Fecha de registro", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Última modificación", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "El nombre del niño es texto libre: esta tabla no está enlazada al censo ni a los ciclos de Herederos.",
    "Orden del módulo: de la incidencia más reciente a la más antigua, por fecha y hora.",
  ],
  obtener: async (ctx) => ({
    filas: await seleccionarTodo<Fila>("reporte_incidencias_herederos", (q) => {
      let consulta = q.order("fecha", { ascending: false }).order("hora", { ascending: false })
      if (ctx.filtros.rango_desde) consulta = consulta.gte("fecha", ctx.filtros.rango_desde)
      if (ctx.filtros.rango_hasta) consulta = consulta.lte("fecha", ctx.filtros.rango_hasta)
      return consulta.order("id")
    }),
  }),
}

// ─── Proyecto Mario ───────────────────────────────────────────────────────────

const MODULOS_PROYECTO_MARIO_PERMISO = [
  "listados",
  "proyecto_mario_belleza_integral_sabados",
  "proyecto_mario_belleza_integral_viernes",
  "proyecto_mario_manualidades",
  "proyecto_mario_belleza_cejas",
  "proyecto_mario_gastronomia",
  "historial_proyecto_mario",
  "control_mensual",
  "resumen-pastoral",
]

const TABLAS_PROYECTO_MARIO = [
  "proyecto_mario_ciclos",
  "proyecto_mario_ciclo_participantes",
  "proyecto_mario_ciclo_fechas",
  "proyecto_mario_ciclo_asistencia",
]

const NOTA_CLASES_PROYECTO_MARIO =
  "El número de clases del ciclo se cuenta sobre las fechas registradas, no sobre total_clases: al quitar domingos o agregar fechas esa cifra deja de coincidir."

const proyectoMarioParticipantes: DefinicionReporte<Fila> = {
  id: "proyecto-mario-participantes",
  grupo: "Formación",
  titulo: "Proyecto Mario — participantes",
  descripcion:
    "Participantes de los cursos de Proyecto Mario, con su estado y el resumen de asistencia de su ciclo.",
  tablas: TABLAS_PROYECTO_MARIO,
  modulos: MODULOS_PROYECTO_MARIO_PERMISO,
  hoja: "Participantes",
  archivo: "Proyecto_Mario_Participantes",
  filtros: [
    {
      id: "tipo",
      label: "Tipo de curso",
      tipo: "opcion",
      opcionTodos: "Todos los cursos",
      opciones: Object.entries(CURSOS_PROYECTO_MARIO).map(([value, label]) => ({ value, label })),
      ayuda: "Belleza Integral (Sábados) es un solo curso aunque el menú lo muestre desde dos rutas distintas.",
    },
    filtroEstadoCiclo(),
    filtroEstatusParticipante(),
  ],
  columnas: [
    { key: "nombre", label: "Nombre", ancho: 34 },
    colTipoCiclo(PROYECTO_MARIO),
    ...COLS_CICLO,
    COL_ESTATUS,
    ...COLS_RESUMEN_ASISTENCIA,
    ...COLS_METADATOS_CICLO,
  ],
  notas: [
    NOTA_CLASES_PROYECTO_MARIO,
    "Los participantes se guardan por ciclo con el nombre escrito a mano: no hay vínculo con el censo, así que quien repite curso aparece una vez por ciclo.",
    NOTA_PORCENTAJE,
    NOTA_ESTATUS,
  ],
  obtener: async (ctx) => ({ filas: await filasConResumen(PROYECTO_MARIO, ctx.filtros) }),
  acciones: [
    {
      id: "certificados-proyecto-mario",
      label: "Certificados de aprobados (PDF)",
      icono: "pdf",
      ejecutar: (ctx) =>
        certificadosDeAprobados(
          PROYECTO_MARIO,
          ctx.filtros,
          (nombres, tipo) => generateCertificadosProyectoMarioPDF(nombres, tipo as ProyectoMarioCicloTipo),
          "Certificados_Proyecto_Mario",
        ),
    },
  ],
}

const proyectoMarioAsistencia: DefinicionReporte<Fila> = {
  id: "proyecto-mario-asistencia",
  grupo: "Formación",
  titulo: "Proyecto Mario — asistencia por ciclo",
  descripcion:
    "Matriz de asistencia de un ciclo de Proyecto Mario: una fila por participante y una columna por clase.",
  tablas: TABLAS_PROYECTO_MARIO,
  modulos: MODULOS_PROYECTO_MARIO_PERMISO,
  hoja: "Asistencia",
  archivo: "Proyecto_Mario_Asistencia",
  filtros: [
    {
      id: "ciclo",
      label: "Ciclo",
      tipo: "opcion",
      requerido: true,
      cargarOpciones: opcionesDeCiclos(PROYECTO_MARIO),
      ayuda: "La matriz es de un solo ciclo: sus columnas son las clases de ese ciclo.",
    },
  ],
  columnas: columnasDeMatriz(true),
  notas: [
    "Esta hoja se arma completa, con una columna por clase; el selector de columnas no recorta la matriz.",
    "Las clases se numeran por orden de fecha. En este módulo la numeración guardada se reescribe al reordenar o quitar fechas, así que no se usa como referencia.",
    "Las clases son semanales desde la fecha de inicio y pueden caer en cualquier día de la semana.",
    NOTA_PORCENTAJE,
  ],
  obtener: async (ctx) => matrizDeCiclo(PROYECTO_MARIO, ctx.filtros.ciclo ?? ""),
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

interface FilaEvento {
  id: number
  nombre: string
  descripcion: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  valor_default: number
  is_active: boolean
  sort_order: number
}

function numero(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

/** Saldo pendiente, con la fórmula del exportador del módulo de eventos. */
function saldoPendiente(valor: unknown, abono: unknown): number {
  const v = numero(valor)
  return v > 0 ? Math.max(0, v - numero(abono)) : 0
}

function estadoPago(valor: unknown, abono: unknown): string {
  const v = numero(valor)
  const a = numero(abono)
  if (v <= 0) return "Sin costo"
  if (a >= v) return "Cancelado"
  return `Debe $${(v - a).toFixed(2)}`
}

const COLS_PARTICIPANTE_EVENTO: ColumnaReporte<Fila>[] = [
  { key: "nombre", label: "Nombre", ancho: 32 },
  { key: "edad", label: "Edad", tipo: "numero", ancho: 8 },
  { key: "telefono", label: "Teléfono", ancho: 14 },
  { key: "genero", label: "Género", ancho: 12, valor: (f) => etiqueta(GENEROS, f.genero) },
  { key: "ministerio", label: "Ministerio", ancho: 20 },
  {
    key: "contextura",
    label: "Contextura",
    ancho: 12,
    ayuda: "Se usa para asignar camisetas y alojamiento.",
    valor: (f) => etiqueta(CONTEXTURAS, f.contextura),
  },
  { key: "limitacion_fisica", label: "Limitación física", tipo: "booleano", ancho: 16, sensible: true, ayuda: "Dato de salud." },
  { key: "valor", label: "Valor ($)", tipo: "moneda", totalizar: true },
  { key: "abono", label: "Abono ($)", tipo: "moneda", totalizar: true },
]

const eventosParticipantes: DefinicionReporte<Fila> = {
  id: "eventos-participantes",
  grupo: "Eventos",
  titulo: "Eventos — participantes",
  descripcion:
    "Inscritos en los eventos con pestaña propia, con lo cobrado, lo abonado y el saldo pendiente de cada persona.",
  tablas: ["eventos_tabs", "evento_participantes"],
  modulos: ["listados", "eventos_encuentro", "control_mensual", "resumen-pastoral"],
  hoja: "Participantes",
  archivo: "Eventos_Participantes",
  filtros: [
    {
      id: "evento",
      label: "Evento",
      tipo: "opcion",
      opcionTodos: "Todos los eventos",
      cargarOpciones: async () => {
        const eventos = await seleccionarTodo<FilaEvento>(
          "eventos_tabs",
          (q) => q.order("sort_order", { ascending: true }).order("id"),
          { select: "id, nombre, is_active" },
        )
        return eventos.map((e) => ({
          value: String(e.id),
          label: e.is_active ? e.nombre : `${e.nombre} (inactivo)`,
        }))
      },
      ayuda: "Un evento inactivo solo tiene la pestaña oculta; sus participantes siguen existiendo.",
    },
    {
      id: "pago",
      label: "Estado de pago",
      tipo: "opcion",
      opcionTodos: "Todos",
      opciones: [
        { value: "pagado", label: "Pagados completos" },
        { value: "pendiente", label: "Con saldo pendiente" },
        { value: "sin_costo", label: "Sin costo" },
      ],
    },
  ],
  columnas: [
    { key: "evento_nombre", label: "Evento", ancho: 28 },
    ...COLS_PARTICIPANTE_EVENTO,
    {
      key: "saldo",
      label: "Saldo pendiente ($)",
      tipo: "moneda",
      totalizar: true,
      ayuda: "Valor menos abono, nunca negativo. Con valor 0 el saldo es 0.",
      valor: (f) => saldoPendiente(f.valor, f.abono),
    },
    {
      key: "pagado_completo",
      label: "Pagado completo",
      tipo: "booleano",
      ancho: 16,
      ayuda: "Sí cuando el evento no tiene costo o el abono ya cubre el valor.",
      valor: (f) => numero(f.valor) <= 0 || numero(f.abono) >= numero(f.valor),
    },
    {
      key: "estado_pago",
      label: "Estado de pago",
      ancho: 16,
      ayuda: "Sin costo, Cancelado o lo que falta por cobrar, como lo muestra el módulo.",
      valor: (f) => estadoPago(f.valor, f.abono),
    },
    {
      key: "metodo_pago",
      label: "Método de pago",
      ancho: 16,
      ayuda: "Solo se informa cuando hay abono: con abono 0 la columna queda vacía, igual que en el módulo.",
      valor: (f) => (numero(f.abono) > 0 ? (f.metodo_pago ?? "") : ""),
    },
    { key: "equipo", label: "Equipo", ancho: 12, valor: (f) => etiqueta(EQUIPOS, f.equipo) },
    { key: "equipo_razon", label: "Razón del equipo", ancho: 32, opcional: true },
    {
      key: "importado_de",
      label: "Importado desde",
      ancho: 26,
      opcional: true,
      ayuda: "Evento del que se copió la inscripción.",
    },
    { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
    { key: "evento_id", label: "ID del evento", tipo: "numero", ancho: 12, opcional: true },
    { key: "created_at", label: "Fecha de registro", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Última modificación", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "El dinero sale de evento_participantes: cada abono ya está reflejado en la tabla de ingresos como un registro con concepto 'auto-evento', así que este reporte no lee ingresos y sus totales no deben sumarse a los de un reporte de ingresos.",
    "El enlace entre un abono y su ingreso es el texto del detalle, no un id, y renombrar un evento lo reescribe. Si lo que busca es conciliar con contabilidad, espere diferencias y revise los ingresos huérfanos.",
    "No hay restricción de unicidad por evento y nombre: dos homónimos en el mismo evento son dos filas aquí, pero colapsan en un solo ingreso automático.",
  ],
  obtener: async (ctx) => {
    const idEvento = ctx.filtros.evento ? Number(ctx.filtros.evento) : null

    const [eventos, participantes] = await Promise.all([
      seleccionarTodo<FilaEvento>("eventos_tabs", (q) => q.order("sort_order", { ascending: true }).order("id"), {
        select: "id, nombre, descripcion, fecha_inicio, fecha_fin, valor_default, is_active, sort_order",
      }),
      seleccionarTodo<Fila>("evento_participantes", (q) => {
        const consulta = q.order("nombre", { ascending: true }).order("id")
        return idEvento === null ? consulta : consulta.eq("evento_id", idEvento)
      }),
    ])

    const nombrePorId = new Map<number, string>(eventos.map((e) => [e.id, e.nombre]))
    const ordenPorId = new Map<number, number>(eventos.map((e) => [e.id, e.sort_order ?? 0]))

    const todas: Fila[] = participantes.map((p) => ({
      ...p,
      evento_nombre: nombrePorId.get(Number(p.evento_id)) ?? `Evento ${p.evento_id}`,
      importado_de:
        p.importado_de_evento_id === null || p.importado_de_evento_id === undefined
          ? ""
          : (nombrePorId.get(Number(p.importado_de_evento_id)) ?? `Evento ${p.importado_de_evento_id}`),
    }))

    const filas = todas.filter((p) => {
      const valor = numero(p.valor)
      const abono = numero(p.abono)
      if (ctx.filtros.pago === "pagado") return valor <= 0 || abono >= valor
      if (ctx.filtros.pago === "pendiente") return valor > 0 && abono < valor
      if (ctx.filtros.pago === "sin_costo") return valor <= 0
      return true
    })

    filas.sort(
      (a, b) =>
        (ordenPorId.get(Number(a.evento_id)) ?? 0) - (ordenPorId.get(Number(b.evento_id)) ?? 0) ||
        String(a.evento_nombre).localeCompare(String(b.evento_nombre)) ||
        porNombre(a, b),
    )

    // Resumen por evento, calculado sobre las filas ya filtradas para que
    // cuadre con la hoja principal.
    const eventosPresentes = eventos.filter((e) => filas.some((f) => Number(f.evento_id) === e.id))
    const resumen: HojaReporte = {
      nombre: "Resumen por evento",
      encabezados: [
        "Evento",
        "Participantes",
        "Total valor ($)",
        "Total abonado ($)",
        "Saldo pendiente ($)",
        "Pagados completos",
        "Con saldo pendiente",
        "Sin costo",
      ],
      filas: eventosPresentes.map((e) => {
        const suyas = filas.filter((f) => Number(f.evento_id) === e.id)
        return [
          e.is_active ? e.nombre : `${e.nombre} (inactivo)`,
          suyas.length,
          suyas.reduce((s, f) => s + numero(f.valor), 0),
          suyas.reduce((s, f) => s + numero(f.abono), 0),
          suyas.reduce((s, f) => s + saldoPendiente(f.valor, f.abono), 0),
          suyas.filter((f) => numero(f.valor) > 0 && numero(f.abono) >= numero(f.valor)).length,
          suyas.filter((f) => numero(f.valor) > 0 && numero(f.abono) < numero(f.valor)).length,
          suyas.filter((f) => numero(f.valor) <= 0).length,
        ]
      }),
      anchos: [30, 14, 16, 18, 20, 18, 20, 12],
      tipos: [undefined, "numero", "moneda", "moneda", "moneda", "numero", "numero", "numero"],
      notas: [
        "Los participantes sin costo no entran en pagados completos ni en pendientes; las tres cifras suman el total.",
        "El total abonado es el mismo dinero que ya figura en ingresos como 'auto-evento'. No lo sume dos veces.",
      ],
    }

    if (resumen.filas.length > 0) {
      resumen.totales = [
        "TOTAL",
        resumen.filas.reduce((s, f) => s + numero(f[1]), 0),
        resumen.filas.reduce((s, f) => s + numero(f[2]), 0),
        resumen.filas.reduce((s, f) => s + numero(f[3]), 0),
        resumen.filas.reduce((s, f) => s + numero(f[4]), 0),
        resumen.filas.reduce((s, f) => s + numero(f[5]), 0),
        resumen.filas.reduce((s, f) => s + numero(f[6]), 0),
        resumen.filas.reduce((s, f) => s + numero(f[7]), 0),
      ]
    }

    return { filas, hojas: resumen.filas.length > 0 ? [resumen] : [] }
  },
}

const encuentroParticipantes: DefinicionReporte<Fila> = {
  id: "encuentro-participantes",
  grupo: "Eventos",
  titulo: "Encuentros — participantes (modelo anterior)",
  descripcion:
    "Inscritos del encuentro único que se manejaba antes de los eventos con pestaña propia. Tabla histórica: hoy el módulo ya no escribe en ella.",
  tablas: ["encuentro_participantes"],
  modulos: ["listados", "eventos_encuentro"],
  hoja: "Encuentro",
  archivo: "Encuentro_Participantes",
  filtros: [
    {
      id: "equipo",
      label: "Equipo",
      tipo: "opcion",
      opcionTodos: "Todos los equipos",
      opciones: Object.entries(EQUIPOS).map(([value, label]) => ({ value, label })),
    },
  ],
  columnas: [
    ...COLS_PARTICIPANTE_EVENTO,
    {
      key: "saldo",
      label: "Saldo pendiente ($)",
      tipo: "moneda",
      totalizar: true,
      valor: (f) => saldoPendiente(f.valor, f.abono),
    },
    {
      key: "estado_pago",
      label: "Estado de pago",
      ancho: 16,
      valor: (f) => estadoPago(f.valor, f.abono),
    },
    { key: "equipo", label: "Equipo", ancho: 12, valor: (f) => etiqueta(EQUIPOS, f.equipo) },
    { key: "equipo_razon", label: "Razón del equipo", ancho: 32, opcional: true },
    { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Fecha de registro", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Última modificación", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "Es el modelo anterior de encuentros: un solo encuentro global, sin evento al que pertenecer, sin método de pago y sin trazabilidad de importaciones. Los eventos actuales están en el reporte \"Eventos — participantes\".",
    "Los abonos de esta tabla nunca generaron registros en ingresos: a diferencia de los eventos actuales, aquí no hubo sincronización automática con finanzas.",
    "No tiene columna de método de pago, así que no se puede saber cómo se cobró cada abono.",
  ],
  obtener: async (ctx) => ({
    filas: await seleccionarTodo<Fila>("encuentro_participantes", (q) => {
      const consulta = q.order("nombre", { ascending: true }).order("id")
      return ctx.filtros.equipo ? consulta.eq("equipo", ctx.filtros.equipo) : consulta
    }),
  }),
}

export const reportesFormacion: DefinicionReporte<Fila>[] = [
  discipuladoParticipantes,
  discipuladoAsistencia,
  herederosParticipantes,
  herederosAsistencia,
  consolidacionHerederos,
  incidenciasHerederos,
  proyectoMarioParticipantes,
  proyectoMarioAsistencia,
  eventosParticipantes,
  encuentroParticipantes,
]
