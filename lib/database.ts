import { supabase } from "./supabase"

export interface Mes {
  id: string
  name: string
  year: number
  month: number
  start_date: string
  end_date: string | null
  status: "active" | "closed"
  created_at: string
  updated_at: string
}

export interface Ingreso {
  id: number
  mes_id: string
  concepto: string
  monto: number
  fecha: string
  ministerio: string | null
  categoria_principal: string | null
  detalle: string | null
  observacion: string | null
  estado: string | null
}

export interface Egreso {
  id: number
  mes_id: string
  concepto: string
  monto: number
  fecha: string
  ministerio: string | null
  categoria_principal: string | null
  detalle: string | null
  observacion: string | null
  estado: string | null
}

export interface DiscipuladoFecha {
  id: number
  mes_id: string
  fecha: string
}

export interface DiscipuladoParticipante {
  id: number
  name: string
}

export interface DiscipuladoAsistencia {
  id: number
  mes_id: string
  participante_id: number
  fecha_id: number
  estado: "A" | "F" | "J" | "AT"
}

export interface AsistenciaDetalle {
  id: number
  mes_id: string
  nombre: string
  orden: number
}

export interface AsistenciaColumna {
  id: number
  mes_id: string
  nombre: string
  orden: number
}

export interface AsistenciaDato {
  id: number
  mes_id: string
  detalle_id: number
  columna_id: number
  valor: number
}

export interface Diezmo {
  id: number
  mes_id: string
  numero: number
  fecha: string
  donador: string
  valor: number
  created_at: string
  updated_at: string
}


// Adding censo interfaces
export interface CensoDatosPersonales {
  id?: number
  cedula: string
  apellidos_nombres: string
  fecha_nacimiento?: string
  edad?: number
  es_cristiano: boolean
  bautizo: boolean
  tipo_sangre?: string
  estado_civil?: string
  sexo?: string
  capacidad_especial?: string
  porcentaje_discapacidad?: number
  tipo_discapacidad?: string
  celular?: string
  telefono_convencional?: string
  telefono_familiar?: string
  conyuge?: string
  correo?: string
  nivel_estudio?: string
  curso?: string
  acumuladecimos?: string
  hoja_vida?: string
  estado?: string
  fecha_registro_saite?: string
  fecha_registro_iess?: string
  direccion?: string
  ciudad?: string
  created_at?: string
  updated_at?: string
}

export interface CensoDatosIglesia {
  id?: number
  cedula: string
  jornada_trabajo?: string
  cargo?: string
  local?: string
  fecha_ingreso?: string
  fecha_reingreso?: string
  fecha_salida?: string
  dias_por_mes?: number
  horas_diarias?: number
  horas_semanales?: number
  sueldo?: number
  tipo_pago?: string
  banco?: string
  numero_cuenta?: string
  interseccion?: string
  redil?: string
  ninos?: string
  otros?: string
  created_at?: string
  updated_at?: string
}

export interface CensoConfiguraciones {
  id?: number
  tipos_sangre: string[]
  estados_civiles: string[]
  capacidades_especiales: string[]
  niveles_estudio: string[]
  jornadas_trabajo: string[]
  cargos: string[]
  locales: string[]
  tipos_pago: string[]
  bancos: string[]
  created_at?: string
  updated_at?: string
}

export async function getMesById(mesId: string) {


  const { data: mes, error } = await supabase.from("meses").select("*").eq("id", mesId).single()

  if (error) throw error
  return mes as Mes
}

export async function getIngresosByMes(mesId: string) {

  const { data, error } = await supabase
    .from("ingresos")
    .select("*")
    .eq("mes_id", mesId)
    .order("fecha", { ascending: false })

  if (error) throw error
  return data as Ingreso[]
}


export async function getDiezmosByMes(mesId: string) {

  const { data, error } = await supabase
    .from("diezmos")
    .select("*")
    .eq("mes_id", mesId)
    .order("fecha", { ascending: false })

  if (error) throw error
  return data as Diezmo[]
}

export async function getEgresosByMes(mesId: string) {

  const { data, error } = await supabase
    .from("egresos")
    .select("*")
    .eq("mes_id", mesId)
    .order("fecha", { ascending: false })

  if (error) throw error
  return data as Egreso[]
}

export async function getDiscipuladoData(mesId: string) {

  // Obtener fechas del discipulado
  const { data: fechas, error: fechasError } = await supabase
    .from("discipulado_fechas")
    .select("*")
    .eq("mes_id", mesId)
    .order("fecha", { ascending: true })

  if (fechasError) throw fechasError

  // Obtener participantes
  const { data: participantes, error: participantesError } = await supabase
    .from("discipulado_participantes")
    .select("*")
    .order("name", { ascending: true })

  if (participantesError) throw participantesError

  // Obtener asistencia
  const { data: asistencia, error: asistenciaError } = await supabase
    .from("discipulado_asistencia")
    .select("*")
    .eq("mes_id", mesId)

  if (asistenciaError) throw asistenciaError

  return {
    fechas: fechas as DiscipuladoFecha[],
    participantes: participantes as DiscipuladoParticipante[],
    asistencia: asistencia as DiscipuladoAsistencia[],
  }
}

export async function getAsistenciaData(mesId: string) {

  // Obtener detalles de asistencia
  const { data: detalles, error: detallesError } = await supabase
    .from("asistencia_detalles")
    .select("*")
    .eq("mes_id", mesId)
    .order("orden", { ascending: true })

  if (detallesError) throw detallesError

  // Obtener columnas de asistencia
  const { data: columnas, error: columnasError } = await supabase
    .from("asistencia_columnas")
    .select("*")
    .eq("mes_id", mesId)
    .order("orden", { ascending: true })

  if (columnasError) throw columnasError

  // Obtener datos de asistencia
  const { data: datos, error: datosError } = await supabase.from("asistencia_datos").select("*").eq("mes_id", mesId)

  if (datosError) throw datosError

  return {
    detalles: detalles as AsistenciaDetalle[],
    columnas: columnas as AsistenciaColumna[],
    datos: datos as AsistenciaDato[],
  }
}


export async function getCensoData(tipo: "datos_personales" | "datos_iglesia") {

  const tableName = tipo === "datos_personales" ? "censo_datos_personales" : "censo_datos_iglesia"

  const { data, error } = await supabase.from(tableName).select("*").order("created_at", { ascending: false })

  if (error) throw error
  return data as CensoDatosPersonales[] | CensoDatosIglesia[]
}

export async function getCensoConfiguraciones() {

  const { data, error } = await supabase.from("censo_configuraciones").select("*").single()

  if (error) {
    return {
      tipos_sangre: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      estados_civiles: ["Soltero", "Casado", "Divorciado", "Viudo", "Unión Libre"],
      capacidades_especiales: ["Ninguna", "Visual", "Auditiva", "Motriz", "Intelectual", "Psicosocial"],
      niveles_estudio: ["Primaria", "Secundaria", "Técnico", "Tecnológico", "Universitario", "Postgrado"],
      jornadas_trabajo: ["Mañana", "Tarde", "Noche", "Mixta"],
      cargos: ["Pastor", "Líder", "Diácono", "Maestro", "Músico", "Ujier", "Miembro"],
      locales: ["Sede Principal", "Sede Norte", "Sede Sur", "Sede Este", "Sede Oeste"],
      tipos_pago: ["DIEZMO", "PROMESA DONACION", "OFRENDA", "OTRO"],
      bancos: ["Banco Popular", "Bancolombia", "Banco de Bogotá", "BBVA", "Davivienda"],
    } as CensoConfiguraciones
  }

  return data as CensoConfiguraciones
}
