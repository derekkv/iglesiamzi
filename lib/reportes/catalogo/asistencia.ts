/**
 * Reportes de asistencia, cronogramas, mensajes y requerimientos.
 *
 * Tres advertencias de esquema que condicionan todo este archivo:
 *
 * 1. **Tres anclajes de periodo distintos y no intercambiables.** La matriz de
 *    asistencia general y la asistencia al culto se filtran por `mes_id`
 *    (texto `"YYYY-M"`, FK a `meses.id`); la asistencia de servidores, el
 *    cronograma y los atrasados no tienen `mes_id` y se filtran por rango de
 *    `fecha`; mensajes y requerimientos tampoco tienen mes y se anclan a su
 *    propia fecha. El `mes_id` nunca se construye en código: se resuelve con
 *    `mesDelFiltro` contra la tabla `meses`.
 * 2. **`asistencia_datos` guarda la cantidad en `cantidad`, no en `valor`.**
 *    `lib/database.ts:72-78` declara `valor: number`, pero el upsert real
 *    (`lib/mod/attendance-service.ts:141`) y todas las lecturas de la UI
 *    (`app/dashboard/asistencia/page.tsx:100,244-246`) usan `cantidad`.
 * 3. **El módulo `listados` no tiene acceso a ninguna tabla de este dominio**
 *    (`lib/module-table-map.ts:122-172,289-317,360-367`), y es deliberado: son
 *    datos de gestión interna de cada ministerio. Por eso el campo `modulos`
 *    de cada reporte lista los módulos dueños de los datos; quien solo tenga
 *    permiso de listados verá el reporte bloqueado, no un 403 al exportar.
 *
 * Columnas que no se pudieron confirmar y por eso NO se exportan:
 *
 * - `asistencia_servidores.observacion`: **no existe**. La tabla solo guarda
 *   `modulo`, `user_id`, `user_name`, `fecha`, `estado` y `updated_at`
 *   (`components/ControlAsistenciaServidores.tsx:33-40,183-193`); no hay
 *   ningún `select`, `insert` ni `update` de una observación en el repo.
 * - `asistencia_servidores.created_at`: DUDOSA, nunca leída ni escrita en
 *   código (inventario `.agents/inventario/04-asistencia.md`, sección 4). No
 *   se declara como columna para no romper el `select`.
 */

import {
  ESTADOS_ASISTENCIA,
  ESTADOS_SERVIDOR,
  MINISTERIOS,
  etiqueta,
  mesDelFiltro,
  opcionesMinisterios,
  seleccionarTodo,
} from "../data"
import { ErrorReporte } from "../ejecutar"
import { aNumero, hojaDesdeFilas } from "../excel"
import type {
  ColumnaReporte,
  DefinicionReporte,
  FiltroReporte,
  HojaReporte,
  MesRef,
  TipoColumna,
  ValorCelda,
} from "../types"

type Fila = Record<string, unknown>

// ─── Utilidades locales ───────────────────────────────────────────────────────

/**
 * Primer y último día del mes de trabajo, con el mismo cálculo del módulo de
 * servidores (`ControlAsistenciaServidores.tsx:136-137`). Estas tablas no
 * tienen `mes_id`: el mes se traduce a un rango de `fecha`.
 */
function rangoDelMes(mes: MesRef): { desde: string; hasta: string } {
  const mm = String(mes.mes).padStart(2, "0")
  const ultimoDia = new Date(mes.anio, mes.mes, 0).getDate()
  return {
    desde: `${mes.anio}-${mm}-01`,
    hasta: `${mes.anio}-${mm}-${String(ultimoDia).padStart(2, "0")}`,
  }
}

/**
 * Consulta `in(...)` por lotes. PostgREST manda la lista en la URL, así que un
 * `in` con miles de ids falla por longitud; 300 por lote va sobrado.
 */
async function seleccionarPorLotes<T>(
  tabla: string,
  columna: string,
  valores: Array<string | number>,
  select?: string,
): Promise<T[]> {
  const TAMANO_LOTE = 300
  const salida: T[] = []
  for (let i = 0; i < valores.length; i += TAMANO_LOTE) {
    const lote = valores.slice(i, i + TAMANO_LOTE)
    salida.push(...(await seleccionarTodo<T>(tabla, (q) => q.in(columna, lote), { select })))
  }
  return salida
}

/** Ministerio como filtro de opción. El valor guardado es el slug en minúsculas. */
function filtroMinisterio(id: string, label: string, opcionTodos?: string): FiltroReporte {
  return {
    id,
    label,
    tipo: "opcion",
    opciones: opcionesMinisterios(),
    ...(opcionTodos ? { opcionTodos } : { requerido: true }),
    ayuda: "La tabla guarda el slug del ministerio en minúsculas y sin tildes.",
  }
}

/** Ministerio legible desde la columna discriminadora que corresponda. */
function columnaMinisterio(clave: string, label: string): ColumnaReporte<Fila> {
  return {
    key: clave,
    label,
    ancho: 20,
    valor: (f) => etiqueta(MINISTERIOS, f[clave]),
  }
}

/** Booleano de tres estados: sí, no o sin marcar. */
function siNoVacio(valor: unknown): string {
  if (valor === true) return "Sí"
  if (valor === false) return "No"
  return ""
}

const COLS_AUDITORIA: ColumnaReporte<Fila>[] = [
  { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
  { key: "created_at", label: "Creado el", tipo: "fechaHora", opcional: true },
  { key: "updated_at", label: "Actualizado el", tipo: "fechaHora", opcional: true },
]

// ─── 1. Asistencia general (matriz) ───────────────────────────────────────────

const asistenciaGeneral: DefinicionReporte<Fila> = {
  id: "asistencia-general",
  grupo: "Asistencia",
  titulo: "Asistencia general (matriz)",
  descripcion:
    "Matriz del módulo de asistencia: una fila por categoría de conteo, una columna por cada fecha del mes, con totales por fila y por columna.",
  tablas: ["asistencia_detalles", "asistencia_columnas", "asistencia_datos"],
  modulos: ["asistencia", "control_mensual", "resumen-pastoral"],
  hoja: "Asistencia general",
  archivo: "Asistencia_General",
  filtros: [{ id: "mes", label: "Mes", tipo: "mes", requerido: true }],
  columnas: [
    {
      key: "detalle",
      label: "Detalle / categoría",
      ancho: 42,
      ayuda:
        "La hoja se arma completa como matriz: las columnas de fecha y la de total salen del mes elegido, no de este selector.",
    },
  ],
  notas: [
    "Las filas son las de asistencia_detalles del mes y las columnas las de asistencia_columnas, ambas en su orden guardado (columna orden).",
    "El encabezado de cada fecha es el nombre de la columna, no la fecha: las columnas creadas a mano pueden no tener fecha registrada, mientras el cron de domingos la llena y nombra la columna como \"Dom DD/MM\".",
    "Una celda sin registro en asistencia_datos se exporta como 0, igual que la muestra el módulo.",
    "El total por fila suma todas las fechas del mes y el total por columna suma todas las categorías; la celda inferior derecha es el gran total.",
  ],
  obtener: async (ctx) => {
    const mes = mesDelFiltro(ctx.filtros, ctx.meses, ctx.mesActivo)
    if (!mes) throw new ErrorReporte("Seleccione el mes que quiere exportar.")

    const [detalles, columnas, datos] = await Promise.all([
      seleccionarTodo<Fila>("asistencia_detalles", (q) =>
        q.eq("mes_id", mes.id).order("orden", { ascending: true }),
      ),
      seleccionarTodo<Fila>("asistencia_columnas", (q) =>
        q.eq("mes_id", mes.id).order("orden", { ascending: true }),
      ),
      seleccionarTodo<Fila>("asistencia_datos", (q) => q.eq("mes_id", mes.id)),
    ])

    if (detalles.length === 0) {
      throw new ErrorReporte(
        `El mes "${mes.nombre}" no tiene categorías de asistencia registradas. Ábralo en el módulo de asistencia para que se creen.`,
      )
    }
    if (columnas.length === 0) {
      throw new ErrorReporte(
        `El mes "${mes.nombre}" no tiene columnas de asistencia, así que no hay matriz que exportar. Cree las fechas en el módulo de asistencia.`,
      )
    }

    // La clave única real de una celda es (detalle_id, columna_id)
    // (attendance-service.ts:145).
    const celdas = new Map<string, number>()
    for (const dato of datos) {
      celdas.set(`${dato.detalle_id}-${dato.columna_id}`, aNumero(dato.cantidad))
    }

    const encabezados = [
      "Detalle / categoría",
      ...columnas.map((c) => String(c.nombre ?? "")),
      "Total",
    ]
    const tipos: (TipoColumna | undefined)[] = [
      undefined,
      ...columnas.map(() => "numero" as TipoColumna),
      "numero",
    ]
    const anchos = [42, ...columnas.map(() => 12), 12]

    const filas: ValorCelda[][] = detalles.map((detalle) => {
      const valores = columnas.map((columna) => celdas.get(`${detalle.id}-${columna.id}`) ?? 0)
      const total = valores.reduce((suma, v) => suma + v, 0)
      return [String(detalle.nombre ?? ""), ...valores, total]
    })

    const totalesPorColumna = columnas.map((_, i) =>
      filas.reduce((suma, fila) => suma + aNumero(fila[i + 1]), 0),
    )
    const totales: ValorCelda[] = [
      "TOTAL",
      ...totalesPorColumna,
      totalesPorColumna.reduce((suma, v) => suma + v, 0),
    ]

    const hojaPrincipal: HojaReporte = {
      nombre: "Asistencia general",
      encabezados,
      filas,
      tipos,
      anchos,
      totales,
      sinAutofiltro: true,
    }

    const sinFecha = columnas.filter((c) => !c.fecha).length
    const advertencias =
      sinFecha > 0
        ? [`${sinFecha} columna(s) del mes no tienen fecha registrada; se identifican solo por su nombre.`]
        : []

    return { hojaPrincipal, advertencias }
  },
}

// ─── 2. Asistencia de servidores ──────────────────────────────────────────────

/**
 * Letra con la que la matriz del módulo muestra cada estado
 * (`ControlAsistenciaServidores.tsx:42-48`). "pendiente" no se guarda: al
 * elegirlo se borra la fila (líneas 172-179), así que ausencia ≡ pendiente.
 */
const CODIGO_SERVIDOR: Record<string, string> = {
  asistio: "A",
  falto: "F",
  justifico: "J",
  atrasado: "AT",
}

/** Resumen por servidor: conteos por estado y % de asistencia sobre registros. */
function resumenServidores(filas: Fila[]): HojaReporte {
  interface Acumulado {
    nombre: string
    asistio: number
    falto: number
    justifico: number
    atrasado: number
  }

  const porServidor = new Map<string, Acumulado>()
  for (const fila of filas) {
    const clave = String(fila.user_id ?? fila.user_name ?? "")
    const acumulado: Acumulado =
      porServidor.get(clave) ??
      { nombre: String(fila.user_name ?? ""), asistio: 0, falto: 0, justifico: 0, atrasado: 0 }

    const estado = String(fila.estado ?? "")
    if (estado === "asistio") acumulado.asistio += 1
    else if (estado === "falto") acumulado.falto += 1
    else if (estado === "justifico") acumulado.justifico += 1
    else if (estado === "atrasado") acumulado.atrasado += 1

    porServidor.set(clave, acumulado)
  }

  const resumen = [...porServidor.values()]
    .map((s) => {
      const registros = s.asistio + s.falto + s.justifico + s.atrasado
      return { ...s, registros, porcentaje: registros > 0 ? s.asistio / registros : 0 }
    })
    .sort((a, b) => b.porcentaje - a.porcentaje || a.nombre.localeCompare(b.nombre))

  const sumar = (campo: "asistio" | "falto" | "justifico" | "atrasado" | "registros") =>
    resumen.reduce((suma, s) => suma + s[campo], 0)

  const registrosTotales = sumar("registros")

  return {
    nombre: "Resumen por servidor",
    encabezados: [
      "Servidor",
      "Asistió",
      "Faltó",
      "Justificó",
      "Atrasado",
      "Registros",
      "% de asistencia",
    ],
    filas: resumen.map((s) => [
      s.nombre,
      s.asistio,
      s.falto,
      s.justifico,
      s.atrasado,
      s.registros,
      s.porcentaje,
    ]),
    tipos: [undefined, "numero", "numero", "numero", "numero", "numero", "porcentaje"],
    anchos: [34, 11, 11, 12, 12, 12, 16],
    totales: [
      "TOTAL",
      sumar("asistio"),
      sumar("falto"),
      sumar("justifico"),
      sumar("atrasado"),
      registrosTotales,
      registrosTotales > 0 ? sumar("asistio") / registrosTotales : 0,
    ],
    notas: [
      "El % de asistencia divide las asistencias entre los registros existentes del servidor, que excluyen los pendientes porque esos no se guardan. Es el criterio de las vistas pastorales (app/dashboard/resumen-mensual/page.tsx:303).",
      "El módulo de asistencia de servidores calcula ese mismo porcentaje sobre el número de domingos del mes (ControlAsistenciaServidores.tsx:232-243), así que sus cifras serán más bajas que las de esta hoja cuando falten celdas por marcar.",
    ],
  }
}

const asistenciaServidores: DefinicionReporte<Fila> = {
  id: "asistencia-servidores",
  grupo: "Asistencia",
  titulo: "Asistencia de servidores",
  descripcion:
    "Asistencia dominical de los servidores de un ministerio: detalle por servidor y fecha, más un resumen con sus conteos y porcentaje de asistencia.",
  tablas: ["asistencia_servidores"],
  modulos: [
    "asistencia-servidores-protocolo",
    "asistencia-servidores-administracion",
    "asistencia-servidores-discipulado",
    "asistencia-servidores-alabanza",
    "asistencia-servidores-comunicacion",
    "asistencia-servidores-herederos",
    "asistencia-servidores-intercesion",
    "asistencia-servidores-mdg",
    "asistencia-servidores-redil",
    "asistencia-servidores-hombres",
    "asistencia-servidores-jovenes",
    "asistencia-servidores-pastoral",
    "asistencia-servidores-celulas",
    "asistencia-servidores-proyecto-mario",
    "control_mensual",
    "resumen-pastoral",
  ],
  hoja: "Detalle por servidor",
  archivo: "Asistencia_Servidores",
  filtros: [
    filtroMinisterio("ministerio", "Ministerio"),
    {
      id: "mes",
      label: "Mes",
      tipo: "mes",
      ayuda: "Esta tabla no tiene mes_id: el mes se traduce al rango de fechas que lo cubre.",
    },
  ],
  columnas: [
    { key: "user_name", label: "Servidor", ancho: 34 },
    columnaMinisterio("modulo", "Ministerio"),
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    {
      key: "estado",
      label: "Estado",
      ancho: 14,
      valor: (f) => etiqueta(ESTADOS_SERVIDOR, f.estado),
    },
    {
      key: "codigo",
      label: "Código en la matriz",
      ancho: 18,
      opcional: true,
      ayuda: "Letra con la que el módulo muestra el estado en la matriz: A, F, J o AT.",
      valor: (f) => etiqueta(CODIGO_SERVIDOR, f.estado),
    },
    { key: "user_id", label: "ID del servidor", ancho: 38, opcional: true },
    { key: "updated_at", label: "Actualizado el", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "Solo se exportan las celdas marcadas. El módulo arma sus filas con los usuarios que tienen permiso de ver cronograma-<ministerio> (ControlAsistenciaServidores.tsx:98-130), así que un servidor sin ningún registro en el mes no aparece en este reporte.",
    "El estado pendiente no se guarda: al elegirlo el módulo borra la fila, por lo que la ausencia de un domingo equivale a pendiente, no a falta.",
    "La tabla no guarda observaciones ni ninguna nota por celda.",
    "Servidor es la copia de users.displayName del momento en que se marcó la celda, así que puede quedar desfasada si después se renombró al usuario.",
    `El código AT de esta matriz significa "${etiqueta(ESTADOS_SERVIDOR, "atrasado")}" sin umbral de minutos; no debe confundirse con el "${etiqueta(ESTADOS_ASISTENCIA, "AT")}" de los ciclos de formación, que usa las mismas letras con otro criterio.`,
    "Marcar atrasado en el módulo crea además una fila en gestion_atrasados y notifica al líder; ese seguimiento está en el reporte de atrasados.",
  ],
  obtener: async (ctx) => {
    const mes = mesDelFiltro(ctx.filtros, ctx.meses, ctx.mesActivo)
    if (!mes) throw new ErrorReporte("Seleccione el mes que quiere exportar.")

    const ministerio = ctx.filtros.ministerio
    const { desde, hasta } = rangoDelMes(mes)

    const filas = await seleccionarTodo<Fila>("asistencia_servidores", (q) =>
      q
        .eq("modulo", ministerio)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("user_name", { ascending: true })
        .order("fecha", { ascending: true }),
    )

    return { filas, hojas: [resumenServidores(filas)] }
  },
}

// ─── 3. Asistencia al culto ───────────────────────────────────────────────────

/** Censos de los que sale una persona de `asistencia_culto` (CHECK en SQL). */
const FUENTES_CULTO: Record<string, string> = {
  protocolo: "Protocolo",
  mdg: "MDG",
  jovenes: "Jóvenes",
}

const COLS_SEGUIMIENTO_CULTO: ColumnaReporte<Fila>[] = [
  { key: "apellido", label: "Apellidos", ancho: 24 },
  { key: "nombre", label: "Nombres", ancho: 24 },
  { key: "fuente", label: "Censo de origen", ancho: 16, valor: (f) => etiqueta(FUENTES_CULTO, f.fuente) },
  { key: "total_faltas", label: "Total de faltas", tipo: "numero", ancho: 15 },
  { key: "celular", label: "Celular", ancho: 14 },
  { key: "gestionado", label: "Gestionado", tipo: "booleano", ancho: 12 },
  { key: "respuesta_gestion", label: "Respuesta de la gestión", ancho: 44 },
  { key: "gestionado_por_nombre", label: "Gestionado por", ancho: 26 },
  { key: "fecha_gestion", label: "Fecha de gestión", tipo: "fechaHora" },
  {
    key: "movido_automaticamente",
    label: "Movido automáticamente",
    tipo: "booleano",
    ayuda: "Verdadero cuando el proceso automático de seguimiento creó la fila, no un líder.",
  },
  { key: "persona_id", label: "ID de la persona", tipo: "numero", ancho: 14, opcional: true },
  { key: "mes_id", label: "Mes", ancho: 10, opcional: true },
  { key: "created_at", label: "Creado el", tipo: "fechaHora", opcional: true },
]

const asistenciaCulto: DefinicionReporte<Fila> = {
  id: "asistencia-culto",
  grupo: "Asistencia",
  titulo: "Asistencia al culto",
  descripcion:
    "Asistencia dominical persona por persona en el mes, con una segunda hoja de las personas en seguimiento por acumular faltas.",
  tablas: ["asistencia_culto", "asistencia_culto_seguimiento"],
  modulos: ["asistencia_culto", "control_mensual", "resumen-pastoral"],
  hoja: "Asistencia al culto",
  archivo: "Asistencia_Culto",
  filtros: [
    { id: "mes", label: "Mes", tipo: "mes" },
    {
      id: "marca",
      label: "Marca de asistencia",
      tipo: "opcion",
      opcionTodos: "Todas",
      opciones: [
        { value: "asistio", label: "Solo asistencias" },
        { value: "falto", label: "Solo faltas" },
      ],
    },
  ],
  columnas: [
    { key: "apellido", label: "Apellidos", ancho: 24 },
    { key: "nombre", label: "Nombres", ancho: 24 },
    {
      key: "fuente",
      label: "Censo de origen",
      ancho: 16,
      valor: (f) => etiqueta(FUENTES_CULTO, f.fuente),
    },
    { key: "fecha_domingo", label: "Domingo", tipo: "fecha" },
    {
      key: "asistio",
      label: "Asistencia",
      ancho: 13,
      ayuda: "Asistió, Faltó o vacío cuando la celda no tiene marca.",
      valor: (f) => (f.asistio === true ? "Asistió" : f.asistio === false ? "Faltó" : ""),
    },
    { key: "celular", label: "Celular", ancho: 14 },
    { key: "registrado_por_nombre", label: "Registrado por", ancho: 26 },
    { key: "persona_id", label: "ID de la persona", tipo: "numero", ancho: 14, opcional: true },
    { key: "mes_id", label: "Mes", ancho: 10, opcional: true },
    ...COLS_AUDITORIA,
  ],
  notas: [
    "Las personas no se guardan por nombre: la fila apunta al censo con el par persona_id + fuente (censo, censo_mdg o censo_jovenes). No es una llave foránea declarada, así que nombre, apellido y celular son la copia que existía al registrar la asistencia.",
    "Los domingos se calculan en código al abrir el mes (lib/mod/asistencia-culto-service.ts:79-98); no hay tabla de calendario. Una persona sin fila en un domingo simplemente no fue marcada: al elegir \"ninguno\" el módulo borra el registro.",
    "Una persona entra en seguimiento cuando acumula 2 faltas o más en el mes, contando las filas con asistio = false (asistencia-culto-service.ts:311-341). El cálculo se dispara al marcar cada falta y también en lote desde el proceso automático, que marca la fila como movida automáticamente.",
    "La clave única de la asistencia es persona_id + fuente + domingo, y la del seguimiento persona_id + fuente + mes.",
    "La respuesta de la gestión es texto libre; el módulo le añade al inicio un prefijo que indica si se pudo gestionar o no.",
    "La columna movido_automaticamente existe en la base y el servicio la escribe, pero falta en la migración versionada sql/asistencia_culto.sql: si el reporte falla por esa columna, es la base la que está detrás.",
  ],
  obtener: async (ctx) => {
    const mes = mesDelFiltro(ctx.filtros, ctx.meses, ctx.mesActivo)
    if (!mes) throw new ErrorReporte("Seleccione el mes que quiere exportar.")

    const [filas, seguimiento] = await Promise.all([
      seleccionarTodo<Fila>("asistencia_culto", (q) => {
        let consulta = q
          .eq("mes_id", mes.id)
          .order("apellido", { ascending: true })
          .order("fecha_domingo", { ascending: true })
        if (ctx.filtros.marca === "asistio") consulta = consulta.eq("asistio", true)
        if (ctx.filtros.marca === "falto") consulta = consulta.eq("asistio", false)
        return consulta
      }),
      seleccionarTodo<Fila>("asistencia_culto_seguimiento", (q) =>
        q
          .eq("mes_id", mes.id)
          .order("total_faltas", { ascending: false })
          .order("apellido", { ascending: true }),
      ),
    ])

    const hojas: HojaReporte[] = []
    if (seguimiento.length > 0) {
      hojas.push(
        hojaDesdeFilas("Seguimiento (2+ faltas)", seguimiento, COLS_SEGUIMIENTO_CULTO, {
          notas: [
            `Mes: ${mes.nombre}`,
            "Una fila por persona con 2 faltas o más en el mes. Las personas sin gestionar son las que tienen Gestionado en No.",
          ],
        }),
      )
    }

    const advertencias =
      seguimiento.length === 0
        ? [`El mes "${mes.nombre}" no tiene personas en seguimiento, así que no se añadió esa hoja.`]
        : []

    return { filas, hojas, advertencias }
  },
}

// ─── 4. Cronograma de servicio ────────────────────────────────────────────────

/** Módulos con acceso a `cronograma_servicio` (`lib/module-table-map.ts:123-141`). */
const MODULOS_CRONOGRAMA = [
  "cronograma-protocolo",
  "cronograma-administracion",
  "cronograma-discipulado",
  "cronograma-alabanza",
  "cronograma-comunicacion",
  "cronograma-herederos",
  "cronograma-intercesion",
  "cronograma-mdg",
  "cronograma-redil",
  "cronograma-hombres",
  "cronograma-jovenes",
  "cronograma-pastoral",
  "cronograma-celulas",
  "cronograma-proyecto-mario",
  "cronograma-eventos-celulas",
  "cronograma-eventos-protocolo",
  "cronograma-eventos-administracion",
  "cronograma-eventos-discipulado",
  "cronograma-eventos-alabanza",
  "cronograma-eventos-comunicacion",
  "cronograma-eventos-herederos",
  "cronograma-eventos-intercesion",
  "cronograma-eventos-mdg",
  "cronograma-eventos-redil",
  "cronograma-eventos-hombres",
  "cronograma-eventos-jovenes",
  "cronograma-eventos-pastoral",
  "cronograma-eventos-proyecto-mario",
  "gestion-cronogramas",
]

const cronogramaServicio: DefinicionReporte<Fila> = {
  id: "cronograma-servicio",
  grupo: "Cronogramas y comunicación interna",
  titulo: "Cronograma de servicio",
  descripcion:
    "Asignaciones de servicio por fecha y servidor, con la hora de entrada, la hora de llegada, el atraso y el estado de los acuses y alertas.",
  tablas: ["cronograma_servicio"],
  modulos: MODULOS_CRONOGRAMA,
  hoja: "Cronograma",
  archivo: "Cronograma_Servicio",
  filtros: [
    filtroMinisterio("ministerio", "Ministerio", "Todos los ministerios"),
    {
      id: "rango",
      label: "Fecha de la asignación",
      tipo: "rangoFechas",
      ayuda: "Esta tabla no tiene mes_id: el periodo siempre se delimita por la fecha de la asignación.",
    },
    {
      id: "soloEventos",
      label: "Asignaciones con evento",
      tipo: "opcion",
      valorInicial: "todas",
      opciones: [
        { value: "todas", label: "Todas las asignaciones" },
        { value: "evento", label: "Solo las que tienen evento escrito" },
      ],
      ayuda:
        "No hay columna que separe el cronograma de servicio del de eventos. Filtrar por evento con contenido es lo más cercano, y es un criterio nuevo de este reporte.",
    },
  ],
  columnas: [
    { key: "fecha", label: "Fecha", tipo: "fecha" },
    columnaMinisterio("modulo", "Ministerio"),
    {
      key: "ministerio",
      label: "Ministerio (etiqueta guardada)",
      ancho: 26,
      opcional: true,
      ayuda: "Nombre legible elegido en el formulario; viene de module_groups.display_name, no del slug.",
    },
    { key: "user_name", label: "Servidor", ancho: 34 },
    { key: "asignacion", label: "Asignación", ancho: 30 },
    { key: "evento", label: "Evento", ancho: 26 },
    { key: "hora_entrada", label: "Hora de entrada", ancho: 16 },
    { key: "hora_llegada", label: "Hora de llegada", ancho: 16 },
    {
      key: "atraso",
      label: "Atraso",
      ancho: 10,
      ayuda: "Vacío cuando nadie marcó la llegada; el módulo lo muestra como un guion.",
      valor: (f) => siNoVacio(f.atraso),
    },
    { key: "acuse_asignacion", label: "Acuse de la asignación", tipo: "booleano", opcional: true },
    { key: "acuse_asignacion_at", label: "Acuse de la asignación (fecha)", tipo: "fechaHora", opcional: true },
    { key: "alerta2_enviada", label: "Alerta de 5 días enviada", tipo: "booleano", opcional: true },
    { key: "alerta2_enviada_at", label: "Alerta de 5 días (fecha)", tipo: "fechaHora", opcional: true },
    { key: "acuse_alerta2", label: "Acuse de la alerta de 5 días", tipo: "booleano", opcional: true },
    { key: "acuse_alerta2_at", label: "Acuse de la alerta de 5 días (fecha)", tipo: "fechaHora", opcional: true },
    { key: "alerta1_enviada", label: "Alerta de 1 día enviada", tipo: "booleano", opcional: true },
    { key: "alerta1_enviada_at", label: "Alerta de 1 día (fecha)", tipo: "fechaHora", opcional: true },
    { key: "acuse_alerta1", label: "Acuse de la alerta de 1 día", tipo: "booleano", opcional: true },
    { key: "acuse_alerta1_at", label: "Acuse de la alerta de 1 día (fecha)", tipo: "fechaHora", opcional: true },
    { key: "email_asignacion_enviado", label: "Correo de asignación enviado", tipo: "booleano", opcional: true },
    { key: "email_alerta2_enviado", label: "Correo de alerta de 5 días", tipo: "booleano", opcional: true },
    { key: "email_alerta1_enviado", label: "Correo de alerta de 1 día", tipo: "booleano", opcional: true },
    { key: "whatsapp_asignacion_enviado", label: "WhatsApp de asignación", tipo: "booleano", opcional: true },
    { key: "whatsapp_alerta2_enviado", label: "WhatsApp de alerta de 5 días", tipo: "booleano", opcional: true },
    { key: "whatsapp_alerta1_enviado", label: "WhatsApp de alerta de 1 día", tipo: "booleano", opcional: true },
    { key: "user_id", label: "ID del servidor", ancho: 38, opcional: true },
    ...COLS_AUDITORIA,
  ],
  notas: [
    "El cronograma de servicio y el de eventos son la misma tabla y los mismos registros: no existe ninguna columna que los distinga. La vista de eventos lee todos los ministerios sin filtro (lib/mod/cronograma-service.ts:51-59) y solo cambia cómo agrupa.",
    "Lo más cercano a un marcador de evento es la columna evento, que es texto libre y opcional; ni la vista de eventos la usa para filtrar.",
    "Ministerio sale del slug de la columna modulo, que es el discriminador real. La columna ministerio guarda la etiqueta que el usuario eligió en el formulario y puede estar vacía.",
    "Las alertas las envía el cron: la de 5 días antes es alerta2 y la de 1 día antes es alerta1 (app/api/cron-reminders/route.ts:196-215).",
    "El atraso de esta tabla lo marca el administrador a mano y es independiente de gestion_atrasados, que nace de la matriz de asistencia de servidores.",
    "Este reporte no excluye el ministerio pastoral; la vista de gestión de cronogramas sí lo oculta.",
  ],
  obtener: async (ctx) => ({
    filas: await seleccionarTodo<Fila>("cronograma_servicio", (q) => {
      let consulta = q.order("fecha", { ascending: false }).order("user_name", { ascending: true })
      if (ctx.filtros.ministerio) consulta = consulta.eq("modulo", ctx.filtros.ministerio)
      if (ctx.filtros.rango_desde) consulta = consulta.gte("fecha", ctx.filtros.rango_desde)
      if (ctx.filtros.rango_hasta) consulta = consulta.lte("fecha", ctx.filtros.rango_hasta)
      if (ctx.filtros.soloEventos === "evento") {
        consulta = consulta.not("evento", "is", null).neq("evento", "")
      }
      return consulta
    }),
  }),
}

// ─── 5. Atrasados ─────────────────────────────────────────────────────────────

/** Estado de la gestión tal como lo muestra el módulo (`CronogramaServicio.tsx:398-406`). */
function estadoAtraso(fila: Fila): string {
  if (fila.gestionado !== true) return "Pendiente"
  return fila.respuesta_gestion === true ? "Gestionado" : "No gestionado"
}

const atrasados: DefinicionReporte<Fila> = {
  id: "atrasados",
  grupo: "Cronogramas y comunicación interna",
  titulo: "Atrasados",
  descripcion:
    "Atrasos de servidores registrados desde la matriz de asistencia, con el acuerdo alcanzado, quién los gestionó y si se notificó al líder.",
  tablas: ["gestion_atrasados"],
  modulos: [
    "cronograma-protocolo",
    "cronograma-administracion",
    "cronograma-discipulado",
    "cronograma-alabanza",
    "cronograma-comunicacion",
    "cronograma-herederos",
    "cronograma-intercesion",
    "cronograma-mdg",
    "cronograma-redil",
    "cronograma-hombres",
    "cronograma-jovenes",
    "cronograma-pastoral",
    "cronograma-celulas",
    "cronograma-proyecto-mario",
    "gestion-cronogramas",
    "control_mensual",
    "resumen-pastoral",
  ],
  hoja: "Atrasados",
  archivo: "Atrasados",
  filtros: [
    filtroMinisterio("ministerio", "Ministerio", "Todos los ministerios"),
    {
      id: "rango",
      label: "Fecha del atraso",
      tipo: "rangoFechas",
      ayuda: "Esta tabla no tiene mes_id: el periodo se delimita por la fecha del atraso.",
    },
    {
      id: "gestion",
      label: "Estado de la gestión",
      tipo: "opcion",
      opcionTodos: "Todos",
      opciones: [
        { value: "pendiente", label: "Pendientes de gestionar" },
        { value: "gestionado", label: "Ya gestionados" },
      ],
    },
  ],
  columnas: [
    { key: "fecha", label: "Fecha del atraso", tipo: "fecha" },
    columnaMinisterio("modulo", "Ministerio"),
    { key: "user_name", label: "Servidor", ancho: 34 },
    { key: "estadoGestion", label: "Estado", ancho: 16, valor: estadoAtraso },
    { key: "gestionado", label: "Gestionado", tipo: "booleano", ancho: 12 },
    {
      key: "respuesta_gestion",
      label: "¿Se pudo gestionar?",
      ancho: 18,
      ayuda: "Vacío mientras el atraso sigue pendiente.",
      valor: (f) => siNoVacio(f.respuesta_gestion),
    },
    {
      key: "acuerdo",
      label: "Acuerdo",
      ancho: 44,
      ayuda: "El módulo lo recorta a 240 caracteres al guardar.",
    },
    { key: "gestionado_por_nombre", label: "Gestionado por", ancho: 26 },
    { key: "fecha_gestion", label: "Fecha de gestión", tipo: "fechaHora" },
    { key: "notificado", label: "Notificado al líder", tipo: "booleano", ancho: 18 },
    { key: "notificado_at", label: "Notificado el", tipo: "fechaHora" },
    { key: "registrado_por_nombre", label: "Registrado por", ancho: 26, opcional: true },
    { key: "user_id", label: "ID del servidor", ancho: 38, opcional: true },
    ...COLS_AUDITORIA,
  ],
  notas: [
    "La fila nace cuando un líder marca atrasado en la matriz de asistencia de servidores, y se borra si después cambia ese estado por otro (lib/mod/gestion-atrasados-service.ts:73-79). Por eso el reporte es la foto de los atrasos vigentes, no un histórico de cambios.",
    "Notificado al líder lo pone el proceso que avisa por push, correo y WhatsApp al líder del grupo dueño del módulo cronograma-<ministerio>.",
    "Notificado el existe en la base y el servicio la escribe, aunque falte en su interfaz de TypeScript.",
    "La clave única es ministerio + servidor + fecha, así que un servidor no puede tener dos atrasos el mismo día en el mismo ministerio.",
    "El campo atraso del cronograma de servicio es independiente: lo marca el administrador a mano y no crea filas aquí.",
  ],
  obtener: async (ctx) => ({
    filas: await seleccionarTodo<Fila>("gestion_atrasados", (q) => {
      let consulta = q.order("fecha", { ascending: false }).order("user_name", { ascending: true })
      if (ctx.filtros.ministerio) consulta = consulta.eq("modulo", ctx.filtros.ministerio)
      if (ctx.filtros.rango_desde) consulta = consulta.gte("fecha", ctx.filtros.rango_desde)
      if (ctx.filtros.rango_hasta) consulta = consulta.lte("fecha", ctx.filtros.rango_hasta)
      if (ctx.filtros.gestion === "pendiente") consulta = consulta.eq("gestionado", false)
      if (ctx.filtros.gestion === "gestionado") consulta = consulta.eq("gestionado", true)
      return consulta
    }),
  }),
}

// ─── 6. Mensajes y citaciones ─────────────────────────────────────────────────

const TIPOS_MENSAJE: Record<string, string> = {
  mensaje: "Mensaje",
  invitacion: "Invitación",
}

/** `destinatario_tipo` (`components/MensajesCitaciones.tsx:595-599`). */
const DESTINATARIOS_MENSAJE: Record<string, string> = {
  usuario: "Un usuario específico",
  modulo: "Todos los de un módulo",
  todos: "Todos los usuarios",
}

const MODULOS_MENSAJES = [
  "mensajes-administracion",
  "mensajes-protocolo",
  "mensajes-discipulado",
  "mensajes-alabanza",
  "mensajes-comunicacion",
  "mensajes-herederos",
  "mensajes-intercesion",
  "mensajes-mdg",
  "mensajes-redil",
  "mensajes-hombres",
  "mensajes-jovenes",
  "mensajes-pastoral",
  "mensajes-celulas",
  "mensajes-proyecto-mario",
]

const COLS_DESTINATARIOS: ColumnaReporte<Fila>[] = [
  { key: "mensaje_id", label: "ID del mensaje", tipo: "numero", ancho: 15 },
  { key: "mensaje_fecha", label: "Fecha del mensaje", tipo: "fecha" },
  { key: "mensaje_tipo", label: "Tipo", ancho: 13 },
  { key: "mensaje_remitente", label: "Remitente", ancho: 34 },
  { key: "mensaje_detalle", label: "Detalle", ancho: 44 },
  { key: "user_id", label: "ID del destinatario", ancho: 38 },
  { key: "leido", label: "Leído", tipo: "booleano", ancho: 10 },
  { key: "leido_at", label: "Leído el", tipo: "fechaHora" },
  { key: "created_at", label: "Recibido el", tipo: "fechaHora", opcional: true },
  { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
]

const mensajesCitaciones: DefinicionReporte<Fila> = {
  id: "mensajes-citaciones",
  grupo: "Cronogramas y comunicación interna",
  titulo: "Mensajes y citaciones",
  descripcion:
    "Mensajes e invitaciones enviados desde los ministerios, con cuántas personas los recibieron y cuántas los leyeron, más una hoja con cada destinatario.",
  tablas: ["mensajes_citaciones", "mensajes_citaciones_recibidos"],
  modulos: MODULOS_MENSAJES,
  hoja: "Mensajes enviados",
  archivo: "Mensajes_Citaciones",
  filtros: [
    filtroMinisterio("ministerio", "Ministerio de origen", "Todos los ministerios"),
    {
      id: "rango",
      label: "Fecha del mensaje",
      tipo: "rangoFechas",
      ayuda:
        "Filtra por la fecha del evento o la citación, que es obligatoria al enviar, no por la fecha de envío.",
    },
    {
      id: "tipo",
      label: "Tipo",
      tipo: "opcion",
      opcionTodos: "Mensajes e invitaciones",
      opciones: [
        { value: "mensaje", label: "Solo mensajes" },
        { value: "invitacion", label: "Solo invitaciones" },
      ],
    },
  ],
  columnas: [
    { key: "fecha", label: "Fecha del mensaje", tipo: "fecha" },
    columnaMinisterio("modulo_origen", "Ministerio de origen"),
    { key: "remitente_nombre", label: "Remitente", ancho: 36 },
    { key: "tipo", label: "Tipo", ancho: 13, valor: (f) => etiqueta(TIPOS_MENSAJE, f.tipo) },
    {
      key: "destinatario_tipo",
      label: "Tipo de destinatario",
      ancho: 24,
      valor: (f) => etiqueta(DESTINATARIOS_MENSAJE, f.destinatario_tipo),
    },
    { key: "destinatario_nombre", label: "Destinatario", ancho: 30 },
    {
      key: "destinatario_modulo",
      label: "Módulo de destino",
      ancho: 22,
      valor: (f) => etiqueta(MINISTERIOS, f.destinatario_modulo),
    },
    { key: "detalle", label: "Detalle", ancho: 46 },
    { key: "evento_lugar", label: "Evento o lugar", ancho: 28 },
    { key: "valor", label: "Valor", tipo: "moneda", totalizar: true },
    {
      key: "destinatarios",
      label: "Destinatarios",
      tipo: "numero",
      ancho: 14,
      totalizar: true,
      ayuda: "Filas de mensajes_citaciones_recibidos creadas para este mensaje.",
    },
    {
      key: "leidos",
      label: "Lo leyeron",
      tipo: "numero",
      ancho: 13,
      totalizar: true,
      ayuda: "Destinatarios con la marca de leído.",
    },
    {
      key: "porcentajeLectura",
      label: "% de lectura",
      tipo: "porcentaje",
      ancho: 14,
      opcional: true,
      ayuda: "Leídos sobre destinatarios. Es una métrica derivada de este reporte; el módulo no la calcula.",
    },
    { key: "created_at", label: "Enviado el", tipo: "fechaHora" },
    { key: "remitente_id", label: "ID del remitente", ancho: 38, opcional: true },
    { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
  ],
  notas: [
    "Al enviar, el módulo inserta un mensaje y luego una fila por destinatario en mensajes_citaciones_recibidos: para un usuario concreto, una sola fila; para un módulo, los usuarios con permiso de ver cronograma-<módulo> (no el de mensajes); para todos, los usuarios activos. En los dos casos masivos se excluye al remitente.",
    "La única señal de lectura es la marca de leído y su fecha, que el módulo escribe al abrir la tarjeta del mensaje. No existe confirmación de asistencia ni aceptación, ni para las invitaciones.",
    "Destinatarios, Lo leyeron y % de lectura se calculan en este reporte contando las filas de recibidos; el módulo solo muestra los no leídos del usuario que está mirando.",
    "La hoja de destinatarios identifica a cada persona por su ID de usuario: esa tabla no guarda el nombre y este reporte no lee la tabla de usuarios.",
    "El módulo de destino solo admite cuatro valores en el formulario (protocolo, administración, Mujeres de Gracia y discipulado), mucho menos que la lista de ministerios de origen.",
  ],
  obtener: async (ctx) => {
    const mensajes = await seleccionarTodo<Fila>("mensajes_citaciones", (q) => {
      let consulta = q.order("created_at", { ascending: false })
      if (ctx.filtros.ministerio) consulta = consulta.eq("modulo_origen", ctx.filtros.ministerio)
      if (ctx.filtros.rango_desde) consulta = consulta.gte("fecha", ctx.filtros.rango_desde)
      if (ctx.filtros.rango_hasta) consulta = consulta.lte("fecha", ctx.filtros.rango_hasta)
      if (ctx.filtros.tipo) consulta = consulta.eq("tipo", ctx.filtros.tipo)
      return consulta
    })

    const ids = mensajes
      .map((m) => m.id)
      .filter((id): id is number | string => id !== null && id !== undefined)

    const recibidos =
      ids.length > 0
        ? await seleccionarPorLotes<Fila>("mensajes_citaciones_recibidos", "mensaje_id", ids)
        : []

    const conteos = new Map<string, { destinatarios: number; leidos: number }>()
    for (const recibido of recibidos) {
      const clave = String(recibido.mensaje_id)
      const actual = conteos.get(clave) ?? { destinatarios: 0, leidos: 0 }
      actual.destinatarios += 1
      if (recibido.leido === true) actual.leidos += 1
      conteos.set(clave, actual)
    }

    const filas = mensajes.map((mensaje) => {
      const conteo = conteos.get(String(mensaje.id)) ?? { destinatarios: 0, leidos: 0 }
      return {
        ...mensaje,
        destinatarios: conteo.destinatarios,
        leidos: conteo.leidos,
        // En porcentaje el formateador divide entre 100, así que aquí va 0-100.
        porcentajeLectura:
          conteo.destinatarios > 0 ? (conteo.leidos / conteo.destinatarios) * 100 : "",
      }
    })

    const porId = new Map(mensajes.map((m) => [String(m.id), m]))
    const hojas: HojaReporte[] = []

    if (recibidos.length > 0) {
      const filasDestinatarios = recibidos.map((recibido) => {
        const mensaje = porId.get(String(recibido.mensaje_id))
        return {
          ...recibido,
          mensaje_fecha: mensaje?.fecha ?? "",
          mensaje_tipo: etiqueta(TIPOS_MENSAJE, mensaje?.tipo),
          mensaje_remitente: mensaje?.remitente_nombre ?? "",
          mensaje_detalle: mensaje?.detalle ?? "",
        }
      })

      hojas.push(
        hojaDesdeFilas("Destinatarios", filasDestinatarios, COLS_DESTINATARIOS, {
          notas: [
            "Una fila por destinatario de cada mensaje de la hoja anterior.",
            "El destinatario se identifica por su ID de usuario porque la tabla no guarda el nombre.",
          ],
        }),
      )
    }

    return { filas, hojas }
  },
}

// ─── 7. Requerimientos de bienes y servicios ──────────────────────────────────

/** `respuesta` (`components/RequerimientosBienesServicios.tsx:115-126`). */
const ESTADOS_REQUERIMIENTO: Record<string, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  negado: "Negado",
  suspenso: "Suspenso",
}

/**
 * Semáforo de cumplimiento, calcado de `getSemaforoActual`
 * (`RequerimientosBienesServicios.tsx:88-108`): solo aplica a los aprobados
 * con fecha de entrega, compara contra `fecha_entrega` a las 23:59:59 y usa la
 * fecha de recepción si ya se recibió o la de hoy si todavía no.
 *
 * El comentario del código dice "72h o más" para el rojo, pero el umbral
 * implementado es 48h; se conserva el umbral real.
 */
function cumplimientoRequerimiento(fila: Fila): string {
  if (fila.respuesta !== "aprobado") return ""
  const entrega = typeof fila.fecha_entrega === "string" ? fila.fecha_entrega.slice(0, 10) : ""
  if (!entrega) return ""

  const limite = new Date(`${entrega}T23:59:59`)
  if (isNaN(limite.getTime())) return ""

  const recibido =
    fila.recibido === true && typeof fila.fecha_recibido === "string"
      ? new Date(fila.fecha_recibido)
      : null
  const referencia = recibido && !isNaN(recibido.getTime()) ? recibido : new Date()

  const horas = (referencia.getTime() - limite.getTime()) / (1000 * 60 * 60)
  if (horas <= 24) return "Cumplido a tiempo (hasta 24 h)"
  if (horas <= 48) return "Entrega tardía (24 a 48 h)"
  return "Fuera de plazo (más de 48 h)"
}

const requerimientos: DefinicionReporte<Fila> = {
  id: "requerimientos-bienes-servicios",
  grupo: "Cronogramas y comunicación interna",
  titulo: "Requerimientos de bienes y servicios",
  descripcion:
    "Requerimientos que cada ministerio pide a administración, con su estado, el valor solicitado, la entrega comprometida y el semáforo de cumplimiento.",
  tablas: ["requerimientos_bienes_servicios"],
  modulos: [
    "requerimientos-admin",
    "requerimientos-protocolo",
    "requerimientos-discipulado",
    "requerimientos-mdg",
    "requerimientos-alabanza",
    "requerimientos-intercesion",
    "requerimientos-herederos",
    "requerimientos-redil",
    "requerimientos-comunicacion",
    "requerimientos-jovenes",
    "requerimientos-hombres",
    "requerimientos-pastoral",
    "requerimientos-celulas",
    "requerimientos-proyecto-mario",
  ],
  hoja: "Requerimientos",
  archivo: "Requerimientos",
  filtros: [
    filtroMinisterio("ministerio", "Ministerio solicitante", "Todos los ministerios"),
    {
      id: "rango",
      label: "Fecha de solicitud",
      tipo: "rangoFechas",
      ayuda: "Esta tabla no tiene mes_id: el periodo se delimita por la fecha de solicitud.",
    },
    {
      id: "estado",
      label: "Estado",
      tipo: "opcion",
      opcionTodos: "Todos los estados",
      opciones: Object.entries(ESTADOS_REQUERIMIENTO).map(([value, label]) => ({ value, label })),
    },
  ],
  columnas: [
    { key: "fecha_requerimiento", label: "Fecha de solicitud", tipo: "fecha" },
    columnaMinisterio("modulo", "Ministerio solicitante"),
    { key: "persona_nombre", label: "Solicitante", ancho: 36 },
    { key: "requerimiento", label: "Requerimiento", ancho: 46 },
    { key: "valor", label: "Valor", tipo: "moneda", totalizar: true },
    { key: "evento_lugar", label: "Evento o lugar", ancho: 28 },
    {
      key: "respuesta",
      label: "Estado",
      ancho: 14,
      valor: (f) => etiqueta(ESTADOS_REQUERIMIENTO, f.respuesta),
    },
    { key: "fecha_entrega", label: "Entrega comprometida", tipo: "fecha" },
    {
      key: "cumplimiento",
      label: "Cumplimiento",
      ancho: 30,
      ayuda:
        "Solo se calcula en los aprobados con fecha de entrega. Si el requerimiento aún no se recibió, se mide contra el momento de exportar, así que puede cambiar entre un archivo y otro.",
      valor: cumplimientoRequerimiento,
    },
    { key: "recibido", label: "Recibido", tipo: "booleano", ancho: 11 },
    { key: "fecha_recibido", label: "Fecha de recepción", tipo: "fechaHora" },
    {
      key: "observaciones",
      label: "Observaciones",
      ancho: 44,
      ayuda: "Obligatorias cuando administración aprueba, niega o deja en suspenso.",
    },
    { key: "respondido_por_nombre", label: "Respondido por", ancho: 28 },
    { key: "fecha_respuesta", label: "Fecha de respuesta", tipo: "fechaHora" },
    {
      key: "ministerio",
      label: "Ministerio asignado",
      ancho: 22,
      opcional: true,
      ayuda: "Siempre vale \"Administración\": el módulo escribe ese literal e ignora el campo del formulario.",
    },
    { key: "persona_id", label: "ID del solicitante", ancho: 38, opcional: true },
    ...COLS_AUDITORIA,
  ],
  notas: [
    "El ministerio real del requerimiento es el slug de la columna modulo. La columna ministerio no es un dato: el módulo la escribe siempre con el literal \"Administración\", tanto al crear como al editar.",
    "Administración solo puede responder aprobado, negado o suspenso, y la observación es obligatoria al responder.",
    "El semáforo de cumplimiento compara la recepción contra la fecha de entrega comprometida al final del día: hasta 24 horas se considera a tiempo, entre 24 y 48 horas entrega tardía y por encima de 48 horas fuera de plazo. El comentario del código menciona 72 horas, pero el umbral implementado es 48.",
    "No existe el ministerio administración como solicitante en la lista del módulo: Administración es quien responde, así que un requerimiento con ese ministerio sería un dato heredado.",
    "La vista del solicitante considera editado un requerimiento cuando su fecha de actualización difiere de la de creación y sigue pendiente.",
  ],
  obtener: async (ctx) => ({
    filas: await seleccionarTodo<Fila>("requerimientos_bienes_servicios", (q) => {
      let consulta = q.order("fecha_requerimiento", { ascending: false })
      if (ctx.filtros.ministerio) consulta = consulta.eq("modulo", ctx.filtros.ministerio)
      if (ctx.filtros.rango_desde) consulta = consulta.gte("fecha_requerimiento", ctx.filtros.rango_desde)
      if (ctx.filtros.rango_hasta) consulta = consulta.lte("fecha_requerimiento", ctx.filtros.rango_hasta)
      if (ctx.filtros.estado) consulta = consulta.eq("respuesta", ctx.filtros.estado)
      return consulta
    }),
  }),
}

export const reportesAsistencia: DefinicionReporte<Fila>[] = [
  asistenciaGeneral,
  asistenciaServidores,
  asistenciaCulto,
  cronogramaServicio,
  atrasados,
  mensajesCitaciones,
  requerimientos,
]
