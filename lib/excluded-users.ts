/**
 * IDs de usuarios excluidos de las búsquedas en módulos de
 * cronograma de servicio y control de asistencia de servidores.
 *
 * Estos usuarios solo aparecen en el módulo de administración.
 * El último (SYSTEM) no aparece en ningún módulo.
 */

// Usuarios que solo aparecen en administración (no en cronograma ni asistencia)
export const EXCLUDED_FROM_SERVICIO: string[] = [
  "4eb62d12-4701-4cfc-8c3c-8dd56f9315ad",
  "83cb032c-38ef-4b47-85f1-84d4ae7d531e",
  "ddb5abfd-726e-4070-be8e-787bc3e7e365",
]

// Usuario que no aparece en NINGÚN módulo (ni administración)
export const EXCLUDED_FROM_ALL: string[] = [
  "8a799e01-11bb-4ea4-8a95-9f7033e90fb1",
]

/** Todos los IDs excluidos de cronograma y asistencia de servidores */
export const EXCLUDED_USER_IDS: string[] = [
  ...EXCLUDED_FROM_SERVICIO,
  ...EXCLUDED_FROM_ALL,
]
