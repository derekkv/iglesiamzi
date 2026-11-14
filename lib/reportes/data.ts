/**
 * Acceso a datos y utilidades compartidas por el catálogo de reportes.
 *
 * Dos problemas concretos que resuelve este archivo:
 *
 * 1. **Tope de 1000 filas.** `/api/db` no impone límite, pero PostgREST
 *    devuelve como máximo 1000 filas por consulta. Un censo o un histórico de
 *    movimientos supera ese tope y el Excel saldría recortado sin avisar.
 *    `seleccionarTodo()` pagina con `range()` hasta agotar la tabla.
 *
 * 2. **Errores opacos.** El código anterior mostraba "Error al exportar" ante
 *    cualquier fallo, incluido el 403 por falta de permiso sobre una tabla.
 *    `ErrorConsulta` conserva la tabla y el estado para poder explicarlo.
 */

import { supabase as db } from "@/lib/secure-db"
import type { MesRef, OpcionFiltro } from "./types"

const TAMANO_PAGINA = 1000

export class ErrorConsulta extends Error {
  readonly tabla: string
  readonly status?: number

  constructor(tabla: string, mensaje: string, status?: number) {
    super(mensaje)
    this.name = "ErrorConsulta"
    this.tabla = tabla
    this.status = status
  }

  /** Mensaje para el usuario, distinguiendo falta de permiso de error real. */
  get mensajeUsuario(): string {
    if (this.status === 403) {
      return `Sin permiso para leer "${this.tabla}". Pida al administrador acceso de lectura a esa tabla desde el módulo de listados.`
    }
    if (this.status === 401) {
      return "La sesión expiró. Vuelva a iniciar sesión e intente de nuevo."
    }
    return `No se pudo leer "${this.tabla}": ${this.message}`
  }
}

type AplicarFiltros = (consulta: any) => any

/**
 * Lee una tabla completa paginando de 1000 en 1000.
 *
 * `aplicar` recibe la consulta para añadir filtros y orden. Se invoca en cada
 * página, así que debe ser pura.
 */
export async function seleccionarTodo<T = Record<string, unknown>>(
  tabla: string,
  aplicar: AplicarFiltros = (q) => q,
  opciones: { select?: string; maximo?: number } = {},
): Promise<T[]> {
  const campos = opciones.select ?? "*"
  const acumulado: T[] = []
  let desde = 0

  for (;;) {
    const consulta = aplicar(db.from(tabla).select(campos)).range(desde, desde + TAMANO_PAGINA - 1)
    const { data, error } = await consulta

    if (error) {
      throw new ErrorConsulta(tabla, error.message ?? "error desconocido", error.status)
    }

    const pagina = (data ?? []) as T[]
    acumulado.push(...pagina)

    if (pagina.length < TAMANO_PAGINA) break
    if (opciones.maximo && acumulado.length >= opciones.maximo) break
    desde += TAMANO_PAGINA
  }

  return opciones.maximo ? acumulado.slice(0, opciones.maximo) : acumulado
}

/** Variante para una sola página, cuando el volumen es acotado por diseño. */
export async function seleccionar<T = Record<string, unknown>>(
  tabla: string,
  aplicar: AplicarFiltros = (q) => q,
  select = "*",
): Promise<T[]> {
  const { data, error } = await aplicar(db.from(tabla).select(select))
  if (error) throw new ErrorConsulta(tabla, error.message ?? "error desconocido", error.status)
  return (data ?? []) as T[]
}

/**
 * Lee una tabla que el reporte puede omitir: si el usuario no tiene permiso
 * sobre ella devuelve `null` en lugar de abortar.
 *
 * Sirve para informes que agregan datos de varios dominios. Quien los use debe
 * rotular el resultado como parcial cuando reciba `null`; un total al que le
 * falta un sumando sin avisar sería peor que no generar el archivo.
 */
export async function seleccionarSiHayPermiso<T = Record<string, unknown>>(
  tabla: string,
  aplicar: AplicarFiltros = (q) => q,
  opciones: { select?: string; maximo?: number } = {},
): Promise<T[] | null> {
  try {
    return await seleccionarTodo<T>(tabla, aplicar, opciones)
  } catch (error) {
    if (error instanceof ErrorConsulta && error.status === 403) return null
    throw error
  }
}

// ─── Periodos ─────────────────────────────────────────────────────────────────

/**
 * Catálogo de meses de trabajo. Se lee de la tabla `meses`, nunca se arma el id
 * a mano: el formato real es "YYYY-M" sin relleno de ceros y construirlo en
 * código ha producido meses fantasma.
 */
export async function cargarMeses(): Promise<MesRef[]> {
  const filas = await seleccionarTodo<{
    id: string
    name: string
    year: number
    month: number
    status: string
  }>("meses", (q) => q.order("year", { ascending: false }).order("month", { ascending: false }))

  return filas.map((m) => ({
    id: m.id,
    nombre: m.name,
    anio: m.year,
    mes: m.month,
    activo: m.status === "active",
  }))
}

export function opcionesDeMeses(meses: MesRef[]): OpcionFiltro[] {
  return meses.map((m) => ({
    value: m.id,
    label: m.activo ? `${m.nombre} (activo)` : m.nombre,
  }))
}

export function opcionesDeAnios(meses: MesRef[]): OpcionFiltro[] {
  const anios = [...new Set(meses.map((m) => m.anio))].sort((a, b) => b - a)
  return anios.map((a) => ({ value: String(a), label: String(a) }))
}

/** Resuelve el mes elegido en un filtro, con el mes activo como respaldo. */
export function mesDelFiltro(
  filtros: Record<string, string>,
  meses: MesRef[],
  mesActivo: MesRef | null,
  idFiltro = "mes",
): MesRef | null {
  const id = filtros[idFiltro]
  if (id) return meses.find((m) => m.id === id) ?? null
  return mesActivo
}

export function mesesDelAnio(meses: MesRef[], anio: number): MesRef[] {
  return meses.filter((m) => m.anio === anio).sort((a, b) => a.mes - b.mes)
}

/** Rango de fechas de un filtro `rangoFechas` ("desde" y "hasta" por id). */
export function rangoDelFiltro(
  filtros: Record<string, string>,
  idFiltro = "rango",
): { desde?: string; hasta?: string } {
  return {
    desde: filtros[`${idFiltro}_desde`] || undefined,
    hasta: filtros[`${idFiltro}_hasta`] || undefined,
  }
}

/** Aplica un rango de fechas a una consulta si hay valores. */
export function aplicarRango(consulta: any, columna: string, rango: { desde?: string; hasta?: string }) {
  let q = consulta
  if (rango.desde) q = q.gte(columna, rango.desde)
  if (rango.hasta) q = q.lte(columna, rango.hasta)
  return q
}

// ─── Derivaciones compartidas ─────────────────────────────────────────────────

/**
 * Edad a partir de la fecha de nacimiento, con la misma fórmula que los
 * servicios de censo (`censo-ninos-service.ts:38-50`). La columna `edad` de la
 * base puede estar desactualizada, así que los reportes la recalculan.
 */
export function calcularEdad(fechaNacimiento: unknown): number | null {
  if (typeof fechaNacimiento !== "string" || !fechaNacimiento) return null
  const nacimiento = new Date(`${fechaNacimiento.slice(0, 10)}T12:00:00`)
  if (isNaN(nacimiento.getTime())) return null

  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const difMes = hoy.getMonth() - nacimiento.getMonth()
  if (difMes < 0 || (difMes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return edad < 0 ? null : edad
}

/** Busca la etiqueta legible de un valor de enum; devuelve el valor si no está. */
export function etiqueta(mapa: Record<string, string>, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return ""
  const clave = String(valor)
  return mapa[clave] ?? clave
}

// ─── Hijos del censo ──────────────────────────────────────────────────────────

/**
 * La columna `hijos` del censo es un jsonb `[{ nombre, edad }]`. En un listado
 * no sirve como texto: hay que poder filtrar por la edad de los hijos, así que
 * se reparte en una pareja de columnas por hijo más tres columnas de resumen.
 */
export interface HijoCenso {
  nombre: string
  edad: number | null
}

export function hijosDeFila(fila: Record<string, unknown>): HijoCenso[] {
  const crudo = fila.hijos
  if (!Array.isArray(crudo)) return []

  return crudo
    .map((item) => {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>
        // Ojo: Number(null) y Number("") dan 0, que es una edad válida de un
        // bebé. Hay que descartar el vacío antes de convertir.
        const sinEdad = obj.edad === null || obj.edad === undefined || obj.edad === ""
        const edad = sinEdad ? NaN : Number(obj.edad)
        return {
          nombre: String(obj.nombre ?? "").trim(),
          edad: Number.isFinite(edad) ? edad : null,
        }
      }
      return { nombre: String(item ?? "").trim(), edad: null }
    })
    .filter((hijo) => hijo.nombre !== "" || hijo.edad !== null)
}

/** Cuántas columnas de hijo hacen falta para no recortar a ninguna familia. */
export function maximoDeHijos(filas: Record<string, unknown>[]): number {
  return filas.reduce((maximo, fila) => Math.max(maximo, hijosDeFila(fila).length), 0)
}

/**
 * Añade a la fila `hijo_1_nombre`, `hijo_1_edad`, … y el resumen que permite
 * filtrar por edades dentro del propio Excel.
 */
export function expandirHijos<T extends Record<string, unknown>>(fila: T): T {
  const hijos = hijosDeFila(fila)
  const edades = hijos.map((h) => h.edad).filter((e): e is number => e !== null)
  const expandida: Record<string, unknown> = {
    ...fila,
    hijos_total: hijos.length,
    hijo_edad_menor: edades.length > 0 ? Math.min(...edades) : "",
    hijo_edad_mayor: edades.length > 0 ? Math.max(...edades) : "",
  }

  hijos.forEach((hijo, i) => {
    expandida[`hijo_${i + 1}_nombre`] = hijo.nombre
    expandida[`hijo_${i + 1}_edad`] = hijo.edad ?? ""
  })

  return expandida as T
}

/** ¿La persona tiene al menos un hijo cuya edad caiga en el rango indicado? */
export function tieneHijoEnRango(
  fila: Record<string, unknown>,
  desde?: string,
  hasta?: string,
): boolean {
  if (!desde && !hasta) return true

  const minimo = desde ? Number(desde) : Number.NEGATIVE_INFINITY
  const maximo = hasta ? Number(hasta) : Number.POSITIVE_INFINITY

  return hijosDeFila(fila).some(
    (hijo) => hijo.edad !== null && hijo.edad >= minimo && hijo.edad <= maximo,
  )
}

/**
 * Deduplica registros de persona por cédula respetando el orden del array:
 * el primero gana. Es el algoritmo de los módulos de bautizo y matrimonio
 * (`app/dashboard/bautizo/page.tsx:126-133`).
 *
 * Los registros marcados como manuales nunca se descartan, y las cédulas
 * vacías no colapsan entre sí.
 */
export function dedupPorCedula<T extends { cedula?: string | null; fuente?: string }>(
  filas: T[],
  opciones: { claveExtra?: (fila: T) => string | null | undefined } = {},
): T[] {
  const vistas = new Set<string>()
  const salida: T[] = []

  for (const fila of filas) {
    if (fila.fuente === "manual") {
      salida.push(fila)
      continue
    }
    const cedula = (fila.cedula ?? "").trim()
    if (cedula && vistas.has(cedula)) continue

    const extra = opciones.claveExtra?.(fila)
    if (extra) vistas.add(String(extra).trim())
    if (cedula) vistas.add(cedula)
    salida.push(fila)
  }

  return salida
}

// ─── Catálogos de etiquetas ───────────────────────────────────────────────────

/**
 * Ministerios. La columna discriminadora se llama `modulo` en
 * `asistencia_servidores`, `cronograma_servicio`, `gestion_atrasados` y
 * `requerimientos_bienes_servicios`, y `modulo_origen` en `mensajes_citaciones`.
 * Etiquetas tomadas de `app/dashboard/resumen-mensual/page.tsx:40-54`.
 */
export const MINISTERIOS: Record<string, string> = {
  administracion: "Administración",
  alabanza: "Alabanza",
  celulas: "Células",
  comunicacion: "Comunicación",
  discipulado: "Discipulado",
  herederos: "Herederos",
  hombres: "Hombres",
  intercesion: "Intercesión",
  jovenes: "Jóvenes",
  mdg: "Mujeres de Gracia",
  pastoral: "Pastoral",
  protocolo: "Protocolo",
  redil: "Redil",
  "proyecto-mario": "Proyecto Mario",
}

export function opcionesMinisterios(): OpcionFiltro[] {
  return Object.entries(MINISTERIOS).map(([value, label]) => ({ value, label }))
}

/** Fuentes de censo, con la etiqueta que ya usaba el exportador anterior. */
export const FUENTES_CENSO: Record<string, string> = {
  protocolo: "Protocolo",
  mdg: "MDG",
  jovenes: "Jóvenes",
  ninos: "Niños",
  manual: "Manual",
}

/** Estados de asistencia de los ciclos de formación. */
export const ESTADOS_ASISTENCIA: Record<string, string> = {
  A: "Asistió",
  J: "Justificó",
  F: "Falta",
  AT: "Atraso +30min",
}

/** Estados de `asistencia_servidores.estado`. */
export const ESTADOS_SERVIDOR: Record<string, string> = {
  asistio: "Asistió",
  falto: "Faltó",
  justifico: "Justificó",
  atrasado: "Atrasado",
  pendiente: "Pendiente",
}

/** Estatus de participante en ciclos de formación. */
export const ESTATUS_PARTICIPANTE: Record<string, string> = {
  aprobado: "Aprobado",
  reprobado: "Reprobado",
  en_curso: "En curso",
  activo: "En curso",
}
