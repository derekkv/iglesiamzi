/**
 * Reportes de vida ministerial: bautizos, matrimonios y presentación de niños.
 *
 * Reglas de origen de datos que estos reportes replican del módulo operativo:
 *
 * - Los bautizos **no** salen de la tabla `bautizos` (código legado sin uso):
 *   salen de `censo` y `censo_mdg` con `bautizo_irdd = true`, más los registros
 *   de `bautizos_manual`. Igual para matrimonios con `matrimonio_irdd`.
 * - La deduplicación por cédula respeta el orden Protocolo → MDG → manual, y
 *   los registros manuales nunca se descartan. En matrimonios se marca también
 *   la cédula del cónyuge para que una pareja cuente como una sola fila.
 */

import { generateBautizoPDF } from "@/lib/generate-bautizo-pdf"
import { generateMatrimonioPDF } from "@/lib/generate-matrimonio-pdf"
import { generateMatrimonioPDFv2 } from "@/lib/generate-matrimonio-pdf-v2"
import { generatePresentacionNinoPDF } from "@/lib/generate-presentacion-ninos-pdf"

import { FUENTES_CENSO, dedupPorCedula, etiqueta, seleccionarTodo } from "../data"
import { hoyISO } from "../excel"
import { ErrorReporte } from "../ejecutar"
import { unirPdfs } from "../pdf"
import type { ColumnaReporte, DefinicionReporte, FuenteReporte } from "../types"

type Fila = Record<string, unknown>

const FUENTES_VIDA: FuenteReporte[] = [
  { id: "protocolo", label: "Censo Protocolo", default: true },
  { id: "mdg", label: "Censo MDG", default: true },
  { id: "manual", label: "Registros manuales", default: true },
]

const COL_FUENTE: ColumnaReporte<Fila> = {
  key: "fuente",
  label: "Origen",
  ancho: 14,
  valor: (f) => etiqueta(FUENTES_CENSO, f.fuente),
}

const FILTRO_DUPLICADOS = {
  id: "duplicados",
  label: "Filas por persona",
  tipo: "opcion" as const,
  valorInicial: "dedup",
  opciones: [
    { value: "dedup", label: "Una sola fila por persona (como el módulo)" },
    { value: "todos", label: "Incluir todos los registros" },
  ],
  ayuda:
    "Con la primera opción el listado sale igual que la pantalla del módulo: una fila por persona, y en matrimonios una fila por pareja.",
}

/** Une varias fuentes de censo con el mismo juego de columnas. */
async function unirFuentes(
  fuentes: string[],
  campos: string,
  filtro: (q: any) => any,
  tablaManual: string,
  camposManual: string,
): Promise<Fila[]> {
  const [protocolo, mdg, manual] = await Promise.all([
    fuentes.includes("protocolo")
      ? seleccionarTodo<Fila>("censo", filtro, { select: campos })
      : Promise.resolve([]),
    fuentes.includes("mdg")
      ? seleccionarTodo<Fila>("censo_mdg", filtro, { select: campos })
      : Promise.resolve([]),
    fuentes.includes("manual")
      ? seleccionarTodo<Fila>(tablaManual, (q) => q, { select: camposManual })
      : Promise.resolve([]),
  ])

  return [
    ...protocolo.map((r) => ({ ...r, fuente: "protocolo" })),
    ...mdg.map((r) => ({ ...r, fuente: "mdg" })),
    ...manual.map((r) => ({ ...r, fuente: "manual" })),
  ]
}

/** Une los PDF de una página en un solo documento. */

// ─── Bautizos ─────────────────────────────────────────────────────────────────

const CAMPOS_BAUTIZO = "id, cedula, apellidos_nombres, fecha_bautizo, celular, created_at"

async function filasBautizos(ctx: { fuentes: string[]; filtros: Record<string, string> }): Promise<Fila[]> {
  const filas = await unirFuentes(
    ctx.fuentes,
    CAMPOS_BAUTIZO,
    (q) => q.eq("bautizo_irdd", true).order("fecha_bautizo", { ascending: false }),
    "bautizos_manual",
    CAMPOS_BAUTIZO,
  )

  const conFecha = ctx.filtros.soloConFecha === "no" ? filas : filas.filter((f) => !!f.fecha_bautizo)
  const resultado = ctx.filtros.duplicados === "todos" ? conFecha : dedupPorCedula(conFecha as any[])

  const { desde, hasta } = { desde: ctx.filtros.rango_desde, hasta: ctx.filtros.rango_hasta }
  return resultado.filter((f) => {
    const fecha = typeof f.fecha_bautizo === "string" ? f.fecha_bautizo.slice(0, 10) : ""
    if (desde && (!fecha || fecha < desde)) return false
    if (hasta && (!fecha || fecha > hasta)) return false
    return true
  })
}

const bautizos: DefinicionReporte<Fila> = {
  id: "bautizos",
  grupo: "Vida ministerial",
  titulo: "Bautizos",
  descripcion: "Personas bautizadas en la iglesia, uniendo Protocolo, MDG y los registros manuales.",
  tablas: ["censo", "censo_mdg", "bautizos_manual"],
  modulos: ["listados", "bautizo"],
  hoja: "Bautizos",
  archivo: "Bautizos",
  fuentes: FUENTES_VIDA,
  filtros: [
    { id: "rango", label: "Fecha del bautizo", tipo: "rangoFechas" },
    FILTRO_DUPLICADOS,
    {
      id: "soloConFecha",
      label: "Registros sin fecha",
      tipo: "opcion",
      valorInicial: "si",
      opciones: [
        { value: "si", label: "Excluirlos" },
        { value: "no", label: "Incluirlos" },
      ],
    },
  ],
  columnas: [
    { key: "apellidos_nombres", label: "Apellidos y nombres", ancho: 34 },
    { key: "cedula", label: "Cédula", ancho: 14 },
    { key: "fecha_bautizo", label: "Fecha del bautizo", tipo: "fecha" },
    COL_FUENTE,
    { key: "celular", label: "Celular", ancho: 14 },
    { key: "id", label: "ID en su tabla", tipo: "numero", ancho: 12, opcional: true },
    { key: "created_at", label: "Fecha de registro", tipo: "fecha", opcional: true },
  ],
  obtener: async (ctx) => ({ filas: await filasBautizos(ctx) }),
  acciones: [
    {
      id: "pdf-bautizos",
      label: "Certificados en PDF",
      icono: "pdf",
      ejecutar: async (ctx) => {
        const filas = (await filasBautizos(ctx)).filter((f) => !!f.fecha_bautizo)
        if (filas.length === 0) throw new ErrorReporte("No hay bautizos con fecha registrada.")

        const paginas: Uint8Array[] = []
        for (const fila of filas) {
          paginas.push(
            await generateBautizoPDF({
              nombre: String(fila.apellidos_nombres ?? ""),
              cedula: String(fila.cedula ?? ""),
              fecha_bautizo: String(fila.fecha_bautizo ?? ""),
            }),
          )
        }

        return {
          contenido: await unirPdfs(paginas),
          nombre: `Certificados_Bautizo_${hoyISO()}.pdf`,
          mensaje: `PDF con ${filas.length} certificados de bautizo.`,
        }
      },
    },
  ],
}

// ─── Matrimonios ──────────────────────────────────────────────────────────────

const CAMPOS_MATRIMONIO =
  "id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio, celular, created_at"

async function filasMatrimonios(ctx: { fuentes: string[]; filtros: Record<string, string> }): Promise<Fila[]> {
  const filas = await unirFuentes(
    ctx.fuentes,
    CAMPOS_MATRIMONIO,
    (q) => q.eq("matrimonio_irdd", true).order("fecha_matrimonio", { ascending: false }),
    "matrimonios_manual",
    CAMPOS_MATRIMONIO,
  )

  const conFecha = ctx.filtros.soloConFecha === "no" ? filas : filas.filter((f) => !!f.fecha_matrimonio)

  // La cédula del cónyuge también se marca como vista: así una pareja en la que
  // ambos están en el censo produce una sola fila, no dos.
  const resultado =
    ctx.filtros.duplicados === "todos"
      ? conFecha
      : dedupPorCedula(conFecha as any[], { claveExtra: (f) => (f as Fila).cedula_conyugue as string })

  const desde = ctx.filtros.rango_desde
  const hasta = ctx.filtros.rango_hasta
  return resultado.filter((f) => {
    const fecha = typeof f.fecha_matrimonio === "string" ? f.fecha_matrimonio.slice(0, 10) : ""
    if (desde && (!fecha || fecha < desde)) return false
    if (hasta && (!fecha || fecha > hasta)) return false
    return true
  })
}

const matrimonios: DefinicionReporte<Fila> = {
  id: "matrimonios",
  grupo: "Vida ministerial",
  titulo: "Matrimonios",
  descripcion: "Matrimonios celebrados en la iglesia. Una fila por pareja, uniendo Protocolo, MDG y registros manuales.",
  tablas: ["censo", "censo_mdg", "matrimonios_manual"],
  modulos: ["listados", "matrimonio"],
  hoja: "Matrimonios",
  archivo: "Matrimonios",
  fuentes: FUENTES_VIDA,
  filtros: [
    { id: "rango", label: "Fecha del matrimonio", tipo: "rangoFechas" },
    FILTRO_DUPLICADOS,
    {
      id: "soloConFecha",
      label: "Registros sin fecha",
      tipo: "opcion",
      valorInicial: "si",
      opciones: [
        { value: "si", label: "Excluirlos" },
        { value: "no", label: "Incluirlos" },
      ],
    },
  ],
  columnas: [
    { key: "apellidos_nombres", label: "Cónyuge registrado", ancho: 32 },
    { key: "cedula", label: "Cédula", ancho: 14 },
    { key: "conyuge", label: "Cónyuge", ancho: 32 },
    { key: "cedula_conyugue", label: "Cédula del cónyuge", ancho: 16 },
    { key: "fecha_matrimonio", label: "Fecha del matrimonio", tipo: "fecha" },
    { key: "hora_matrimonio", label: "Hora", ancho: 9 },
    { key: "oficio_matrimonio", label: "Quién ofició" },
    { key: "padrino1_matrimonio", label: "Testigo 1" },
    { key: "padrino2_matrimonio", label: "Testigo 2" },
    COL_FUENTE,
    { key: "celular", label: "Celular", ancho: 14, opcional: true },
    { key: "id", label: "ID en su tabla", tipo: "numero", ancho: 12, opcional: true },
    { key: "created_at", label: "Fecha de registro", tipo: "fecha", opcional: true },
  ],
  notas: [
    "Los testigos se guardan en columnas llamadas padrino1/padrino2; la etiqueta sigue el formulario del módulo.",
  ],
  obtener: async (ctx) => ({ filas: await filasMatrimonios(ctx) }),
  acciones: [
    {
      id: "pdf-completo",
      label: "Certificados PDF (completo)",
      icono: "pdf",
      ejecutar: async (ctx) => {
        const filas = (await filasMatrimonios(ctx)).filter((f) => f.fecha_matrimonio && f.conyuge)
        if (filas.length === 0) throw new ErrorReporte("No hay matrimonios con fecha y cónyuge registrados.")

        const paginas: Uint8Array[] = []
        for (const f of filas) {
          paginas.push(
            await generateMatrimonioPDF({
              nombre: String(f.apellidos_nombres ?? ""),
              cedula: String(f.cedula ?? ""),
              conyuge: String(f.conyuge ?? ""),
              cedula_conyugue: String(f.cedula_conyugue ?? ""),
              fecha: String(f.fecha_matrimonio ?? ""),
              hora: String(f.hora_matrimonio ?? ""),
              oficio: String(f.oficio_matrimonio ?? ""),
              padrino1: String(f.padrino1_matrimonio ?? ""),
              padrino2: String(f.padrino2_matrimonio ?? ""),
            }),
          )
        }

        return {
          contenido: await unirPdfs(paginas),
          nombre: `Certificados_Matrimonio_Completo_${hoyISO()}.pdf`,
          mensaje: `PDF con ${filas.length} certificados.`,
        }
      },
    },
    {
      id: "pdf-simple",
      label: "Certificados PDF (simple)",
      icono: "pdf",
      ejecutar: async (ctx) => {
        const filas = (await filasMatrimonios(ctx)).filter((f) => f.fecha_matrimonio && f.conyuge)
        if (filas.length === 0) throw new ErrorReporte("No hay matrimonios con fecha y cónyuge registrados.")

        const paginas: Uint8Array[] = []
        for (const f of filas) {
          paginas.push(
            await generateMatrimonioPDFv2({
              nombre: String(f.apellidos_nombres ?? ""),
              conyuge: String(f.conyuge ?? ""),
              oficio: String(f.oficio_matrimonio ?? ""),
              fecha: String(f.fecha_matrimonio ?? ""),
            }),
          )
        }

        return {
          contenido: await unirPdfs(paginas),
          nombre: `Certificados_Matrimonio_Simple_${hoyISO()}.pdf`,
          mensaje: `PDF con ${filas.length} certificados.`,
        }
      },
    },
  ],
}

// ─── Presentación de niños ────────────────────────────────────────────────────

async function filasPresentacion(filtros: Record<string, string>): Promise<Fila[]> {
  return seleccionarTodo<Fila>("presentacion_ninos", (q) => {
    let consulta = q.order("fecha", { ascending: false })
    if (filtros.rango_desde) consulta = consulta.gte("fecha", filtros.rango_desde)
    if (filtros.rango_hasta) consulta = consulta.lte("fecha", filtros.rango_hasta)
    return consulta
  })
}

const presentacionNinos: DefinicionReporte<Fila> = {
  id: "presentacion-ninos",
  grupo: "Vida ministerial",
  titulo: "Presentación de niños",
  descripcion: "Niños presentados ante la congregación, con padres, pastor y testigos.",
  tablas: ["presentacion_ninos"],
  modulos: ["listados", "presentacion-ninos", "control_mensual", "resumen-pastoral"],
  hoja: "Presentación de niños",
  archivo: "Presentacion_Ninos",
  filtros: [{ id: "rango", label: "Fecha de presentación", tipo: "rangoFechas" }],
  columnas: [
    { key: "nombre_presentado", label: "Niño presentado", ancho: 32 },
    { key: "fecha", label: "Fecha de presentación", tipo: "fecha" },
    { key: "nombre_padre", label: "Padre", ancho: 30 },
    { key: "nombre_madre", label: "Madre", ancho: 30 },
    { key: "nombre_pastor", label: "Pastor que presentó", ancho: 28 },
    { key: "testigo1", label: "Testigo 1" },
    { key: "testigo2", label: "Testigo 2" },
    { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
    { key: "created_at", label: "Fecha de registro", tipo: "fecha", opcional: true },
  ],
  obtener: async (ctx) => ({ filas: await filasPresentacion(ctx.filtros) }),
  acciones: [
    {
      id: "pdf-presentacion",
      label: "Certificados en PDF",
      icono: "pdf",
      ejecutar: async (ctx) => {
        const filas = await filasPresentacion(ctx.filtros)
        if (filas.length === 0) throw new ErrorReporte("No hay presentaciones registradas en ese rango.")

        const paginas: Uint8Array[] = []
        for (const f of filas) {
          paginas.push(
            await generatePresentacionNinoPDF({
              nombre_presentado: String(f.nombre_presentado ?? ""),
              nombre_padre: String(f.nombre_padre ?? ""),
              nombre_madre: String(f.nombre_madre ?? ""),
              fecha: String(f.fecha ?? ""),
              nombre_pastor: String(f.nombre_pastor ?? ""),
              testigo1: String(f.testigo1 ?? ""),
              testigo2: String(f.testigo2 ?? ""),
            }),
          )
        }

        return {
          contenido: await unirPdfs(paginas),
          nombre: `Certificados_Presentacion_Ninos_${hoyISO()}.pdf`,
          mensaje: `PDF con ${filas.length} certificados.`,
        }
      },
    },
  ],
}

export const reportesVidaMinisterial: DefinicionReporte<Fila>[] = [
  bautizos,
  matrimonios,
  presentacionNinos,
]
