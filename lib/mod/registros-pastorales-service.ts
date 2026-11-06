import { supabase } from "@/lib/secure-db"

/**
 * Servicio de conteos de Registros Pastorales (bautizos y matrimonios).
 *
 * IMPORTANTE: los bautizos y matrimonios NO viven en una sola tabla. Cada uno
 * se arma combinando TRES fuentes, igual que los módulos /dashboard/bautizo y
 * /dashboard/matrimonio:
 *   1. censo         (bautizo_irdd / matrimonio_irdd = true)  → fuente "protocolo"
 *   2. censo_mdg     (bautizo_irdd / matrimonio_irdd = true)  → fuente "mdg"
 *   3. bautizos_manual / matrimonios_manual                   → fuente "manual"
 *
 * Deduplicación (idéntica a los módulos):
 *   - Los registros "manual" SIEMPRE se cuentan (no se deduplican).
 *   - Entre censo protocolo/mdg se deduplica por cédula.
 *   - En matrimonios, además se marca la cédula del cónyuge como vista para no
 *     contar dos veces a una misma pareja presente en el censo.
 *
 * Las fechas (fecha_bautizo / fecha_matrimonio) son strings "YYYY-MM-DD", por lo
 * que la comparación por rango de cadenas es correcta.
 */

export interface ConteoRegistro {
  total: number
  esteAnio: number
  esteMes: number
}

const enRango = (f: any, ini: string, fin: string): boolean =>
  typeof f === "string" && f >= ini && f <= fin

interface RangoFechas {
  primerDiaAnio: string
  ultimoDiaAnio: string
  primerDiaMes: string
  ultimoDiaMes: string
}

/** Bautizos: censo + censo_mdg + bautizos_manual, con dedup por cédula. */
export async function getConteoBautizos(rango: RangoFechas): Promise<ConteoRegistro> {
  const [proRes, mdgRes, manRes] = await Promise.all([
    supabase.from("censo").select("cedula, fecha_bautizo").eq("bautizo_irdd", true),
    supabase.from("censo_mdg").select("cedula, fecha_bautizo").eq("bautizo_irdd", true),
    supabase.from("bautizos_manual").select("cedula, fecha_bautizo"),
  ])

  const all = [
    ...(proRes.data || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
    ...(mdgRes.data || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
    ...(manRes.data || []).map((r: any) => ({ ...r, fuente: "manual" as const })),
  ]

  const seen = new Set<string>()
  const filtrados = all.filter((r) => {
    if (r.fuente === "manual") return true
    if (seen.has(r.cedula)) return false
    seen.add(r.cedula)
    return true
  })

  return {
    total: filtrados.length,
    esteAnio: filtrados.filter((r) => enRango(r.fecha_bautizo, rango.primerDiaAnio, rango.ultimoDiaAnio)).length,
    esteMes: filtrados.filter((r) => enRango(r.fecha_bautizo, rango.primerDiaMes, rango.ultimoDiaMes)).length,
  }
}

/** Matrimonios: censo + censo_mdg + matrimonios_manual, con dedup por cédula y cónyuge. */
export async function getConteoMatrimonios(rango: RangoFechas): Promise<ConteoRegistro> {
  const [proRes, mdgRes, manRes] = await Promise.all([
    supabase.from("censo").select("cedula, cedula_conyugue, fecha_matrimonio").eq("matrimonio_irdd", true),
    supabase.from("censo_mdg").select("cedula, cedula_conyugue, fecha_matrimonio").eq("matrimonio_irdd", true),
    supabase.from("matrimonios_manual").select("cedula, cedula_conyugue, fecha_matrimonio"),
  ])

  const all = [
    ...(proRes.data || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
    ...(mdgRes.data || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
    ...(manRes.data || []).map((r: any) => ({ ...r, fuente: "manual" as const })),
  ]

  const seen = new Set<string>()
  const filtrados = all.filter((r) => {
    if (r.fuente === "manual") return true
    if (seen.has(r.cedula)) return false
    if (r.cedula_conyugue) seen.add(r.cedula_conyugue)
    seen.add(r.cedula)
    return true
  })

  return {
    total: filtrados.length,
    esteAnio: filtrados.filter((r) => enRango(r.fecha_matrimonio, rango.primerDiaAnio, rango.ultimoDiaAnio)).length,
    esteMes: filtrados.filter((r) => enRango(r.fecha_matrimonio, rango.primerDiaMes, rango.ultimoDiaMes)).length,
  }
}
