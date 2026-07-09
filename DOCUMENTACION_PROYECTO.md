# Documentacion Completa del Proyecto - Iglesia Regalo de Dios

## 1. Informacion General

**Nombre:** Panel Administrativo Iglesia Regalo de Dios
**URL Produccion:** https://panel.iglesiaregalodedios.com
**Supabase URL:** https://servidor.iglesiaregalodedios.com
**Repositorio:** Se despliega via GitHub Actions a un VPS

### Stack Tecnologico
- **Frontend:** Next.js 15.4.6 con React 19, TypeScript, Tailwind CSS 4
- **UI Components:** Radix UI (Dialog, Select, Checkbox, Tabs, AlertDialog, Label, Slot, Toast) + shadcn/ui
- **Backend:** Next.js API Routes (App Router) + Middleware JWT
- **Base de datos:** Supabase (PostgreSQL auto-hospedado)
- **Autenticacion:** Custom JWT (jose) + bcryptjs (NO usa Supabase Auth)
- **Realtime:** Supabase Realtime (postgres_changes)
- **WhatsApp:** Servidor Express separado con @whiskeysockets/baileys
- **Email:** Nodemailer via SMTP Hostinger (notificaciones@iglesiaregalodedios.com)
- **Push Notifications:** web-push (VAPID)
- **PWA:** next-pwa con service worker personalizado
- **Charts:** Recharts
- **PDF:** pdf-lib (certificados)
- **Fonts:** Geist Sans + Geist Mono
- **Toast:** Sonner
- **Deploy:** GitHub Actions -> SSH -> VPS con PM2 (puerto 3712)


---

## 2. Arquitectura de Seguridad (Secure DB Layer)

### Capa de Base de Datos Segura (`lib/secure-db.ts`)
El sistema implementa un **proxy seguro de base de datos** que reemplaza las llamadas directas a Supabase desde el frontend:

```
Frontend (db.from("tabla").select())
    -> POST /api/db (con JWT en header Authorization)
        -> Verificar JWT valido
        -> Obtener permisos del usuario (user_permissions)
        -> Verificar acceso a la tabla via module-table-map.ts
        -> Ejecutar query con service_key (bypasa RLS)
        -> Strippear campos bloqueados (password_hash)
        -> Retornar resultado
```

**Uso:** Drop-in replacement para supabase. Importar `db` de `@/lib/secure-db` en vez de `supabase` de `@/lib/supabase`.

### Module Table Map (`lib/module-table-map.ts`)
Define que modulo(s) se necesitan para acceder a cada tabla:
- `"any"` = cualquier usuario autenticado
- `string[]` = necesita can_view en al menos uno de los modulos listados
- `[]` (vacio) = inaccesible desde el cliente (solo server-side)

Reglas adicionales por tabla:
- `requireEditForWrite` — Si se necesita can_edit para INSERT/UPDATE
- `requireAdminForDelete` — Si se necesita can_admin para DELETE
- `blockedFields` — Campos que nunca se retornan al cliente

### API Auth (`lib/api-auth.ts`)
Verificacion de autenticacion en API routes. Soporta:
1. **JWT del usuario** — via header `Authorization: Bearer <jwt>`
2. **Secreto interno** — via header `X-Internal-Secret: <secret>` (server-to-server)
3. **Token en body** — retrocompatibilidad con frontend legacy

### Auth Fetch (`lib/auth-fetch.ts`)
- `authFetch(url, options)` — Wrapper que automaticamente adjunta JWT desde localStorage
- `getInternalHeaders()` — Headers para llamadas server-to-server con INTERNAL_API_SECRET


---

## 3. Sistema de Autenticacion

### Flujo de Login
1. El usuario envia credenciales a `POST /api/login`
2. Se busca en tabla `users` por username, email o phone
3. Se verifica password con bcrypt
4. Se genera un JWT (HS256, 24h de expiracion) con `jose`
5. El token se almacena en `localStorage` del cliente Y como cookie `authToken`
6. Al cargar la app, `AuthContext` valida el token via `POST /api/verify-session`

### Middleware de Rutas (`middleware.ts`)
Next.js middleware que protege todas las rutas bajo `/dashboard`:
- Verifica la cookie `authToken` con `jwtVerify` de jose
- Si no hay cookie o es invalida, redirige a `/login?from=<ruta>`
- Limpia la cookie si el token es invalido/expirado

### Rate Limiting (Login)
- Maximo 5 intentos por IP en 15 minutos
- Se limpia automaticamente la memoria cada 5 minutos

### Estructura del Token JWT
```typescript
{
  userId: string
  username: string
  displayName: string
  accountType: "personal" | "ministerio"
  email?: string
  ministerioName?: string
  cedula?: string
}
```

### Tabla `users`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | UUID | PK |
| account_type | text | "personal" o "ministerio" |
| username | text | Unico |
| password_hash | text | bcrypt hash |
| displayName | text | Nombre visible |
| email | text | Opcional, para notificaciones |
| phone | text | Opcional, para WhatsApp |
| cedula | text | Cedula de identidad |
| ministerio_name | text | Solo para cuentas tipo ministerio |
| is_active | boolean | Si el usuario esta habilitado |
| created_by | UUID | Quien lo creo |
| created_at | timestamptz | Fecha creacion |

### Seguridad de Acceso a Datos
- La tabla `users` tiene RLS habilitado
- El campo `password_hash` NUNCA se retorna al cliente (blockedFields en module-table-map)
- El login y cambio de password usan `supabaseServer` (service_key) exclusivamente server-side
- El endpoint `/api/user-profile` permite GET/PUT del perfil sin exponer password
- El endpoint `/api/change-password` valida password actual antes de actualizar

### Clientes Supabase:
1. `supabase` (`lib/supabase.ts`) — Cliente con anon key (legacy, en desuso progresivo)
2. `db` (`lib/secure-db.ts`) — Proxy seguro via /api/db (recomendado para frontend)
3. `supabaseServer` (`lib/supabase-server.ts`) — Service role key, SOLO en API routes


---

## 4. Sistema de Roles y Permisos

### Arquitectura de Permisos
El sistema NO usa roles fijos. Usa un sistema de **permisos granulares por modulo**:

#### Tablas clave:
- `module_groups` — Grupos de modulos (ej: "protocolo", "administracion", "comunicacion", "jovenes")
- `system_modules` — Modulos individuales del sistema
- `user_permissions` — Relacion usuario<->modulo con permisos
- `user_group_leaders` — Lideres de grupo (rol especial)
- `acceso_restringido` — Control de acceso adicional para modulos sensibles (ej: nomina)

### Tabla `module_groups`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | UUID | PK |
| name | text | Identificador (protocolo, administracion, comunicacion, jovenes, hombres, pastoral, etc.) |
| display_name | text | Nombre visible |
| icon | text | Emoji del grupo |
| image | text | URL imagen (/NombreGrupo.jpeg) |
| sort_order | int | Orden de visualizacion |

### Tabla `system_modules`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | UUID | PK |
| name | text | Identificador unico (ej: "cronograma-protocolo") |
| display_name | text | Nombre visible |
| description | text | Descripcion del modulo |
| icon | text | Emoji |
| route | text | Ruta del dashboard (ej: "/dashboard/cronograma-protocolo") |
| requires_active_month | boolean | Si necesita un mes activo |
| is_active | boolean | Si el modulo esta habilitado |
| group_id | UUID FK | Grupo al que pertenece |
| sort_order | int | Orden |

### Tabla `user_permissions`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| user_id | UUID FK | Usuario |
| module_id | UUID FK | Modulo |
| can_view | boolean | Puede ver el modulo |
| can_edit | boolean | Puede editar contenido |
| can_admin | boolean | Permisos administrativos |
| granted_by | UUID | Quien otorgo el permiso |
| UNIQUE | (user_id, module_id) | |

### Tabla `user_group_leaders`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| user_id | UUID FK | Usuario |
| group_id | UUID FK | Grupo del que es lider |
| granted_by | UUID | Quien lo asigno |
| UNIQUE | (user_id, group_id) | |

### Tabla `acceso_restringido`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | int | PK |
| modulo | text | Nombre del modulo restringido (ej: "nomina") |
| user_id | UUID FK | Usuario con acceso |

### Niveles de acceso efectivo:
1. **can_view** — Puede ver el modulo en el dashboard y acceder a el
2. **can_edit** — Puede crear/editar/eliminar datos dentro del modulo
3. **can_admin** — Permisos especiales de administracion
4. **canLeader** — Si es lider del grupo, automaticamente tiene can_edit en todos los modulos del grupo
5. **acceso_restringido** — Capa adicional para sub-modulos sensibles (ej: nomina dentro de flujo-pago)

### PermissionsGuard (Frontend)
El componente `PermissionsGuard` en `lib/permissions-guard.tsx` protege cada pagina:
- Verifica que el usuario tenga `can_view` en el modulo
- Pasa `canEdit`, `canAdmin` y `canLeader` como props al componente hijo
- Si no tiene permiso, redirige al dashboard con un toast de error


---

## 5. Sistema de Doble Vista (Vista/Edicion)

Cada modulo del dashboard tiene dos modos de operacion:
- **Vista (can_view):** El usuario puede ver la informacion pero no modificarla
- **Edicion (can_edit):** El usuario puede crear, editar y eliminar registros

El patron se implementa asi:
```tsx
<PermissionsGuard moduleName="cronograma-protocolo">
  {(canEdit, canAdmin, canLeader) => (
    <MiComponente canEdit={canEdit} canAdmin={canAdmin} canLeader={canLeader} />
  )}
</PermissionsGuard>
```

Dentro del componente, los botones de crear/editar/eliminar se ocultan si `canEdit === false`.

---

## 6. Sistema de Meses (Control Mensual)

### Concepto
El sistema opera en periodos mensuales. Un "mes" es una unidad temporal que:
- Tiene fecha de inicio y fin
- Puede estar "active" o "closed"
- Los modulos que requieren mes activo no funcionan sin uno abierto

### Tabla `meses`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | text | PK (formato: "YYYY-M-timestamp") |
| name | text | "Enero 2025", etc. |
| year | int | Ano |
| month | int | Mes (1-12) |
| start_date | text | Fecha inicio |
| end_date | text | Fecha cierre (null si activo) |
| status | text | "active" o "closed" |

### Tablas asociadas al mes:
- `ingresos` — Ingresos financieros
- `egresos` — Egresos financieros
- `diezmos` — Registro de diezmos/primicias/ofrendas especiales
- `nomina` — Registros de nomina mensual
- `asistencia_detalles` / `asistencia_columnas` / `asistencia_datos` — Asistencia general
- `discipulado_participantes` / `discipulado_fechas` / `discipulado_asistencia` — Discipulado por mes
- `configuraciones_mes` — Ministerios, categorias y detalles del mes

### MonthContext (Frontend)
Provee el mes activo a toda la app y metodos para:
- Iniciar nuevo mes
- Cerrar mes actual
- Editar fechas
- Eliminar mes


---

## 7. Sistema de Notificaciones (Multicanal)

### Canales de notificacion:
1. **Buzon interno** — Tabla `buzon_mensajes` (con Realtime)
2. **Push notifications** — Web Push via VAPID keys
3. **Email** — SMTP via Hostinger (nodemailer)
4. **WhatsApp** — Servidor Baileys separado

### Buzon de Mensajes (`buzon_mensajes`)
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | bigserial | PK |
| user_id | UUID FK | Destinatario |
| titulo | varchar(200) | Titulo |
| mensaje | text | Contenido |
| tipo | varchar(50) | info, requerimiento, aprobado, negado, suspenso |
| leido | boolean | Si fue leido |
| referencia_tipo | varchar(50) | Tipo de recurso relacionado |
| referencia_id | bigint | ID del recurso |

### Push Notifications
- Tabla `push_subscriptions` almacena endpoints y keys por usuario
- Service Worker en `worker/index.js` maneja eventos push
- VAPID keys configurados en el cron
- `PushNotificationPrompt` componente global que pide permiso al usuario

### Hook `useNotificaciones`
- Carga mensajes del buzon del usuario actual
- Se suscribe a Realtime para nuevos mensajes
- Permite marcar como leido
- `enviarNotificacion()` — Envia al buzon + push
- `notificarAdmins()` — Notifica a todos los usuarios del grupo "administracion"

### Componentes globales de notificacion:
- `NotificacionModal` — Modal que aparece con nuevas notificaciones
- `BuzonNotificaciones` — Panel de notificaciones en el dashboard
- `ServiceAcknowledgeModal` — Modal de acuse de recibo para servicios asignados
- `ServiceAlertModal` — Modal de alertas de servicio

---

## 8. Sistema de Email

### Configuracion SMTP
- **Host:** smtp.hostinger.com (puerto 465, SSL)
- **From:** notificaciones@iglesiaregalodedios.com
- **Archivo:** `lib/mod/email-service.ts`

### Tipos de email:
1. **asignacion** — "Nuevo Servicio Asignado" (azul)
2. **alerta2** — "Tu servicio es en 5 dias" (naranja/amarillo)
3. **alerta1** — "Manana tienes servicio!" (rojo)

### Flujo:
- Se envia via `POST /api/send-email`
- El body incluye: `to`, `type`, `data` (userName, asignacion, fecha, horaEntrada, modulo, ministerio, evento)
- El email es HTML responsive con diseno profesional

---

## 9. Sistema de WhatsApp

### Arquitectura
El WhatsApp funciona como un **microservicio separado**:

```
whatsapp-server/           (Express, puerto 3100)
├── src/
│   ├── index.ts          — Endpoints REST
│   └── whatsapp-service.ts — Conexion con Baileys
├── auth_info/            — Credenciales guardadas (multi-file auth state)
```

### Conexion
- Usa `@whiskeysockets/baileys` (conexion directa, NO la API oficial de Meta)
- Requiere escanear QR desde el frontend la primera vez
- Las credenciales se guardan en `auth_info/` y reconecta automaticamente
- Maximo 5 reintentos de conexion antes de detenerse

### Endpoints del servidor WhatsApp:
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /api/whatsapp/status | Estado de conexion |
| GET | /api/whatsapp/qr | QR code base64 |
| POST | /api/whatsapp/connect | Iniciar conexion |
| POST | /api/whatsapp/disconnect | Desconectar |
| POST | /api/whatsapp/send | Enviar mensaje (phone + message) |
| POST | /api/whatsapp/send-bulk | Envio masivo (phones[] + message) |
| POST | /api/whatsapp/logout | Cerrar sesion (borra credenciales) |

### Proxy en Next.js
El frontend llama a `/api/whatsapp/send` -> Next.js API Route -> redirige al servidor Express en `WA_SERVER_URL`

### Formato de telefonos (Ecuador)
- `0980932062` -> `593980932062`
- `+593980932062` -> `593980932062`
- `593980932062` -> sin cambio
- Anti-ban: delay aleatorio de 1-3s entre mensajes masivos

### Tab de WhatsApp en Administracion
El panel de administracion tiene un tab dedicado (`WhatsAppTab.tsx`) para:
- Ver estado de conexion
- Escanear QR
- Enviar mensajes de prueba
- Enviar mensajes masivos a usuarios seleccionados

### Historial
Tabla `whatsapp_messages` registra cada mensaje enviado con status (sent/failed).


---

## 10. Sistema de Cronogramas de Servicio

### Tabla `cronograma_servicio`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | serial | PK |
| user_id | UUID FK | Servidor asignado |
| user_name | text | Nombre del servidor |
| asignacion | text | Rol/lugar asignado |
| fecha | date | Fecha del servicio |
| modulo | text | protocolo, administracion, discipulado, comunicacion, jovenes, hombres, pastoral, mdg, etc. |
| ministerio | text | Ministerio (opcional) |
| evento | text | Evento (opcional) |
| hora_entrada | text | Hora esperada |
| hora_llegada | text | Hora real de llegada |
| atraso | boolean | Si llego tarde |
| acuse_asignacion | boolean | Confirmo recepcion |
| acuse_alerta2 | boolean | Confirmo alerta 5 dias |
| acuse_alerta1 | boolean | Confirmo alerta 1 dia |
| alerta2_enviada | boolean | Flag de envio |
| alerta1_enviada | boolean | Flag de envio |
| email_*_enviado | boolean | Flags de email por tipo |
| whatsapp_*_enviado | boolean | Flags de WhatsApp por tipo |

### Flujo al crear asignacion:
1. Validar que el usuario NO este asignado el mismo dia en ningun modulo
2. Insertar en `cronograma_servicio`
3. Enviar notificacion multicanal:
   - Buzon interno
   - Push notification
   - Email (si tiene correo)
   - WhatsApp (si tiene telefono)
4. Marcar flags de envio

### Sistema de Alertas (Cron)
Endpoint: `GET /api/cron-reminders` (protegido con Bearer token)

Se ejecuta periodicamente y procesa:
- **Alerta 2:** Servicios en exactamente 5 dias (sin enviar aun)
- **Alerta 1:** Servicios manana (sin enviar aun)

Para cada servicio pendiente:
1. Envia al buzon interno
2. Envia push notification
3. Envia email
4. Envia WhatsApp
5. Marca flags en la base de datos

### Sistema de Acuse de Recibo
Los servidores deben confirmar que recibieron la notificacion:
- `markAcknowledgment(id, tipo)` — Marca acuse con timestamp
- `getPendingAcknowledgments(userId)` — Obtiene servicios sin confirmar
- `ServiceAcknowledgeModal` — Modal global que muestra servicios pendientes de confirmar

### Modulos de cronograma existentes:
- cronograma-protocolo
- cronograma-administracion
- cronograma-discipulado
- cronograma-mdg
- cronograma-alabanza
- cronograma-intercesion
- cronograma-herederos
- cronograma-redil
- cronograma-comunicacion
- cronograma-jovenes
- cronograma-hombres
- cronograma-pastoral

### Componente reutilizable: `CronogramaServicio`
Componente compartido (`components/CronogramaServicio.tsx`) que recibe `modulo` como prop y renderiza todo el CRUD del cronograma para cualquier ministerio.


---

## 11. Modulos del Sistema

### 11.1 Ingresos y Egresos
- **Tablas:** `ingresos`, `egresos`
- **Campos:** mes_id, concepto, monto, fecha, ministerio, categoria_principal, detalle, observacion, estado
- **Funcionalidad:** CRUD completo vinculado al mes activo
- **Auditoria:** Cada operacion se registra en `audit_logs`

### 11.2 Diezmos
- **Tabla:** `diezmos`
- **Campos:** mes_id, numero (secuencial), fecha, donador, valor, tipo_ofrenda, transaccion
- **tipo_ofrenda:** "diezmo" | "primicia" | "ofrenda_especial"
- **transaccion:** "efectivo" | "transferencia"
- **Funcionalidad:** Registro numerado de diezmos/primicias/ofrendas por mes
- **Busqueda:** Por donador y rango de fechas (cross-month)

### 11.3 Asistencia General
- **Tablas:** `asistencia_detalles` (filas), `asistencia_columnas` (fechas/columnas), `asistencia_datos` (valores)
- **Estructura:** Tabla dinamica donde filas son categorias (ej: "Hombres", "Mujeres", "Ninos") y columnas son fechas
- **Detalle:** Cada celda contiene un valor numerico (cantidad de personas)
- **updated_at:** Cada celda tiene timestamp de ultima actualizacion para security check individual
- **Defaults:** Al crear un mes nuevo, se inicializan filas predeterminadas

### 11.4 Discipulado por Ciclos (3 sub-modulos)
- **Tablas:** `discipulado_ciclos`, `discipulado_ciclo_participantes`, `discipulado_ciclo_fechas`, `discipulado_ciclo_asistencia`

| Ciclo | Clases | Modulo |
|-------|--------|--------|
| Primeros pasos | 13 | discipulado_primeros_pasos |
| Seguimos avanzando | 15 | discipulado_seguimos_avanzando |
| Siendo iglesia | 11 | discipulado_siendo_iglesia |

- **Ciclos:** Se inicia uno nuevo, el anterior se desactiva automaticamente
- **Fechas:** Se calculan automaticamente como domingos consecutivos desde la fecha de inicio
- **Cambio de fecha:** Si modificas una fecha, recalcula todas las posteriores como domingos consecutivos
- **Participantes:** Tienen estatus: en_curso, aprobado, reprobado
- **Historial:** Se puede ver el historial de ciclos cerrados (modulo `historial-discipulado`)

### 11.5 Censo (Protocolo)
- **Tabla:** `censo`
- **Campos extensos:** Datos personales (cedula, nombre, fecha nacimiento, tipo sangre, estado civil, sexo, discapacidad, telefonos, direccion), datos iglesia (jornada, cargo, ministerio, discipulado, bautizo, matrimonio, membresia, celula, hijos)
- **Catalogos:** Tabla `censo_catalogos` con opciones dinamicas por tipo
- **Configuraciones:** Tabla `censo_configuraciones` para settings del censo
- **Busqueda:** Por cedula, nombre, parroquia, barrio

### 11.6 Censo MDG
- **Tabla:** `censo_mdg` (misma estructura que censo)
- **Comparte catalogos** con el censo principal
- **Campo adicional:** `nuevo_creyente`
- **Servicio dedicado:** `lib/mod/censo-mdg-service.ts`

### 11.7 Control de Asistencia de Servidores
- **Tabla:** `asistencia_servidores`
- **Campos:** modulo, user_id, user_name, fecha, estado (asistio/falto/justifico/pendiente)
- **Unique:** (modulo, user_id, fecha)
- **Modulos:** Uno por cada ministerio:
  - asistencia-servidores-protocolo
  - asistencia-servidores-administracion
  - asistencia-servidores-discipulado
  - asistencia-servidores-mdg
  - asistencia-servidores-alabanza
  - asistencia-servidores-intercesion
  - asistencia-servidores-herederos
  - asistencia-servidores-redil
  - asistencia-servidores-comunicacion
  - asistencia-servidores-jovenes
  - asistencia-servidores-hombres
  - asistencia-servidores-pastoral
- **Componente reutilizable:** `ControlAsistenciaServidores`

### 11.8 Cronograma de Eventos General
- Cada grupo tiene su propio cronograma de eventos
- **Componente reutilizable:** `CronogramaEventosGeneral`
- Modulos: cronograma-eventos-protocolo, cronograma-eventos-administracion, cronograma-eventos-discipulado, cronograma-eventos-mdg, cronograma-eventos-alabanza, cronograma-eventos-intercesion, cronograma-eventos-herederos, cronograma-eventos-redil, cronograma-eventos-comunicacion, cronograma-eventos-jovenes, cronograma-eventos-hombres, cronograma-eventos-pastoral

### 11.9 Bautizos
- **Tabla:** `bautizos`
- **Campos:** numero (secuencial global), fecha, nombre_bautizado, nombre_padre, nombre_madre, padrinos, observacion
- **Busqueda:** Por nombre o rango de fechas
- **Certificados:** Generacion de PDF con `lib/generate-certificados.ts`

### 11.10 Matrimonios
- **Tabla:** `matrimonios`
- **Campos:** numero (secuencial global), fecha, nombres_esposos, cedula_esposo, cedula_esposa, observacion
- **Busqueda:** Por nombre/cedula o rango de fechas

### 11.11 Inventario
- **Tabla:** `inventory_items`
- **Campos:** cantidad, codigo, detalle, numero_serie, ubicacion, ministerio, estado, fecha_registro
- **Configuraciones:** Ministerios, ubicaciones, estados vienen de `configuraciones_globales`

### 11.12 Flujo de Pago y Nomina
- **Tablas de Flujo:** `payment_tables`, `payment_rows`
- **Tabla Nomina:** `nomina`
- **Concepto Flujo:** Tablas dinamicas de pagos. Cada tabla tiene filas con: fecha, beneficiarios, detalle, valor
- **Concepto Nomina:** Registro mensual de personal con sueldos, descuentos y quincenas

#### Tabla `nomina`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | serial | PK |
| mes_id | text FK | Mes asociado |
| cedula | text | Cedula del empleado |
| nombre | text | Nombre completo |
| telefono | text | Telefono |
| email | text | Email |
| valor_sueldo | numeric | Sueldo base |
| descuento | text | Tipo de descuento |
| descuento_valor | numeric | Monto del descuento |
| descuento_motivo | text | Razon del descuento |
| valor_a_pagar | numeric | Sueldo - descuento |
| categoria_principal | text | Categoria (default: "Pago de nomina") |
| detalle | text | Detalle configurable |
| primera_quincena_pagada | boolean | Si se pago 1ra quincena |
| primera_quincena_valor | numeric | Monto 1ra quincena |
| primera_quincena_fecha | text | Fecha de pago |
| primera_quincena_metodo | text | Metodo de pago |
| segunda_quincena_pagada | boolean | Si se pago 2da quincena |
| segunda_quincena_valor | numeric | Monto 2da quincena |
| segunda_quincena_fecha | text | Fecha de pago |
| segunda_quincena_metodo | text | Metodo de pago |
| created_at | timestamptz | Fecha creacion |

- **Acceso restringido:** Nomina usa `useRestrictedAccess("nomina")` — solo usuarios en tabla `acceso_restringido` pueden verla
- **Auto-calculo:** Las quincenas se calculan automaticamente como mitad del valor_a_pagar
- **CRUD completo** con auditoria

### 11.13 Alfoli
- **Tabla:** `alfoli`
- **Campos:** fecha, mes, anio, tipo (domingo/mdg), valor, recibido, recibido_por, recibido_por_nombre, recibido_at, registrado_por, registrado_por_nombre, created_at
- **Unique:** (fecha, tipo)
- **Funcionalidad:** Registrar ofrendas de domingos y MDG, marcar como recibidas
- **Calculo automatico:** Genera todos los domingos del mes para precargar fechas

### 11.14 Ofrenda de Celulas
- **Tabla:** `ofrendas_celulas`
- **Campos:** celula_nombre, fecha, mes, anio, valor, recibido, recibido_por, registrado_por
- **Unique:** (celula_nombre, fecha)
- **Funcionalidad:** Registro de ofrendas por celula en cada jueves del mes

### 11.15 Celulas / Somos Uno
- Los miembros del censo pueden tener campos: `celula_asiste`, `celula_nombre`
- Permite agrupar miembros por celula

### 11.16 Gestion de Celulas
- **Tabla:** `gestion_celulas`
- **Campos:** miembro_id, fuente (protocolo/mdg), celula_nombre, semana_inicio, gestionado, respuesta, asistio, gestionado_por
- **Concepto:** Seguimiento semanal de miembros de cada celula
- **Semana:** Se calcula desde el lunes de la semana actual (zona Ecuador)

### 11.17 Gestion de Atrasados
- **Tabla:** `gestion_atrasados`
- **Campos:** modulo, user_id, user_name, fecha, gestionado, respuesta_gestion, acuerdo, gestionado_por, notificado
- **Flujo:**
  1. Se marca un atraso en asistencia de servidores
  2. Se notifica al lider del grupo (push + email + WhatsApp)
  3. El lider gestiona: registra si se resolvio y acuerdo alcanzado

### 11.18 Mensajes y Citaciones
- **Tablas:** `mensajes_citaciones`, `mensajes_citaciones_recibidos`
- **Tipos de destinatario:** usuario especifico, modulo completo, todos
- **Campos:** remitente, destinatario, tipo (mensaje/invitacion), detalle, fecha, valor, evento_lugar
- **Tracking:** Tabla de recepcion con estado leido/no leido por usuario
- **Componente reutilizable:** `MensajesCitaciones`
- **Modulos:** mensajes-protocolo, mensajes-administracion, mensajes-discipulado, mensajes-alabanza, mensajes-comunicacion, mensajes-herederos, mensajes-intercesion, mensajes-mdg, mensajes-redil, mensajes-jovenes, mensajes-hombres, mensajes-pastoral

### 11.19 Requerimientos de Bienes y Servicios
- **Tabla:** `requerimientos_bienes_servicios`
- **Campos:** modulo, ministerio, persona_id, persona_nombre, requerimiento (max 250), valor, evento_lugar, fecha_requerimiento, fecha_entrega
- **Respuesta:** respuesta (pendiente/aprobado/negado/suspenso), observaciones, respondido_por
- **Componente reutilizable:** `RequerimientosBienesServicios` (cada ministerio) + `AdminRequerimientos` (admin)
- **Flujo:**
  1. Un usuario con acceso al modulo envia un requerimiento
  2. Se notifica a los administradores
  3. Un admin aprueba/niega/suspende con observaciones
  4. Se notifica al solicitante con el resultado
- **Modulos:** requerimientos-admin, requerimientos-protocolo, requerimientos-discipulado, requerimientos-mdg, requerimientos-alabanza, requerimientos-intercesion, requerimientos-herederos, requerimientos-redil, requerimientos-comunicacion, requerimientos-jovenes, requerimientos-hombres, requerimientos-pastoral

### 11.20 Pastoral
- Vista especial para la pastoral con acceso panoramico (resumen-pastoral)
- Ahora es un GRUPO completo con modulos propios (cronograma, eventos, mensajes, asistencia, requerimientos)

### 11.21 Gestion de Cronogramas
- Vista administrativa para gestionar todos los cronogramas de todos los ministerios

### 11.22 Historial de Discipulado
- Vista para ver el historial de ciclos de discipulado cerrados


---

## 12. Sistema de Auditoria

### Tabla `audit_logs`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | UUID | PK |
| timestamp | timestamptz | Cuando ocurrio |
| user_id | text | Quien lo hizo |
| user_name | text | Nombre del usuario |
| module | text | Modulo afectado |
| action | text | crear, editar, eliminar |
| description | text | Descripcion legible |
| details | jsonb | Datos antes/despues |
| is_ai | boolean | Si lo hizo una IA |
| ai_authorized_by | text | Quien autorizo la IA |

### Integracion
Casi todos los servicios (`storage`, `attendance-service`, `cronograma-service`, `diezmos-service`, `bautizo-service`, `matrimonio-service`, `payment-flow-service`, `censo-service`, `discipulado-ciclos-service`) reciben un parametro opcional `audit?: AuditInfo` que registra la accion.

### Tab de Auditoria en Administracion
El panel de administracion tiene un tab dedicado (`AuditLogTab.tsx`) para consultar el historial de auditoria con filtros por modulo, accion y usuario.

---

## 13. Sistema de Seguridad (Security Keys)

### Concepto
Para operaciones sensibles en registros con mas de 6 horas de antiguedad, se requiere una "clave de seguridad".

### Tabla `security_keys`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | UUID | PK |
| key_code | text | Codigo de 6 caracteres (A-Z, 2-9) |
| is_used | boolean | Si ya fue usada |
| used_at | timestamptz | Cuando se uso |
| used_by | UUID | Quien la uso |

### Flujo:
1. Siempre hay 3 claves activas (no usadas) en la base de datos
2. Cuando se edita/elimina algo con +6h de antiguedad, se pide una clave
3. Los usuarios "jaime" y "dev" estan exentos
4. Al usar una clave, se marca como usada y se genera una nueva automaticamente
5. Un admin puede regenerar todas las claves

### SecurityCheckContext (Frontend)
- `checkAndExecute(createdAt, callback)` — Verifica si necesita clave y ejecuta el callback
- `SecurityKeyDialog` — Componente global que muestra el dialog de ingreso de clave

---

## 14. Realtime (Supabase)

### Hook `useRealtime`
```typescript
useRealtime({
  table: "ingresos",
  filter: "mes_id=eq.123",
  enabled: !!currentMonth,
  onChange: () => loadData(true),
})
```

### Hook `useRealtimeMultiple`
Se suscribe a multiples tablas y llama `onChange` cuando cualquiera cambia.

### Tablas con Realtime habilitado:
- buzon_mensajes
- requerimientos_bienes_servicios
- mensajes_citaciones
- mensajes_citaciones_recibidos
- asistencia_servidores
- discipulado_ciclos, discipulado_ciclo_participantes, discipulado_ciclo_fechas, discipulado_ciclo_asistencia
- payment_tables, payment_rows
- nomina


---

## 15. Configuraciones Globales

### Tabla `configuraciones_globales`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | int | PK (siempre 1) |
| ministerios | text[] | Lista de ministerios |
| ubicaciones | text[] | Ubicaciones del inventario |
| estados | text[] | Estados del inventario |
| categorias_principales | text[] | Categorias financieras |
| detalles | text[] | Detalles financieros |
| nomina_detalles | text[] | Detalles configurables para nomina |

### Tabla `configuraciones_mes`
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| mes_id | text FK | Mes |
| ministerios | text[] | Ministerios activos ese mes |
| categorias_principales | text[] | Categorias del mes |
| detalles | text[] | Detalles del mes |

---

## 16. Deployment e Infraestructura

### Flujo de Deploy
1. Push a rama `main`
2. GitHub Action SSH al VPS
3. `git reset --hard origin/main`
4. `npm ci`
5. `npm run build` (Next.js)
6. `pm2 reload iglesia`

### Puertos
- **Next.js app:** 3712 (produccion), 3001 (desarrollo con Turbopack)
- **WhatsApp server:** 3100

### Variables de Entorno (.env)
```
NEXT_PUBLIC_SUPABASE_URL=https://servidor.iglesiaregalodedios.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://servidor.iglesiaregalodedios.com
SUPABASE_SERVICE_KEY=... (service role, acceso completo)
JWT_SECRET=...
INTERNAL_API_SECRET=... (server-to-server auth)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=notificaciones@iglesiaregalodedios.com
SMTP_PASS=...
WA_SERVER_URL=http://localhost:3100
CRON_SECRET=...
```

### Scripts de Package.json
```json
{
  "dev": "next dev --turbopack -p 3001",
  "build": "next build",
  "start": "next start -p 3712",
  "deploy": "npm run build && pm2 reload iglesia",
  "lint": "next lint"
}
```
