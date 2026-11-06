#!/usr/bin/env node
/**
 * Migración puntual: corrige URLs de archivos guardadas con el dominio
 * localhost/loopback (http://127.0.0.1:8000) en la tabla redil_adjuntos
 * y en la columna JSON archivos de entregas_redil.
 *
 * USO:
 *   node scripts/fix-storage-urls.mjs              # dry-run (solo muestra)
 *   node scripts/fix-storage-urls.mjs --fix        # aplica los cambios
 *   node scripts/fix-storage-urls.mjs --url https://servidor.iglesiaregalodedios.com --fix
 *
 * Nota: si SUPABASE_URL es http://127.0.0.1:8000 (loopback del servidor),
 * ejecutar este script directamente en el servidor O pasar --url con la URL
 * pública: node scripts/fix-storage-urls.mjs --url https://servidor.iglesiaregalodedios.com
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

// ── Cargar .env sin dependencias externas ─────────────────────────────────
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

// Prioridad URL: --url flag > SUPABASE_SCRIPT_URL > NEXT_PUBLIC_SUPABASE_URL > SUPABASE_URL
const urlFlagIdx = process.argv.indexOf("--url")
const SUPABASE_URL =
  (urlFlagIdx !== -1 ? process.argv[urlFlagIdx + 1] : null) ||
  process.env.SUPABASE_SCRIPT_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  env.SUPABASE_URL ||
  process.env.SUPABASE_URL

const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY

// URL pública real (la que queremos usar en los reemplazos)
const PUBLIC_URL =
  (urlFlagIdx !== -1 ? process.argv[urlFlagIdx + 1] : null) ||
  process.env.SUPABASE_SCRIPT_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("✗ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY en .env")
  process.exit(1)
}

if (!PUBLIC_URL) {
  console.error("✗ No se pudo determinar la URL pública. Pasa --url https://tu-dominio.com")
  process.exit(1)
}

const FIX = process.argv.includes("--fix")
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// Patrón de URLs de loopback a corregir
const LOOPBACK_PATTERNS = [
  /^http:\/\/127\.\d+\.\d+\.\d+:\d+/,
  /^http:\/\/localhost:\d+/,
]

function isLoopbackUrl(url) {
  return typeof url === "string" && LOOPBACK_PATTERNS.some((p) => p.test(url))
}

function fixUrl(url) {
  if (!url) return url
  for (const pattern of LOOPBACK_PATTERNS) {
    if (pattern.test(url)) return url.replace(pattern, PUBLIC_URL)
  }
  return url
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tabla redil_adjuntos — columna url (text)
// ─────────────────────────────────────────────────────────────────────────────
async function fixRedilAdjuntos() {
  console.log("\n📋 Tabla: redil_adjuntos")

  const { data, error } = await db
    .from("redil_adjuntos")
    .select("id, url")
    .or(LOOPBACK_PATTERNS.map((p) => `url.like.${p.source.replace(/\^/, "").replace(/\\\./g, ".").split("\\d")[0]}%`).join(","))

  // Fallback: traemos todos y filtramos en JS si el .or() no funciona bien
  const { data: allData, error: allError } = await db
    .from("redil_adjuntos")
    .select("id, url")

  if (allError) {
    console.error("  ✗ Error leyendo redil_adjuntos:", allError.message)
    return 0
  }

  const affected = (allData || []).filter((r) => isLoopbackUrl(r.url))

  if (affected.length === 0) {
    console.log("  ✓ Ningún registro con URL de loopback encontrado.")
    return 0
  }

  console.log(`  ⚠  ${affected.length} registro(s) con URL de loopback:`)
  for (const r of affected) {
    const fixed = fixUrl(r.url)
    console.log(`     id=${r.id}`)
    console.log(`       antes : ${r.url}`)
    console.log(`       después: ${fixed}`)
  }

  if (!FIX) {
    console.log("  → Modo dry-run. Usa --fix para aplicar los cambios.")
    return affected.length
  }

  let updated = 0
  for (const r of affected) {
    const { error: upErr } = await db
      .from("redil_adjuntos")
      .update({ url: fixUrl(r.url) })
      .eq("id", r.id)
    if (upErr) {
      console.error(`  ✗ Error actualizando id=${r.id}: ${upErr.message}`)
    } else {
      updated++
    }
  }
  console.log(`  ✓ ${updated}/${affected.length} registro(s) actualizados.`)
  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Tabla entregas_redil — columna foto1 (TEXT con JSON.stringify de ArchivoSubido[])
// ─────────────────────────────────────────────────────────────────────────────
async function fixEntregasRedilFoto1() {
  console.log("\n📋 Tabla: entregas_redil (columna foto1)")

  const { data: allData, error: allError } = await db
    .from("entregas_redil")
    .select("id, foto1")

  if (allError) {
    console.error("  ✗ Error leyendo entregas_redil:", allError.message)
    return 0
  }

  // foto1 es un JSON.stringify(ArchivoSubido[]) — lo parseamos y buscamos URLs de loopback
  const affected = []
  for (const r of allData || []) {
    if (!r.foto1) continue
    try {
      const archivos = JSON.parse(r.foto1)
      if (!Array.isArray(archivos)) continue
      if (archivos.some((a) => isLoopbackUrl(a?.url))) {
        affected.push(r)
      }
    } catch { /* JSON inválido, ignorar */ }
  }

  if (affected.length === 0) {
    console.log("  ✓ Ningún registro con URL de loopback encontrado.")
    return 0
  }

  console.log(`  ⚠  ${affected.length} registro(s) con URLs de loopback en foto1:`)
  for (const r of affected) {
    const archivos = JSON.parse(r.foto1)
    console.log(`     id=${r.id}`)
    for (const a of archivos) {
      if (isLoopbackUrl(a?.url)) {
        console.log(`       antes : ${a.url}`)
        console.log(`       después: ${fixUrl(a.url)}`)
      }
    }
  }

  if (!FIX) {
    console.log("  → Modo dry-run. Usa --fix para aplicar los cambios.")
    return affected.length
  }

  let updated = 0
  for (const r of affected) {
    const archivos = JSON.parse(r.foto1)
    const fixedArchivos = archivos.map((a) =>
      a && isLoopbackUrl(a.url) ? { ...a, url: fixUrl(a.url) } : a
    )
    const { error: upErr } = await db
      .from("entregas_redil")
      .update({ foto1: JSON.stringify(fixedArchivos) })
      .eq("id", r.id)
    if (upErr) {
      console.error(`  ✗ Error actualizando id=${r.id}: ${upErr.message}`)
    } else {
      updated++
    }
  }
  console.log(`  ✓ ${updated}/${affected.length} registro(s) actualizados.`)
  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Tabla entregas_redil — columna archivos (jsonb array de {url, ...}) — legacy check
// ─────────────────────────────────────────────────────────────────────────────
async function fixEntregasRedilArchivos() {
  console.log("\n📋 Tabla: entregas_redil (columna archivos — si existe)")

  const { data: allData, error: allError } = await db
    .from("entregas_redil")
    .select("id, archivos")

  if (allError) {
    // La columna no existe — es normal, la omitimos silenciosamente
    if (allError.message.includes("does not exist")) {
      console.log("  ℹ  Columna archivos no existe en entregas_redil — omitida.")
    } else {
      console.error("  ✗ Error leyendo entregas_redil.archivos:", allError.message)
    }
    return 0
  }

  const affected = (allData || []).filter((r) => {
    if (!Array.isArray(r.archivos)) return false
    return r.archivos.some((a) => isLoopbackUrl(a?.url))
  })

  if (affected.length === 0) {
    console.log("  ✓ Ningún registro con URL de loopback encontrado.")
    return 0
  }

  console.log(`  ⚠  ${affected.length} registro(s) con URLs de loopback en archivos:`)
  for (const r of affected) {
    console.log(`     id=${r.id}`)
    for (const a of r.archivos) {
      if (isLoopbackUrl(a?.url)) {
        console.log(`       antes : ${a.url}`)
        console.log(`       después: ${fixUrl(a.url)}`)
      }
    }
  }

  if (!FIX) {
    console.log("  → Modo dry-run. Usa --fix para aplicar los cambios.")
    return affected.length
  }

  let updated = 0
  for (const r of affected) {
    const fixedArchivos = r.archivos.map((a) =>
      a && isLoopbackUrl(a.url) ? { ...a, url: fixUrl(a.url) } : a
    )
    const { error: upErr } = await db
      .from("entregas_redil")
      .update({ archivos: fixedArchivos })
      .eq("id", r.id)
    if (upErr) {
      console.error(`  ✗ Error actualizando id=${r.id}: ${upErr.message}`)
    } else {
      updated++
    }
  }
  console.log(`  ✓ ${updated}/${affected.length} registro(s) actualizados.`)
  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
console.log("=".repeat(60))
console.log("  fix-storage-urls — Corrección de URLs de loopback")
console.log("=".repeat(60))
console.log(`  Supabase : ${SUPABASE_URL}`)
console.log(`  URL pública destino: ${PUBLIC_URL}`)
console.log(`  Modo     : ${FIX ? "✏  FIX (aplica cambios)" : "👁  DRY-RUN (solo lectura)"}`)

const total1 = await fixRedilAdjuntos()
const total2 = await fixEntregasRedilFoto1()
const total3 = await fixEntregasRedilArchivos()

console.log("\n" + "=".repeat(60))
if (FIX) {
  console.log(`  ✓ Migración completada. ${total1 + total2 + total3} registros actualizados en total.`)
} else {
  const total = total1 + total2 + total3
  if (total === 0) {
    console.log("  ✓ No se encontraron URLs de loopback. La base de datos está limpia.")
  } else {
    console.log(`  ⚠  ${total} registro(s) necesitan corrección. Ejecuta con --fix para aplicarla.`)
    console.log("  Ejemplo:")
    console.log("    node scripts/fix-storage-urls.mjs --fix")
    console.log("    node scripts/fix-storage-urls.mjs --url https://servidor.iglesiaregalodedios.com --fix")
  }
}
console.log("=".repeat(60))
