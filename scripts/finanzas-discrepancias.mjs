#!/usr/bin/env node
/**
 * Script LOCAL de detección (y opcional reparación) de descuadres financieros.
 *
 * Compara los registros base de cada módulo con su movimiento derivado en
 * `ingresos`/`egresos` y reporta los que faltan. Usa SUPABASE_SERVICE_KEY del
 * .env (service_role → ignora permisos y RLS). NO necesita el servidor web.
 *
 * USO:
 *   node scripts/finanzas-discrepancias.mjs                 # detectar (solo lectura)
 *   node scripts/finanzas-discrepancias.mjs --mes <mes_id>  # acotar a un mes
 *   node scripts/finanzas-discrepancias.mjs --json          # salida JSON cruda
 *   node scripts/finanzas-discrepancias.mjs --fix           # REPARAR (crea movimientos faltantes)
 *   node scripts/finanzas-discrepancias.mjs --fix --mes <mes_id>
 *   node scripts/finanzas-discrepancias.mjs --url https://servidor.iglesiaregalodedios.com
 *
 * Nota: si SUPABASE_URL es http://127.0.0.1:8000 (loopback del servidor) y se
 * ejecuta desde otra máquina, usar --url con la URL pública del Supabase, o
 * ejecutar el script en el propio servidor.
 *
 * Tipos detectados:
 *   diezmo-sin-ingreso, caja-chica-sin-ingreso, pago-diario-sin-egreso,
 *   evento-sin-ingreso, pasivo-abono-sin-egreso (este último NO se auto-repara).
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

// ── Cargar .env sin dependencias externas ──────────────────────────────────
function loadEnv() {
  const env = {}
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(join(ROOT, file), "utf8")
      for (const line of raw.split("\n")) {
        const t = line.trim()
        if (!t || t.startsWith("#")) continue
        const eq = t.indexOf("=")
        if (eq === -1) continue
        const k = t.slice(0, eq).trim()
        let v = t.slice(eq + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (!(k in env)) env[k] = v
      }
    } catch { /* archivo no existe, seguir */ }
  }
  return env
}

const env = loadEnv()
// Permite sobrescribir la URL: útil cuando SUPABASE_URL apunta a 127.0.0.1:8000
// (loopback del servidor de producción) y se ejecuta el script desde otra máquina.
// Prioridad: --url <x>  >  SUPABASE_SCRIPT_URL env  >  SUPABASE_URL  >  NEXT_PUBLIC_SUPABASE_URL
const urlFlagIdx = process.argv.indexOf("--url")
const URL =
  (urlFlagIdx !== -1 ? process.argv[urlFlagIdx + 1] : null) ||
  process.env.SUPABASE_SCRIPT_URL ||
  env.SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!URL || !KEY) {
  console.error("✗ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY en .env")
  process.exit(1)
}

const db = createClient(URL, KEY)

// ── Flags ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const FIX = args.includes("--fix")
const JSON_OUT = args.includes("--json")
const mesIdx = args.indexOf("--mes")
const MES_ID = mesIdx !== -1 ? args[mesIdx + 1] : null

const TIPO_LABEL = { diezmo: "Diezmo", primicia: "Primicia", diezmo_especial: "Ofrenda Especial" }
const money = (n) => "$" + Number(n || 0).toLocaleString("es-EC", { minimumFractionDigits: 2 })

// ── Detección ─────────────────────────────────────────────────────────────
async function detectar() {
  const out = []

  // 1. Diezmos (transferencia) sin ingreso auto-diezmo
  {
    let q = db.from("diezmos").select("*").eq("transaccion", "transferencia")
    if (MES_ID) q = q.eq("mes_id", MES_ID)
    const { data: diezmos, error } = await q
    if (error) throw new Error("diezmos: " + error.message)

    let qi = db.from("ingresos").select("detalle, mes_id").eq("concepto", "auto-diezmo")
    if (MES_ID) qi = qi.eq("mes_id", MES_ID)
    const { data: ingresos } = await qi
    const normD = (s) => String(s ?? "").trim().toLowerCase()
    const existentes = new Set((ingresos || []).map((i) => `${i.mes_id}|${normD(i.detalle)}`))

    for (const d of diezmos || []) {
      const detalle = `${TIPO_LABEL[d.tipo_ofrenda] || "Diezmo"} - ${d.donador}`
      if (!existentes.has(`${d.mes_id}|${normD(detalle)}`)) {
        out.push({
          tipo: "diezmo-sin-ingreso", tabla_base: "diezmos", id_base: d.id, mes_id: d.mes_id,
          descripcion: `Diezmo #${d.numero} (${d.donador}) transferencia sin ingreso vinculado`,
          monto: Number(d.valor),
          _fix: { tabla: "ingresos", input: {
            mes_id: d.mes_id, concepto: "auto-diezmo", monto: d.valor, fecha: d.fecha,
            ministerio: "Administración", categoria_principal: "Ingresos x Ofrendas, Diezmo y Primicias",
            detalle, observacion: `Registrado automáticamente desde módulo Diezmos (#${d.numero})`,
            estado: "Procesado", metodo_pago: "Transferencia",
          }},
        })
      }
    }
  }

  // 2. Caja chica (gestión de efectivo) sin ingreso auto-caja-chica
  {
    let q = db.from("caja_chica_movimientos").select("*").eq("concepto", "Gestion de Efectivo")
    if (MES_ID) q = q.eq("mes_id", MES_ID)
    const { data: gestiones, error } = await q
    if (error) throw new Error("caja_chica: " + error.message)

    let qi = db.from("ingresos").select("detalle, mes_id").eq("concepto", "auto-caja-chica")
    if (MES_ID) qi = qi.eq("mes_id", MES_ID)
    const { data: ingresos } = await qi
    const normC = (s) => String(s ?? "").trim().toLowerCase()
    const existentes = new Set((ingresos || []).map((i) => `${i.mes_id}|${normC(i.detalle)}`))

    for (const g of gestiones || []) {
      const detalle = `Gestion de Efectivo - ${g.responsable}`
      if (!existentes.has(`${g.mes_id}|${normC(detalle)}`)) {
        out.push({
          tipo: "caja-chica-sin-ingreso", tabla_base: "caja_chica_movimientos", id_base: g.id, mes_id: g.mes_id,
          descripcion: `Gestión de efectivo (${g.responsable}) sin ingreso vinculado`,
          monto: Number(g.monto),
          _fix: { tabla: "ingresos", input: {
            mes_id: g.mes_id, concepto: "auto-caja-chica", monto: g.monto, fecha: g.fecha,
            ministerio: "Administracion", categoria_principal: "Caja Chica",
            detalle, observacion: `${g.detalle} (${g.metodo_pago})`,
            estado: "Procesado", metodo_pago: "Transferencia",
          }},
        })
      }
    }
  }

  // 3. Pago diario sin egreso auto-pago-diario
  // Comparación case-insensitive y tolerante: un pago está "cubierto" si existe
  // un egreso auto-pago-diario en el mismo mes cuyo detalle corresponde a
  // "pago diario - <nombre>" (ignorando mayúsculas) y mismo monto. Esto evita
  // falsos positivos por diferencias de capitalización (p.ej. "PAGO DIARIO -").
  {
    let q = db.from("pago_diario").select("*")
    if (MES_ID) q = q.eq("mes_id", MES_ID)
    const { data: pagos, error } = await q
    if (error) throw new Error("pago_diario: " + error.message)

    let qe = db.from("egresos").select("detalle, monto, observacion, mes_id").eq("concepto", "auto-pago-diario")
    if (MES_ID) qe = qe.eq("mes_id", MES_ID)
    const { data: egresos } = await qe
    // Clave laxa: mes | detalle(lower) | monto   (sin la observacion, que suele variar)
    const norm = (s) => String(s ?? "").trim().toLowerCase()
    const existentes = new Set((egresos || []).map((e) => `${e.mes_id}|${norm(e.detalle)}|${Number(e.monto)}`))

    for (const p of pagos || []) {
      const detalle = `Pago diario - ${p.nombre}`
      const key = `${p.mes_id}|${norm(detalle)}|${Number(p.valor)}`
      if (!existentes.has(key)) {
        out.push({
          tipo: "pago-diario-sin-egreso", tabla_base: "pago_diario", id_base: p.id, mes_id: p.mes_id,
          descripcion: `Pago diario (${p.nombre}) ${money(p.valor)} sin egreso vinculado`,
          monto: Number(p.valor),
          _fix: { tabla: "egresos", input: {
            mes_id: p.mes_id, concepto: "auto-pago-diario", monto: p.valor, fecha: p.fecha,
            ministerio: p.ministerio, categoria_principal: p.categoria,
            detalle, observacion: p.detalle, estado: "Procesado", metodo_pago: p.metodo_pago,
          }},
        })
      }
    }
  }

  // 4. Eventos (abono>0) sin ingreso auto-evento
  {
    const { data: participantes, error } = await db.from("evento_participantes").select("*").gt("abono", 0)
    if (error) throw new Error("evento_participantes: " + error.message)

    const { data: tabs } = await db.from("eventos_tabs").select("id, nombre")
    const eventoNombre = new Map((tabs || []).map((t) => [t.id, t.nombre]))

    const { data: mesesActivos } = await db
      .from("meses").select("id").eq("status", "active").order("start_date", { ascending: false }).limit(1)
    const mesActivoId = mesesActivos && mesesActivos.length > 0 ? mesesActivos[0].id : null

    const { data: ingresos } = await db.from("ingresos").select("detalle").eq("concepto", "auto-evento")
    const normE = (s) => String(s ?? "").trim().toLowerCase()
    const detallesExistentes = new Set((ingresos || []).map((i) => normE(i.detalle)))

    for (const p of participantes || []) {
      const evNombre = eventoNombre.get(p.evento_id) || `Evento #${p.evento_id}`
      const detalle = `Abono evento - ${p.nombre} (${evNombre})`
      if (!detallesExistentes.has(normE(detalle))) {
        out.push({
          tipo: "evento-sin-ingreso", tabla_base: "evento_participantes", id_base: p.id, mes_id: mesActivoId,
          descripcion: `Abono de ${p.nombre} en "${evNombre}" sin ingreso vinculado`,
          monto: Number(p.abono),
          _fix: mesActivoId ? { tabla: "ingresos", input: {
            mes_id: mesActivoId, concepto: "auto-evento", monto: p.abono,
            fecha: new Date().toISOString().split("T")[0], ministerio: "Administración",
            categoria_principal: "Ingresos x Eventos", detalle,
            observacion: `Abono de ${p.nombre} para ${evNombre} (valor total: $${Number(p.valor).toFixed(2)})`,
            estado: "Procesado", metodo_pago: p.metodo_pago || "Efectivo",
          }} : null,
        })
      }
    }
  }

  // 5. Pasivos: abonos sin egreso vinculado (solo reporte, no auto-fix)
  {
    const { data: abonos, error } = await db.from("pasivos_abonos").select("*")
    if (error) throw new Error("pasivos_abonos: " + error.message)

    const egresoIds = (abonos || []).map((a) => a.egreso_id).filter((x) => x != null)
    const egresosValidos = new Set()
    if (egresoIds.length > 0) {
      const { data: egs } = await db.from("egresos").select("id").in("id", egresoIds)
      for (const e of egs || []) egresosValidos.add(e.id)
    }
    const pasivoIds = [...new Set((abonos || []).map((a) => a.pasivo_id))]
    const pasivoMap = new Map()
    if (pasivoIds.length > 0) {
      const { data: pasivos } = await db.from("pasivos").select("*").in("id", pasivoIds)
      for (const p of pasivos || []) pasivoMap.set(p.id, p)
    }
    for (const a of abonos || []) {
      if (a.egreso_id == null || !egresosValidos.has(a.egreso_id)) {
        const pasivo = pasivoMap.get(a.pasivo_id)
        out.push({
          tipo: "pasivo-abono-sin-egreso", tabla_base: "pasivos_abonos", id_base: a.id, mes_id: null,
          descripcion: `Abono de pasivo${pasivo ? ` (${pasivo.acreedor})` : ""} ${money(a.monto)} sin egreso vinculado`,
          monto: Number(a.monto),
          _fix: null, // requiere re-vincular egreso_id → revisión manual
        })
      }
    }
  }

  return out
}

// ── Main ──────────────────────────────────────────────────────────────────
;(async () => {
  const discrepancias = await detectar()

  if (JSON_OUT) {
    console.log(JSON.stringify(discrepancias.map(({ _fix, ...r }) => ({ ...r, reparable: !!_fix })), null, 2))
    if (!FIX) return
  }

  // Resumen
  const porTipo = {}
  let montoTotal = 0
  for (const d of discrepancias) {
    porTipo[d.tipo] = porTipo[d.tipo] || { n: 0, monto: 0 }
    porTipo[d.tipo].n++
    porTipo[d.tipo].monto += d.monto
    montoTotal += d.monto
  }

  if (!JSON_OUT) {
    console.log("\n═══════════════════════════════════════════════════════════")
    console.log("  DESCUADRES FINANCIEROS DETECTADOS" + (MES_ID ? ` (mes ${MES_ID})` : " (todos los meses)"))
    console.log("═══════════════════════════════════════════════════════════\n")

    if (discrepancias.length === 0) {
      console.log("  ✓ No se encontraron descuadres. Todo cuadra.\n")
      return
    }

    for (const [tipo, info] of Object.entries(porTipo)) {
      console.log(`  • ${tipo.padEnd(26)} ${String(info.n).padStart(4)} registros   ${money(info.monto)}`)
    }
    console.log("  " + "─".repeat(57))
    console.log(`  • ${"TOTAL".padEnd(26)} ${String(discrepancias.length).padStart(4)} registros   ${money(montoTotal)}\n`)

    // Detalle (máx 60 para no saturar)
    console.log("  Detalle:")
    for (const d of discrepancias.slice(0, 60)) {
      const flag = d._fix ? " " : " [manual]"
      console.log(`   - ${d.descripcion} → ${money(d.monto)}${flag}`)
    }
    if (discrepancias.length > 60) console.log(`   ... y ${discrepancias.length - 60} más`)
    console.log("")
  }

  const reparables = discrepancias.filter((d) => d._fix)

  if (!FIX) {
    console.log(`  ${reparables.length} reparables automáticamente, ${discrepancias.length - reparables.length} requieren revisión manual.`)
    console.log("  Para repararlos ejecuta el mismo comando añadiendo  --fix\n")
    return
  }

  // Reparar
  console.log(`  Reparando ${reparables.length} movimientos faltantes...\n`)
  let ok = 0
  const errores = []
  for (const d of reparables) {
    const { tabla, input } = d._fix
    // Idempotencia case-insensitive: no duplicar si ya existe un movimiento
    // equivalente (mismo concepto, mes y monto, y detalle igual ignorando
    // mayúsculas). Esto evita crear duplicados como el falso positivo visto.
    const { data: candidatos } = await db.from(tabla).select("id, detalle, monto")
      .eq("concepto", input.concepto).eq("mes_id", input.mes_id).eq("monto", input.monto)
    const yaExiste = (candidatos || []).some(
      (c) => String(c.detalle ?? "").trim().toLowerCase() === String(input.detalle).trim().toLowerCase()
    )
    if (yaExiste) continue
    const { error } = await db.from(tabla).insert(input)
    if (error) errores.push(`${d.tipo} base#${d.id_base}: ${error.message}`)
    else ok++
  }

  console.log(`  ✓ ${ok} movimientos creados.`)
  if (errores.length) {
    console.log(`  ✗ ${errores.length} errores:`)
    for (const e of errores) console.log("     " + e)
  }
  console.log("")
})().catch((e) => { console.error("✗ Error:", e.message); process.exit(1) })
