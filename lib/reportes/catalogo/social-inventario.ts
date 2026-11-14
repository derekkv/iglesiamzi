/**
 * Reportes de acción social, existencias e inventario.
 *
 * Decisiones que condicionan este catálogo, todas verificadas en el código:
 *
 * - **Ningún reporte de este archivo declara el módulo `listados`.** Es
 *   deliberado: `lib/module-table-map.ts:390-456` no concede a `listados` ni
 *   lectura sobre las tablas de Redil ni sobre las de existencias, porque los
 *   casos de ayuda social contienen datos de personas en situación de
 *   vulnerabilidad. Cada reporte declara los módulos dueños, así que la
 *   interfaz de listados los oculta a quien no tenga uno de ellos.
 * - **Las tres bodegas de existencias comparten esquema exacto**
 *   (`sql/existencia_ayuda.sql`, `existencia_administracion.sql`,
 *   `existencia_mdg.sql`): mismas columnas, tipos, CHECK, UNIQUE e índices. Lo
 *   único que cambia es el prefijo de tabla, el DEFAULT de `items.categoria`
 *   (`'Otro'` en ayuda, `'General'` en administración y MDG) y las semillas de
 *   categorías. Por eso hay un solo reporte parametrizado por bodega.
 * - **No existe ninguna columna de mínimo, umbral o stock de alerta** en
 *   `existencia_*_items` (verificado por grep en `sql/`, los tres servicios y
 *   las tres UI). El reporte de bodega no incluye columna "mínimo": sería un
 *   dato inventado. Lo que sí se puede calcular es la existencia teórica según
 *   movimientos, que es la columna de control que lleva la hoja.
 * - **`inventory_movements` no se usa.** No hay `.from("inventory_movements")`
 *   en el repo, ni interfaz, ni DDL: solo una suscripción realtime
 *   (`app/dashboard/inventario/page.tsx:91`) y su entrada de permisos. El
 *   reporte de inventario general se limita a `inventory_items`.
 *
 * Las etiquetas de enums se redeclaran aquí en lugar de importarse de los
 * servicios: `lib/mod/redil-ayuda-social-service.ts` y los
 * `existencia-*-service.ts` importan `@/lib/secure-db` y el servicio de
 * auditoría, que no deben entrar en el motor de reportes. Cada mapa cita su
 * origen para poder auditarlo.
 */

import { aplicarRango, etiqueta, rangoDelFiltro, seleccionarTodo } from "../data"
import { aNumero, hojaDesdeFilas } from "../excel"
import { ErrorReporte } from "../ejecutar"
import type {
  ColumnaReporte,
  ContextoReporte,
  DefinicionReporte,
  HojaReporte,
  OpcionFiltro,
} from "../types"

type Fila = Record<string, unknown>

/** Módulos que dan acceso a las tablas de Redil (`lib/module-table-map.ts:390-415`). */
const MODULOS_REDIL = ["redil_ayuda_social", "control_mensual", "resumen-pastoral"]

// ─── Catálogos de etiquetas ───────────────────────────────────────────────────

/** `ESTADOS_LABELS` de `lib/mod/redil-ayuda-social-service.ts:25-33`. */
const ESTADOS_CASO: Record<string, string> = {
  pendiente_visita: "Pendiente de visita",
  en_visita_tecnica: "En visita técnica",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  pendiente_entrega: "Pendiente de entrega",
  entregado: "Entregado",
  cerrado: "Cerrado",
}

/** `TIPOS_AYUDA` de `lib/mod/redil-ayuda-social-service.ts:45-53`, sin los iconos. */
const TIPOS_AYUDA: Record<string, string> = {
  canasta: "Canasta / Víveres",
  medicinas: "Medicinas",
  ropa: "Ropa",
  panales: "Pañales",
  utiles_escolares: "Útiles escolares",
  ayuda_economica: "Ayuda económica",
  otro: "Otro",
}

/** Selector de estado civil de la solicitud (`app/dashboard/redil-ayuda-social/page.tsx:147-151`). */
const ESTADOS_CIVILES: Record<string, string> = {
  soltero: "Soltero/a",
  casado: "Casado/a",
  divorciado: "Divorciado/a",
  viudo: "Viudo/a",
  union_libre: "Unión libre",
}

/** `visitas_tecnicas.resultado`: los dos únicos valores que escribe el módulo. */
const RESULTADOS_VISITA: Record<string, string> = {
  aprobado: "Aprobado",
  no_aprobado: "Denegado",
}

/** Recomendación técnica de la ficha (`app/dashboard/redil-ayuda-social/page.tsx:1064-1067`). */
const RECOMENDACIONES_VISITA: Record<string, string> = {
  apto: "Apto para participar",
  apto_acompanamiento: "Apto con acompañamiento",
  seguimiento_adicional: "Requiere seguimiento adicional",
  no_recomendado: "No recomendado por el momento",
}

/** CHECK de `existencia_*_movimientos.tipo` (`sql/existencia_ayuda.sql:89`). */
const TIPOS_MOVIMIENTO: Record<string, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
}

// ─── Utilidades locales ───────────────────────────────────────────────────────

/** Traduce un `text[]` de valores de enum a etiquetas legibles separadas por coma. */
function listaEtiquetas(mapa: Record<string, string>, valor: unknown): string {
  if (Array.isArray(valor)) {
    return valor
      .map((v) => etiqueta(mapa, v))
      .filter((t) => t !== "")
      .join(", ")
  }
  return etiqueta(mapa, valor)
}

/**
 * Extiende el límite superior de un rango al final del día.
 *
 * `casos_redil.fecha_creacion` y `visitas_tecnicas.fecha_visita` son
 * `timestamptz`: un `lte("fecha_creacion", "2026-01-31")` dejaría fuera todo lo
 * registrado ese día después de medianoche. Para columnas `date`
 * (`entregas_redil.fecha_entrega`, `existencia_*_movimientos.fecha`) no hace
 * falta y el rango se aplica tal cual.
 */
function hastaFinDelDia(rango: { desde?: string; hasta?: string }) {
  return { desde: rango.desde, hasta: rango.hasta ? `${rango.hasta}T23:59:59.999` : undefined }
}

/** Agrupa filas hijas por `caso_id`. */
function agruparPorCaso<T extends Fila>(filas: T[]): Map<number, T[]> {
  const mapa = new Map<number, T[]>()
  for (const fila of filas) {
    const id = Number(fila.caso_id)
    if (!Number.isFinite(id)) continue
    const lista = mapa.get(id)
    if (lista) lista.push(fila)
    else mapa.set(id, [fila])
  }
  return mapa
}

/** Ordena de más reciente a más antiguo por una columna de fecha en texto. */
function porFechaDesc<T extends Fila>(columna: string) {
  return (a: T, b: T) => String(b[columna] ?? "").localeCompare(String(a[columna] ?? ""))
}

/** Un artículo dentro de `entregas_redil.articulos_entregados`. */
interface ArticuloEntregado {
  item_id?: number
  item_nombre?: string
  categoria?: string | null
  cantidad?: number
}

/**
 * Lee el JSONB `articulos_entregados` con el mismo criterio tolerante que
 * `parseArticulosEntregados()` (`lib/mod/redil-ayuda-social-service.ts:161-174`):
 * la columna puede venir como objeto o como texto.
 */
function parseArticulos(valor: unknown): { incluyeCanasta: boolean; articulos: ArticuloEntregado[] } {
  const vacio = { incluyeCanasta: false, articulos: [] as ArticuloEntregado[] }
  if (!valor) return vacio
  try {
    const objeto = typeof valor === "string" ? JSON.parse(valor) : valor
    if (!objeto || typeof objeto !== "object") return vacio
    const bruto = objeto as { incluye_canasta?: unknown; articulos?: unknown }
    return {
      incluyeCanasta: bruto.incluye_canasta === true,
      articulos: Array.isArray(bruto.articulos) ? (bruto.articulos as ArticuloEntregado[]) : [],
    }
  } catch {
    return vacio
  }
}

/** Cuenta los archivos legados de `entregas_redil.foto1` (JSON de `ArchivoSubido[]`). */
function contarArchivosLegados(valor: unknown): number {
  if (typeof valor !== "string" || valor.trim() === "") return 0
  try {
    const lista = JSON.parse(valor)
    return Array.isArray(lista) ? lista.length : 0
  } catch {
    return 0
  }
}

function sumarArticulos(articulos: ArticuloEntregado[]): number {
  return articulos.reduce((suma, a) => suma + aNumero(a.cantidad), 0)
}

function detalleArticulos(articulos: ArticuloEntregado[]): string {
  return articulos
    .map((a) => `${a.item_nombre ?? "(sin nombre)"} x${aNumero(a.cantidad)}`)
    .join(", ")
}

// ─── Columnas reutilizables de Redil ──────────────────────────────────────────

const COL_CASO: ColumnaReporte<Fila> = {
  key: "caso_id",
  label: "N.º de caso",
  tipo: "numero",
  ancho: 11,
}

const COL_SOLICITANTE: ColumnaReporte<Fila> = {
  key: "nombre_completo",
  label: "Nombre del solicitante",
  ancho: 34,
}

const COL_ESTADO_CASO: ColumnaReporte<Fila> = {
  key: "estado",
  label: "Estado del caso",
  ancho: 20,
  valor: (f) => etiqueta(ESTADOS_CASO, f.estado),
}

// ─── REDIL · casos de ayuda ───────────────────────────────────────────────────

/**
 * Une cada caso con su solicitud y resume su visita técnica y sus entregas.
 *
 * Las tablas hijas se leen completas y se indexan en memoria en lugar de
 * filtrarse con un `in(...)` de ids: son tablas pequeñas (una solicitud, una
 * visita y una entrega por caso) y así se evita armar una URL con cientos de
 * identificadores.
 */
async function filasCasos(ctx: ContextoReporte): Promise<Fila[]> {
  const rango = hastaFinDelDia(rangoDelFiltro(ctx.filtros, "apertura"))

  const casos = await seleccionarTodo<Fila>("casos_redil", (q) => {
    let consulta = aplicarRango(q, "fecha_creacion", rango).order("fecha_creacion", {
      ascending: false,
    })
    if (ctx.filtros.estado) consulta = consulta.eq("estado", ctx.filtros.estado)
    return consulta
  })

  if (casos.length === 0) return []

  const [solicitudes, visitas, entregas] = await Promise.all([
    seleccionarTodo<Fila>("solicitudes_redil", (q) => q.order("caso_id", { ascending: true })),
    seleccionarTodo<Fila>("visitas_tecnicas", (q) => q.order("fecha_visita", { ascending: false })),
    seleccionarTodo<Fila>("entregas_redil", (q) => q.order("fecha_entrega", { ascending: false })),
  ])

  const porSolicitud = agruparPorCaso(solicitudes)
  const porVisita = agruparPorCaso(visitas)
  const porEntrega = agruparPorCaso(entregas)

  return casos.map((caso) => {
    const id = Number(caso.id)
    const solicitud = porSolicitud.get(id)?.[0] ?? {}
    // El servicio lee la visita y la entrega con `maybeSingle()` (1:1), pero la
    // base no lo impone: si hubiera varias se toma la más reciente.
    const visita = [...(porVisita.get(id) ?? [])].sort(porFechaDesc("fecha_visita"))[0]
    const entregasCaso = [...(porEntrega.get(id) ?? [])].sort(porFechaDesc("fecha_entrega"))

    const articulos = entregasCaso.flatMap((e) => parseArticulos(e.articulos_entregados).articulos)

    return {
      // La solicitud va primero y el caso después, para que el id y las fechas
      // del caso ganen sobre las columnas homónimas de la solicitud.
      ...solicitud,
      ...caso,
      caso_id: caso.id,
      solicitud_id: solicitud.id ?? "",
      tuvo_visita: !!visita,
      fecha_visita: visita?.fecha_visita ?? "",
      resultado_visita: visita ? etiqueta(RESULTADOS_VISITA, visita.resultado) : "",
      recomendacion_visita: visita ? etiqueta(RECOMENDACIONES_VISITA, visita.ficha_recomendacion) : "",
      tecnico_visita: visita?.realizada_por_nombre ?? "",
      tuvo_entrega: entregasCaso.length > 0,
      fecha_ultima_entrega: entregasCaso[0]?.fecha_entrega ?? "",
      numero_entregas: entregasCaso.length,
      articulos_total: sumarArticulos(articulos),
    }
  })
}

const redilCasos: DefinicionReporte<Fila> = {
  id: "redil-casos",
  grupo: "Acción social e inventarios",
  titulo: "REDIL — casos de ayuda",
  descripcion:
    "Un caso por fila, con los datos del solicitante y el resumen de su visita técnica y sus entregas.",
  tablas: ["casos_redil", "solicitudes_redil", "visitas_tecnicas", "entregas_redil"],
  modulos: MODULOS_REDIL,
  hoja: "Casos de ayuda",
  archivo: "REDIL_Casos",
  filtros: [
    {
      id: "estado",
      label: "Estado del caso",
      tipo: "opcion",
      opcionTodos: "Todos los estados",
      opciones: Object.entries(ESTADOS_CASO).map(([value, label]) => ({ value, label })),
      ayuda:
        "Tres estados del enum no los escribe ninguna ruta del sistema: «En visita técnica», «Aprobado» y «Entregado». Un caso aprobado y entregado queda en «Cerrado».",
    },
    {
      id: "apertura",
      label: "Fecha de apertura del caso",
      tipo: "rangoFechas",
      ayuda: "Filtra por la fecha de creación del caso, incluyendo el día completo del límite superior.",
    },
  ],
  columnas: [
    COL_CASO,
    COL_ESTADO_CASO,
    { key: "fecha_creacion", label: "Fecha de apertura", tipo: "fecha" },

    COL_SOLICITANTE,
    { key: "edad", label: "Edad", tipo: "numero", ancho: 8 },
    { key: "cedula", label: "Cédula", ancho: 14, sensible: true, ayuda: "Dato personal de un beneficiario." },
    { key: "telefono", label: "Teléfono", ancho: 14, sensible: true },
    { key: "direccion", label: "Dirección", ancho: 34, sensible: true },
    { key: "barrio_sector", label: "Barrio / sector", ancho: 22 },
    {
      key: "estado_civil",
      label: "Estado civil",
      valor: (f) => etiqueta(ESTADOS_CIVILES, f.estado_civil),
    },
    { key: "numero_hijos", label: "Número de hijos", tipo: "numero", ancho: 12, sensible: true },
    { key: "edad_hijos", label: "Edad de los hijos", sensible: true, opcional: true },
    { key: "tiempo_asistiendo", label: "Tiempo en la iglesia" },
    { key: "trabaja_actualmente", label: "¿Trabaja actualmente?", tipo: "booleano", sensible: true },
    { key: "lugar_trabajo", label: "Lugar de trabajo", sensible: true },
    {
      key: "ingreso_mensual",
      label: "Ingreso mensual",
      sensible: true,
      ayuda: "La columna es texto libre en la base, no un monto: se exporta tal cual se escribió.",
    },

    {
      key: "tipo_ayuda",
      label: "Tipo de ayuda solicitada",
      tipo: "lista",
      ancho: 34,
      valor: (f) => listaEtiquetas(TIPOS_AYUDA, f.tipo_ayuda),
    },
    { key: "tipo_ayuda_otro", label: "Otro tipo de ayuda", opcional: true },
    {
      key: "motivo",
      label: "Motivo de la solicitud",
      ancho: 48,
      sensible: true,
      ayuda: "Relato de la situación de la familia.",
    },
    { key: "referencia_nombre", label: "Nombre de referencia", opcional: true },
    { key: "referencia_telefono", label: "Teléfono de referencia", opcional: true, sensible: true },

    { key: "tuvo_visita", label: "¿Tuvo visita técnica?", tipo: "booleano", ancho: 14 },
    { key: "fecha_visita", label: "Fecha de la visita", tipo: "fecha" },
    { key: "resultado_visita", label: "Resultado de la visita", ancho: 18 },
    { key: "recomendacion_visita", label: "Recomendación técnica", ancho: 30, opcional: true },
    { key: "tecnico_visita", label: "Visita realizada por", opcional: true },

    { key: "tuvo_entrega", label: "¿Tuvo entrega?", tipo: "booleano", ancho: 12 },
    { key: "fecha_ultima_entrega", label: "Fecha de la última entrega", tipo: "fecha" },
    { key: "numero_entregas", label: "Entregas registradas", tipo: "numero", ancho: 12, totalizar: true },
    {
      key: "articulos_total",
      label: "Artículos entregados",
      tipo: "numero",
      ancho: 14,
      totalizar: true,
      ayuda: "Suma de las cantidades del JSON de artículos de todas las entregas del caso.",
    },

    { key: "aprobado_por_nombre", label: "Aprobado por" },
    { key: "fecha_aprobacion", label: "Fecha de aprobación", tipo: "fecha" },
    { key: "fecha_cierre", label: "Fecha de cierre", tipo: "fecha" },
    { key: "usuario_creador_nombre", label: "Registrado por" },

    { key: "solicitud_id", label: "ID de la solicitud", tipo: "numero", ancho: 12, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Actualizado", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "Flujo de estados que escribe el sistema: al registrar la solicitud el caso queda en «Pendiente de visita»; la visita técnica lo pasa a «Pendiente de entrega» si aprueba, o a «Rechazado» con fecha de cierre si deniega; al registrar la entrega queda en «Cerrado» con fecha de cierre.",
    "«En visita técnica», «Aprobado» y «Entregado» existen en el enum pero ninguna ruta del sistema los escribe: solo aparecerían por una edición manual de la base. Un caso aprobado y entregado termina en «Cerrado», nunca en «Entregado».",
    "Los datos personales del solicitante corresponden a personas en situación de vulnerabilidad: desmarque esas columnas si el informe no las necesita.",
    "Un caso sin solicitud asociada se exporta igual, con las columnas del solicitante vacías.",
  ],
  obtener: async (ctx) => ({ filas: await filasCasos(ctx) }),
}

// ─── REDIL · entregas ─────────────────────────────────────────────────────────

/** Entregas con su caso y su solicitante resueltos, y los artículos ya parseados. */
async function filasEntregas(ctx: ContextoReporte): Promise<{ filas: Fila[]; articulos: Fila[] }> {
  const rango = rangoDelFiltro(ctx.filtros, "entrega")

  const entregas = await seleccionarTodo<Fila>("entregas_redil", (q) =>
    aplicarRango(q, "fecha_entrega", rango).order("fecha_entrega", { ascending: false }),
  )

  if (entregas.length === 0) return { filas: [], articulos: [] }

  const [casos, solicitudes] = await Promise.all([
    seleccionarTodo<Fila>("casos_redil", (q) => q.order("id", { ascending: true })),
    seleccionarTodo<Fila>("solicitudes_redil", (q) => q.order("caso_id", { ascending: true })),
  ])

  const porCaso = new Map(casos.map((c) => [Number(c.id), c]))
  const porSolicitud = agruparPorCaso(solicitudes)

  const filas: Fila[] = []
  const articulosSueltos: Fila[] = []

  for (const entrega of entregas) {
    const casoId = Number(entrega.caso_id)
    const caso = porCaso.get(casoId)
    const solicitud = porSolicitud.get(casoId)?.[0]
    const { incluyeCanasta, articulos } = parseArticulos(entrega.articulos_entregados)

    filas.push({
      ...entrega,
      estado: caso?.estado ?? "",
      fecha_creacion_caso: caso?.fecha_creacion ?? "",
      nombre_completo: solicitud?.nombre_completo ?? "",
      cedula: solicitud?.cedula ?? "",
      telefono: solicitud?.telefono ?? "",
      barrio_sector: solicitud?.barrio_sector ?? "",
      incluye_canasta: incluyeCanasta,
      articulos_total: sumarArticulos(articulos),
      articulos_detalle: detalleArticulos(articulos),
      articulos_distintos: articulos.length,
      archivos_legados: contarArchivosLegados(entrega.foto1),
    })

    for (const articulo of articulos) {
      articulosSueltos.push({
        fecha_entrega: entrega.fecha_entrega,
        caso_id: entrega.caso_id,
        nombre_completo: solicitud?.nombre_completo ?? "",
        item_nombre: articulo.item_nombre ?? "",
        categoria: articulo.categoria ?? "",
        cantidad: aNumero(articulo.cantidad),
        item_id: articulo.item_id ?? "",
      })
    }
  }

  return { filas, articulos: articulosSueltos }
}

/** Columnas de la hoja de desglose: una fila por artículo entregado. */
const COLUMNAS_ARTICULOS: ColumnaReporte<Fila>[] = [
  { key: "fecha_entrega", label: "Fecha de entrega", tipo: "fecha" },
  COL_CASO,
  COL_SOLICITANTE,
  { key: "item_nombre", label: "Producto", ancho: 30 },
  { key: "categoria", label: "Categoría", ancho: 20 },
  { key: "cantidad", label: "Cantidad", tipo: "numero", ancho: 10, totalizar: true },
  { key: "item_id", label: "ID del producto", tipo: "numero", ancho: 14 },
]

const redilEntregas: DefinicionReporte<Fila> = {
  id: "redil-entregas",
  grupo: "Acción social e inventarios",
  titulo: "REDIL — entregas",
  descripcion:
    "Entregas de ayuda social con su caso, su beneficiario y los artículos que se descontaron de la bodega de ayuda.",
  tablas: ["entregas_redil", "casos_redil", "solicitudes_redil"],
  modulos: MODULOS_REDIL,
  hoja: "Entregas",
  archivo: "REDIL_Entregas",
  filtros: [{ id: "entrega", label: "Fecha de entrega", tipo: "rangoFechas" }],
  columnas: [
    { key: "fecha_entrega", label: "Fecha de entrega", tipo: "fecha" },
    COL_CASO,
    COL_SOLICITANTE,
    { key: "cedula", label: "Cédula", ancho: 14, sensible: true, ayuda: "Dato personal de un beneficiario." },
    { key: "telefono", label: "Teléfono", ancho: 14, sensible: true },
    { key: "barrio_sector", label: "Barrio / sector", ancho: 22 },
    COL_ESTADO_CASO,
    {
      key: "incluye_canasta",
      label: "Incluye canasta",
      tipo: "booleano",
      ancho: 14,
      ayuda: "Marca independiente del listado: los víveres de la canasta van además como artículos.",
    },
    {
      key: "articulos_total",
      label: "Artículos entregados",
      tipo: "numero",
      ancho: 14,
      totalizar: true,
      ayuda: "Suma de las cantidades del JSON articulos_entregados.",
    },
    { key: "articulos_distintos", label: "Productos distintos", tipo: "numero", ancho: 12, opcional: true },
    { key: "articulos_detalle", label: "Detalle de los artículos", tipo: "lista", ancho: 48 },
    { key: "observaciones", label: "Observaciones", ancho: 44 },
    { key: "entregado_por_nombre", label: "Entregado por" },
    {
      key: "archivos_legados",
      label: "Archivos de evidencia (legado)",
      tipo: "numero",
      ancho: 16,
      opcional: true,
      ayuda: "Archivos guardados en la columna foto1; los nuevos adjuntos viven en redil_adjuntos.",
    },
    { key: "fecha_creacion_caso", label: "Fecha de apertura del caso", tipo: "fecha", opcional: true },
    { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "Los artículos se guardan en el JSONB articulos_entregados, que la migración sql/entregas_redil_articulos.sql añadió a la tabla: cada artículo trae item_id, nombre, categoría y cantidad de la bodega de ayuda social.",
    "«Incluye canasta» es un booleano independiente del listado de artículos: señala que la entrega incluyó la canasta de alimentos, y esos víveres aparecen además en el detalle. No lo cuente como una unidad extra.",
    "Las entregas anteriores a esa migración no tienen artículos registrados: su detalle sale vacío aunque la entrega sí ocurrió.",
    "La hoja «Artículos entregados» desglosa una fila por artículo y solo contiene las entregas que sí registraron el JSON.",
  ],
  obtener: async (ctx) => {
    const { filas, articulos } = await filasEntregas(ctx)
    const hojas: HojaReporte[] = []

    if (articulos.length > 0) {
      hojas.push(
        hojaDesdeFilas("Artículos entregados", articulos, COLUMNAS_ARTICULOS, {
          notas: [
            "Una fila por artículo descontado de la bodega de ayuda social.",
            "El ID del producto apunta a existencia_ayuda_items; si el producto se borró después, el nombre es el histórico guardado en la entrega.",
          ],
        }),
      )
    }

    const sinArticulos = filas.filter((f) => aNumero(f.articulos_total) === 0).length
    const advertencias =
      sinArticulos > 0
        ? [`${sinArticulos} entrega(s) no tienen artículos registrados en el JSON de la tabla.`]
        : []

    return { filas, hojas, advertencias }
  },
}

// ─── REDIL · visitas técnicas ─────────────────────────────────────────────────

const redilVisitas: DefinicionReporte<Fila> = {
  id: "redil-visitas",
  grupo: "Acción social e inventarios",
  titulo: "REDIL — visitas técnicas",
  descripcion:
    "Visitas técnicas con su resultado, la ficha socioeconómica del hogar y la recomendación del trabajador social.",
  tablas: ["visitas_tecnicas", "casos_redil", "solicitudes_redil"],
  modulos: MODULOS_REDIL,
  hoja: "Visitas técnicas",
  archivo: "REDIL_Visitas_Tecnicas",
  filtros: [
    {
      id: "visita",
      label: "Fecha de la visita",
      tipo: "rangoFechas",
      ayuda: "Incluye el día completo del límite superior.",
    },
    {
      id: "resultado",
      label: "Resultado",
      tipo: "opcion",
      opcionTodos: "Todos los resultados",
      opciones: Object.entries(RESULTADOS_VISITA).map(([value, label]) => ({ value, label })),
    },
  ],
  columnas: [
    { key: "fecha_visita", label: "Fecha de la visita", tipo: "fecha" },
    COL_CASO,
    COL_SOLICITANTE,
    { key: "cedula", label: "Cédula", ancho: 14, sensible: true, ayuda: "Dato personal de un beneficiario." },
    { key: "barrio_sector", label: "Barrio / sector", ancho: 22 },
    COL_ESTADO_CASO,
    {
      key: "resultado",
      label: "Resultado",
      ancho: 14,
      valor: (f) => etiqueta(RESULTADOS_VISITA, f.resultado),
    },
    {
      key: "tipo_ayuda_aprobada",
      label: "Tipo de ayuda aprobada",
      tipo: "lista",
      ancho: 34,
      valor: (f) => listaEtiquetas(TIPOS_AYUDA, f.tipo_ayuda_aprobada),
    },
    {
      key: "ficha_recomendacion",
      label: "Recomendación técnica",
      ancho: 30,
      valor: (f) => etiqueta(RECOMENDACIONES_VISITA, f.ficha_recomendacion),
    },
    { key: "motivo_rechazo", label: "Motivo de la denegación", ancho: 44, sensible: true },
    { key: "observaciones", label: "Observaciones", ancho: 44, sensible: true },
    { key: "realizada_por_nombre", label: "Realizada por" },

    { key: "ficha_num_personas_hogar", label: "Personas en el hogar", tipo: "numero", ancho: 12, sensible: true },
    { key: "ficha_num_hijos_menores", label: "Hijos menores de edad", tipo: "numero", ancho: 12, sensible: true },
    {
      key: "ficha_personas_dependientes",
      label: "Personas dependientes económicamente",
      tipo: "numero",
      ancho: 14,
      sensible: true,
    },
    { key: "ficha_trabaja_actualmente", label: "¿Actualmente trabaja?", tipo: "booleano", sensible: true },
    { key: "ficha_ocupacion", label: "Ocupación", sensible: true },
    { key: "ficha_tiene_negocio", label: "¿Tiene negocio propio?", tipo: "booleano", sensible: true },
    {
      key: "ficha_ingreso_mensual",
      label: "Ingreso mensual aproximado del hogar",
      ancho: 20,
      sensible: true,
      ayuda: "Texto libre en la base, no un monto numérico.",
    },
    {
      key: "ficha_tipo_vivienda",
      label: "Tipo de vivienda",
      sensible: true,
      ayuda: "Se guarda ya en español: Propia, Arrendada, Prestada o Familiar.",
    },
    { key: "ficha_material_vivienda", label: "Material predominante", sensible: true },
    { key: "ficha_servicios_basicos", label: "Servicios básicos", tipo: "lista", ancho: 34, sensible: true },

    { key: "ficha_desea_emprender", label: "¿Desea emprender?", tipo: "booleano", opcional: true },
    { key: "ficha_idea_negocio", label: "Idea de negocio", ancho: 36, opcional: true },
    {
      key: "ficha_espacio_emprendimiento",
      label: "¿Tiene espacio para emprender en casa?",
      tipo: "booleano",
      opcional: true,
    },
    { key: "ficha_espacio_descripcion", label: "Descripción del espacio", ancho: 36, opcional: true },
    { key: "ficha_motivacion", label: "¿Por qué desea participar?", ancho: 44, opcional: true, sensible: true },
    { key: "ficha_apoyo_familiar", label: "¿Quiénes le apoyan?", ancho: 36, opcional: true, sensible: true },
    {
      key: "ficha_cuidado_hijos",
      label: "¿Quién cuidaría a los hijos en clases?",
      ancho: 36,
      opcional: true,
      sensible: true,
    },
    {
      key: "ficha_observaciones_ts",
      label: "Observaciones de Trabajo Social",
      ancho: 48,
      opcional: true,
      sensible: true,
    },

    { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "La visita es el paso que decide el caso: si aprueba, el caso pasa a «Pendiente de entrega» y se registran quién aprobó y la fecha de aprobación; si deniega, el caso queda «Rechazado» y se cierra.",
    "El módulo no envía fecha_visita en el insert: la fecha es la que pone la base al registrar la visita, no una fecha elegida por el técnico.",
    "La ficha socioeconómica describe el hogar de una familia en situación de vulnerabilidad: desmarque esas columnas si el informe no las necesita.",
    "Las columnas de emprendimiento solo se llenan en las visitas que evalúan el proyecto productivo; en el resto quedan vacías.",
  ],
  obtener: async (ctx) => {
    const rango = hastaFinDelDia(rangoDelFiltro(ctx.filtros, "visita"))

    const visitas = await seleccionarTodo<Fila>("visitas_tecnicas", (q) => {
      let consulta = aplicarRango(q, "fecha_visita", rango).order("fecha_visita", { ascending: false })
      if (ctx.filtros.resultado) consulta = consulta.eq("resultado", ctx.filtros.resultado)
      return consulta
    })

    if (visitas.length === 0) return { filas: [] }

    const [casos, solicitudes] = await Promise.all([
      seleccionarTodo<Fila>("casos_redil", (q) => q.order("id", { ascending: true })),
      seleccionarTodo<Fila>("solicitudes_redil", (q) => q.order("caso_id", { ascending: true })),
    ])

    const porCaso = new Map(casos.map((c) => [Number(c.id), c]))
    const porSolicitud = agruparPorCaso(solicitudes)

    const filas = visitas.map((visita) => {
      const casoId = Number(visita.caso_id)
      const solicitud = porSolicitud.get(casoId)?.[0]
      return {
        ...visita,
        estado: porCaso.get(casoId)?.estado ?? "",
        nombre_completo: solicitud?.nombre_completo ?? "",
        cedula: solicitud?.cedula ?? "",
        barrio_sector: solicitud?.barrio_sector ?? "",
      }
    })

    return { filas }
  },
}

// ─── Existencias por bodega ───────────────────────────────────────────────────

interface Bodega {
  label: string
  /** Nombre corto, para que el nombre de la hoja quepa en los 31 caracteres de Excel. */
  corto: string
  /** Prefijo común de las tres tablas de la bodega. */
  prefijo: string
  /** Módulos que autorizan las tablas de esta bodega. */
  modulos: string[]
}

/**
 * Las tres bodegas de existencias. El esquema es idéntico (ver cabecera del
 * archivo), así que basta el prefijo para resolver las tres tablas.
 *
 * Cada bodega es un reporte aparte y no una opción de un filtro, porque sus
 * permisos son distintos: un solo reporte con un selector de bodega ofrecería
 * opciones que terminan en 403 para quien administra una sola.
 */
const BODEGAS: Record<string, Bodega> = {
  ayuda: {
    label: "Ayuda social (REDIL)",
    corto: "Ayuda social",
    prefijo: "existencia_ayuda",
    modulos: ["existencia_ayuda", "redil_ayuda_social", "control_mensual", "resumen-pastoral"],
  },
  administracion: {
    label: "Administración",
    corto: "Administración",
    prefijo: "existencia_adm",
    modulos: ["existencia_administracion", "control_mensual", "resumen-pastoral"],
  },
  mdg: {
    label: "Mujeres de Gracia",
    corto: "MDG",
    prefijo: "existencia_mdg",
    modulos: ["existencia_mdg", "control_mensual", "resumen-pastoral"],
  },
}

/** Resumen de los movimientos de un producto. */
interface ResumenMovimientos {
  ingresos: number
  egresos: number
  cantidad: number
  ultima: string
}

const COLUMNAS_MOVIMIENTOS: ColumnaReporte<Fila>[] = [
  { key: "fecha", label: "Fecha", tipo: "fecha" },
  { key: "item_nombre", label: "Producto", ancho: 30 },
  { key: "categoria", label: "Categoría", ancho: 20 },
  {
    key: "tipo",
    label: "Tipo de movimiento",
    ancho: 16,
    valor: (f) => etiqueta(TIPOS_MOVIMIENTO, f.tipo),
  },
  { key: "cantidad", label: "Cantidad", tipo: "numero", ancho: 10, totalizar: true },
  { key: "motivo", label: "Motivo", ancho: 44 },
  { key: "usuario_nombre", label: "Registrado por" },
  { key: "item_id", label: "ID del producto", tipo: "numero", ancho: 14 },
  { key: "id", label: "ID del movimiento", tipo: "numero", ancho: 14 },
]

/** Un reporte de existencias por bodega, para que cada uno lleve su permiso. */
function reporteExistencias(clave: string, bodega: Bodega): DefinicionReporte<Fila> {
  return {
  id: `existencias-${clave}`,
  grupo: "Acción social e inventarios",
  titulo: `Existencias — ${bodega.label}`,
  descripcion:
    "Productos de la bodega con su existencia almacenada, la existencia teórica según movimientos y el desfase entre ambas. Segunda hoja con el libro de movimientos.",
  tablas: [
    `${bodega.prefijo}_categorias`,
    `${bodega.prefijo}_items`,
    `${bodega.prefijo}_movimientos`,
  ],
  modulos: bodega.modulos,
  hoja: "Existencias",
  archivo: `Existencias_${bodega.corto}`,
  filtros: [
    {
      id: "movimiento",
      label: "Fecha de los movimientos",
      tipo: "rangoFechas",
      ayuda:
        "Acota solo la hoja de movimientos. La existencia teórica siempre se calcula con el historial completo.",
    },
  ],
  columnas: [
    { key: "nombre", label: "Producto", ancho: 32 },
    { key: "categoria", label: "Categoría", ancho: 22 },
    {
      key: "cantidad_actual",
      label: "Existencia actual",
      tipo: "numero",
      ancho: 15,
      totalizar: true,
      ayuda: "Campo almacenado en la tabla: es la fuente de verdad del sistema.",
    },
    {
      key: "existencia_teorica",
      label: "Existencia teórica (según movimientos)",
      tipo: "numero",
      ancho: 20,
      totalizar: true,
      ayuda: "Suma de ingresos menos egresos de todo el historial. Sirve de control, no reemplaza la existencia actual.",
    },
    {
      key: "desfase",
      label: "Desfase",
      tipo: "numero",
      ancho: 11,
      totalizar: true,
      ayuda: "Existencia actual menos la teórica. Distinto de cero indica que el libro de movimientos no cuadra.",
    },
    { key: "total_ingresos", label: "Total de ingresos", tipo: "numero", ancho: 14, totalizar: true },
    { key: "total_egresos", label: "Total de egresos", tipo: "numero", ancho: 14, totalizar: true },
    { key: "movimientos", label: "Movimientos registrados", tipo: "numero", ancho: 14 },
    { key: "ultimo_movimiento", label: "Último movimiento", tipo: "fecha" },
    { key: "descripcion", label: "Descripción", ancho: 38 },
    {
      key: "categoria_en_catalogo",
      label: "Categoría en el catálogo",
      tipo: "booleano",
      ancho: 14,
      opcional: true,
      ayuda: "La categoría del producto se guarda por nombre, sin clave foránea: esta columna avisa si ya no existe en el catálogo.",
    },
    { key: "registrado_por_nombre", label: "Registrado por", opcional: true },
    { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
    { key: "updated_at", label: "Actualizado", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "La existencia actual es un campo almacenado (cantidad_actual) que el sistema ajusta en cada movimiento: es la fuente de verdad. La existencia teórica es solo una columna de control.",
    "El ajuste se calcula con Math.max(0, existencia + delta): un movimiento que dejaría la existencia en negativo la trunca en cero sin avisar, y desde ese momento la suma de movimientos ya no cuadra.",
    "La entrega de ayuda social descuenta por una ruta propia del servidor (RPC decrementar_existencia_ayuda, con UPDATE directo como respaldo) que no es atómica: un fallo a mitad del descuento deja desfase en la bodega de ayuda.",
    "Un movimiento cuyo producto se borró después conserva el nombre histórico pero queda sin item_id, así que no suma a la existencia teórica de ningún producto. Aparece igual en la hoja de movimientos.",
    "Ninguna de las tres bodegas guarda un mínimo, umbral o punto de reposición: esa columna no existe en la base y por eso no se exporta.",
  ],
  obtener: async (ctx) => {
    const [categorias, items, movimientos] = await Promise.all([
      seleccionarTodo<Fila>(`${bodega.prefijo}_categorias`, (q) => q.order("nombre", { ascending: true })),
      seleccionarTodo<Fila>(`${bodega.prefijo}_items`, (q) =>
        q.order("categoria", { ascending: true }).order("nombre", { ascending: true }),
      ),
      // Historial completo: la existencia teórica no puede depender del rango
      // elegido, que solo acota la hoja de movimientos.
      seleccionarTodo<Fila>(`${bodega.prefijo}_movimientos`, (q) =>
        q.order("fecha", { ascending: false }).order("id", { ascending: false }),
      ),
    ])

    const resumen = new Map<number, ResumenMovimientos>()
    for (const movimiento of movimientos) {
      const itemId = Number(movimiento.item_id)
      if (!Number.isFinite(itemId)) continue

      const actual = resumen.get(itemId) ?? { ingresos: 0, egresos: 0, cantidad: 0, ultima: "" }
      const cantidad = aNumero(movimiento.cantidad)
      if (movimiento.tipo === "egreso") actual.egresos += cantidad
      else actual.ingresos += cantidad
      actual.cantidad += 1

      const fecha = typeof movimiento.fecha === "string" ? movimiento.fecha.slice(0, 10) : ""
      if (fecha > actual.ultima) actual.ultima = fecha

      resumen.set(itemId, actual)
    }

    const nombresCategoria = new Set(categorias.map((c) => String(c.nombre ?? "")))

    const filas = items.map((item) => {
      const datos = resumen.get(Number(item.id)) ?? { ingresos: 0, egresos: 0, cantidad: 0, ultima: "" }
      const teorica = datos.ingresos - datos.egresos
      return {
        ...item,
        total_ingresos: datos.ingresos,
        total_egresos: datos.egresos,
        existencia_teorica: teorica,
        desfase: aNumero(item.cantidad_actual) - teorica,
        movimientos: datos.cantidad,
        ultimo_movimiento: datos.ultima,
        categoria_en_catalogo: nombresCategoria.has(String(item.categoria ?? "")),
      }
    })

    const rango = rangoDelFiltro(ctx.filtros, "movimiento")
    const delRango = movimientos.filter((m) => {
      const fecha = typeof m.fecha === "string" ? m.fecha.slice(0, 10) : ""
      if (rango.desde && (!fecha || fecha < rango.desde)) return false
      if (rango.hasta && (!fecha || fecha > rango.hasta)) return false
      return true
    })

    const hojas: HojaReporte[] = []
    if (delRango.length > 0) {
      hojas.push(
        hojaDesdeFilas(`Movimientos ${bodega.corto}`, delRango, COLUMNAS_MOVIMIENTOS, {
          notas: [
            `Bodega: ${bodega.label}.`,
            "El producto y la categoría se guardan copiados en cada movimiento, así que el nombre es el que tenía el producto el día del movimiento.",
            "Un movimiento sin ID de producto es un movimiento cuyo producto se eliminó después.",
          ],
        }),
      )
    }

    const conDesfase = filas.filter((f) => aNumero(f.desfase) !== 0).length
    const advertencias: string[] = []
    if (conDesfase > 0) {
      advertencias.push(
        `${conDesfase} producto(s) con desfase entre la existencia almacenada y la suma de movimientos.`,
      )
    }
    const huerfanos = items.filter((i) => !nombresCategoria.has(String(i.categoria ?? ""))).length
    if (huerfanos > 0) {
      advertencias.push(`${huerfanos} producto(s) con una categoría que ya no está en el catálogo de la bodega.`)
    }

    return { filas, hojas, advertencias, notas: [`Bodega exportada: ${bodega.label}.`] }
  },
  }
}

// ─── Inventario general ───────────────────────────────────────────────────────

/**
 * Opciones de un filtro de inventario a partir de los valores realmente
 * guardados.
 *
 * Ubicación, ministerio y estado **no son enums de base**: son listas
 * editables de configuración (`lib/globalConfig.ts:7-30`, y el ministerio sale
 * de `module_groups`). Leerlas de la propia tabla evita ofrecer opciones que
 * nadie usó y no exige permiso sobre otras tablas.
 */
function opcionesDeInventario(columna: string): () => Promise<OpcionFiltro[]> {
  return async () => {
    const filas = await seleccionarTodo<Fila>("inventory_items", (q) => q, { select: columna })
    const valores = [
      ...new Set(filas.map((f) => String(f[columna] ?? "").trim()).filter((v) => v !== "")),
    ].sort((a, b) => a.localeCompare(b))
    return valores.map((v) => ({ value: v, label: v }))
  }
}

const inventarioGeneral: DefinicionReporte<Fila> = {
  id: "inventario-general",
  grupo: "Acción social e inventarios",
  titulo: "Inventario general",
  descripcion: "Bienes de la iglesia con su código, ubicación, ministerio responsable y estado de conservación.",
  tablas: ["inventory_items"],
  modulos: ["inventario"],
  hoja: "Inventario",
  archivo: "Inventario_General",
  filtros: [
    {
      id: "ministerio",
      label: "Ministerio",
      tipo: "opcion",
      opcionTodos: "Todos los ministerios",
      cargarOpciones: opcionesDeInventario("ministerio"),
    },
    {
      id: "ubicacion",
      label: "Ubicación",
      tipo: "opcion",
      opcionTodos: "Todas las ubicaciones",
      cargarOpciones: opcionesDeInventario("ubicacion"),
    },
    {
      id: "estado",
      label: "Estado",
      tipo: "opcion",
      opcionTodos: "Todos los estados",
      cargarOpciones: opcionesDeInventario("estado"),
    },
    { id: "registro", label: "Fecha de registro", tipo: "rangoFechas" },
  ],
  columnas: [
    { key: "codigo", label: "Código", ancho: 16 },
    { key: "detalle", label: "Detalle (nombre del artículo)", ancho: 38 },
    { key: "cantidad", label: "Cantidad", tipo: "numero", ancho: 10, totalizar: true },
    { key: "numero_serie", label: "N.º de serie", ancho: 18 },
    { key: "ubicacion", label: "Ubicación", ancho: 24 },
    { key: "ministerio", label: "Ministerio", ancho: 24 },
    { key: "estado", label: "Estado", ancho: 16 },
    { key: "fecha_registro", label: "Fecha de registro", tipo: "fecha" },
    { key: "id", label: "ID", ancho: 38, opcional: true },
    { key: "created_at", label: "Creado", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "Ubicación, ministerio y estado son listas de configuración editables, no valores cerrados de la base: las opciones de los filtros salen de los valores que hay guardados.",
    "El código es el identificador que usa la iglesia (por ejemplo CODIRDD:001); el ID es el uuid interno de la fila.",
    "No hay historial de movimientos de inventario: la tabla inventory_movements no tiene ninguna consulta ni interfaz en el sistema, así que este reporte es la foto del estado actual.",
  ],
  obtener: async (ctx) => {
    const rango = rangoDelFiltro(ctx.filtros, "registro")

    const filas = await seleccionarTodo<Fila>("inventory_items", (q) => {
      let consulta = aplicarRango(q, "fecha_registro", rango)
        .order("ministerio", { ascending: true })
        .order("ubicacion", { ascending: true })
        .order("codigo", { ascending: true })
      if (ctx.filtros.ministerio) consulta = consulta.eq("ministerio", ctx.filtros.ministerio)
      if (ctx.filtros.ubicacion) consulta = consulta.eq("ubicacion", ctx.filtros.ubicacion)
      if (ctx.filtros.estado) consulta = consulta.eq("estado", ctx.filtros.estado)
      return consulta
    })

    return { filas }
  },
}

export const reportesSocialInventario: DefinicionReporte<Fila>[] = [
  redilCasos,
  redilEntregas,
  redilVisitas,
  ...Object.entries(BODEGAS).map(([clave, bodega]) => reporteExistencias(clave, bodega)),
  inventarioGeneral,
]
