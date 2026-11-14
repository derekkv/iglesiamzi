/**
 * Catálogo de tipos de ofrenda del módulo de diezmos.
 *
 * Fuente única de verdad: estos valores los usan la pantalla de diezmos, el
 * endpoint que sincroniza el ingreso vinculado, el detector de discrepancias,
 * el resumen de ingresos y egresos y los informes de listados. Antes estaban
 * repetidos en seis archivos y bastaba olvidar uno para que un tipo nuevo
 * quedara sin etiqueta o, peor, sin su ingreso en la contabilidad.
 *
 * Este archivo no importa nada a propósito: lo cargan tanto componentes de
 * cliente como rutas de servidor.
 *
 * Al añadir un tipo hay que ejecutar también `sql/diezmos_tipos_ofrenda.sql`,
 * porque la columna `tipo_ofrenda` puede tener una restricción CHECK que
 * rechace los valores nuevos.
 */

export type TipoOfrenda =
  | "diezmo"
  | "primicia"
  | "diezmo_especial"
  | "actividad_redil"
  | "entradas_eventos"
  | "seminarios"
  | "otras_actividades"

export type GrupoOfrenda = "ofrendas" | "actividades"

export interface DefinicionTipoOfrenda {
  valor: TipoOfrenda
  /** Etiqueta visible. También se escribe en el detalle del ingreso vinculado. */
  label: string
  /** Etiqueta corta para las tarjetas de totales. */
  corto: string
  grupo: GrupoOfrenda
  /** `categoria_principal` con la que el movimiento entra a `ingresos`. */
  categoriaIngreso: string
  /** Clases del badge en la tabla. */
  badge: string
  /** Clase del color del monto en las tarjetas de totales. */
  monto: string
  /** Clase de color de la barra en los gráficos de distribución. */
  barra: string
}

export const GRUPOS_OFRENDA: Record<GrupoOfrenda, string> = {
  ofrendas: "Diezmos y ofrendas",
  actividades: "Actividades",
}

/** Categoría contable de los diezmos, primicias y ofrendas especiales. */
export const CATEGORIA_OFRENDAS = "Ingresos x Ofrendas, Diezmo y Primicias"

/**
 * Categoría contable de las actividades. Conviene añadirla al catálogo de
 * categorías principales del módulo de ingresos y egresos para que aparezca en
 * sus listas desplegables; la columna es texto libre, así que el movimiento se
 * registra igual si no está en el catálogo.
 */
export const CATEGORIA_ACTIVIDADES = "Ingresos x Actividades"

export const TIPOS_OFRENDA: DefinicionTipoOfrenda[] = [
  {
    valor: "diezmo",
    label: "Diezmo",
    corto: "Diezmo",
    grupo: "ofrendas",
    categoriaIngreso: CATEGORIA_OFRENDAS,
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    monto: "text-blue-600",
    barra: "bg-blue-500",
  },
  {
    valor: "primicia",
    label: "Primicia",
    corto: "Primicia",
    grupo: "ofrendas",
    categoriaIngreso: CATEGORIA_OFRENDAS,
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    monto: "text-purple-600",
    barra: "bg-purple-500",
  },
  {
    valor: "diezmo_especial",
    label: "Ofrenda Especial",
    corto: "Ofrenda Esp.",
    grupo: "ofrendas",
    categoriaIngreso: CATEGORIA_OFRENDAS,
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    monto: "text-rose-600",
    barra: "bg-rose-500",
  },
  {
    valor: "actividad_redil",
    label: "Actividad Redil",
    corto: "Act. Redil",
    grupo: "actividades",
    categoriaIngreso: CATEGORIA_ACTIVIDADES,
    badge: "bg-teal-100 text-teal-800 border-teal-200",
    monto: "text-teal-600",
    barra: "bg-teal-500",
  },
  {
    valor: "entradas_eventos",
    label: "Entradas a Eventos",
    corto: "Entradas Eventos",
    grupo: "actividades",
    categoriaIngreso: CATEGORIA_ACTIVIDADES,
    badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
    monto: "text-indigo-600",
    barra: "bg-indigo-500",
  },
  {
    valor: "seminarios",
    label: "Seminarios",
    corto: "Seminarios",
    grupo: "actividades",
    categoriaIngreso: CATEGORIA_ACTIVIDADES,
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    monto: "text-amber-600",
    barra: "bg-amber-500",
  },
  {
    valor: "otras_actividades",
    label: "Otras Ofrendas por Actividades",
    corto: "Otras Actividades",
    grupo: "actividades",
    categoriaIngreso: CATEGORIA_ACTIVIDADES,
    badge: "bg-cyan-100 text-cyan-800 border-cyan-200",
    monto: "text-cyan-600",
    barra: "bg-cyan-500",
  },
]

/** Los tres tipos que existían antes de los de actividades. */
export const TIPOS_HISTORICOS: TipoOfrenda[] = ["diezmo", "primicia", "diezmo_especial"]

const POR_VALOR = new Map(TIPOS_OFRENDA.map((t) => [t.valor, t]))

/**
 * Definición de un tipo. Un registro antiguo puede tener `tipo_ofrenda` nulo:
 * en ese caso cuenta como diezmo, el mismo criterio que usa la pantalla.
 */
export function tipoOfrenda(valor: unknown): DefinicionTipoOfrenda {
  if (!valor) return POR_VALOR.get("diezmo")!
  return POR_VALOR.get(String(valor) as TipoOfrenda) ?? POR_VALOR.get("diezmo")!
}

export function etiquetaTipoOfrenda(valor: unknown): string {
  return tipoOfrenda(valor).label
}

/** Normaliza a un valor conocido del catálogo. */
export function valorTipoOfrenda(valor: unknown): TipoOfrenda {
  return tipoOfrenda(valor).valor
}

export function tiposDelGrupo(grupo: GrupoOfrenda): DefinicionTipoOfrenda[] {
  return TIPOS_OFRENDA.filter((t) => t.grupo === grupo)
}

/** Mapa valor → etiqueta, para los informes y los filtros. */
export const ETIQUETAS_TIPO_OFRENDA: Record<string, string> = Object.fromEntries(
  TIPOS_OFRENDA.map((t) => [t.valor, t.label]),
)
