/**
 * Mapa de tablas a módulos de permisos.
 * Define qué módulo se necesita para acceder a cada tabla.
 * 
 * Reglas:
 * - Si una tabla requiere un módulo específico, solo usuarios con can_view en ese módulo pueden leerla
 * - Si una tabla requiere "any" → cualquier usuario autenticado puede acceder
 * - Si una tabla no está listada → acceso bloqueado
 * - Para escritura (INSERT/UPDATE/DELETE) se requiere can_edit en el módulo
 */

export interface TableAccess {
  /** Módulo(s) que dan acceso. "any" = cualquier usuario autenticado */
  modules: string[] | "any"
  /** Si true, requiere can_edit para escritura. Default: true */
  requireEditForWrite?: boolean
  /** Si true, requiere can_admin para DELETE. Default: false */
  requireAdminForDelete?: boolean
  /** Campos que NUNCA se deben retornar al cliente */
  blockedFields?: string[]
}

export const TABLE_ACCESS_MAP: Record<string, TableAccess> = {
  // === SISTEMA (cualquier usuario autenticado) ===
  users: {
    modules: "any",
    requireEditForWrite: true,
    requireAdminForDelete: true,
    blockedFields: ["password_hash"],
  },
  buzon_mensajes: {
    modules: "any",
    requireEditForWrite: false, // Cualquiera puede insertar/marcar leído
  },
  user_permissions: {
    modules: ["administracion"],
    requireAdminForDelete: true,
  },
  user_group_leaders: {
    modules: ["administracion"],
    requireAdminForDelete: true,
  },
  system_modules: {
    modules: ["administracion"],
  },
  module_groups: {
    modules: ["administracion"],
  },
  configuraciones_globales: {
    modules: ["administracion"],
  },
  configuraciones_mes: {
    modules: "any",
    requireEditForWrite: true,
  },
  acceso_restringido: {
    modules: "any",
    requireEditForWrite: true,
    requireAdminForDelete: true,
  },
  meses: {
    modules: "any",
    requireEditForWrite: true,
  },

  // === FINANCIERO (muy sensible) ===
  nomina: {
    modules: ["flujo_pago"],
    requireAdminForDelete: true,
  },
  payment_tables: {
    modules: ["flujo_pago"],
    requireAdminForDelete: true,
  },
  payment_rows: {
    modules: ["flujo_pago"],
    requireAdminForDelete: true,
  },
  ingresos: {
    modules: ["ingresos_egresos"],
    requireAdminForDelete: true,
  },
  egresos: {
    modules: ["ingresos_egresos"],
    requireAdminForDelete: true,
  },
  diezmos: {
    modules: ["diezmos"],
    requireAdminForDelete: true,
  },
  alfoli: {
    modules: ["administracion", "control_mensual"],
  },
  ofrendas_celulas: {
    modules: ["ofrenda-celulas"],
  },

  // === CRONOGRAMA Y ASISTENCIA ===
  cronograma_servicio: {
    modules: [
      "cronograma-protocolo", "cronograma-administracion", "cronograma-discipulado",
      "cronograma-alabanza", "cronograma-comunicacion", "cronograma-herederos",
      "cronograma-intercesion", "cronograma-mdg", "cronograma-redil",
      "cronograma-hombres", "cronograma-jovenes", "cronograma-pastoral",
      "gestion-cronogramas",
    ],
  },
  gestion_atrasados: {
    modules: [
      "cronograma-protocolo", "cronograma-administracion", "cronograma-discipulado",
      "cronograma-alabanza", "cronograma-comunicacion", "cronograma-herederos",
      "cronograma-intercesion", "cronograma-mdg", "cronograma-redil",
      "cronograma-hombres", "cronograma-jovenes", "cronograma-pastoral",
      "gestion-cronogramas",
    ],
  },

  // === ASISTENCIA GENERAL ===
  asistencia_columnas: {
    modules: ["asistencia", "control_mensual"],
  },
  asistencia_detalles: {
    modules: ["asistencia", "control_mensual"],
  },
  asistencia_datos: {
    modules: ["asistencia", "control_mensual"],
  },

  // === DATOS PERSONALES ===
  censo: {
    modules: ["censo", "bautizo", "matrimonio", "celulas", "cumpleanos-comunicacion"],
  },
  censo_mdg: {
    modules: ["censo-mdg", "cumpleanos-comunicacion"],
  },
  censo_catalogos: {
    modules: ["censo", "censo-mdg"],
  },
  censo_configuraciones: {
    modules: ["censo", "censo-mdg"],
  },
  bautizos: {
    modules: ["bautizo"],
  },
  matrimonios: {
    modules: ["matrimonio"],
  },

  // === INVENTARIO ===
  inventory_items: {
    modules: ["inventario"],
  },

  // === DISCIPULADO ===
  discipulado_ciclos: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado"],
  },
  discipulado_ciclo_fechas: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado"],
  },
  discipulado_asistencia: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado"],
  },
  discipulado_fechas: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado"],
  },
  discipulado_participantes: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado"],
  },

  // === MENSAJES Y CITACIONES ===
  mensajes_citaciones: {
    modules: [
      "mensajes-administracion", "mensajes-protocolo", "mensajes-discipulado",
      "mensajes-alabanza", "mensajes-comunicacion", "mensajes-herederos",
      "mensajes-intercesion", "mensajes-mdg", "mensajes-redil",
      "mensajes-hombres", "mensajes-jovenes", "mensajes-pastoral",
    ],
  },
  mensajes_citaciones_recibidos: {
    modules: [
      "mensajes-administracion", "mensajes-protocolo", "mensajes-discipulado",
      "mensajes-alabanza", "mensajes-comunicacion", "mensajes-herederos",
      "mensajes-intercesion", "mensajes-mdg", "mensajes-redil",
      "mensajes-hombres", "mensajes-jovenes", "mensajes-pastoral",
    ],
  },

  // === REQUERIMIENTOS ===
  requerimientos_bienes_servicios: {
    modules: [
      "requerimientos-admin", "requerimientos-protocolo", "requerimientos-discipulado",
      "requerimientos-mdg", "requerimientos-alabanza", "requerimientos-intercesion",
      "requerimientos-herederos", "requerimientos-redil", "requerimientos-comunicacion",
      "requerimientos-jovenes", "requerimientos-hombres", "requerimientos-pastoral",
    ],
  },

  // === CUMPLEAÑOS ===
  cumpleanos_enviados: {
    modules: ["cumpleanos-comunicacion"],
    requireEditForWrite: false,
  },

  // === MATRIMONIOS PDF ===
  matrimonios_pdf_generados: {
    modules: ["matrimonio"],
    requireEditForWrite: false,
  },

  // === AUDITORÍA (solo lectura + insert, nunca delete/update) ===
  audit_logs: {
    modules: "any",
    requireEditForWrite: false,
    requireAdminForDelete: true, // Efectivamente imposible
  },

  // === PUSH (solo desde API routes con service_key) ===
  push_subscriptions: {
    modules: [], // Nadie accede por esta vía, solo service_key routes
  },
  security_keys: {
    modules: [], // Solo server actions
  },
  user_sessions: {
    modules: [], // Solo server
  },
}

/**
 * Verifica si un usuario tiene acceso a una tabla según sus módulos permitidos.
 */
export function checkTableAccess(
  table: string,
  userModules: string[],
  operation: "select" | "insert" | "update" | "delete",
  userCanEdit: boolean,
  userCanAdmin: boolean
): { allowed: boolean; reason?: string } {
  const access = TABLE_ACCESS_MAP[table]

  if (!access) {
    return { allowed: false, reason: `Tabla "${table}" no está registrada en el sistema` }
  }

  // Tablas con modules = [] son inaccesibles por esta ruta
  if (Array.isArray(access.modules) && access.modules.length === 0) {
    return { allowed: false, reason: `Tabla "${table}" no es accesible desde el cliente` }
  }

  // "any" = cualquier usuario autenticado puede acceder
  if (access.modules === "any") {
    // Para escritura, verificar si se requiere can_edit
    if (operation !== "select" && access.requireEditForWrite !== false && !userCanEdit) {
      return { allowed: false, reason: "Requiere permiso de edición" }
    }
    if (operation === "delete" && access.requireAdminForDelete && !userCanAdmin) {
      return { allowed: false, reason: "Requiere permiso de administrador para eliminar" }
    }
    return { allowed: true }
  }

  // Verificar que el usuario tenga acceso a al menos uno de los módulos requeridos
  const hasModuleAccess = access.modules.some((m) => userModules.includes(m))
  if (!hasModuleAccess) {
    return { allowed: false, reason: `No tiene acceso a ningún módulo que permita acceder a "${table}"` }
  }

  // Para escritura, verificar can_edit
  if (operation !== "select" && access.requireEditForWrite !== false && !userCanEdit) {
    return { allowed: false, reason: "Requiere permiso de edición" }
  }

  // Para delete, verificar can_admin si es requerido
  if (operation === "delete" && access.requireAdminForDelete && !userCanAdmin) {
    return { allowed: false, reason: "Requiere permiso de administrador para eliminar" }
  }

  return { allowed: true }
}
