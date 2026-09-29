/**
 * Detector de duplicados financieros (SOLO LECTURA, no borra nada).
 *
 * Revisa las tablas `ingresos` y `egresos` y reporta:
 *   1. Filas duplicadas exactas (mismo mes + fecha + monto + detalle + concepto).
 *   2. Reconciliacion de filas auto-* contra su tabla de origen:
 *        - auto-evento     vs  evento_participantes (abono > 0)
 *        - auto-diezmo     vs  diezmos (transaccion = transferencia)
 *        - auto-pago-diario vs pago_diario
 *      Un desajuste indica que el sincronizador creo de mas (o de menos).
 *
 * Uso:
 *   # Usa las credenciales del .env del proyecto:
 *   node scripts/detectar-duplicados-financieros.mjs
 *
 *   # O apunta a otra instancia con variables de entorno:
 *   SB_URL=https://... SB_KEY=service_key node scripts/detectar-duplicados-financieros.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

// --- credenciales: primero variables de entorno, luego .env ---
function fromEnvFile() {
  try {
    const env = {}
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
    }
    return env
  } catch { return {} }
}
const env = fromEnvFile()
const url = process.env.SB_URL || env.SUPABASE_URL
const key = process.env.SB_KEY || env.SUPABASE_SERVICE_KEY
if (!url || !key) { console.error("Faltan credenciales (SB_URL/SB_KEY o SUPABASE_URL/SUPABASE_SERVICE_KEY)"); process.exit(1) }

const supabase = createClient(url, key, { auth: { persistSession: false } })
const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase())

async function all(table, sel) {
  let out = [], from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(sel).order("id", { ascending: true }).range(from, from + 999)
    if (error) { console.error(`Error leyendo ${table}:`, error.message); process.exit(1) }
    out = out.concat(data); if (data.length < 1000) break; from += 1000
  }
  return out
}

function reportarDuplicados(nombre, filas) {
  const g = new Map()
  for (const r of filas) {
    // La observacion SE INCLUYE en la clave: dos pagos con mismo detalle/monto/fecha
    // pero distinta observacion (ej. "1ra quincena" vs "2da quincena") son PAGOS
    // DISTINTOS, no duplicados.
    const k = [norm(r.mes_id), norm(r.fecha), norm(r.monto), norm(r.detalle), norm(r.concepto), norm(r.observacion)].join(" | ")
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(r)
  }
  const dups = [...g.values()].filter((v) => v.length > 1).sort((a, b) => b.length - a.length)
  console.log(`\n=== ${nombre.toUpperCase()}: ${filas.length} filas, ${dups.length} grupos duplicados (clave incluye observacion) ===`)
  let extra = 0
  for (const v of dups) {
    const r = v[0]
    extra += v.length - 1
    console.log(`  x${v.length}  $${r.monto}  "${r.detalle}"  concepto=${r.concepto}  obs="${String(r.observacion||"").slice(0,50)}"  ids=[${v.map((x) => x.id).join(", ")}]`)
  }
  if (dups.length === 0) console.log("  Sin duplicados exactos.")
  else console.log(`  -> ${extra} fila(s) sobrantes.`)
  return dups
}

const ingresos = await all("ingresos", "id, concepto, monto, detalle, mes_id, fecha, observacion")
const egresos = await all("egresos", "id, concepto, monto, detalle, mes_id, fecha, observacion")

reportarDuplicados("ingresos", ingresos)
reportarDuplicados("egresos", egresos)

// --- Reconciliacion contra origen ---
console.log("\n=== RECONCILIACION AUTO-* vs ORIGEN ===")
const parts = await all("evento_participantes", "id, abono")
const partsAbono = parts.filter((p) => Number(p.abono) > 0).length
const autoEvento = ingresos.filter((r) => r.concepto === "auto-evento").length
console.log(`  auto-evento: ${autoEvento} ingresos  |  participantes abono>0: ${partsAbono}  ${autoEvento === partsAbono ? "OK" : ">>> REVISAR (incluye encuentro/otros origenes)"}`)

const diez = await all("diezmos", "id, transaccion")
const transf = diez.filter((d) => d.transaccion === "transferencia").length
const autoDiezmo = ingresos.filter((r) => r.concepto === "auto-diezmo").length
console.log(`  auto-diezmo: ${autoDiezmo} ingresos  |  diezmos transferencia: ${transf}  ${autoDiezmo === transf ? "OK" : ">>> DESAJUSTE"}`)

const pagos = await all("pago_diario", "id")
const autoPago = egresos.filter((r) => r.concepto === "auto-pago-diario").length
console.log(`  auto-pago-diario: ${autoPago} egresos  |  pago_diario registros: ${pagos.length}  ${autoPago === pagos.length ? "OK" : ">>> DESAJUSTE"}`)

console.log("\nListo. (Este script NO modifica datos.)")
