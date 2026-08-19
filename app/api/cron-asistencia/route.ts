import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { todayEcuador, currentYearEcuador, currentMonthEcuador, MONTH_NAMES } from "@/lib/timezone"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const CRON_SECRET = process.env.CRON_SECRET

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno del servidor")
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Mismos detalles por defecto que usa el módulo de asistencia (lib/mod/attendance-service.ts)
const DEFAULT_DETAILS = [
  "HOMBRES ASIST. GRAL",
  "MUJERES ASIST. GRAL.",
  "NIÑOS EN AUDITORIO",
  "HER. BABYS 0-3",
  "HER. EXPLORADORES 3-5",
  "HER. KIDS 6-11",
  "HOMBRES NUEVOS ACEPT. CRISTO",
  "MUJERES NUEVOS ACEPT. CRISTO",
  "JOVENES NUEVOS ACEPT. CRISTO (13-18 AÑOS)",
]

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

/**
 * Garantiza que exista el mes activo del calendario actual (hora de Ecuador),
 * replicando la lógica de contexts/month-context.tsx → autoManageMonth, que
 * normalmente solo corre en el cliente al abrir la app. Esto asegura que el
 * cron ponga la columna del domingo en el mes correcto aunque nadie haya
 * abierto la app durante el mes nuevo.
 *
 * Devuelve el `mes_id` del mes activo actual.
 */
async function ensureActiveMonth(): Promise<string> {
  const nowYear = currentYearEcuador()
  const nowMonth = currentMonthEcuador()
  const monthId = `${nowYear}-${nowMonth}`
  const monthName = `${MONTH_NAMES[nowMonth - 1]} ${nowYear}`

  // 1. Cerrar meses activos que no correspondan al mes/año actual
  const { data: activos } = await supabase
    .from("meses")
    .select("id, year, month")
    .eq("status", "active")

  if (activos && activos.length > 0) {
    const staleIds = activos
      .filter((m: any) => !(m.year === nowYear && m.month === nowMonth))
      .map((m: any) => m.id)
    if (staleIds.length > 0) {
      await supabase
        .from("meses")
        .update({ status: "closed", end_date: new Date().toISOString() })
        .in("id", staleIds)
    }
  }

  // 2. ¿Ya existe el mes actual (activo o no)?
  const { data: existing } = await supabase
    .from("meses")
    .select("id")
    .eq("id", monthId)
    .maybeSingle()

  if (!existing) {
    // 3. Crear el mes activo de forma idempotente
    await supabase.from("meses").upsert(
      {
        id: monthId,
        name: monthName,
        year: nowYear,
        month: nowMonth,
        start_date: todayEcuador(),
        status: "active",
        end_date: null,
      },
      { onConflict: "id", ignoreDuplicates: true }
    )

    // Inicializar configuraciones del nuevo mes (mismos defaults que el cliente)
    await supabase.from("configuraciones_mes").upsert(
      {
        mes_id: monthId,
        ministerios: ["Pastoral", "Música", "Jóvenes", "Niños", "Evangelismo"],
        categorias_principales: ["Ofrenda", "Diezmo", "Donación", "Gastos Operativos", "Mantenimiento"],
        detalles: ["Servicio Dominical", "Servicio Miércoles", "Evento Especial", "Gastos Generales"],
      },
      { onConflict: "mes_id" }
    )
  } else {
    // Asegurar que el mes actual quede marcado como activo
    await supabase.from("meses").update({ status: "active", end_date: null }).eq("id", monthId)
  }

  return monthId
}

/**
 * Obtiene el siguiente valor de `orden` para una tabla dentro de un mes.
 */
async function getNextOrder(table: string, mesId: string): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("orden")
    .eq("mes_id", mesId)
    .order("orden", { ascending: false })
    .limit(1)
  return data && data.length > 0 ? (data[0].orden ?? 0) + 1 : 0
}

/**
 * Inserta los detalles por defecto si el mes aún no tiene ninguno.
 */
async function ensureDefaultDetails(mesId: string): Promise<void> {
  const { data: existing } = await supabase
    .from("asistencia_detalles")
    .select("id")
    .eq("mes_id", mesId)
    .limit(1)

  if (existing && existing.length > 0) return

  const rows = DEFAULT_DETAILS.map((nombre, index) => ({ mes_id: mesId, nombre, orden: index }))
  const { error } = await supabase.from("asistencia_detalles").insert(rows)
  if (error) console.error("[cron-asistencia] Error creando detalles por defecto:", error.message)
}

/**
 * GET: Auto-registra la fecha del domingo (columna) en el mes activo del módulo
 * de asistencia general, SIN depender de que un usuario entre al módulo.
 *
 * Pensado para ejecutarse desde el crontab del VPS cada domingo. Es idempotente:
 * si la columna del día ya existe (creada por otro cron o por el cliente), no
 * inserta duplicados. Usa la hora de Ecuador para evitar corrimientos de zona.
 */
export async function GET(request: NextRequest) {
  // Verificar clave de seguridad
  const authHeader = request.headers.get("authorization")
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const todayStr = todayEcuador() // YYYY-MM-DD en hora de Ecuador
    const today = new Date(todayStr + "T12:00:00")
    const dayOfWeek = today.getDay() // 0 = domingo

    // Permitir forzar la creación en cualquier día con ?force=1 (útil para pruebas).
    const force = request.nextUrl.searchParams.get("force") === "1"
    if (dayOfWeek !== 0 && !force) {
      return NextResponse.json({
        message: "Hoy no es domingo; no se crea columna.",
        fecha: todayStr,
        created: false,
      })
    }

    // 1. Asegurar el mes activo correcto (hora de Ecuador) y obtener su id
    const mesId = await ensureActiveMonth()

    // 2. Asegurar detalles por defecto para el mes
    await ensureDefaultDetails(mesId)

    // 3. ¿Ya existe una columna con la fecha de hoy en este mes?
    const { data: existingCols, error: colError } = await supabase
      .from("asistencia_columnas")
      .select("id")
      .eq("mes_id", mesId)
      .eq("fecha", todayStr)
      .limit(1)

    if (colError) {
      console.error("[cron-asistencia] Error consultando columnas:", colError.message)
      return NextResponse.json({ error: colError.message }, { status: 500 })
    }

    if (existingCols && existingCols.length > 0) {
      return NextResponse.json({
        message: "La columna de hoy ya existía.",
        fecha: todayStr,
        mes_id: mesId,
        created: false,
      })
    }

    // 4. Crear la columna del domingo
    const day = String(today.getDate()).padStart(2, "0")
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const displayName = `${DAY_NAMES[dayOfWeek]} ${day}/${month}`
    const orden = await getNextOrder("asistencia_columnas", mesId)

    const { data: inserted, error: insertError } = await supabase
      .from("asistencia_columnas")
      .insert({ mes_id: mesId, nombre: displayName, orden, fecha: todayStr })
      .select()
      .single()

    if (insertError) {
      console.error("[cron-asistencia] Error creando columna:", insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: "Columna del domingo creada.",
      fecha: todayStr,
      mes_id: mesId,
      columna: displayName,
      id: inserted?.id,
      created: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[cron-asistencia] Error:", error?.message)
    return NextResponse.json({ error: error?.message || "Error interno" }, { status: 500 })
  }
}
