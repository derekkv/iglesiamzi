/**
 * Construcción del ingreso vinculado a un registro de diezmos.
 *
 * Vive aparte porque lo usan dos rutas que DEBEN coincidir exactamente:
 * `/api/finanzas/diezmos` (lo crea, actualiza y borra) y
 * `/api/finanzas/discrepancias` (detecta los que faltan y los repara). Si las
 * dos calcularan el detalle de forma distinta, el detector vería como
 * "faltante" un ingreso que ya existe y crearía un duplicado.
 *
 * ── Identidad del ingreso vinculado ──────────────────────────────────────────
 * La clave es el trío (concepto, detalle, mes_id). El `concepto` siempre es
 * `auto-diezmo`; el detalle depende del tipo:
 *
 * - Tipos históricos (diezmo, primicia, ofrenda especial): `"{Tipo} - {donador}"`.
 *   Se conserva tal cual para no romper el vínculo de los ingresos ya creados.
 *   Tiene una limitación conocida: dos registros del mismo tipo y el mismo
 *   donador en el mismo mes comparten detalle y por tanto comparten ingreso.
 * - Tipos de actividades (nuevos): `"{Tipo} - {donador} (#id)"`. Al incluir el
 *   id del registro, cada uno tiene su propio ingreso. Es importante en estos
 *   tipos porque el pagador se repite con facilidad (varias entradas a un mismo
 *   evento, varios seminarios de la misma persona en el mes).
 */

import { TIPOS_HISTORICOS, tipoOfrenda, valorTipoOfrenda } from "@/lib/mod/diezmos-tipos"
import type { MovimientoFinancieroInput } from "@/lib/server/finanzas-sync"

/** Campos del registro de diezmos que intervienen en el ingreso vinculado. */
export interface DiezmoParaIngreso {
  id?: number
  mes_id: string
  numero: number
  fecha: string
  donador: string
  valor: number
  tipo_ofrenda: unknown
}

/**
 * Detalle que identifica al ingreso vinculado.
 *
 * `sobrescribirDonador` permite calcular el detalle ANTERIOR de un registro
 * cuando el donador o el tipo acaban de cambiar, para poder localizar el
 * ingreso que ya existía y actualizarlo en lugar de crear otro.
 */
export function detalleIngresoDiezmo(
  d: DiezmoParaIngreso,
  sobrescribir?: { donador?: string; tipo_ofrenda?: unknown },
): string {
  const tipo = tipoOfrenda(sobrescribir?.tipo_ofrenda ?? d.tipo_ofrenda)
  const donador = sobrescribir?.donador ?? d.donador

  if (TIPOS_HISTORICOS.includes(tipo.valor)) {
    return `${tipo.label} - ${donador}`
  }
  return `${tipo.label} - ${donador} (#${d.id ?? "s/n"})`
}

/** Payload del ingreso vinculado, idéntico para el alta y para la reparación. */
export function ingresoInputDesdeDiezmo(d: DiezmoParaIngreso): MovimientoFinancieroInput {
  const tipo = tipoOfrenda(d.tipo_ofrenda)

  return {
    mes_id: d.mes_id,
    concepto: "auto-diezmo",
    monto: d.valor,
    fecha: d.fecha,
    ministerio: "Administración",
    categoria_principal: tipo.categoriaIngreso,
    detalle: detalleIngresoDiezmo(d),
    observacion: `Registrado automáticamente desde módulo Diezmos (#${d.numero}) — ${tipo.label}`,
    estado: "Procesado",
    metodo_pago: "Transferencia",
  }
}

/** Descripción del registro para la auditoría y los mensajes al usuario. */
export function descripcionDiezmo(d: DiezmoParaIngreso & { transaccion?: string }): string {
  const tipo = tipoOfrenda(d.tipo_ofrenda)
  const transaccion = d.transaccion ? ` [${d.transaccion}]` : ""
  return `${tipo.label} #${d.numero} - ${d.donador} ($${d.valor})${transaccion}`
}

export { valorTipoOfrenda }
