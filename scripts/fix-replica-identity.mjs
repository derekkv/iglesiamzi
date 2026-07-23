/**
 * Fix REPLICA IDENTITY for censo_jovenes and censo_ninos tables
 * and create censo_ninos_archivos table for file uploads.
 * 
 * Run with: node scripts/fix-replica-identity.mjs
 */

const SUPABASE_URL = "https://servidor.iglesiaregalodedios.com"
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI5NTk1MzUsImV4cCI6MTk0MDYzOTUzNX0.i-rIZbX8gTVgttUZpTmchPQ7Nz2lUXD46Pay1MW5JbA"

async function executeSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    // Try alternate approach - direct postgres query via management API
    const text = await res.text()
    console.log(`  RPC not available (${res.status}): ${text}`)
    return null
  }
  return await res.json()
}

// Alternative: use supabase-js with service role to call raw SQL
async function executeSqlViaQuery(sql) {
  // Use the SQL endpoint if available
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.log(`  pg/query not available (${res.status}): ${text.substring(0, 200)}`)
    return null
  }
  return await res.json()
}

const SQLS = [
  // Fix REPLICA IDENTITY
  `ALTER TABLE censo_jovenes REPLICA IDENTITY FULL;`,
  `ALTER TABLE censo_ninos REPLICA IDENTITY FULL;`,
  // Create archivos table
  `CREATE TABLE IF NOT EXISTS censo_ninos_archivos (
    id SERIAL PRIMARY KEY,
    censo_nino_id INTEGER NOT NULL REFERENCES censo_ninos(id) ON DELETE CASCADE,
    nombre_archivo TEXT NOT NULL,
    url TEXT NOT NULL,
    tipo TEXT,
    tamano INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  // Enable RLS
  `ALTER TABLE censo_ninos_archivos ENABLE ROW LEVEL SECURITY;`,
  // Allow all authenticated users
  `CREATE POLICY IF NOT EXISTS "censo_ninos_archivos_all" ON censo_ninos_archivos FOR ALL USING (true) WITH CHECK (true);`,
  // Replica identity for the new table too
  `ALTER TABLE censo_ninos_archivos REPLICA IDENTITY FULL;`,
]

async function main() {
  console.log("=== Fixing REPLICA IDENTITY and creating archivos table ===\n")

  for (const sql of SQLS) {
    console.log(`Executing: ${sql.substring(0, 80)}...`)
    let result = await executeSql(sql)
    if (result === null) {
      result = await executeSqlViaQuery(sql)
    }
    if (result === null) {
      console.log("  -> Could not execute via API. Please run manually in Supabase SQL Editor.\n")
    } else {
      console.log("  -> OK\n")
    }
  }

  console.log("\n=== If the above failed, run these SQL statements manually in Supabase SQL Editor: ===\n")
  console.log(SQLS.join("\n\n"))
}

main().catch(console.error)
