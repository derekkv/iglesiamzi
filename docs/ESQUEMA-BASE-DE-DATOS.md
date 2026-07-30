# Esquema de la Base de Datos

Referencia de las tablas que utiliza el sistema, agrupadas por dominio. La
fuente de verdad para el **control de acceso** de cada tabla es
[`lib/module-table-map.ts`](../lib/module-table-map.ts) (`TABLE_ACCESS_MAP`):
define qué módulo(s) permiten leer/escribir cada tabla.

> ⚠️ Este documento describe el **inventario y el propósito** de las tablas.
> Para **crear** el esquema base usa `sql/schema.sql` (esquema consolidado que
> reconstruye las tablas fundamentales y de dominio) y luego las migraciones
> incrementales. Ver [`REPLICACION.md`](REPLICACION.md) §7 para el orden.

## Cómo funciona el control de acceso

Cada entrada de `TABLE_ACCESS_MAP` declara:

- `modules`: lista de módulos que dan acceso, `"any"` (cualquier usuario
  autenticado) o `[]` (inaccesible desde el cliente; solo rutas de servidor con
  la *service key*).
- `requireEditForWrite` (por defecto `true`): la escritura exige `can_edit`.
- `requireAdminForDelete` (por defecto `false`): el borrado exige `can_admin`.
- `blockedFields`: campos que nunca se devuelven al cliente (p. ej.
  `password_hash`).

Toda tabla **no listada** queda bloqueada por defecto en `/api/db`.

---

## Sistema, usuarios y permisos

| Tabla | Propósito | Acceso |
| --- | --- | --- |
| `users` | Usuarios del sistema. `password_hash` nunca sale al cliente. | any · admin para borrar |
| `user_sessions` | Sesiones activas. | solo servidor |
| `user_permissions` | Permisos por usuario y módulo (`can_view/edit/admin`). | any (lectura) · admin (escritura) |
| `user_group_leaders` | Líderes por grupo (para notificar atrasos). | any (lectura) |
| `system_modules` | Catálogo de módulos del sistema. | any |
| `module_groups` | Grupos y orden de módulos (incluye `image`). | any |
| `acceso_restringido` | Reglas de acceso restringido. | any |
| `security_keys` | Llaves de seguridad. | solo servidor |
| `configuraciones_globales` | Configuración global (ministerios, categorías, detalles…). | any |
| `configuraciones_mes` | Configuración por mes. | any |
| `meses` | Meses de trabajo (periodo activo). | any |
| `buzon_mensajes` | Buzón interno de mensajes. | any |
| `audit_logs` | Auditoría (solo insertar/leer, nunca borrar). | any |
| `service_notifications_log` | Registro de notificaciones de servicio. | any |
| `push_subscriptions` | Suscripciones Web Push. | solo servidor |

## Finanzas

| Tabla | Propósito | Módulos de acceso |
| --- | --- | --- |
| `ingresos` | Ingresos financieros. | ingresos_egresos, diezmos, caja_chica, control_mensual, eventos_encuentro, presupuesto_anual, resumen-pastoral |
| `egresos` | Egresos financieros. | ingresos_egresos, flujo_pago, pago_diario, caja_chica, control_mensual, presupuesto_anual, resumen-pastoral |
| `nomina` | Nómina de servidores. | flujo_pago, control_mensual, resumen-pastoral |
| `payment_tables` / `payment_rows` | Flujo de pagos (tablas y filas). | flujo_pago |
| `caja_chica_movimientos` | Movimientos de caja chica. | caja_chica |
| `caja_chica_arqueos` | Arqueos de caja chica. | caja_chica |
| `diezmos` | Diezmos y ofrendas. | diezmos, ingresos_egresos |
| `alfoli` | Alfolí. | administracion, control_mensual, presupuesto_anual, resumen-pastoral |
| `ofrendas_celulas` | Ofrendas de células. | ofrenda-celulas, celulas, control_mensual, presupuesto_anual, resumen-pastoral |
| `pago_diario` | Pagos diarios. | pago_diario, ingresos_egresos, control_mensual |

## Células

| Tabla | Propósito | Módulos |
| --- | --- | --- |
| `gestion_celulas` | Gestión de células. | celulas, ofrenda-celulas, control_mensual, resumen-pastoral |
| `miembros_celulas` | Miembros de cada célula. | celulas |

## Miembros / Censo

| Tabla | Propósito | Módulos |
| --- | --- | --- |
| `censo` | Censo general (protocolo). | censo, censo-jovenes*, bautizo, matrimonio, celulas, cumpleanos-comunicacion, listados, control_mensual, resumen-pastoral |
| `censo_mdg` | Censo MDG. | censo-mdg, censo-jovenes*, bautizo, matrimonio, celulas, listados… |
| `censo_jovenes` | Censo de jóvenes. | censo-jovenes, censo-mdg, censo-jovenes-mdg, censo-jovenes-protocolo… |
| `censo_ninos` | Censo de niños. | censo-ninos, herederos_* … |
| `censo_catalogos` | Catálogos del censo. | censo, censo-mdg, censo-jovenes* |
| `censo_configuraciones` | Configuración del censo. | censo, censo-mdg |
| `censo_archivos` / `censo_mdg_archivos` / `censo_jovenes_archivos` / `censo_ninos_archivos` | Adjuntos de censo (Storage). | módulos de censo correspondientes |

> Columnas de esquema (no renombrar): `bautizo_irdd`, `discipulado_irdd`,
> `matrimonio_irdd`, `primeros_pasos`, `seguimos_avanzando`, `fecha_bautizo`,
> `fecha_matrimonio`, etc.

## Eventos ministeriales de vida (bautizos, matrimonios, niños)

| Tabla | Propósito | Módulos |
| --- | --- | --- |
| `bautizos` / `bautizos_manual` | Bautizos (y registros manuales). | bautizo, control_mensual, resumen-pastoral |
| `bautizos_pdf_generados` | PDF de bautizo generados. | bautizo |
| `matrimonios` / `matrimonios_manual` | Matrimonios. | matrimonio, control_mensual, resumen-pastoral |
| `matrimonios_pdf_generados` | PDF de matrimonio generados. | matrimonio |
| `presentacion_ninos` | Presentación de niños. | presentacion-ninos, listados, control_mensual, resumen-pastoral |

## Asistencia

| Tabla | Propósito | Módulos |
| --- | --- | --- |
| `asistencia_columnas` / `asistencia_detalles` / `asistencia_datos` | Asistencia general. | asistencia, control_mensual, resumen-pastoral |
| `asistencia_servidores` | Asistencia de servidores por ministerio. | asistencia-servidores-* (por ministerio), control_mensual, resumen-pastoral |

## Cronogramas

| Tabla | Propósito | Módulos |
| --- | --- | --- |
| `cronograma_servicio` | Cronogramas de servicio y eventos por ministerio. | cronograma-* y cronograma-eventos-* (todos los ministerios), gestion-cronogramas |
| `gestion_atrasados` | Seguimiento de atrasados. | cronograma-* (por ministerio), gestion-cronogramas, control_mensual, resumen-pastoral |

## Formación — Discipulado

| Tabla | Propósito |
| --- | --- |
| `discipulado_ciclos` | Ciclos de discipulado. |
| `discipulado_ciclo_participantes` | Participantes por ciclo. |
| `discipulado_ciclo_fechas` | Fechas del ciclo. |
| `discipulado_ciclo_asistencia` | Asistencia del ciclo. |
| `discipulado_participantes` / `discipulado_fechas` / `discipulado_asistencia` | Modelo previo (histórico). |

Módulos: `discipulado_primeros_pasos`, `discipulado_seguimos_avanzando`,
`discipulado_siendo_iglesia`, `historial_discipulado`, `listados`,
`control_mensual`, `resumen-pastoral`.

## Formación — Herederos del Reino

| Tabla | Propósito |
| --- | --- |
| `herederos_ciclos` | Ciclos de Herederos. |
| `herederos_ciclo_participantes` | Participantes por ciclo. |
| `herederos_ciclo_fechas` | Fechas del ciclo. |
| `herederos_ciclo_asistencia` | Asistencia del ciclo. |
| `consolidacion_herederos` | Consolidación. |
| `reporte_incidencias_herederos` | Reporte de incidencias. |

Módulos: `herederos_baby`, `herederos_kids`, `herederos_explores`,
`herederos_champions`, `historial_herederos`, `consolidacion_herederos`,
`reporte_incidencias_herederos`.

## Formación — Proyecto Mario

| Tabla | Propósito |
| --- | --- |
| `proyecto_mario_ciclos` | Ciclos de Proyecto Mario. |
| `proyecto_mario_ciclo_participantes` | Participantes por ciclo. |
| `proyecto_mario_ciclo_fechas` | Fechas del ciclo. |
| `proyecto_mario_ciclo_asistencia` | Asistencia del ciclo. |

Módulos: `proyecto_mario_belleza_integral_sabados`,
`proyecto_mario_belleza_integral_viernes`, `proyecto_mario_manualidades`,
`proyecto_mario_belleza_cejas`, `proyecto_mario_gastronomia`,
`historial_proyecto_mario`.

## Acción social — Redil

| Tabla | Propósito |
| --- | --- |
| `casos_redil` | Casos de ayuda social. |
| `solicitudes_redil` | Solicitudes. |
| `visitas_tecnicas` | Visitas técnicas. |
| `entregas_redil` | Entregas realizadas. |

Módulos: `redil_ayuda_social`, `control_mensual`, `resumen-pastoral`.

## Eventos / Encuentro

| Tabla | Propósito |
| --- | --- |
| `encuentro_participantes` | Participantes de encuentros. |
| `eventos_tabs` | Estructura (pestañas) de eventos. |
| `evento_participantes` | Participantes por evento. |

Módulos: `eventos_encuentro`, `control_mensual`, `resumen-pastoral`.

## Mensajes, citaciones y requerimientos

| Tabla | Propósito |
| --- | --- |
| `mensajes_citaciones` | Mensajes/citaciones enviados por ministerio. |
| `mensajes_citaciones_recibidos` | Mensajes/citaciones recibidos. |
| `requerimientos_bienes_servicios` | Requerimientos de bienes y servicios. |

Módulos: `mensajes-*` y `requerimientos-*` (uno por ministerio).

## Inventario

| Tabla | Propósito | Módulos |
| --- | --- | --- |
| `inventory_items` | Ítems de inventario. | inventario |
| `inventory_movements` | Movimientos de inventario. | inventario |

## Cumpleaños

| Tabla | Propósito | Módulos |
| --- | --- | --- |
| `cumpleanos_enviados` | Registro de felicitaciones enviadas. | cumpleanos-comunicacion, control_mensual, resumen-pastoral |

## Comunicaciones — WhatsApp (Meta Cloud API)

| Tabla | Propósito | Acceso |
| --- | --- | --- |
| `wa_config` | Credenciales de Meta (access_token, app_secret…). | **solo servidor** (`[]`) |
| `wa_contacts` | Contactos de WhatsApp. | comunicaciones |
| `wa_messages` | Historial de mensajes. | comunicaciones |
| `wa_templates` | Plantillas aprobadas. | comunicaciones |
| `wa_campaigns` / `wa_campaign_recipients` | Campañas y destinatarios. | comunicaciones |
| `wa_tags` | Etiquetas de contactos. | comunicaciones |
| `wa_quick_replies` | Respuestas rápidas (texto semilla editable). | comunicaciones |
| `wa_webhook_events` | Eventos recibidos del webhook. | comunicaciones |
| `whatsapp_messages` | Legado (deprecado). | administracion, comunicaciones |

## Comunicaciones — Correo

| Tabla | Propósito | Acceso |
| --- | --- | --- |
| `email_config` | Config SMTP/IMAP (incluye contraseñas). | **solo servidor** (`[]`) |
| `email_messages` | Bandeja de correo sincronizada. | comunicaciones |
| `email_attachments` | Adjuntos de correo (Storage). | comunicaciones |
| `email_templates` | Plantillas de correo (editables desde el panel). | comunicaciones |

## Tablas de servidor / auxiliares (inaccesibles desde el cliente)

`account_types`, `cash_registers`, `ingredients`, `product_ingredients`,
`products`, `sale_items`, `sales` (módulo POS/ventas), además de las vistas
auxiliares `users_2` y `users_safe`. Todas con `modules: []`.

---

## Notas de integridad y seguridad

- Muchas tablas se relacionan con `meses` (periodo de trabajo) mediante
  `mes_id`, y con el censo mediante `cedula` / referencias de persona.
- Las tablas con credenciales (`wa_config`, `email_config`) y las de sistema
  sensibles (`push_subscriptions`, `security_keys`, `user_sessions`) **solo** se
  acceden desde rutas de servidor con la *service key*, nunca desde el navegador.
- Al añadir un módulo o tabla nuevos, actualiza `TABLE_ACCESS_MAP` y las
  políticas RLS correspondientes; de lo contrario la tabla quedará bloqueada.
