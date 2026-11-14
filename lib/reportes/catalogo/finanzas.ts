/**
 * Reportes financieros del módulo de listados.
 *
 * Reglas de coherencia que estos reportes replican de `.agents/inventario/03-finanzas.md`
 * (sección "Reglas de coherencia para reportes") y del código del módulo:
 *
 * 1. **Total de ingresos del mes = tres sumandos y ningún otro.**
 *    `ingresos` (todas las filas del `mes_id`, sin excluir por `concepto`)
 *    + `ofrendas_celulas` con `recibido = true` + `alfoli` del mes.
 *    `diezmos`, `caja_chica_movimientos` y los abonos de eventos **ya están
 *    dentro** de `ingresos` como `auto-diezmo`, `auto-caja-chica` y
 *    `auto-evento`: sumarlos otra vez es doble conteo.
 *    (`ingresos-egresos/page.tsx:990`, `resumen-mensual/page.tsx:378-379`,
 *    `presupuesto-anual/page.tsx:144,158,172`.)
 *
 * 2. **Total de egresos del mes = un solo sumando:** `egresos` del `mes_id`.
 *    `pago_diario`, `nomina` y `pasivos_abonos` ya están espejados ahí como
 *    `auto-pago-diario`, `auto-nomina` y `pasivo`. `payment_rows` y
 *    `pasivos.monto_total` no son flujo de caja, y `caja_chica_arqueos` es
 *    conteo físico. Ninguno entra a un total.
 *
 * 3. **Tres anclajes de periodo distintos.** `ingresos`, `egresos`, `diezmos`,
 *    `pago_diario`, `nomina` y las dos tablas de caja chica se recortan por
 *    `mes_id`; `alfoli` y `ofrendas_celulas` por `mes` + `anio` numéricos;
 *    `pasivos`, `pasivos_abonos` y el flujo de pagos solo tienen `fecha`.
 *    El `mes_id` **nunca** se construye a mano: `"2026-1"` no tiene cero de
 *    relleno (`contexts/month-context.tsx:65`), así que siempre se toma de la
 *    tabla `meses` a través de `ctx.meses` / `ctx.mesActivo`.
 *
 * 4. **Las hojas de detalle de un módulo llevan subtotal del módulo**, nunca un
 *    total general: su importe ya está contado en `ingresos` o en `egresos`.
 *
 * Nota de estructura: en los reportes con resumen, la hoja principal es el
 * **detalle** (es la única que respeta la selección de columnas del usuario) y
 * el resumen va en la hoja siguiente.
 *
 * Importes: siempre `Number(x || 0)` vía `monto()`. La columna `numeric` puede
 * llegar como texto y el módulo operativo tiene un precedente de concatenación
 * (`ingresos-egresos/page.tsx:588-596`, suma sin `Number()` bajo `@ts-ignore`).
 * Las comparaciones de importes usan tolerancia, nunca igualdad exacta.
 *
 * Columnas DUDOSAS (no verificables sin DDL, señaladas también en el
 * inventario): `ingresos.updated_at` / `egresos.updated_at` y cualquier columna
 * de autoría en esas dos tablas —no se exportan—; `payment_rows.created_at`,
 * que el servicio nunca escribe ni lee, y que aquí queda como opcional.
 */

import { DENOMINACIONES } from "@/lib/mod/caja-chica-service"
import {
  calcAbonado,
  calcSaldo,
  esVencido,
  type Pasivo,
  type PasivoAbono,
} from "@/lib/mod/pasivos-service"
import { todayEcuador } from "@/lib/timezone"
import {
  GRUPOS_OFRENDA,
  TIPOS_OFRENDA,
  etiquetaTipoOfrenda,
  tipoOfrenda,
  tiposDelGrupo,
  valorTipoOfrenda,
  type GrupoOfrenda,
} from "@/lib/mod/diezmos-tipos"

/** Orden en que se muestran los grupos de tipos de ofrenda. */
const GRUPOS_ORDENADOS: GrupoOfrenda[] = ["ofrendas", "actividades"]

import {
  aplicarRango,
  cargarMeses,
  etiqueta,
  mesDelFiltro,
  mesesDelAnio,
  rangoDelFiltro,
  seleccionarSiHayPermiso,
  seleccionarTodo,
} from "../data"
import { aNumero, hojaDesdeFilas, hojaResumen } from "../excel"
import { ErrorReporte } from "../ejecutar"
import type {
  ColumnaReporte,
  ContextoReporte,
  DefinicionReporte,
  MesRef,
  TipoColumna,
  ValorCelda,
} from "../types"

type Fila = Record<string, unknown>

/** Tolerancia para comparar importes, como `esVencido` (`pasivos-service.ts:72`). */
const TOLERANCIA = 0.01

// ─── Módulos que habilitan cada tabla ─────────────────────────────────────────
// Copiados de `lib/module-table-map.ts`. El módulo `listados` NO aparece en
// ninguna tabla financiera y eso es deliberado: los datos son sensibles. Por eso
// estos reportes solo los ve quien tenga permiso en el módulo dueño.
// Cuando un reporte cruza varias tablas se declara la unión de sus módulos para
// no ocultarlo a quien sí puede leer lo principal; si le falta permiso sobre una
// de las tablas, `ErrorConsulta` explica cuál es (`lib/reportes/data.ts:33-42`).

/** `module-table-map.ts:88-90`. */
const MODULOS_INGRESOS = [
  "ingresos_egresos",
  "diezmos",
  "caja_chica",
  "control_mensual",
  "eventos_encuentro",
  "presupuesto_anual",
  "resumen-pastoral",
]

/** `module-table-map.ts:91-93`. */
const MODULOS_EGRESOS = [
  "ingresos_egresos",
  "flujo_pago",
  "pago_diario",
  "caja_chica",
  "control_mensual",
  "presupuesto_anual",
  "resumen-pastoral",
  "pasivos",
]

/** `module-table-map.ts:105-107`. */
const MODULOS_ALFOLI = ["administracion", "control_mensual", "presupuesto_anual", "resumen-pastoral"]

/** `module-table-map.ts:108-110`. */
const MODULOS_OFRENDAS = [
  "ofrenda-celulas",
  "celulas",
  "control_mensual",
  "presupuesto_anual",
  "resumen-pastoral",
]

/**
 * Módulos de los reportes que agregan ingresos y egresos.
 *
 * Es la INTERSECCIÓN de lo que permiten `ingresos` y `egresos`, no la unión:
 * basta tener uno de estos módulos para abrir el reporte, así que un módulo que
 * solo autorice una de las dos tablas produciría un 403 al generarlo. Alfolí y
 * ofrendas de células se leen de forma opcional (ver `seleccionarSiHayPermiso`)
 * y el resumen se rotula como parcial si el usuario no tiene acceso a ellas.
 */
const MODULOS_FLUJO = MODULOS_INGRESOS.filter((modulo) => MODULOS_EGRESOS.includes(modulo))

// ─── Utilidades de importe ────────────────────────────────────────────────────

/** Importe tolerante a `numeric` devuelto como texto o nulo. */
function monto(valor: unknown): number {
  return aNumero(valor || 0)
}

function sumar(filas: Fila[], clave: string): number {
  return filas.reduce((total, fila) => total + monto(fila[clave]), 0)
}

/** Suma por grupo, de mayor a menor importe. */
function agrupar(filas: Fila[], clave: (fila: Fila) => string, columnaValor: string): FilaResumen[] {
  const mapa = new Map<string, number>()
  for (const fila of filas) {
    const grupo = clave(fila)
    mapa.set(grupo, (mapa.get(grupo) ?? 0) + monto(fila[columnaValor]))
  }
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([grupo, total]) => dinero(grupo, total))
}

// ─── Utilidades de hoja de resumen ────────────────────────────────────────────

type FilaResumen = [string, ValorCelda, TipoColumna?]

const dinero = (rotulo: string, valor: number): FilaResumen => [rotulo, valor, "moneda"]
const conteo = (rotulo: string, valor: number): FilaResumen => [rotulo, valor, "numero"]
const texto = (rotulo: string, valor: string): FilaResumen => [rotulo, valor]

// ─── Periodo ──────────────────────────────────────────────────────────────────

/**
 * Mes de trabajo del filtro, con el mes activo como respaldo. El `mes_id` sale
 * siempre de la tabla `meses`, nunca de `${anio}-${mes}` armado en código.
 */
function mesRequerido(ctx: ContextoReporte, idFiltro = "mes"): MesRef {
  const mes = mesDelFiltro(ctx.filtros, ctx.meses, ctx.mesActivo, idFiltro)
  if (!mes) {
    throw new ErrorReporte(
      "Seleccione un mes de trabajo. Estos reportes se anclan a la tabla de meses, no a la fecha de cada fila.",
    )
  }
  return mes
}

const FILTRO_MES = { id: "mes", label: "Mes de trabajo", tipo: "mes" as const }

const FILTRO_MES_REQUERIDO = { ...FILTRO_MES, requerido: true }

function movimientosDelMes(tabla: "ingresos" | "egresos", mesId: string): Promise<Fila[]> {
  return seleccionarTodo<Fila>(tabla, (q: any) => q.eq("mes_id", mesId).order("fecha", { ascending: true }))
}

/** `alfoli` y `ofrendas_celulas` se recortan por `mes` + `anio` numéricos. */
function alfoliDelMes(mes: MesRef): Promise<Fila[]> {
  return seleccionarTodo<Fila>("alfoli", (q: any) =>
    q.eq("mes", mes.mes).eq("anio", mes.anio).order("fecha", { ascending: true }),
  )
}

function ofrendasDelMes(mes: MesRef): Promise<Fila[]> {
  return seleccionarTodo<Fila>("ofrendas_celulas", (q: any) =>
    q
      .eq("mes", mes.mes)
      .eq("anio", mes.anio)
      .order("fecha", { ascending: true })
      .order("celula_nombre", { ascending: true }),
  )
}

/**
 * Versiones opcionales para los informes agregados: el módulo de ingresos y
 * egresos no da acceso a `alfoli` ni a `ofrendas_celulas`, así que esos dos
 * sumandos se omiten con aviso en vez de impedir el reporte completo.
 */
function alfoliDelMesOpcional(mes: MesRef): Promise<Fila[] | null> {
  return seleccionarSiHayPermiso<Fila>("alfoli", (q: any) =>
    q.eq("mes", mes.mes).eq("anio", mes.anio).order("fecha", { ascending: true }),
  )
}

function ofrendasDelMesOpcional(mes: MesRef): Promise<Fila[] | null> {
  return seleccionarSiHayPermiso<Fila>("ofrendas_celulas", (q: any) =>
    q.eq("mes", mes.mes).eq("anio", mes.anio).order("fecha", { ascending: true }),
  )
}

const recibidas = (filas: Fila[]) => filas.filter((f) => f.recibido === true)

// ─── Clasificación de origen y etiquetas ──────────────────────────────────────

/** Etiquetas de origen por `concepto` (inventario, "Clasificación de filas automáticas"). */
const ORIGEN_POR_CONCEPTO: Record<string, string> = {
  "auto-diezmo": "Automático — Diezmos (transferencia)",
  "auto-caja-chica": "Automático — Caja chica",
  "auto-evento": "Automático — Eventos",
  "auto-pago-diario": "Automático — Pago diario",
  "auto-nomina": "Automático — Nómina",
  pasivo: "Automático — Abono a pasivo",
  bb: "Manual",
  "edit we": "Manual (editado)",
}

/**
 * Respaldo por `categoria_principal`, que es el criterio robusto cuando el
 * marcador se perdió: editar una fila a mano escribe `concepto = "edit we"` y
 * solo `auto-diezmo` se preserva (`lib/storage.ts:208`, `:251`). Las categorías
 * las escriben los sincronizadores (`diezmos/route.ts:56-66`,
 * `caja-chica/route.ts:40-50`, `eventos/route.ts:40-50`,
 * `nomina/route.ts:32-45`, `pasivos/route.ts:67-80`).
 */
const ORIGEN_POR_CATEGORIA: Record<string, string> = {
  "PAGO DE NOMINA": "Automático — Nómina",
  "PAGO DE PASIVOS": "Automático — Abono a pasivo",
  "Caja Chica": "Automático — Caja chica",
  "Ingresos x Eventos": "Automático — Eventos",
  "Ingresos x Ofrendas, Diezmo y Primicias": "Automático — Diezmos (transferencia)",
}

/**
 * Origen de una fila de `ingresos` o `egresos`.
 *
 * `concepto` es el marcador real (no existe columna `origen` ni booleano
 * `auto`), pero no es confiable en filas editadas: ahí se usa la categoría.
 */
function origenDeMovimiento(fila: Fila): string {
  const concepto = String(fila.concepto ?? "").trim()
  const categoria = String(fila.categoria_principal ?? "").trim()
  const porConcepto = ORIGEN_POR_CONCEPTO[concepto]

  // Marcador automático intacto: es la clasificación más fiable.
  if (porConcepto && concepto !== "bb" && concepto !== "edit we") return porConcepto

  // Marcador perdido o ausente: la categoría delata el módulo de origen.
  if (concepto !== "bb") {
    const porCategoria = ORIGEN_POR_CATEGORIA[categoria]
    if (porCategoria) return `${porCategoria} (marcador editado)`
  }

  if (porConcepto) return porConcepto
  return "Sin clasificar"
}

/**
 * Ministerio normalizado. En datos reales conviven `"Administración"` (diezmos,
 * eventos, nómina, pasivos) y `"Administracion"` sin tilde (caja chica,
 * `caja-chica/route.ts:44`). Sin normalizar, el subtotal se parte en dos.
 */
function ministerioNormalizado(valor: unknown): string {
  const nombre = String(valor ?? "").trim()
  if (nombre === "") return "Sin ministerio"
  if (nombre === "Administracion") return "Administración"
  return nombre
}

function categoriaNormalizada(valor: unknown): string {
  const nombre = String(valor ?? "").trim()
  return nombre === "" ? "Sin categoría" : nombre
}

const SI_NO = (valor: unknown): string => (valor === true ? "Sí" : "No")

// ══════════════════════════════════════════════════════════════════════════════
// 1. Ingresos y egresos del mes
// ══════════════════════════════════════════════════════════════════════════════

const COLUMNAS_MOVIMIENTOS: ColumnaReporte<Fila>[] = [
  { key: "tipo", label: "Movimiento", ancho: 12 },
  { key: "fecha", label: "Fecha", tipo: "fecha" },
  {
    key: "origen",
    label: "Origen",
    ancho: 34,
    ayuda: "Derivado de `concepto`, con `categoria_principal` como respaldo si la fila fue editada a mano.",
  },
  {
    key: "categoria_principal",
    label: "Categoría principal",
    ancho: 30,
    valor: (f) => categoriaNormalizada(f.categoria_principal),
  },
  {
    key: "ministerio",
    label: "Ministerio",
    ancho: 22,
    ayuda: 'Se normaliza "Administracion" sin tilde a "Administración".',
    valor: (f) => ministerioNormalizado(f.ministerio),
  },
  { key: "detalle", label: "Detalle", ancho: 42 },
  {
    key: "observacion",
    label: "Centro de Gasto",
    ancho: 28,
    ayuda: "La columna se llama `observacion`; la UI del módulo la rotula Centro de Gasto.",
  },
  { key: "metodo_pago", label: "Método de pago", ancho: 18 },
  { key: "estado", label: "Estado", ancho: 14 },
  {
    key: "valorIngreso",
    label: "Ingreso",
    tipo: "moneda",
    totalizar: true,
    valor: (f) => (f.tipo === "Ingreso" ? monto(f.monto) : ""),
  },
  {
    key: "valorEgreso",
    label: "Egreso",
    tipo: "moneda",
    totalizar: true,
    valor: (f) => (f.tipo === "Egreso" ? monto(f.monto) : ""),
  },
  {
    key: "monto",
    label: "Valor (sin signo)",
    tipo: "moneda",
    opcional: true,
    ayuda: "No se totaliza: mezclaría ingresos con egresos. Use las columnas Ingreso y Egreso.",
    valor: (f) => monto(f.monto),
  },
  {
    key: "concepto",
    label: "Marcador (concepto)",
    ancho: 20,
    opcional: true,
    ayuda: "Valor crudo de la columna que marca el origen.",
  },
  { key: "mes_id", label: "Mes (ID)", ancho: 12, opcional: true },
  { key: "id", label: "N°", tipo: "numero", ancho: 10, opcional: true },
  { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
]

const NOTAS_FLUJO = [
  "Total de ingresos = ingresos del mes + ofrendas de células marcadas como recibidas + alfolí del mes. No se suma nada más.",
  "Las ofrendas de células solo cuentan si están marcadas como recibidas; las pendientes quedan fuera del total.",
  "El alfolí se suma completo, sin exigir la marca de recibido: es el criterio del código actual (resumen-mensual, ingresos-egresos y presupuesto anual).",
  "Diezmos por transferencia, gestión de efectivo de caja chica y abonos de eventos ya están dentro de la tabla de ingresos; volver a sumarlos sería doble conteo.",
  "Los diezmos en efectivo no llegan a la tabla de ingresos, así que no están en este total. Use el reporte de diezmos y ofrendas para verlos.",
  "Total de egresos = solo la tabla de egresos. Pago diario, nómina y abonos a pasivos ya están espejados ahí.",
  "No entran a ningún total: arqueos de caja chica (conteo físico), monto total de pasivos (deuda) y flujo de pagos (registro paralelo).",
]

const ingresosEgresosMes: DefinicionReporte<Fila> = {
  id: "finanzas-ingresos-egresos-mes",
  grupo: "Finanzas",
  titulo: "Ingresos y egresos del mes",
  descripcion:
    "Detalle combinado de ingresos y egresos del mes, con el origen de cada fila, más una hoja de resumen con el total de ingresos de tres sumandos y el total de egresos de un solo sumando.",
  tablas: ["ingresos", "egresos", "ofrendas_celulas", "alfoli"],
  modulos: MODULOS_FLUJO,
  hoja: "Detalle del mes",
  archivo: "Finanzas_Ingresos_Egresos",
  filtros: [
    {
      ...FILTRO_MES_REQUERIDO,
      ayuda: "El recorte es por `mes_id`, tomado de la tabla de meses. La fecha de cada fila es dato, no filtro.",
    },
    {
      id: "movimiento",
      label: "Tipo de movimiento",
      tipo: "opcion",
      opcionTodos: "Ingresos y egresos",
      opciones: [
        { value: "Ingreso", label: "Solo ingresos" },
        { value: "Egreso", label: "Solo egresos" },
      ],
      ayuda: "La hoja de resumen siempre reporta el mes completo, aunque el detalle se recorte.",
    },
  ],
  columnas: COLUMNAS_MOVIMIENTOS,
  notas: NOTAS_FLUJO,
  obtener: async (ctx) => {
    const mes = mesRequerido(ctx)

    const [ingresos, egresos, ofrendas, alfoli] = await Promise.all([
      movimientosDelMes("ingresos", mes.id),
      movimientosDelMes("egresos", mes.id),
      ofrendasDelMesOpcional(mes),
      alfoliDelMesOpcional(mes),
    ])

    // Sin permiso sobre una tabla opcional el sumando no se omite en silencio:
    // cambia el rótulo del total y se emite una advertencia.
    const sinOfrendas = ofrendas === null
    const sinAlfoli = alfoli === null
    const ofrendasFilas = ofrendas ?? []
    const alfoliFilas = alfoli ?? []
    const parcial = sinOfrendas || sinAlfoli

    const ofrendasRecibidas = recibidas(ofrendasFilas)
    const totalIngresosTabla = sumar(ingresos, "monto")
    const totalOfrendas = sumar(ofrendasRecibidas, "valor")
    const totalAlfoli = sumar(alfoliFilas, "valor")
    const totalIngresos = totalIngresosTabla + totalOfrendas + totalAlfoli
    const totalEgresos = sumar(egresos, "monto")

    const marcadas = (filas: Fila[]) =>
      filas.map((fila) => ({ ...fila, origen: origenDeMovimiento(fila) }))

    const combinados: Fila[] = [
      ...marcadas(ingresos).map((f) => ({ ...f, tipo: "Ingreso" })),
      ...marcadas(egresos).map((f) => ({ ...f, tipo: "Egreso" })),
    ]

    const detalle: Fila[] = combinados
      .filter((f) => !ctx.filtros.movimiento || f.tipo === ctx.filtros.movimiento)
      .sort(
        (a, b) =>
          String(a.fecha ?? "").localeCompare(String(b.fecha ?? "")) ||
          String(a.tipo).localeCompare(String(b.tipo)),
      )

    const resumen = hojaResumen(
      "Resumen del mes",
      [
        {
          titulo: `Mes ${mes.nombre}`,
          filas: [
            texto("Mes (ID)", mes.id),
            texto("Estado del mes", mes.activo ? "Activo" : "Cerrado"),
            conteo("Filas de ingresos", ingresos.length),
            conteo("Filas de egresos", egresos.length),
          ],
        },
        {
          titulo: parcial
            ? "Total de ingresos — PARCIAL, falta algún sumando por permisos"
            : "Total de ingresos — tres sumandos",
          filas: [
            dinero("1. Ingresos registrados (tabla ingresos, todas las filas)", totalIngresosTabla),
            sinOfrendas
              ? texto("2. Ofrendas de células recibidas", "sin acceso a la tabla: NO incluido")
              : dinero("2. Ofrendas de células recibidas", totalOfrendas),
            sinAlfoli
              ? texto("3. Alfolí del mes", "sin acceso a la tabla: NO incluido")
              : dinero("3. Alfolí del mes", totalAlfoli),
            dinero(
              parcial ? "TOTAL PARCIAL DE INGRESOS DEL MES" : "TOTAL DE INGRESOS DEL MES",
              totalIngresos,
            ),
          ],
        },
        {
          titulo: "Total de egresos — un solo sumando",
          filas: [
            dinero("Egresos registrados (tabla egresos, todas las filas)", totalEgresos),
            dinero("TOTAL DE EGRESOS DEL MES", totalEgresos),
          ],
        },
        {
          titulo: "Resultado del mes",
          filas: [dinero("Ingresos menos egresos", totalIngresos - totalEgresos)],
        },
        {
          titulo: "Ingresos por origen (subtotales de la tabla ingresos)",
          filas: agrupar(ingresos, origenDeMovimiento, "monto"),
        },
        {
          titulo: "Egresos por origen (subtotales de la tabla egresos)",
          filas: agrupar(egresos, origenDeMovimiento, "monto"),
        },
        {
          titulo: "Ingresos por categoría principal",
          filas: agrupar(ingresos, (f) => categoriaNormalizada(f.categoria_principal), "monto"),
        },
        {
          titulo: "Egresos por categoría principal",
          filas: agrupar(egresos, (f) => categoriaNormalizada(f.categoria_principal), "monto"),
        },
        {
          titulo: "Egresos por ministerio",
          filas: agrupar(egresos, (f) => ministerioNormalizado(f.ministerio), "monto"),
        },
        {
          titulo: "Fuera del total, a título informativo",
          filas: [
            dinero("Ofrendas de células pendientes de recibir", sumar(ofrendasFilas, "valor") - totalOfrendas),
            dinero(
              "Alfolí marcado como no recibido (igual se suma al total)",
              sumar(alfoliFilas.filter((f) => f.recibido !== true), "valor"),
            ),
          ],
        },
      ],
      NOTAS_FLUJO,
    )

    const advertencias: string[] = []
    if (sinOfrendas) {
      advertencias.push(
        "Su cuenta no tiene acceso a las ofrendas de células: el total de ingresos del resumen es parcial y así está rotulado.",
      )
    }
    if (sinAlfoli) {
      advertencias.push(
        "Su cuenta no tiene acceso al alfolí: el total de ingresos del resumen es parcial y así está rotulado.",
      )
    }
    const pendientes = sumar(ofrendasFilas, "valor") - totalOfrendas
    if (pendientes > TOLERANCIA) {
      advertencias.push(
        `Hay ${pendientes.toFixed(2)} en ofrendas de células sin marcar como recibidas: no entran al total de ingresos.`,
      )
    }
    const sinClasificar = [...ingresos, ...egresos].filter((f) => origenDeMovimiento(f) === "Sin clasificar")
    if (sinClasificar.length > 0) {
      advertencias.push(
        `${sinClasificar.length} fila(s) no tienen marcador de origen reconocible y salen como "Sin clasificar".`,
      )
    }

    return { filas: detalle, hojas: [resumen], advertencias }
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Diezmos y ofrendas
// ══════════════════════════════════════════════════════════════════════════════

/** `diezmos/route.ts:29-32` y `diezmos/page.tsx:34`. */


const TRANSACCIONES: Record<string, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
}

/**
 * `tipo_ofrenda` nulo cuenta como diezmo, igual que la pantalla del módulo.
 * El catálogo de tipos vive en `lib/mod/diezmos-tipos.ts`, así que un tipo
 * nuevo aparece aquí sin tocar este informe.
 */
const tipoDiezmo = valorTipoOfrenda

/** Cualquier valor distinto de `transferencia` se trata como efectivo (`diezmos/page.tsx:272`). */
function esTransferencia(valor: unknown): boolean {
  return String(valor ?? "").trim() === "transferencia"
}

const NOTAS_DIEZMOS = [
  "Solo los diezmos por transferencia generan fila en la tabla de ingresos (concepto auto-diezmo); los de efectivo no llegan a ingresos y no están en ningún total del mes.",
  "El total de esta hoja es un subtotal del módulo de diezmos: no se suma al total general de ingresos, porque la mitad por transferencia ya está contada ahí.",
  "Las filas sin tipo de ofrenda se cuentan como diezmo, igual que en la pantalla del módulo.",
  "Los subtotales de la hoja de resumen corresponden a las filas exportadas; si aplica filtros de tipo o transacción, no reflejan el mes completo.",
]

const diezmosOfrendas: DefinicionReporte<Fila> = {
  id: "finanzas-diezmos",
  grupo: "Finanzas",
  titulo: "Diezmos, ofrendas y actividades",
  descripcion:
    "Diezmos, ofrendas y actividades del mes, separando lo recibido por transferencia (ya reflejado en ingresos) de lo recibido en efectivo (no reflejado).",
  tablas: ["diezmos"],
  modulos: ["diezmos", "ingresos_egresos"],
  hoja: "Diezmos del mes",
  archivo: "Finanzas_Diezmos",
  filtros: [
    FILTRO_MES,
    {
      id: "tipo",
      label: "Tipo de ofrenda",
      tipo: "opcion",
      opcionTodos: "Todos los tipos",
      opciones: TIPOS_OFRENDA.map((def) => ({ value: def.valor, label: def.label })),
      ayuda: "El filtro de diezmo incluye las filas sin tipo registrado.",
    },
    {
      id: "transaccion",
      label: "Forma de transacción",
      tipo: "opcion",
      opcionTodos: "Transferencia y efectivo",
      opciones: [
        { value: "transferencia", label: "Transferencia (ya en ingresos)" },
        { value: "efectivo", label: "Efectivo (no está en ingresos)" },
      ],
    },
  ],
  columnas: [
    { key: "numero", label: "N°", tipo: "numero", ancho: 8 },
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    { key: "donador", label: "Donante", ancho: 34 },
    { key: "valor", label: "Valor", tipo: "moneda", totalizar: true, valor: (f) => monto(f.valor) },
    {
      key: "tipo_ofrenda",
      label: "Tipo",
      ancho: 18,
      valor: (f) => etiquetaTipoOfrenda(f.tipo_ofrenda),
    },
    {
      key: "transaccion",
      label: "Transacción",
      ancho: 16,
      valor: (f) => (esTransferencia(f.transaccion) ? "Transferencia" : "Efectivo"),
    },
    {
      key: "reflejado",
      label: "Reflejado en ingresos",
      ancho: 22,
      ayuda: "Solo la transferencia genera la fila auto-diezmo en la tabla de ingresos.",
      valor: (f) => (esTransferencia(f.transaccion) ? "Sí" : "No"),
    },
    { key: "mes_id", label: "Mes (ID)", ancho: 12, opcional: true },
    { key: "id", label: "ID interno", tipo: "numero", ancho: 12, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Actualizado", tipo: "fechaHora", opcional: true },
  ],
  notas: NOTAS_DIEZMOS,
  obtener: async (ctx) => {
    const mes = mesRequerido(ctx)
    const todos = await seleccionarTodo<Fila>("diezmos", (q: any) =>
      q.eq("mes_id", mes.id).order("numero", { ascending: true }),
    )

    const filas = todos.filter((f) => {
      if (ctx.filtros.tipo && tipoDiezmo(f.tipo_ofrenda) !== ctx.filtros.tipo) return false
      if (ctx.filtros.transaccion === "transferencia" && !esTransferencia(f.transaccion)) return false
      if (ctx.filtros.transaccion === "efectivo" && esTransferencia(f.transaccion)) return false
      return true
    })

    const subtotal = (tipo: string, transferencia: boolean) =>
      sumar(
        filas.filter((f) => tipoDiezmo(f.tipo_ofrenda) === tipo && esTransferencia(f.transaccion) === transferencia),
        "valor",
      )

    const porTransferencia = sumar(filas.filter((f) => esTransferencia(f.transaccion)), "valor")
    const porEfectivo = sumar(filas.filter((f) => !esTransferencia(f.transaccion)), "valor")

    const resumen = hojaResumen(
      "Resumen de diezmos",
      [
        {
          titulo: `Mes ${mes.nombre}`,
          filas: [texto("Mes (ID)", mes.id), conteo("Registros exportados", filas.length)],
        },
        ...GRUPOS_ORDENADOS.map((grupo) => ({
          titulo: `Subtotales — ${GRUPOS_OFRENDA[grupo].toLowerCase()}`,
          filas: [
            ...tiposDelGrupo(grupo).flatMap((def) => [
              dinero(`${def.label} transferencia`, subtotal(def.valor, true)),
              dinero(`${def.label} efectivo`, subtotal(def.valor, false)),
            ]),
            dinero(
              `Subtotal ${GRUPOS_OFRENDA[grupo].toLowerCase()}`,
              sumar(filas.filter((f) => tipoOfrenda(f.tipo_ofrenda).grupo === grupo), "valor"),
            ),
          ] as FilaResumen[],
        })),
        {
          titulo: "Total del módulo",
          filas: [dinero("TOTAL GENERAL (subtotal del módulo)", porTransferencia + porEfectivo)],
        },
        {
          titulo: "Por forma de transacción",
          filas: [
            dinero("Transferencia — ya reflejada en ingresos como auto-diezmo", porTransferencia),
            dinero("Efectivo — no llega a la tabla de ingresos", porEfectivo),
          ],
        },
        {
          titulo: "Por donante",
          filas: agrupar(filas, (f) => String(f.donador ?? "").trim() || "Sin donante", "valor"),
        },
      ],
      NOTAS_DIEZMOS,
    )

    const advertencias: string[] = []
    if (porEfectivo > TOLERANCIA) {
      advertencias.push(
        `${porEfectivo.toFixed(2)} corresponden a diezmos en efectivo: no están reflejados en la tabla de ingresos ni en el total del mes.`,
      )
    }

    return { filas, hojas: [resumen], advertencias }
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Alfolí
// ══════════════════════════════════════════════════════════════════════════════

const TIPOS_ALFOLI: Record<string, string> = { domingo: "Domingo", mdg: "MDG" }

const NOTAS_ALFOLI = [
  "El alfolí no genera fila en la tabla de ingresos: es uno de los tres sumandos del total del mes y se suma por separado.",
  "Se exporta el mes completo sin exigir la marca de recibido, igual que hacen el resumen mensual, ingresos-egresos y el presupuesto anual al sumarlo.",
  "El recorte del periodo es por mes y año numéricos, no por mes_id: esta tabla no tiene esa columna.",
]

const alfoli: DefinicionReporte<Fila> = {
  id: "finanzas-alfoli",
  grupo: "Finanzas",
  titulo: "Alfolí",
  descripcion:
    "Alfolí de los domingos y de MDG del mes, con quién lo registró y quién lo recibió. Es uno de los tres sumandos del total de ingresos.",
  tablas: ["alfoli"],
  modulos: MODULOS_ALFOLI,
  hoja: "Alfolí del mes",
  archivo: "Finanzas_Alfoli",
  filtros: [
    {
      ...FILTRO_MES,
      ayuda: "El mes elegido se traduce a mes y año numéricos, que es como se ancla esta tabla.",
    },
    {
      id: "tipo",
      label: "Tipo",
      tipo: "opcion",
      opcionTodos: "Domingo y MDG",
      opciones: [
        { value: "domingo", label: "Domingo" },
        { value: "mdg", label: "MDG" },
      ],
    },
  ],
  columnas: [
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    { key: "tipo", label: "Tipo", ancho: 12, valor: (f) => etiqueta(TIPOS_ALFOLI, f.tipo) },
    { key: "valor", label: "Valor", tipo: "moneda", totalizar: true, valor: (f) => monto(f.valor) },
    { key: "recibido", label: "Recibido", ancho: 10, valor: (f) => SI_NO(f.recibido) },
    { key: "recibido_por_nombre", label: "Recibido por", ancho: 26 },
    { key: "recibido_at", label: "Fecha de recepción", tipo: "fechaHora", opcional: true },
    { key: "registrado_por_nombre", label: "Registrado por", ancho: 26 },
    { key: "mes", label: "Mes (número)", tipo: "numero", ancho: 12, opcional: true },
    { key: "anio", label: "Año", tipo: "numero", ancho: 10, opcional: true },
    { key: "id", label: "N°", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
    { key: "recibido_por", label: "Recibido por (ID)", ancho: 22, opcional: true },
    { key: "registrado_por", label: "Registrado por (ID)", ancho: 22, opcional: true },
  ],
  notas: NOTAS_ALFOLI,
  obtener: async (ctx) => {
    const mes = mesRequerido(ctx)
    const todos = await alfoliDelMes(mes)
    const filas = ctx.filtros.tipo ? todos.filter((f) => f.tipo === ctx.filtros.tipo) : todos

    const resumen = hojaResumen(
      "Resumen de alfolí",
      [
        {
          titulo: `Mes ${mes.nombre}`,
          filas: [
            texto("Periodo", `${mes.mes}/${mes.anio}`),
            conteo("Registros exportados", filas.length),
          ],
        },
        {
          titulo: "Totales",
          filas: [
            dinero("Alfolí de domingos", sumar(filas.filter((f) => f.tipo === "domingo"), "valor")),
            dinero("Alfolí MDG", sumar(filas.filter((f) => f.tipo === "mdg"), "valor")),
            dinero("TOTAL ALFOLÍ DEL MES (entra al total de ingresos)", sumar(filas, "valor")),
          ],
        },
        {
          titulo: "Control de recepción",
          filas: [
            dinero("Marcado como recibido", sumar(recibidas(filas), "valor")),
            dinero("Sin marcar como recibido (igual entra al total)", sumar(filas.filter((f) => f.recibido !== true), "valor")),
          ],
        },
      ],
      NOTAS_ALFOLI,
    )

    return { filas, hojas: [resumen] }
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Ofrendas de células
// ══════════════════════════════════════════════════════════════════════════════

const NOTAS_OFRENDAS = [
  "Solo las ofrendas marcadas como recibidas entran al total de ingresos del mes: es el filtro obligatorio que aplican el resumen mensual, ingresos-egresos y el presupuesto anual.",
  "Esta tabla no genera fila en la tabla de ingresos: se suma por separado como uno de los tres sumandos.",
  "El recorte del periodo es por mes y año numéricos, no por mes_id.",
]

const ofrendasCelulas: DefinicionReporte<Fila> = {
  id: "finanzas-ofrendas-celulas",
  grupo: "Finanzas",
  titulo: "Ofrendas de células",
  descripcion:
    "Ofrendas semanales de las células del mes, por célula y por jueves, distinguiendo lo recibido de lo pendiente.",
  tablas: ["ofrendas_celulas"],
  modulos: MODULOS_OFRENDAS,
  hoja: "Ofrendas de células",
  archivo: "Finanzas_Ofrendas_Celulas",
  filtros: [
    {
      ...FILTRO_MES,
      ayuda: "El mes elegido se traduce a mes y año numéricos, que es como se ancla esta tabla.",
    },
    {
      id: "recibido",
      label: "Estado de recepción",
      tipo: "opcion",
      valorInicial: "si",
      opciones: [
        { value: "si", label: "Solo recibidas (criterio del total de ingresos)" },
        { value: "todos", label: "Todas, recibidas y pendientes" },
      ],
      ayuda: "Solo lo recibido entra al total de ingresos del mes.",
    },
  ],
  columnas: [
    { key: "celula_nombre", label: "Célula", ancho: 26 },
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    { key: "valor", label: "Valor", tipo: "moneda", totalizar: true, valor: (f) => monto(f.valor) },
    { key: "recibido", label: "Recibido", ancho: 10, valor: (f) => SI_NO(f.recibido) },
    { key: "recibido_por_nombre", label: "Recibido por", ancho: 26 },
    { key: "recibido_at", label: "Fecha de recepción", tipo: "fechaHora", opcional: true },
    { key: "registrado_por_nombre", label: "Registrado por", ancho: 26 },
    { key: "mes", label: "Mes (número)", tipo: "numero", ancho: 12, opcional: true },
    { key: "anio", label: "Año", tipo: "numero", ancho: 10, opcional: true },
    { key: "id", label: "N°", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Actualizado", tipo: "fechaHora", opcional: true },
    { key: "recibido_por", label: "Recibido por (ID)", ancho: 22, opcional: true },
    { key: "registrado_por", label: "Registrado por (ID)", ancho: 22, opcional: true },
  ],
  notas: NOTAS_OFRENDAS,
  obtener: async (ctx) => {
    const mes = mesRequerido(ctx)
    const todas = await ofrendasDelMes(mes)
    const soloRecibidas = ctx.filtros.recibido !== "todos"
    const filas = soloRecibidas ? recibidas(todas) : todas

    const totalRecibido = sumar(recibidas(todas), "valor")
    const totalPendiente = sumar(todas, "valor") - totalRecibido

    const resumen = hojaResumen(
      "Resumen de ofrendas",
      [
        {
          titulo: `Mes ${mes.nombre}`,
          filas: [
            texto("Periodo", `${mes.mes}/${mes.anio}`),
            conteo("Registros exportados", filas.length),
            conteo("Células con registro en el mes", new Set(todas.map((f) => String(f.celula_nombre ?? ""))).size),
          ],
        },
        {
          titulo: "Totales del mes",
          filas: [
            dinero("Recibido (entra al total de ingresos)", totalRecibido),
            dinero("Pendiente de recibir (fuera del total)", totalPendiente),
            dinero("Registrado en total", totalRecibido + totalPendiente),
          ],
        },
        {
          titulo: "Por célula (según las filas exportadas)",
          filas: agrupar(filas, (f) => String(f.celula_nombre ?? "").trim() || "Sin célula", "valor"),
        },
        {
          titulo: "Por fecha (según las filas exportadas)",
          filas: agrupar(filas, (f) => String(f.fecha ?? "").slice(0, 10) || "Sin fecha", "valor"),
        },
      ],
      NOTAS_OFRENDAS,
    )

    const advertencias: string[] = []
    if (totalPendiente > TOLERANCIA) {
      advertencias.push(
        `${totalPendiente.toFixed(2)} siguen sin marcarse como recibidos y por eso no entran al total de ingresos del mes.`,
      )
    }

    return { filas, hojas: [resumen], advertencias }
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Caja chica
// ══════════════════════════════════════════════════════════════════════════════

const COLUMNAS_ARQUEOS: ColumnaReporte<Fila>[] = [
  { key: "fecha", label: "Fecha", tipo: "fecha" },
  { key: "contado_por", label: "Contado por", ancho: 26 },
  ...DENOMINACIONES.map(
    (den): ColumnaReporte<Fila> => ({
      key: den.key,
      label: `${den.valor >= 1 ? "Billetes" : "Monedas"} ${den.label}`,
      tipo: "numero",
      ancho: 13,
    }),
  ),
  { key: "total", label: "Total del arqueo", tipo: "moneda", totalizar: true, valor: (f) => monto(f.total) },
  { key: "observacion", label: "Observación", ancho: 36 },
  { key: "mes_id", label: "Mes (ID)", ancho: 12 },
  { key: "id", label: "N°", tipo: "numero", ancho: 8 },
  { key: "created_at", label: "Creado", tipo: "fechaHora" },
]

const NOTAS_CAJA_CHICA = [
  "La gestión de efectivo genera un ingreso automático (concepto auto-caja-chica) que ya está contado en la tabla de ingresos: el total de esta hoja es un subtotal del módulo y no se suma al total del mes.",
  "El saldo se calcula como suma de los movimientos de tipo Ingreso menos los de tipo Egreso, igual que el servicio de caja chica.",
  "Los arqueos son conteo físico de efectivo: no entran a ningún total de flujo ni corrigen el saldo calculado.",
  "La pantalla del módulo solo muestra los movimientos con concepto Gestion de Efectivo; aquí se exporta el mes completo y la columna Concepto permite distinguirlos.",
]

const cajaChica: DefinicionReporte<Fila> = {
  id: "finanzas-caja-chica",
  grupo: "Finanzas",
  titulo: "Caja chica",
  descripcion:
    "Movimientos de caja chica del mes con el saldo calculado, más una hoja con los arqueos de conteo físico.",
  tablas: ["caja_chica_movimientos", "caja_chica_arqueos"],
  modulos: ["caja_chica"],
  hoja: "Movimientos",
  archivo: "Finanzas_Caja_Chica",
  filtros: [FILTRO_MES],
  columnas: [
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    { key: "tipo", label: "Tipo", ancho: 12 },
    { key: "monto", label: "Valor", tipo: "moneda", totalizar: true, valor: (f) => monto(f.monto) },
    { key: "detalle", label: "Detalle", ancho: 42 },
    { key: "responsable", label: "Responsable", ancho: 26 },
    { key: "metodo_pago", label: "Método de pago", ancho: 32 },
    {
      key: "concepto",
      label: "Concepto",
      ancho: 24,
      ayuda: "Solo los movimientos con concepto Gestion de Efectivo generan ingreso automático.",
    },
    {
      key: "reflejado",
      label: "Reflejado en ingresos",
      ancho: 22,
      valor: (f) => (String(f.concepto ?? "").trim() === "Gestion de Efectivo" ? "Sí" : "No"),
    },
    { key: "mes_id", label: "Mes (ID)", ancho: 12, opcional: true },
    { key: "id", label: "N°", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Actualizado", tipo: "fechaHora", opcional: true },
  ],
  notas: NOTAS_CAJA_CHICA,
  obtener: async (ctx) => {
    const mes = mesRequerido(ctx)

    const [movimientos, arqueos] = await Promise.all([
      seleccionarTodo<Fila>("caja_chica_movimientos", (q: any) =>
        q.eq("mes_id", mes.id).order("fecha", { ascending: true }),
      ),
      seleccionarTodo<Fila>("caja_chica_arqueos", (q: any) =>
        q.eq("mes_id", mes.id).order("fecha", { ascending: true }),
      ),
    ])

    const entradas = sumar(movimientos.filter((f) => f.tipo === "Ingreso"), "monto")
    const salidas = sumar(movimientos.filter((f) => f.tipo === "Egreso"), "monto")
    const saldo = entradas - salidas
    const gestiones = movimientos.filter((f) => String(f.concepto ?? "").trim() === "Gestion de Efectivo")
    const ultimoArqueo = arqueos.length > 0 ? arqueos[arqueos.length - 1] : null
    const totalUltimoArqueo = monto(ultimoArqueo?.total)

    const resumen = hojaResumen(
      "Resumen de caja chica",
      [
        {
          titulo: `Mes ${mes.nombre}`,
          filas: [
            texto("Mes (ID)", mes.id),
            conteo("Movimientos del mes", movimientos.length),
            conteo("Arqueos del mes", arqueos.length),
          ],
        },
        {
          titulo: "Saldo calculado del mes",
          filas: [
            dinero("Movimientos de tipo Ingreso", entradas),
            dinero("Movimientos de tipo Egreso", salidas),
            dinero("SALDO (ingresos menos egresos)", saldo),
          ],
        },
        {
          titulo: "Subtotal del módulo, ya espejado en ingresos",
          filas: [dinero("Gestión de Efectivo sincronizada como auto-caja-chica", sumar(gestiones, "monto"))],
        },
        {
          titulo: "Conteo físico, fuera de todo total de flujo",
          filas: [
            texto("Fecha del último arqueo", String(ultimoArqueo?.fecha ?? "").slice(0, 10) || "Sin arqueos"),
            dinero("Total del último arqueo", totalUltimoArqueo),
            dinero("Suma de todos los arqueos del mes", sumar(arqueos, "total")),
          ],
        },
        {
          titulo: "Movimientos por método de pago",
          filas: agrupar(movimientos, (f) => String(f.metodo_pago ?? "").trim() || "Sin método", "monto"),
        },
        {
          titulo: "Movimientos por responsable",
          filas: agrupar(movimientos, (f) => String(f.responsable ?? "").trim() || "Sin responsable", "monto"),
        },
      ],
      NOTAS_CAJA_CHICA,
    )

    const hojaArqueos = hojaDesdeFilas("Arqueos", arqueos, COLUMNAS_ARQUEOS, {
      notas: [
        "Conteo físico de efectivo. No entra a ningún total de ingresos ni de egresos.",
        "El total de cada arqueo es la suma de denominaciones por su valor, igual que el módulo.",
      ],
    })

    const advertencias: string[] = []
    if (ultimoArqueo && Math.abs(saldo - totalUltimoArqueo) > TOLERANCIA) {
      advertencias.push(
        `El saldo calculado (${saldo.toFixed(2)}) difiere del último arqueo (${totalUltimoArqueo.toFixed(2)}). El arqueo es conteo físico: no corrige el saldo, solo señala una diferencia a revisar.`,
      )
    }

    return { filas: movimientos, hojas: [resumen, hojaArqueos], advertencias }
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. Pago diario
// ══════════════════════════════════════════════════════════════════════════════

const NOTAS_PAGO_DIARIO = [
  "Cada pago genera un egreso automático (concepto auto-pago-diario) que hereda su categoría y su método: el total de esta hoja es un subtotal del módulo y no se suma al total de egresos del mes.",
  "El recorte del periodo es por mes_id, tomado de la tabla de meses. La fecha de cada fila es dato, no filtro.",
  "El ministerio se normaliza para que Administracion sin tilde no abra un grupo aparte.",
]

const pagoDiario: DefinicionReporte<Fila> = {
  id: "finanzas-pago-diario",
  grupo: "Finanzas",
  titulo: "Pago diario",
  descripcion:
    "Pagos diarios del mes por beneficiario, con ministerio, categoría y método de pago. Ya están espejados en egresos.",
  tablas: ["pago_diario"],
  modulos: ["pago_diario", "ingresos_egresos", "control_mensual"],
  hoja: "Pago diario",
  archivo: "Finanzas_Pago_Diario",
  filtros: [FILTRO_MES],
  columnas: [
    { key: "id", label: "N° Reg.", tipo: "numero", ancho: 10 },
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    { key: "nombre", label: "Beneficiario", ancho: 34 },
    { key: "valor", label: "Valor", tipo: "moneda", totalizar: true, valor: (f) => monto(f.valor) },
    { key: "ministerio", label: "Ministerio", ancho: 22, valor: (f) => ministerioNormalizado(f.ministerio) },
    { key: "categoria", label: "Categoría", ancho: 28 },
    { key: "detalle", label: "Detalle", ancho: 42 },
    { key: "metodo_pago", label: "Método de pago", ancho: 30 },
    { key: "telefono", label: "Teléfono", ancho: 16, opcional: true, sensible: true },
    { key: "email", label: "Correo", ancho: 28, opcional: true, sensible: true },
    { key: "mes_id", label: "Mes (ID)", ancho: 12, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Actualizado", tipo: "fechaHora", opcional: true },
  ],
  notas: NOTAS_PAGO_DIARIO,
  obtener: async (ctx) => {
    const mes = mesRequerido(ctx)
    const filas = await seleccionarTodo<Fila>("pago_diario", (q: any) =>
      q.eq("mes_id", mes.id).order("fecha", { ascending: true }),
    )

    const resumen = hojaResumen(
      "Resumen de pago diario",
      [
        {
          titulo: `Mes ${mes.nombre}`,
          filas: [
            texto("Mes (ID)", mes.id),
            conteo("Pagos del mes", filas.length),
            dinero("TOTAL MES (subtotal del módulo, ya en egresos)", sumar(filas, "valor")),
          ],
        },
        {
          titulo: "Por método de pago",
          filas: agrupar(filas, (f) => String(f.metodo_pago ?? "").trim() || "Sin método", "valor"),
        },
        {
          titulo: "Por ministerio",
          filas: agrupar(filas, (f) => ministerioNormalizado(f.ministerio), "valor"),
        },
        {
          titulo: "Por categoría",
          filas: agrupar(filas, (f) => categoriaNormalizada(f.categoria), "valor"),
        },
      ],
      NOTAS_PAGO_DIARIO,
    )

    return { filas, hojas: [resumen] }
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. Nómina
// ══════════════════════════════════════════════════════════════════════════════

/** `NominaSection.tsx:723-728`. */
const DESCUENTOS_NOMINA: Record<string, string> = {
  ninguno: "Sin descuento",
  prestamo: "Préstamo",
  multas: "Multas",
  eventos: "Eventos",
}

/** Pagado = suma condicional de los bloques marcados como pagados. */
function pagadoEnQuincenas(fila: Fila): number {
  let total = 0
  if (fila.primera_quincena_pagada === true) total += monto(fila.primera_quincena_valor)
  if (fila.segunda_quincena_pagada === true) total += monto(fila.segunda_quincena_valor)
  return total
}

function pagadoEnTransporte(fila: Fila): number {
  let total = 0
  if (fila.movilizacion_pagada === true) total += monto(fila.movilizacion_valor)
  if (fila.movilizacion_segunda_pagada === true) total += monto(fila.movilizacion_segunda_valor)
  return total
}

/** Obligación del mes: `max(0, sueldo - descuento)` (`NominaSection.tsx:107`). */
function obligacionRecalculada(fila: Fila): number {
  return Math.max(0, monto(fila.valor_sueldo) - monto(fila.descuento_valor))
}

const NOTAS_NOMINA = [
  "Obligación y pagado son dos cifras distintas y no deben confundirse: la obligación es el valor a pagar del mes, y lo pagado es la suma de las quincenas y del transporte marcados como pagados.",
  "El transporte es un pago aparte que no forma parte del valor a pagar: por eso se totaliza en su propia columna y no se suma a la obligación.",
  "Los egresos automáticos de nómina (hasta cuatro por persona y mes) ya están en la tabla de egresos: el total de esta hoja es un subtotal del módulo y no se suma al total de egresos del mes.",
  "El único rubro restado del sueldo es el descuento registrado; no hay aportes ni retenciones patronales en esta tabla.",
  "Si una persona está en modo transporte sin quincenas, sus dos quincenas quedan en no pagadas y el saldo de la obligación aparece completo: es el comportamiento del módulo.",
  "Sueldos, descuentos y datos de contacto son datos personales: desmarque esas columnas si el informe no las necesita.",
]

const nomina: DefinicionReporte<Fila> = {
  id: "finanzas-nomina",
  grupo: "Finanzas",
  titulo: "Nómina",
  descripcion:
    "Nómina del mes, separando la obligación (valor a pagar) de lo efectivamente pagado en cada quincena y en transporte.",
  tablas: ["nomina"],
  modulos: ["flujo_pago", "control_mensual", "resumen-pastoral"],
  hoja: "Nómina del mes",
  archivo: "Finanzas_Nomina",
  filtros: [
    FILTRO_MES,
    {
      id: "estadoPago",
      label: "Estado de pago",
      tipo: "opcion",
      opcionTodos: "Todas las personas",
      opciones: [
        { value: "completo", label: "Obligación cubierta" },
        { value: "pendiente", label: "Con saldo por pagar" },
      ],
      ayuda: "Se compara la obligación con lo pagado en quincenas, con tolerancia de un centavo.",
    },
  ],
  columnas: [
    {
      key: "nombre",
      label: "Nombre",
      ancho: 34,
      ayuda: "Toda esta hoja es información de sueldos: compártala solo con quien deba verla.",
    },
    { key: "cedula", label: "Cédula", ancho: 14, sensible: true },
    { key: "detalle", label: "Detalle", ancho: 30 },
    { key: "categoria_principal", label: "Categoría principal", ancho: 24, opcional: true },

    { key: "valor_sueldo", label: "Sueldo", tipo: "moneda", totalizar: true, sensible: true, valor: (f) => monto(f.valor_sueldo) },
    { key: "descuento", label: "Tipo de descuento", ancho: 18, sensible: true, valor: (f) => etiqueta(DESCUENTOS_NOMINA, f.descuento) },
    { key: "descuento_valor", label: "Valor del descuento", tipo: "moneda", totalizar: true, sensible: true, valor: (f) => monto(f.descuento_valor) },
    { key: "descuento_motivo", label: "Motivo del descuento", ancho: 30, sensible: true },
    { key: "descuento_quincenas_total", label: "Quincenas de descuento (total)", tipo: "numero", opcional: true, sensible: true },
    { key: "descuento_quincenas_aplicadas", label: "Quincenas aplicadas", tipo: "numero", opcional: true, sensible: true },

    {
      key: "valor_a_pagar",
      label: "Obligación del mes (valor a pagar)",
      tipo: "moneda",
      totalizar: true,
      sensible: true,
      ayuda: "Lo que se debe pagar: sueldo menos descuento. No es lo pagado.",
      valor: (f) => monto(f.valor_a_pagar),
    },
    {
      key: "obligacionRecalculada",
      label: "Obligación recalculada",
      tipo: "moneda",
      opcional: true,
      sensible: true,
      ayuda: "Recálculo de sueldo menos descuento para contrastar el valor almacenado, que se calcula en el cliente.",
      valor: (f) => obligacionRecalculada(f),
    },

    { key: "primera_quincena_pagada", label: "1ra quincena pagada", ancho: 18, valor: (f) => SI_NO(f.primera_quincena_pagada) },
    { key: "primera_quincena_valor", label: "1ra quincena valor", tipo: "moneda", sensible: true, valor: (f) => monto(f.primera_quincena_valor) },
    { key: "primera_quincena_fecha", label: "1ra quincena fecha", tipo: "fecha" },
    { key: "primera_quincena_metodo", label: "1ra quincena método", ancho: 18 },

    { key: "segunda_quincena_pagada", label: "2da quincena pagada", ancho: 18, valor: (f) => SI_NO(f.segunda_quincena_pagada) },
    { key: "segunda_quincena_valor", label: "2da quincena valor", tipo: "moneda", sensible: true, valor: (f) => monto(f.segunda_quincena_valor) },
    { key: "segunda_quincena_fecha", label: "2da quincena fecha", tipo: "fecha" },
    { key: "segunda_quincena_metodo", label: "2da quincena método", ancho: 18 },

    { key: "movilizacion_con_quincenas", label: "Transporte dividido en quincenas", ancho: 20, valor: (f) => SI_NO(f.movilizacion_con_quincenas) },
    { key: "movilizacion_pagada", label: "Transporte pagado", ancho: 16, valor: (f) => SI_NO(f.movilizacion_pagada) },
    { key: "movilizacion_valor", label: "Transporte valor", tipo: "moneda", sensible: true, valor: (f) => monto(f.movilizacion_valor) },
    { key: "movilizacion_fecha", label: "Transporte fecha", tipo: "fecha", opcional: true },
    { key: "movilizacion_metodo", label: "Transporte método", ancho: 18, opcional: true },
    { key: "movilizacion_segunda_pagada", label: "Transporte 2da pagado", ancho: 18, valor: (f) => SI_NO(f.movilizacion_segunda_pagada) },
    { key: "movilizacion_segunda_valor", label: "Transporte 2da valor", tipo: "moneda", sensible: true, valor: (f) => monto(f.movilizacion_segunda_valor) },
    { key: "movilizacion_segunda_fecha", label: "Transporte 2da fecha", tipo: "fecha", opcional: true },
    { key: "movilizacion_segunda_metodo", label: "Transporte 2da método", ancho: 18, opcional: true },

    {
      key: "pagadoQuincenas",
      label: "Pagado en quincenas",
      tipo: "moneda",
      totalizar: true,
      sensible: true,
      ayuda: "Suma de las quincenas marcadas como pagadas. Es caja, no obligación.",
      valor: (f) => pagadoEnQuincenas(f),
    },
    {
      key: "pagadoTransporte",
      label: "Pagado en transporte",
      tipo: "moneda",
      totalizar: true,
      sensible: true,
      valor: (f) => pagadoEnTransporte(f),
    },
    {
      key: "pagadoTotal",
      label: "Total efectivamente pagado",
      tipo: "moneda",
      totalizar: true,
      sensible: true,
      ayuda: "Quincenas más transporte, solo los bloques marcados como pagados.",
      valor: (f) => pagadoEnQuincenas(f) + pagadoEnTransporte(f),
    },
    {
      key: "saldoObligacion",
      label: "Saldo de la obligación",
      tipo: "moneda",
      totalizar: true,
      sensible: true,
      ayuda: "Obligación menos lo pagado en quincenas. El transporte no cuenta aquí porque no forma parte del valor a pagar.",
      valor: (f) => monto(f.valor_a_pagar) - pagadoEnQuincenas(f),
    },

    { key: "telefono", label: "Teléfono", ancho: 16, opcional: true, sensible: true },
    { key: "email", label: "Correo", ancho: 28, opcional: true, sensible: true },
    { key: "mes_id", label: "Mes (ID)", ancho: 12, opcional: true },
    { key: "id", label: "N°", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Actualizado", tipo: "fechaHora", opcional: true },
  ],
  notas: NOTAS_NOMINA,
  obtener: async (ctx) => {
    const mes = mesRequerido(ctx)
    const todas = await seleccionarTodo<Fila>("nomina", (q: any) =>
      q.eq("mes_id", mes.id).order("nombre", { ascending: true }),
    )

    const cubierta = (fila: Fila) => monto(fila.valor_a_pagar) - pagadoEnQuincenas(fila) <= TOLERANCIA
    const filas =
      ctx.filtros.estadoPago === "completo"
        ? todas.filter(cubierta)
        : ctx.filtros.estadoPago === "pendiente"
          ? todas.filter((f) => !cubierta(f))
          : todas

    const obligacion = sumar(todas, "valor_a_pagar")
    const quincenas = todas.reduce((s, f) => s + pagadoEnQuincenas(f), 0)
    const transporte = todas.reduce((s, f) => s + pagadoEnTransporte(f), 0)

    const resumen = hojaResumen(
      "Resumen de nómina",
      [
        {
          titulo: `Mes ${mes.nombre}`,
          filas: [
            texto("Mes (ID)", mes.id),
            conteo("Personas en nómina", todas.length),
            conteo("Personas con la obligación cubierta", todas.filter(cubierta).length),
            conteo("Personas con saldo por pagar", todas.filter((f) => !cubierta(f)).length),
          ],
        },
        {
          titulo: "Obligación del mes (lo que se debe pagar)",
          filas: [
            dinero("Suma de sueldos", sumar(todas, "valor_sueldo")),
            dinero("Suma de descuentos", sumar(todas, "descuento_valor")),
            dinero("OBLIGACIÓN DEL MES (suma de valor a pagar)", obligacion),
          ],
        },
        {
          titulo: "Efectivamente pagado (caja)",
          filas: [
            dinero("Pagado en quincenas marcadas como pagadas", quincenas),
            dinero("Pagado en transporte marcado como pagado", transporte),
            dinero("TOTAL EFECTIVAMENTE PAGADO", quincenas + transporte),
          ],
        },
        {
          titulo: "Diferencia entre obligación y pago",
          filas: [
            dinero("Saldo de la obligación (obligación menos quincenas pagadas)", obligacion - quincenas),
            texto(
              "Lectura",
              "El transporte no entra en la obligación: no reduce este saldo aunque esté pagado.",
            ),
          ],
        },
      ],
      NOTAS_NOMINA,
    )

    const descuadres = todas.filter(
      (f) => Math.abs(monto(f.valor_a_pagar) - obligacionRecalculada(f)) > TOLERANCIA,
    )
    const advertencias: string[] = []
    if (descuadres.length > 0) {
      advertencias.push(
        `${descuadres.length} fila(s) tienen un valor a pagar distinto de sueldo menos descuento. El valor se calcula en el cliente, así que puede haber quedado desactualizado: revise la columna "Obligación recalculada".`,
      )
    }

    return { filas, hojas: [resumen], advertencias }
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. Pasivos y abonos
// ══════════════════════════════════════════════════════════════════════════════

const ESTADOS_PASIVO: Record<string, string> = { pendiente: "Pendiente", pagado: "Pagado" }

const COLUMNAS_ABONOS: ColumnaReporte<Fila>[] = [
  { key: "acreedor", label: "Acreedor", ancho: 30 },
  { key: "pasivo_id", label: "Pasivo", tipo: "numero", ancho: 10 },
  { key: "fecha", label: "Fecha", tipo: "fecha" },
  { key: "monto", label: "Monto", tipo: "moneda", totalizar: true, valor: (f) => monto(f.monto) },
  { key: "metodo_pago", label: "Método de pago", ancho: 18 },
  { key: "observacion", label: "Observación", ancho: 36 },
  {
    key: "egreso_id",
    label: "Egreso vinculado",
    tipo: "numero",
    ancho: 16,
  },
  { key: "id", label: "N°", tipo: "numero", ancho: 8 },
  { key: "created_at", label: "Creado", tipo: "fechaHora" },
]

const NOTAS_PASIVOS = [
  "El monto total de un pasivo es deuda, no flujo de caja: nunca se suma a los egresos del mes.",
  "Cada abono genera un egreso automático (categoría PAGO DE PASIVOS) que ya está en la tabla de egresos, así que el total de abonos es un subtotal del módulo.",
  "Abonado, saldo y vencido son columnas derivadas, calculadas con las funciones del servicio de pasivos (calcAbonado, calcSaldo, esVencido).",
  "Vencido no es un valor del estado: el estado solo admite pendiente o pagado. Vencido significa que queda saldo y que la fecha de pago ya pasó.",
  "Esta tabla no tiene mes de trabajo: el periodo se filtra por la fecha de pago acordada. El egreso del abono, en cambio, se registra en el mes activo al momento de abonar, así que un abono con fecha de un mes puede tener su egreso en otro.",
  "La hoja de abonos incluye solo los abonos de los pasivos exportados.",
]

const pasivos: DefinicionReporte<Fila> = {
  id: "finanzas-pasivos",
  grupo: "Finanzas",
  titulo: "Pasivos y abonos",
  descripcion:
    "Deudas de la iglesia con lo abonado, el saldo y el estado de vencimiento, más una hoja con el detalle de cada abono.",
  tablas: ["pasivos", "pasivos_abonos"],
  modulos: ["pasivos", "control_mensual", "resumen-pastoral"],
  hoja: "Pasivos",
  archivo: "Finanzas_Pasivos",
  filtros: [
    {
      id: "estado",
      label: "Estado",
      tipo: "opcion",
      opcionTodos: "Todos",
      opciones: [
        { value: "pendiente", label: "Pendientes" },
        { value: "pagado", label: "Pagados" },
        { value: "vencido", label: "Vencidos" },
      ],
      ayuda: "Vencido es derivado: hay saldo y la fecha de pago ya pasó.",
    },
    {
      id: "rango",
      label: "Fecha de pago",
      tipo: "rangoFechas",
      ayuda: "Filtra por la fecha de pago acordada, que es el único anclaje de periodo de esta tabla.",
    },
  ],
  columnas: [
    { key: "acreedor", label: "Acreedor", ancho: 30 },
    { key: "detalle", label: "Detalle", ancho: 40 },
    { key: "monto_total", label: "Monto total", tipo: "moneda", totalizar: true, valor: (f) => monto(f.monto_total) },
    {
      key: "abonado",
      label: "Abonado",
      tipo: "moneda",
      totalizar: true,
      ayuda: "Suma de los abonos del pasivo (calcAbonado del servicio de pasivos).",
    },
    {
      key: "saldo",
      label: "Saldo",
      tipo: "moneda",
      totalizar: true,
      ayuda: "Monto total menos abonado (calcSaldo del servicio de pasivos).",
    },
    { key: "estado", label: "Estado", ancho: 14, valor: (f) => etiqueta(ESTADOS_PASIVO, f.estado) },
    {
      key: "vencido",
      label: "Vencido",
      ancho: 10,
      ayuda: "Derivado: hay saldo pendiente y la fecha de pago ya pasó.",
      valor: (f) => SI_NO(f.vencido),
    },
    { key: "fecha", label: "Fecha de pago", tipo: "fecha" },
    { key: "observacion", label: "Observación", ancho: 36 },
    { key: "abonos", label: "N° de abonos", tipo: "numero", ancho: 13 },
    { key: "fecha_ingreso", label: "Fecha de ingreso", tipo: "fechaHora", opcional: true },
    { key: "id", label: "N°", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Actualizado", tipo: "fechaHora", opcional: true },
  ],
  notas: NOTAS_PASIVOS,
  obtener: async (ctx) => {
    const rango = rangoDelFiltro(ctx.filtros)

    const [crudos, abonosCrudos] = await Promise.all([
      seleccionarTodo<Fila>("pasivos", (q: any) =>
        aplicarRango(q.order("fecha", { ascending: false }), "fecha", rango),
      ),
      seleccionarTodo<Fila>("pasivos_abonos", (q: any) => q.order("fecha", { ascending: true })),
    ])

    // Las funciones del servicio son la única fuente de verdad de abonado,
    // saldo y vencido; aquí solo se aplican fila por fila.
    const abonos = abonosCrudos as unknown as PasivoAbono[]
    const hoy = todayEcuador()

    const derivados: Fila[] = crudos.map((fila) => {
      const pasivo = fila as unknown as Pasivo
      const abonado = calcAbonado(abonos, pasivo.id)
      const saldo = calcSaldo(pasivo, abonos)
      return {
        ...fila,
        abonado,
        saldo,
        vencido: esVencido(pasivo, saldo, hoy),
        abonos: abonos.filter((a) => a.pasivo_id === pasivo.id).length,
      }
    })

    const filas =
      ctx.filtros.estado === "vencido"
        ? derivados.filter((f) => f.vencido === true)
        : ctx.filtros.estado
          ? derivados.filter((f) => f.estado === ctx.filtros.estado)
          : derivados

    const idsExportados = new Set(filas.map((f) => Number(f.id)))
    const acreedorPorId = new Map(filas.map((f) => [Number(f.id), String(f.acreedor ?? "")]))
    const abonosExportados: Fila[] = abonos
      .filter((a) => idsExportados.has(a.pasivo_id))
      .map((a) => ({ ...a, acreedor: acreedorPorId.get(a.pasivo_id) ?? "" }))

    const totalDeuda = sumar(filas, "monto_total")
    const totalAbonado = sumar(filas, "abonado")
    const totalSaldo = sumar(filas, "saldo")
    const vencidos = filas.filter((f) => f.vencido === true)

    const resumen = hojaResumen(
      "Resumen de pasivos",
      [
        {
          titulo: "Pasivos exportados",
          filas: [
            conteo("Pasivos", filas.length),
            conteo("Pendientes", filas.filter((f) => f.estado === "pendiente").length),
            conteo("Pagados", filas.filter((f) => f.estado === "pagado").length),
            conteo("Vencidos (derivado)", vencidos.length),
          ],
        },
        {
          titulo: "Deuda, no flujo de caja",
          filas: [
            dinero("Monto total de la deuda", totalDeuda),
            dinero("Abonado (subtotal del módulo, ya en egresos)", totalAbonado),
            dinero("SALDO PENDIENTE", totalSaldo),
            dinero("Saldo de los pasivos vencidos", sumar(vencidos, "saldo")),
          ],
        },
        {
          titulo: "Saldo por acreedor",
          filas: agrupar(filas, (f) => String(f.acreedor ?? "").trim() || "Sin acreedor", "saldo"),
        },
      ],
      NOTAS_PASIVOS,
    )

    const hojaAbonos = hojaDesdeFilas("Abonos", abonosExportados, COLUMNAS_ABONOS, {
      notas: [
        "El total de abonos es un subtotal del módulo: cada abono ya tiene su egreso en la tabla de egresos.",
        "El egreso vinculado se registra en el mes activo al momento del abono, no en el mes de la fecha del abono.",
      ],
    })

    const advertencias: string[] = []
    const pagadosConSaldo = filas.filter((f) => f.estado === "pagado" && monto(f.saldo) > TOLERANCIA)
    if (pagadosConSaldo.length > 0) {
      advertencias.push(
        `${pagadosConSaldo.length} pasivo(s) marcados como pagados conservan saldo pendiente. El estado se recalcula al abonar: revise si el monto total cambió después del último abono.`,
      )
    }
    const sobreAbonados = filas.filter((f) => monto(f.saldo) < -TOLERANCIA)
    if (sobreAbonados.length > 0) {
      advertencias.push(`${sobreAbonados.length} pasivo(s) tienen abonos por encima de su monto total.`)
    }

    return { filas, hojas: [resumen, hojaAbonos], advertencias }
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. Flujo de pagos
// ══════════════════════════════════════════════════════════════════════════════

const NOTAS_FLUJO_PAGOS = [
  "El flujo de pagos es un registro paralelo sin contrapartida contable: no genera ninguna fila en la tabla de egresos y no debe sumarse al total de egresos del mes.",
  "Si los mismos pagos se registran aquí y en egresos, la duplicación es manual y este reporte no la puede detectar.",
  "Estas tablas no tienen mes de trabajo ni mes y año numéricos: el único anclaje es la fecha de cada fila, y el periodo de la tabla vive en su nombre como texto libre.",
]

const flujoPagos: DefinicionReporte<Fila> = {
  id: "finanzas-flujo-pagos",
  grupo: "Finanzas",
  titulo: "Flujo de pagos",
  descripcion:
    "Tablas de pago y sus filas de beneficiarios. Registro paralelo de planificación, sin reflejo en los egresos.",
  tablas: ["payment_tables", "payment_rows"],
  modulos: ["flujo_pago"],
  hoja: "Filas de pago",
  archivo: "Finanzas_Flujo_Pagos",
  filtros: [
    {
      id: "rango",
      label: "Fecha de la fila",
      tipo: "rangoFechas",
      ayuda: "Único recorte posible: estas tablas no tienen anclaje de mes.",
    },
  ],
  columnas: [
    { key: "tabla_nombre", label: "Tabla de pago", ancho: 30 },
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    { key: "beneficiarios", label: "Beneficiarios", ancho: 34 },
    { key: "detalle", label: "Detalle", ancho: 42 },
    { key: "valor", label: "Valor", tipo: "moneda", totalizar: true, valor: (f) => monto(f.valor) },
    { key: "tabla_fecha_creacion", label: "Fecha de creación de la tabla", tipo: "fecha", opcional: true },
    { key: "table_id", label: "Tabla (ID)", ancho: 24, opcional: true },
    { key: "id", label: "ID de la fila", ancho: 24, opcional: true },
    {
      key: "created_at",
      label: "Creado",
      tipo: "fechaHora",
      opcional: true,
      ayuda: "El servicio nunca escribe esta columna, así que puede venir vacía.",
    },
    { key: "updated_at", label: "Actualizado", tipo: "fechaHora", opcional: true },
  ],
  notas: NOTAS_FLUJO_PAGOS,
  obtener: async (ctx) => {
    const rango = rangoDelFiltro(ctx.filtros)

    const [tablas, filasCrudas] = await Promise.all([
      seleccionarTodo<Fila>("payment_tables", (q: any) => q.order("fecha_creacion", { ascending: false })),
      seleccionarTodo<Fila>("payment_rows", (q: any) =>
        aplicarRango(q.order("fecha", { ascending: true }), "fecha", rango),
      ),
    ])

    const nombrePorId = new Map(tablas.map((t) => [String(t.id), String(t.nombre ?? "")]))
    const creacionPorId = new Map(tablas.map((t) => [String(t.id), String(t.fecha_creacion ?? "")]))

    const conTabla: Fila[] = filasCrudas.map((f) => ({
      ...f,
      tabla_nombre: nombrePorId.get(String(f.table_id)) ?? "Tabla eliminada",
      tabla_fecha_creacion: creacionPorId.get(String(f.table_id)) ?? "",
    }))

    const filas: Fila[] = conTabla.sort(
      (a, b) =>
        String(a.tabla_nombre).localeCompare(String(b.tabla_nombre)) ||
        String(a.fecha ?? "").localeCompare(String(b.fecha ?? "")),
    )

    const resumen = hojaResumen(
      "Resumen por tabla",
      [
        {
          titulo: "Universo exportado",
          filas: [
            conteo("Tablas de pago registradas", tablas.length),
            conteo("Filas exportadas", filas.length),
            dinero("Total planificado (no es egreso contable)", sumar(filas, "valor")),
          ],
        },
        {
          titulo: "Total por tabla de pago",
          filas: agrupar(filas, (f) => String(f.tabla_nombre), "valor"),
        },
      ],
      NOTAS_FLUJO_PAGOS,
    )

    const advertencias: string[] = []
    const huerfanas = filas.filter((f) => f.tabla_nombre === "Tabla eliminada")
    if (huerfanas.length > 0) {
      advertencias.push(
        `${huerfanas.length} fila(s) apuntan a una tabla de pago que ya no existe y salen como "Tabla eliminada".`,
      )
    }

    return { filas, hojas: [resumen], advertencias }
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. Consolidado anual
// ══════════════════════════════════════════════════════════════════════════════

const NOTAS_CONSOLIDADO = [
  "Una fila por mes de trabajo del año, resuelto con la tabla de meses: el mes_id nunca se construye en código porque no lleva cero de relleno.",
  "Total de ingresos de cada mes = ingresos del mes + ofrendas de células recibidas + alfolí del mes. No se suma nada más.",
  "Las ofrendas de células solo cuentan si están marcadas como recibidas; el alfolí se suma completo, sin exigir esa marca.",
  "Total de egresos de cada mes = solo la tabla de egresos. Pago diario, nómina y abonos a pasivos ya están espejados ahí.",
  "Es un informe de ejecución real: no existe tabla de presupuesto ni de metas en el sistema, así que no hay comparación contra presupuesto.",
  "Los meses sin fila en la tabla de meses quedan fuera del informe, aunque tengan ofrendas o alfolí registrados.",
]

const consolidadoAnual: DefinicionReporte<Fila> = {
  id: "finanzas-consolidado-anual",
  grupo: "Finanzas",
  titulo: "Consolidado anual",
  descripcion:
    "Un mes por fila con el total de ingresos de tres sumandos, el total de egresos y el resultado, más la fila de totales del año.",
  tablas: ["ingresos", "egresos", "ofrendas_celulas", "alfoli"],
  modulos: MODULOS_FLUJO,
  hoja: "Consolidado anual",
  archivo: "Finanzas_Consolidado_Anual",
  filtros: [
    {
      id: "anio",
      label: "Año",
      tipo: "anio",
      requerido: true,
      ayuda: "Los meses del año se resuelven con la tabla de meses, igual que el informe económico anual.",
    },
  ],
  columnas: [
    { key: "mesNombre", label: "Mes", ancho: 18 },
    { key: "estado", label: "Estado del mes", ancho: 14 },
    {
      key: "ingresosTabla",
      label: "Ingresos registrados",
      tipo: "moneda",
      totalizar: true,
      ayuda: "Sumando 1: todas las filas de la tabla de ingresos del mes.",
    },
    {
      key: "ofrendasRecibidas",
      label: "Ofrendas de células recibidas",
      tipo: "moneda",
      totalizar: true,
      ayuda: "Sumando 2: solo lo marcado como recibido.",
    },
    { key: "alfoli", label: "Alfolí", tipo: "moneda", totalizar: true, ayuda: "Sumando 3: el mes completo." },
    { key: "totalIngresos", label: "Total de ingresos", tipo: "moneda", totalizar: true },
    { key: "totalEgresos", label: "Total de egresos", tipo: "moneda", totalizar: true },
    { key: "resultado", label: "Ingresos menos egresos", tipo: "moneda", totalizar: true },
    { key: "mesNumero", label: "Mes (número)", tipo: "numero", ancho: 12, opcional: true },
    { key: "mesId", label: "Mes (ID)", ancho: 12, opcional: true },
    { key: "filasIngresos", label: "N° de ingresos", tipo: "numero", ancho: 14, opcional: true },
    { key: "filasEgresos", label: "N° de egresos", tipo: "numero", ancho: 14, opcional: true },
    {
      key: "ofrendasPendientes",
      label: "Ofrendas pendientes (fuera del total)",
      tipo: "moneda",
      totalizar: true,
      opcional: true,
    },
  ],
  notas: NOTAS_CONSOLIDADO,
  obtener: async (ctx) => {
    const anio = Number(ctx.filtros.anio) || new Date().getFullYear()

    // `ctx.meses` ya viene de `cargarMeses()`; la relectura es el respaldo por si
    // la pantalla no alcanzó a cargar el catálogo.
    const catalogo = ctx.meses.length > 0 ? ctx.meses : await cargarMeses()
    const mesesDelPeriodo = mesesDelAnio(catalogo, anio)
    if (mesesDelPeriodo.length === 0) {
      throw new ErrorReporte(
        `No hay meses de trabajo registrados para ${anio}. El informe se arma con la tabla de meses, así que no hay nada que consolidar.`,
      )
    }

    const ids = mesesDelPeriodo.map((m) => m.id)

    const [ingresos, egresos, ofrendasLeidas, alfoliLeido] = await Promise.all([
      seleccionarTodo<Fila>("ingresos", (q: any) => q.in("mes_id", ids)),
      seleccionarTodo<Fila>("egresos", (q: any) => q.in("mes_id", ids)),
      seleccionarSiHayPermiso<Fila>("ofrendas_celulas", (q: any) => q.eq("anio", anio)),
      seleccionarSiHayPermiso<Fila>("alfoli", (q: any) => q.eq("anio", anio)),
    ])

    // Igual que en el informe mensual: un sumando sin permiso no se omite en
    // silencio, se rotula y se avisa.
    const sinOfrendas = ofrendasLeidas === null
    const sinAlfoli = alfoliLeido === null
    const ofrendas = ofrendasLeidas ?? []
    const alfoli = alfoliLeido ?? []

    const porMesId = (filas: Fila[], mesId: string) => filas.filter((f) => String(f.mes_id) === mesId)
    const porMesNumero = (filas: Fila[], mes: number) => filas.filter((f) => Number(f.mes) === mes)

    const filas: Fila[] = mesesDelPeriodo.map((mes) => {
      const ingresosMes = porMesId(ingresos, mes.id)
      const egresosMes = porMesId(egresos, mes.id)
      const ofrendasMes = porMesNumero(ofrendas, mes.mes)
      const alfoliMes = porMesNumero(alfoli, mes.mes)

      const ingresosTabla = sumar(ingresosMes, "monto")
      const ofrendasRecibidas = sumar(recibidas(ofrendasMes), "valor")
      const totalAlfoli = sumar(alfoliMes, "valor")
      const totalIngresos = ingresosTabla + ofrendasRecibidas + totalAlfoli
      const totalEgresos = sumar(egresosMes, "monto")

      return {
        mesId: mes.id,
        mesNombre: mes.nombre,
        mesNumero: mes.mes,
        estado: mes.activo ? "Activo" : "Cerrado",
        ingresosTabla,
        ofrendasRecibidas,
        alfoli: totalAlfoli,
        totalIngresos,
        totalEgresos,
        resultado: totalIngresos - totalEgresos,
        filasIngresos: ingresosMes.length,
        filasEgresos: egresosMes.length,
        ofrendasPendientes: sumar(ofrendasMes, "valor") - ofrendasRecibidas,
      }
    })

    const resumen = hojaResumen(
      "Resumen del año",
      [
        {
          titulo: `Año ${anio}`,
          filas: [
            conteo("Meses de trabajo registrados", mesesDelPeriodo.length),
            texto("Meses incluidos", mesesDelPeriodo.map((m) => m.nombre).join(", ")),
          ],
        },
        {
          titulo:
            sinOfrendas || sinAlfoli
              ? "Ingresos del año — PARCIAL, falta algún sumando por permisos"
              : "Ingresos del año — tres sumandos",
          filas: [
            dinero("1. Ingresos registrados", sumar(filas, "ingresosTabla")),
            sinOfrendas
              ? texto("2. Ofrendas de células recibidas", "sin acceso a la tabla: NO incluido")
              : dinero("2. Ofrendas de células recibidas", sumar(filas, "ofrendasRecibidas")),
            sinAlfoli
              ? texto("3. Alfolí", "sin acceso a la tabla: NO incluido")
              : dinero("3. Alfolí", sumar(filas, "alfoli")),
            dinero(
              sinOfrendas || sinAlfoli ? "TOTAL PARCIAL DE INGRESOS DEL AÑO" : "TOTAL DE INGRESOS DEL AÑO",
              sumar(filas, "totalIngresos"),
            ),
          ],
        },
        {
          titulo: "Egresos del año — un solo sumando",
          filas: [dinero("TOTAL DE EGRESOS DEL AÑO", sumar(filas, "totalEgresos"))],
        },
        {
          titulo: "Resultado del año",
          filas: [dinero("Ingresos menos egresos", sumar(filas, "resultado"))],
        },
        {
          titulo: "Resultado por mes",
          filas: filas.map((f) => dinero(String(f.mesNombre), monto(f.resultado))),
        },
      ],
      NOTAS_CONSOLIDADO,
    )

    // Ofrendas y alfolí de meses del año que no tienen fila en `meses`: el
    // informe no puede ubicarlas y quedan fuera, igual que en el informe anual.
    const mesesConocidos = new Set(mesesDelPeriodo.map((m) => m.mes))
    const fueraDeCatalogo =
      sumar(recibidas(ofrendas).filter((f) => !mesesConocidos.has(Number(f.mes))), "valor") +
      sumar(alfoli.filter((f) => !mesesConocidos.has(Number(f.mes))), "valor")

    const advertencias: string[] = []
    if (sinOfrendas) {
      advertencias.push(
        "Su cuenta no tiene acceso a las ofrendas de células: los totales de ingresos son parciales y así están rotulados.",
      )
    }
    if (sinAlfoli) {
      advertencias.push(
        "Su cuenta no tiene acceso al alfolí: los totales de ingresos son parciales y así están rotulados.",
      )
    }
    if (fueraDeCatalogo > TOLERANCIA) {
      advertencias.push(
        `${fueraDeCatalogo.toFixed(2)} en ofrendas de células y alfolí pertenecen a meses de ${anio} que no existen en la tabla de meses, así que no entran al consolidado.`,
      )
    }

    return { filas, hojas: [resumen], advertencias }
  },
}

export const reportesFinanzas: DefinicionReporte<Record<string, unknown>>[] = [
  ingresosEgresosMes,
  diezmosOfrendas,
  alfoli,
  ofrendasCelulas,
  cajaChica,
  pagoDiario,
  nomina,
  pasivos,
  flujoPagos,
  consolidadoAnual,
]
