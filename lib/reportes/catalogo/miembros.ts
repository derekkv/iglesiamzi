/**
 * Reportes de miembros y membresía: los cuatro censos, su combinación,
 * cumpleaños y células.
 *
 * Advertencias de esquema que condicionan estas definiciones:
 *
 * - `censo_jovenes` comparte nombres de columna con `censo` pero **reutiliza
 *   varias con otro significado** (`conyuge` es la madre, `cargo` es el número
 *   de emergencia, `fecha_matrimonio` es la primera visita a la iglesia). Por
 *   eso tiene su propio juego de etiquetas y el reporte combinado solo incluye
 *   las columnas con semántica idéntica.
 * - `censo_ninos` no comparte estructura: usa `nombre` en lugar de
 *   `apellidos_nombres` y no tiene cédula.
 * - `edad` se recalcula siempre desde `fecha_nacimiento`: el valor almacenado
 *   queda desactualizado y los servicios lo sobreescriben al leer.
 */

import {
  FUENTES_CENSO,
  calcularEdad,
  etiqueta,
  expandirHijos,
  maximoDeHijos,
  seleccionarTodo,
  tieneHijoEnRango,
} from "../data"
import type { ColumnaReporte, DefinicionReporte, FiltroReporte } from "../types"

type Fila = Record<string, unknown>

// ─── Columnas reutilizables ───────────────────────────────────────────────────

/**
 * Filtro por la edad de los hijos. Deja las personas que tengan al menos un
 * hijo en el rango; la familia se exporta completa, no solo los hijos que
 * caen dentro.
 */
const FILTRO_EDAD_HIJOS: FiltroReporte = {
  id: "edadHijos",
  label: "Edad de los hijos",
  tipo: "rangoNumeros",
  ayuda:
    "Deja solo a quienes tengan al menos un hijo en ese rango de edad. En el Excel el mismo filtro se puede repetir con las columnas de edad del hijo menor y del hijo mayor.",
}

/** Resumen de los hijos: es lo que permite filtrar por edades dentro del Excel. */
const COLS_RESUMEN_HIJOS: ColumnaReporte<Fila>[] = [
  { key: "hijos_total", label: "N.º de hijos", tipo: "numero", ancho: 11 },
  {
    key: "hijo_edad_menor",
    label: "Edad del hijo menor",
    tipo: "numero",
    ancho: 15,
    ayuda: "Sirve para filtrar por rango de edades directamente en la hoja.",
  },
  { key: "hijo_edad_mayor", label: "Edad del hijo mayor", tipo: "numero", ancho: 15 },
]

const NOTA_COLUMNAS_HIJOS =
  "Cada hijo ocupa dos columnas al final de la hoja (nombre y edad), tantas parejas como tenga la familia más numerosa. Para filtrar por edades use el n.º de hijos y las columnas de edad del hijo menor y del hijo mayor."

/** Expande los hijos de cada fila y aplica el filtro por edad de los hijos. */
function filasConHijos(filas: Fila[], filtros: Record<string, string>): Fila[] {
  const desde = filtros.edadHijos_desde
  const hasta = filtros.edadHijos_hasta
  return filas
    .filter((fila) => tieneHijoEnRango(fila, desde, hasta))
    .map((fila) => expandirHijos(fila))
}

/**
 * Una pareja de columnas por hijo, tantas como la familia más numerosa.
 * Se consulta al abrir el reporte para no recortar a nadie ni dejar columnas
 * vacías de más.
 */
function columnasDeHijos(tablas: string[]): () => Promise<ColumnaReporte<Fila>[]> {
  return async () => {
    const porTabla = await Promise.all(
      tablas.map((tabla) => seleccionarTodo<Fila>(tabla, (q) => q, { select: "hijos" })),
    )
    const maximo = maximoDeHijos(porTabla.flat())

    return Array.from({ length: maximo }, (_, i) => [
      { key: `hijo_${i + 1}_nombre`, label: `Hijo/a ${i + 1}`, ancho: 26 },
      { key: `hijo_${i + 1}_edad`, label: `Edad hijo/a ${i + 1}`, tipo: "numero" as const, ancho: 13 },
    ]).flat()
  }
}

const COL_EDAD: ColumnaReporte<Fila> = {
  key: "edad",
  label: "Edad",
  tipo: "numero",
  ancho: 8,
  ayuda: "Recalculada desde la fecha de nacimiento al momento de exportar.",
  valor: (f) => calcularEdad(f.fecha_nacimiento) ?? "",
}

const COL_FUENTE: ColumnaReporte<Fila> = {
  key: "fuente",
  label: "Censo de origen",
  ancho: 16,
  valor: (f) => etiqueta(FUENTES_CENSO, f.fuente),
}

const COLS_METADATOS: ColumnaReporte<Fila>[] = [
  { key: "id", label: "ID", tipo: "numero", ancho: 8, opcional: true },
  { key: "created_at", label: "Fecha de registro", tipo: "fecha", opcional: true },
  { key: "updated_at", label: "Última actualización", tipo: "fechaHora", opcional: true },
]

/** Bloque de vida cristiana y membresía, idéntico en censo, MDG y jóvenes. */
const COLS_VIDA_CRISTIANA: ColumnaReporte<Fila>[] = [
  { key: "si_a_cristo", label: "Sí a Cristo" },
  { key: "bautizo", label: "Bautizo" },
  { key: "discipulado_irdd", label: "Hizo discipulado en la IRDD", tipo: "booleano" },
  { key: "primeros_pasos", label: "1. Primeros pasos", tipo: "booleano" },
  { key: "seguimos_avanzando", label: "2. Seguimos avanzando", tipo: "booleano" },
  { key: "siendo_iglesia", label: "3. Siendo iglesia", tipo: "booleano" },
  { key: "bautizo_irdd", label: "Se bautizó en la IRDD", tipo: "booleano" },
  { key: "fecha_bautizo", label: "Fecha del bautizo", tipo: "fecha" },
  { key: "miembro", label: "Miembro", tipo: "booleano" },
  { key: "miembro_activo", label: "Miembro activo", tipo: "booleano" },
  { key: "sirve_iglesia", label: "Sirve a la iglesia", tipo: "booleano" },
  { key: "ministerio", label: "Ministerio", tipo: "lista" },
  { key: "ministerios_list", label: "Ministerios", tipo: "lista", opcional: true },
  { key: "cargo_ministerio", label: "Cargo en el ministerio" },
  { key: "seminarios", label: "Seminarios realizados", tipo: "lista", opcional: true },
  { key: "proyecto_mario", label: "Participa en Proyecto Mario", tipo: "booleano" },
  { key: "proyecto_mario_detalle", label: "Proyecto Mario — detalle", opcional: true },
  { key: "celula_asiste", label: "Asiste a una célula", tipo: "booleano" },
  { key: "celula_nombre", label: "Célula asignada" },
]

/** Censo Protocolo y MDG comparten formulario, así que comparten columnas. */
function columnasCenso(incluirNuevoCreyente: boolean): ColumnaReporte<Fila>[] {
  return [
    { key: "cedula", label: "Cédula", ancho: 14 },
    { key: "apellidos_nombres", label: "Apellidos y nombres", ancho: 34 },
    { key: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "fecha" },
    COL_EDAD,
    { key: "sexo", label: "Sexo", ancho: 12 },
    { key: "estado_civil", label: "Estado civil" },
    ...(incluirNuevoCreyente
      ? [{ key: "nuevo_creyente", label: "Nuevo creyente", tipo: "booleano" } as ColumnaReporte<Fila>]
      : []),
    { key: "tipo_sangre", label: "Tipo de sangre", opcional: true },

    { key: "celular", label: "Celular", ancho: 14 },
    { key: "convencional", label: "Convencional", ancho: 14, opcional: true },
    { key: "familiar", label: "Contacto familiar", opcional: true },
    { key: "familiar_nombre", label: "Nombre del familiar", opcional: true },
    { key: "correo", label: "Correo electrónico", ancho: 28 },

    { key: "direccion", label: "Dirección", ancho: 36 },
    { key: "ciudad", label: "Ciudad" },
    { key: "parroquia", label: "Parroquia", opcional: true },
    { key: "barrio", label: "Barrio", opcional: true },

    { key: "nivel_estudio", label: "Nivel de estudio" },
    { key: "curso", label: "Curso / profesión" },
    { key: "jornada_trabajo", label: "Jornada de trabajo", opcional: true },
    { key: "cargo", label: "Cargo (trabajo)", opcional: true },
    { key: "lugar_trabajo", label: "Lugar de trabajo", opcional: true },

    { key: "conyuge", label: "Nombre del cónyuge" },
    { key: "cedula_conyugue", label: "Cédula del cónyuge", opcional: true },
    { key: "tiene_hijos", label: "Tiene hijos", tipo: "booleano" },
    ...COLS_RESUMEN_HIJOS,

    {
      key: "tiene_discapacidad",
      label: "Tiene discapacidad",
      tipo: "booleano",
      sensible: true,
      ayuda: "Dato de salud.",
    },
    { key: "capacidad_esp", label: "Capacidad especial", sensible: true },
    { key: "porcentaje", label: "Porcentaje de discapacidad", tipo: "numero", sensible: true },
    { key: "tipo_discapacidad", label: "Detalle de la discapacidad", sensible: true },

    ...COLS_VIDA_CRISTIANA,

    { key: "matrimonio_irdd", label: "Matrimonio en la IRDD", tipo: "booleano" },
    { key: "fecha_matrimonio", label: "Fecha del matrimonio", tipo: "fecha" },
    { key: "hora_matrimonio", label: "Hora de la ceremonia", opcional: true },
    { key: "oficio_matrimonio", label: "Quién ofició la ceremonia", opcional: true },
    { key: "padrino1_matrimonio", label: "Padrino 1", opcional: true },
    { key: "padrino2_matrimonio", label: "Padrino 2", opcional: true },

    ...COLS_METADATOS,
  ]
}

/**
 * Censo de jóvenes. Las columnas marcadas con "(reutilizada)" guardan datos de
 * padres o de contacto de emergencia en campos cuyo nombre viene del censo de
 * adultos; la etiqueta refleja el significado real del formulario de jóvenes.
 */
const COLUMNAS_CENSO_JOVENES: ColumnaReporte<Fila>[] = [
  { key: "cedula", label: "Cédula", ancho: 14, ayuda: "Puede estar vacía: no es obligatoria en jóvenes." },
  { key: "apellidos_nombres", label: "Apellidos y nombres", ancho: 34 },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "fecha" },
  COL_EDAD,
  { key: "sexo", label: "Género", ancho: 12 },
  { key: "nuevo_creyente", label: "Nuevo creyente", tipo: "booleano" },
  { key: "primera_vez_iglesia", label: "Primera vez en la iglesia", tipo: "booleano" },
  {
    key: "fecha_matrimonio",
    label: "Fecha de la primera visita",
    tipo: "fecha",
    ayuda: "Guardada en la columna fecha_matrimonio del censo de jóvenes.",
  },

  { key: "celular", label: "Teléfono", ancho: 14 },
  { key: "correo", label: "Correo electrónico", ancho: 28 },
  { key: "direccion", label: "Dirección", ancho: 36 },
  { key: "ciudad", label: "Ciudad" },
  { key: "parroquia", label: "Parroquia", opcional: true },
  { key: "barrio", label: "Barrio", opcional: true },

  { key: "familiar_nombre", label: "Nombre del padre", sensible: true },
  { key: "convencional", label: "Número del padre", sensible: true },
  { key: "conyuge", label: "Nombre de la madre", sensible: true },
  { key: "cedula_conyugue", label: "Número de la madre", sensible: true },
  { key: "familiar", label: "¿Con quién vive?", sensible: true },
  { key: "lugar_trabajo", label: "Emergencia — nombre", sensible: true },
  { key: "jornada_trabajo", label: "Emergencia — parentesco", sensible: true },
  { key: "cargo", label: "Emergencia — número", sensible: true },

  { key: "nivel_estudio", label: "Nivel de estudio" },
  { key: "curso", label: "Curso" },
  { key: "escuela_colegio", label: "Escuela / colegio" },

  { key: "capacidad_esp", label: "Alergias o condición médica", sensible: true, ayuda: "Dato de salud de un menor." },
  { key: "tipo_discapacidad", label: "¿Toma algún medicamento?", sensible: true },

  { key: "ig", label: "Instagram", opcional: true, sensible: true },
  { key: "tiktok", label: "TikTok", opcional: true, sensible: true },
  { key: "facebook", label: "Facebook", opcional: true, sensible: true },

  ...COLS_VIDA_CRISTIANA,
  ...COLS_METADATOS,
]

const COLUMNAS_CENSO_NINOS: ColumnaReporte<Fila>[] = [
  { key: "nombre", label: "Nombre", ancho: 34 },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "fecha" },
  COL_EDAD,
  { key: "grupo", label: "Grupo", ancho: 22, ayuda: "Se asigna automáticamente según la edad." },
  { key: "nombre_madre", label: "Madre" },
  { key: "telefono_madre", label: "Teléfono de la madre", ancho: 16 },
  { key: "nombre_padre", label: "Padre" },
  { key: "telefono_padre", label: "Teléfono del padre", ancho: 16 },
  {
    key: "alergias",
    label: "Alergias",
    sensible: true,
    ancho: 30,
    ayuda: "Dato de salud de un menor.",
  },
  { key: "observaciones", label: "Observaciones", sensible: true, ancho: 36 },
  ...COLS_METADATOS,
]

/**
 * Núcleo con semántica idéntica en Protocolo, MDG y jóvenes. Es la base del
 * reporte combinado; se excluye a propósito todo campo que cambie de
 * significado entre censos.
 */
const COLUMNAS_COMBINADO: ColumnaReporte<Fila>[] = [
  COL_FUENTE,
  { key: "cedula", label: "Cédula", ancho: 14 },
  { key: "apellidos_nombres", label: "Apellidos y nombres", ancho: 34 },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "fecha" },
  COL_EDAD,
  { key: "sexo", label: "Sexo / género", ancho: 12 },
  { key: "celular", label: "Celular / teléfono", ancho: 14 },
  { key: "correo", label: "Correo electrónico", ancho: 28 },
  { key: "direccion", label: "Dirección", ancho: 36 },
  { key: "ciudad", label: "Ciudad" },
  { key: "parroquia", label: "Parroquia", opcional: true },
  { key: "barrio", label: "Barrio", opcional: true },
  { key: "nivel_estudio", label: "Nivel de estudio" },
  { key: "curso", label: "Curso / profesión" },
  {
    key: "grupo",
    label: "Grupo (niños)",
    opcional: true,
    ayuda: "Solo lo llena el censo de niños.",
  },
  ...COLS_RESUMEN_HIJOS,
  ...COLS_VIDA_CRISTIANA,
  { key: "id", label: "ID en su censo", tipo: "numero", ancho: 10, opcional: true },
  { key: "created_at", label: "Fecha de registro", tipo: "fecha", opcional: true },
]

// ─── Reportes de censo individuales ───────────────────────────────────────────

const censoProtocolo: DefinicionReporte<Fila> = {
  id: "censo-protocolo",
  grupo: "Miembros y membresía",
  titulo: "Censo Protocolo",
  descripcion: "Censo general de la iglesia, con datos personales, de contacto, vida cristiana y membresía.",
  tablas: ["censo"],
  modulos: ["listados", "censo", "control_mensual", "resumen-pastoral"],
  hoja: "Censo Protocolo",
  archivo: "Censo_Protocolo",
  columnas: columnasCenso(false),
  cargarColumnas: columnasDeHijos(["censo"]),
  filtros: [FILTRO_EDAD_HIJOS],
  notas: [NOTA_COLUMNAS_HIJOS],
  obtener: async (ctx) => {
    const filas = await seleccionarTodo<Fila>("censo", (q) =>
      q.order("apellidos_nombres", { ascending: true }),
    )
    return { filas: filasConHijos(filas, ctx.filtros) }
  },
}

const censoMdg: DefinicionReporte<Fila> = {
  id: "censo-mdg",
  grupo: "Miembros y membresía",
  titulo: "Censo MDG",
  descripcion: "Censo de Mujeres de Gracia y nuevos creyentes. Mismo formulario que Protocolo más el indicador de nuevo creyente.",
  tablas: ["censo_mdg"],
  modulos: ["listados", "censo-mdg", "control_mensual", "resumen-pastoral"],
  hoja: "Censo MDG",
  archivo: "Censo_MDG",
  columnas: columnasCenso(true),
  cargarColumnas: columnasDeHijos(["censo_mdg"]),
  filtros: [FILTRO_EDAD_HIJOS],
  notas: [NOTA_COLUMNAS_HIJOS],
  obtener: async (ctx) => {
    const filas = await seleccionarTodo<Fila>("censo_mdg", (q) =>
      q.order("apellidos_nombres", { ascending: true }),
    )
    return { filas: filasConHijos(filas, ctx.filtros) }
  },
}

const censoJovenes: DefinicionReporte<Fila> = {
  id: "censo-jovenes",
  grupo: "Miembros y membresía",
  titulo: "Censo de Jóvenes",
  descripcion: "Censo de jóvenes, con datos de los padres, contacto de emergencia y redes sociales.",
  tablas: ["censo_jovenes"],
  modulos: ["listados", "censo-jovenes", "control_mensual", "resumen-pastoral"],
  hoja: "Censo Jóvenes",
  archivo: "Censo_Jovenes",
  columnas: COLUMNAS_CENSO_JOVENES,
  notas: [
    "Los datos de padres y de contacto de emergencia se guardan en columnas heredadas del censo de adultos; las etiquetas de este reporte reflejan el significado real del formulario de jóvenes.",
    "La cédula no es obligatoria en este censo, así que puede venir vacía.",
  ],
  obtener: async () => ({
    filas: await seleccionarTodo<Fila>("censo_jovenes", (q) =>
      q.order("apellidos_nombres", { ascending: true }),
    ),
  }),
}

const censoNinos: DefinicionReporte<Fila> = {
  id: "censo-ninos",
  grupo: "Miembros y membresía",
  titulo: "Censo de Niños",
  descripcion: "Censo de niños con datos de los padres y grupo de Herederos asignado por edad.",
  tablas: ["censo_ninos"],
  modulos: ["listados", "censo-ninos", "control_mensual", "resumen-pastoral"],
  hoja: "Censo Niños",
  archivo: "Censo_Ninos",
  columnas: COLUMNAS_CENSO_NINOS,
  filtros: [
    {
      id: "grupo",
      label: "Grupo",
      tipo: "opcion",
      opcionTodos: "Todos los grupos",
      opciones: [
        { value: "HEREDEROS BABY", label: "Herederos Baby (0-2)" },
        { value: "HEREDEROS KIDS", label: "Herederos Kids (3-5)" },
        { value: "HEREDEROS EXPLORES", label: "Herederos Explores (6-8)" },
        { value: "HEREDEROS CHAMPIONS", label: "Herederos Champions (9-11)" },
      ],
    },
  ],
  notas: ["Alergias y observaciones son datos de salud de menores."],
  obtener: async (ctx) => ({
    filas: await seleccionarTodo<Fila>("censo_ninos", (q) => {
      let consulta = q.order("nombre", { ascending: true })
      if (ctx.filtros.grupo) consulta = consulta.eq("grupo", ctx.filtros.grupo)
      return consulta
    }),
  }),
}

// ─── Censo combinado ──────────────────────────────────────────────────────────

const censoCombinado: DefinicionReporte<Fila> = {
  id: "censo-combinado",
  grupo: "Miembros y membresía",
  titulo: "Censo combinado",
  descripcion:
    "Une los cuatro censos en una sola hoja con una columna que indica el censo de origen. Incluye solo las columnas que significan lo mismo en todos los censos.",
  tablas: ["censo", "censo_mdg", "censo_jovenes", "censo_ninos"],
  modulos: ["listados", "control_mensual", "resumen-pastoral"],
  hoja: "Censo combinado",
  archivo: "Censo_Combinado",
  fuentes: [
    { id: "protocolo", label: "Censo Protocolo", default: true },
    { id: "mdg", label: "Censo MDG", default: true },
    { id: "jovenes", label: "Censo de Jóvenes", default: true },
    {
      id: "ninos",
      label: "Censo de Niños",
      default: true,
      descripcion: "Solo aporta nombre, fecha de nacimiento, edad y grupo.",
    },
  ],
  filtros: [FILTRO_EDAD_HIJOS],
  columnas: COLUMNAS_COMBINADO,
  cargarColumnas: columnasDeHijos(["censo", "censo_mdg"]),
  notas: [
    "El censo de niños no comparte estructura con los demás: su nombre se mapea a la columna de apellidos y nombres, y el resto de columnas queda vacío.",
    "Las columnas que en el censo de jóvenes significan otra cosa (datos de los padres, contacto de emergencia, primera visita) no se incluyen aquí; use el reporte específico de jóvenes.",
    "Las columnas de hijos solo las llenan Protocolo y MDG: son los únicos censos que guardan ese dato.",
    NOTA_COLUMNAS_HIJOS,
  ],
  obtener: async (ctx) => {
    const quiere = (id: string) => ctx.fuentes.includes(id)

    const [protocolo, mdg, jovenes, ninos] = await Promise.all([
      quiere("protocolo")
        ? seleccionarTodo<Fila>("censo", (q) => q.order("apellidos_nombres", { ascending: true }))
        : Promise.resolve([]),
      quiere("mdg")
        ? seleccionarTodo<Fila>("censo_mdg", (q) => q.order("apellidos_nombres", { ascending: true }))
        : Promise.resolve([]),
      quiere("jovenes")
        ? seleccionarTodo<Fila>("censo_jovenes", (q) => q.order("apellidos_nombres", { ascending: true }))
        : Promise.resolve([]),
      quiere("ninos")
        ? seleccionarTodo<Fila>("censo_ninos", (q) => q.order("nombre", { ascending: true }))
        : Promise.resolve([]),
    ])

    const filas: Fila[] = [
      ...protocolo.map((r) => ({ ...r, fuente: "protocolo" })),
      ...mdg.map((r) => ({ ...r, fuente: "mdg" })),
      ...jovenes.map((r) => ({ ...r, fuente: "jovenes" })),
      ...ninos.map((r) => ({
        ...r,
        fuente: "ninos",
        apellidos_nombres: r.nombre,
        cedula: "",
      })),
    ]

    return { filas: filasConHijos(filas, ctx.filtros) }
  },
}

// ─── Cumpleaños ───────────────────────────────────────────────────────────────

const MESES_CALENDARIO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const cumpleanos: DefinicionReporte<Fila> = {
  id: "cumpleanos",
  grupo: "Miembros y membresía",
  titulo: "Cumpleaños",
  descripcion: "Cumpleaños de los censos, ordenados por día, con la edad que cumple la persona este año.",
  tablas: ["censo", "censo_mdg", "censo_jovenes", "censo_ninos"],
  modulos: ["listados", "control_mensual", "resumen-pastoral"],
  hoja: "Cumpleaños",
  archivo: "Cumpleanos",
  fuentes: [
    { id: "protocolo", label: "Censo Protocolo", default: true },
    { id: "mdg", label: "Censo MDG", default: true },
    { id: "jovenes", label: "Censo de Jóvenes", default: true },
    { id: "ninos", label: "Censo de Niños", default: true },
  ],
  filtros: [
    {
      id: "mesCalendario",
      label: "Mes del cumpleaños",
      tipo: "opcion",
      opcionTodos: "Todo el año",
      opciones: MESES_CALENDARIO.map((nombre, i) => ({ value: String(i + 1), label: nombre })),
    },
  ],
  columnas: [
    { key: "dia", label: "Día", tipo: "numero", ancho: 7 },
    { key: "mesNombre", label: "Mes", ancho: 12 },
    { key: "apellidos_nombres", label: "Nombre", ancho: 34 },
    COL_FUENTE,
    { key: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "fecha" },
    { key: "edadActual", label: "Edad actual", tipo: "numero", ancho: 11 },
    { key: "edadCumple", label: "Cumple", tipo: "numero", ancho: 9, ayuda: "Edad que cumple este año." },
    { key: "celular", label: "Celular", ancho: 14 },
    { key: "correo", label: "Correo electrónico", ancho: 28, opcional: true },
    { key: "celula_nombre", label: "Célula", opcional: true },
    { key: "grupo", label: "Grupo (niños)", opcional: true },
  ],
  notas: ["Se excluyen los registros sin fecha de nacimiento."],
  obtener: async (ctx) => {
    const quiere = (id: string) => ctx.fuentes.includes(id)
    const campos = "id, apellidos_nombres, fecha_nacimiento, celular, correo, celula_nombre"

    const [protocolo, mdg, jovenes, ninos] = await Promise.all([
      quiere("protocolo") ? seleccionarTodo<Fila>("censo", (q) => q, { select: campos }) : Promise.resolve([]),
      quiere("mdg") ? seleccionarTodo<Fila>("censo_mdg", (q) => q, { select: campos }) : Promise.resolve([]),
      quiere("jovenes") ? seleccionarTodo<Fila>("censo_jovenes", (q) => q, { select: campos }) : Promise.resolve([]),
      quiere("ninos")
        ? seleccionarTodo<Fila>("censo_ninos", (q) => q, {
            select: "id, nombre, fecha_nacimiento, telefono_madre, grupo",
          })
        : Promise.resolve([]),
    ])

    const crudas: Fila[] = [
      ...protocolo.map((r) => ({ ...r, fuente: "protocolo" })),
      ...mdg.map((r) => ({ ...r, fuente: "mdg" })),
      ...jovenes.map((r) => ({ ...r, fuente: "jovenes" })),
      ...ninos.map((r) => ({
        ...r,
        fuente: "ninos",
        apellidos_nombres: r.nombre,
        celular: r.telefono_madre,
      })),
    ]

    const anioActual = new Date().getFullYear()
    const mesPedido = ctx.filtros.mesCalendario ? Number(ctx.filtros.mesCalendario) : null
    const filas: Fila[] = []

    for (const persona of crudas) {
      const fecha = typeof persona.fecha_nacimiento === "string" ? persona.fecha_nacimiento.slice(0, 10) : ""
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue

      const mes = Number(fecha.slice(5, 7))
      if (mesPedido && mes !== mesPedido) continue

      const anioNacimiento = Number(fecha.slice(0, 4))
      filas.push({
        ...persona,
        dia: Number(fecha.slice(8, 10)),
        mes,
        mesNombre: MESES_CALENDARIO[mes - 1] ?? "",
        edadActual: calcularEdad(fecha) ?? "",
        edadCumple: anioActual - anioNacimiento,
      })
    }

    filas.sort((a, b) => Number(a.mes) - Number(b.mes) || Number(a.dia) - Number(b.dia))
    return { filas }
  },
}


// ─── Células ──────────────────────────────────────────────────────────────────

const celulasMiembros: DefinicionReporte<Fila> = {
  id: "celulas-miembros",
  grupo: "Miembros y membresía",
  titulo: "Células — miembros",
  descripcion: "Miembros asignados a cada célula, uniendo Protocolo, MDG y los miembros registrados a mano.",
  tablas: ["censo", "censo_mdg", "miembros_celulas"],
  modulos: ["listados", "celulas"],
  hoja: "Miembros por célula",
  archivo: "Celulas_Miembros",
  fuentes: [
    { id: "protocolo", label: "Censo Protocolo", default: true },
    { id: "mdg", label: "Censo MDG", default: true },
    { id: "manual", label: "Miembros registrados a mano", default: true },
  ],
  filtros: [
    {
      id: "asiste",
      label: "Estado",
      tipo: "opcion",
      opcionTodos: "Todos",
      opciones: [
        { value: "si", label: "Asiste actualmente" },
        { value: "no", label: "No asiste / posible" },
      ],
    },
    FILTRO_EDAD_HIJOS,
  ],
  columnas: [
    { key: "celula_nombre", label: "Célula", ancho: 26 },
    { key: "apellidos_nombres", label: "Nombre", ancho: 34 },
    COL_FUENTE,
    { key: "celula_asiste", label: "Asiste", tipo: "booleano", ancho: 9 },
    { key: "contacto", label: "Contacto", ancho: 16 },
    { key: "cedula", label: "Cédula", ancho: 14, ayuda: "Vacía en los miembros registrados a mano." },
    { key: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "fecha", opcional: true },
    COL_EDAD,
    { key: "estado_civil", label: "Estado civil", opcional: true },
    { key: "sexo", label: "Sexo", opcional: true, ancho: 12 },
    { key: "conyuge", label: "Cónyuge", opcional: true },
    ...COLS_RESUMEN_HIJOS,
    { key: "direccion", label: "Dirección", ancho: 34, opcional: true },
    { key: "correo", label: "Correo electrónico", ancho: 28, opcional: true },
  ],
  notas: [
    "En los miembros registrados a mano el formulario guarda el teléfono dentro de la columna de cédula; por eso el contacto de esas filas sale en la columna Contacto y su cédula queda vacía.",
    "Las columnas de hijos solo las llenan Protocolo y MDG.",
    NOTA_COLUMNAS_HIJOS,
  ],
  cargarColumnas: columnasDeHijos(["censo", "censo_mdg"]),
  obtener: async (ctx) => {
    const quiere = (id: string) => ctx.fuentes.includes(id)
    const campos =
      "id, apellidos_nombres, cedula, celular, convencional, conyuge, hijos, celula_asiste, celula_nombre, fecha_nacimiento, estado_civil, sexo, direccion, correo"

    const conCelula = (q: any) => q.not("celula_nombre", "is", null).order("celula_nombre", { ascending: true })

    const [protocolo, mdg, manuales] = await Promise.all([
      quiere("protocolo") ? seleccionarTodo<Fila>("censo", conCelula, { select: campos }) : Promise.resolve([]),
      quiere("mdg") ? seleccionarTodo<Fila>("censo_mdg", conCelula, { select: campos }) : Promise.resolve([]),
      quiere("manual")
        ? seleccionarTodo<Fila>("miembros_celulas", (q) => q.order("celula_nombre", { ascending: true }), {
            select: "id, apellidos_nombres, cedula, celula_nombre, celula_asiste",
          })
        : Promise.resolve([]),
    ])

    const filas: Fila[] = [
      ...protocolo.map((r) => ({ ...r, fuente: "protocolo", contacto: r.celular || r.convencional || "" })),
      ...mdg.map((r) => ({ ...r, fuente: "mdg", contacto: r.celular || r.convencional || "" })),
      // En los manuales la columna `cedula` contiene el teléfono.
      ...manuales.map((r) => ({ ...r, fuente: "manual", contacto: r.cedula ?? "", cedula: "" })),
    ]

    const filtradas = (
      ctx.filtros.asiste === "si"
        ? filas.filter((f) => f.celula_asiste === true)
        : ctx.filtros.asiste === "no"
          ? filas.filter((f) => f.celula_asiste !== true)
          : filas
    ).filter((f) => tieneHijoEnRango(f, ctx.filtros.edadHijos_desde, ctx.filtros.edadHijos_hasta))
      .map((f) => expandirHijos(f))

    filtradas.sort(
      (a, b) =>
        String(a.celula_nombre ?? "").localeCompare(String(b.celula_nombre ?? "")) ||
        String(a.apellidos_nombres ?? "").localeCompare(String(b.apellidos_nombres ?? "")),
    )

    return { filas: filtradas }
  },
}

const celulasGestion: DefinicionReporte<Fila> = {
  id: "celulas-gestion",
  grupo: "Miembros y membresía",
  titulo: "Células — gestión semanal",
  descripcion: "Seguimiento semanal de los miembros de célula: quién fue contactado, qué respondió y si asistió.",
  tablas: ["gestion_celulas"],
  modulos: ["listados", "celulas", "ofrenda-celulas", "control_mensual", "resumen-pastoral"],
  hoja: "Gestión semanal",
  archivo: "Celulas_Gestion",
  filtros: [
    { id: "rango", label: "Semanas (inicio)", tipo: "rangoFechas", ayuda: "Filtra por la fecha del lunes de cada semana." },
    {
      id: "fuente",
      label: "Censo de origen",
      tipo: "opcion",
      opcionTodos: "Todos",
      opciones: [
        { value: "protocolo", label: "Protocolo" },
        { value: "mdg", label: "MDG" },
        { value: "manual", label: "Manual" },
      ],
    },
  ],
  columnas: [
    { key: "semana_inicio", label: "Semana (lunes)", tipo: "fecha" },
    { key: "celula_nombre", label: "Célula", ancho: 26 },
    { key: "miembro_id", label: "ID del miembro", tipo: "numero", ancho: 14 },
    COL_FUENTE,
    { key: "gestionado", label: "Gestionado", tipo: "booleano", ancho: 12 },
    { key: "asistio", label: "Asistió", tipo: "booleano", ancho: 10 },
    { key: "respuesta", label: "Respuesta", ancho: 40 },
    { key: "gestionado_por_nombre", label: "Gestionado por" },
    { key: "created_at", label: "Registrado", tipo: "fechaHora", opcional: true },
  ],
  notas: [
    "El miembro se identifica por id dentro de su censo de origen; esta tabla no guarda el nombre.",
  ],
  obtener: async (ctx) => ({
    filas: await seleccionarTodo<Fila>("gestion_celulas", (q) => {
      let consulta = q.order("semana_inicio", { ascending: false })
      if (ctx.filtros.rango_desde) consulta = consulta.gte("semana_inicio", ctx.filtros.rango_desde)
      if (ctx.filtros.rango_hasta) consulta = consulta.lte("semana_inicio", ctx.filtros.rango_hasta)
      if (ctx.filtros.fuente) consulta = consulta.eq("fuente", ctx.filtros.fuente)
      return consulta
    }),
  }),
}

export const reportesMiembros: DefinicionReporte<Fila>[] = [
  censoProtocolo,
  censoMdg,
  censoJovenes,
  censoNinos,
  censoCombinado,
  cumpleanos,
  celulasMiembros,
  celulasGestion,
]
