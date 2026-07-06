# Documentación Completa del Proyecto - Iglesia Regalo de Dios

## 1. Información General

**Nombre:** Panel Administrativo Iglesia Regalo de Dios
**URL Producción:** https://panel.iglesiaregalodedios.com
**Supabase URL:** https://servidor.iglesiaregalodedios.com
**Repositorio:** Se despliega vía GitHub Actions a un VPS

### Stack Tecnológico
- **Frontend:** Next.js 15.4.6 con React 19, TypeScript, Tailwind CSS 4
- **UI Components:** Radix UI (Dialog, Select, Checkbox, Tabs, etc.) + shadcn/ui
- **Backend:** Next.js API Routes (App Router)
- **Base de datos:** Supabase (PostgreSQL auto-hospedado)
- **Autenticación:** Custom JWT (jose) + bcryptjs (NO usa Supabase Auth)
- **Realtime:** Supabase Realtime (postgres_changes)
- **WhatsApp:** Servidor Express separado con @whiskeysockets/baileys
- **Email:** Nodemailer via SMTP Hostinger (notificaciones@iglesiaregalodedios.com)
- **Push Notifications:** web-push (VAPID)
- **PWA:** next-pwa con service worker personalizado
- **Charts:** Recharts
- **PDF:** pdf-lib (certificados)
- **Deploy:** GitHub Actions → SSH → VPS con PM2 (puerto 3712)

---

## 2. Sistema de Autenticación

### Flujo de Login
1. El usuario envía credenciales a `POST /api/login`
2. Se busca en tabla `users` por username, email o phone
3. Se verifica password con bcrypt
4. Se genera un JWT (HS256, 24h de expiración) con `jose`
5. El token se almacena en `localStorage` del cliente
6. Al cargar la app, `AuthContext` valida el token via `POST /api/verify-session`

### Rate Limiting
- Máximo 5 intentos por IP en 15 minutos
- Se limpia automáticamente la memoria cada 5 minutos

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
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| account_type | text | "personal" o "ministerio" |
| username | text | Único |
| password_hash | text | bcrypt hash |
| displayName | text | Nombre visible |
| email | text | Opcional, para notificaciones |
| phone | text | Opcional, para WhatsApp |
| cedula | text | Cédula de identidad |
| ministerio_name | text | Solo para cuentas tipo ministerio |
| is_active | boolean | Si el usuario está habilitado |
| created_by | UUID | Quién lo creó |
| created_at | timestamptz | Fecha creación |

### Seguridad RLS
- La tabla `users` tiene RLS habilitado
- Existe una vista `users_safe` que excluye `password_hash`
- El login server-side usa una `SUPABASE_SERVICE_KEY` con acceso completo
- El cliente usa la `anon key` con políticas RLS permisivas

---

## 3. Sistema de Roles y Permisos

### Arquitectura de Permisos
El sistema NO usa roles fijos. Usa un sistema de **permisos granulares por módulo**:

#### Tablas clave:
- `module_groups` — Grupos de módulos (ej: "protocolo", "administracion", "discipulado", "mdg")
- `system_modules` — Módulos individuales del sistema
- `user_permissions` — Relación usuario↔módulo con permisos
- `user_group_leaders` — Líderes de grupo (rol especial)

### Tabla `module_groups`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| name | text | Identificador (protocolo, administracion, etc.) |
| display_name | text | Nombre visible |
| icon | text | Emoji del grupo |
| image | text | URL imagen opcional |
| sort_order | int | Orden de visualización |

### Tabla `system_modules`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| name | text | Identificador único (ej: "cronograma-protocolo") |
| display_name | text | Nombre visible |
| description | text | Descripción del módulo |
| icon | text | Emoji |
| route | text | Ruta del dashboard (ej: "/dashboard/cronograma-protocolo") |
| requires_active_month | boolean | Si necesita un mes activo |
| is_active | boolean | Si el módulo está habilitado |
| group_id | UUID FK | Grupo al que pertenece |
| sort_order | int | Orden |

### Tabla `user_permissions`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| user_id | UUID FK | Usuario |
| module_id | UUID FK | Módulo |
| can_view | boolean | Puede ver el módulo |
| can_edit | boolean | Puede editar contenido |
| can_admin | boolean | Permisos administrativos |
| granted_by | UUID | Quién otorgó el permiso |
| UNIQUE | (user_id, module_id) | |

### Tabla `user_group_leaders`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| user_id | UUID FK | Usuario |
| group_id | UUID FK | Grupo del que es líder |
| granted_by | UUID | Quién lo asignó |
| UNIQUE | (user_id, group_id) | |

### Niveles de acceso efectivo:
1. **can_view** — Puede ver el módulo en el dashboard y acceder a él
2. **can_edit** — Puede crear/editar/eliminar datos dentro del módulo
3. **can_admin** — Permisos especiales de administración
4. **canLeader** — Si es líder del grupo, automáticamente tiene can_edit en todos los módulos del grupo

### PermissionsGuard (Frontend)
El componente `PermissionsGuard` en `lib/permissions-guard.tsx` protege cada página:
- Verifica que el usuario tenga `can_view` en el módulo
- Pasa `canEdit`, `canAdmin` y `canLeader` como props al componente hijo
- Si no tiene permiso, redirige al dashboard con un toast de error


---

## 4. Sistema de Doble Vista (Vista/Edición)

Cada módulo del dashboard tiene dos modos de operación:
- **Vista (can_view):** El usuario puede ver la información pero no modificarla
- **Edición (can_edit):** El usuario puede crear, editar y eliminar registros

El patrón se implementa así:
```tsx
<PermissionsGuard moduleName="cronograma-protocolo">
  {(canEdit, canAdmin, canLeader) => (
    <MiComponente canEdit={canEdit} canAdmin={canAdmin} canLeader={canLeader} />
  )}
</PermissionsGuard>
```

Dentro del componente, los botones de crear/editar/eliminar se ocultan si `canEdit === false`.

---

## 5. Sistema de Meses (Control Mensual)

### Concepto
El sistema opera en periodos mensuales. Un "mes" es una unidad temporal que:
- Tiene fecha de inicio y fin
- Puede estar "active" o "closed"
- Los módulos que requieren mes activo no funcionan sin uno abierto

### Tabla `meses`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | text | PK (formato: "YYYY-M-timestamp") |
| name | text | "Enero 2025", etc. |
| year | int | Año |
| month | int | Mes (1-12) |
| start_date | text | Fecha inicio |
| end_date | text | Fecha cierre (null si activo) |
| status | text | "active" o "closed" |

### Tablas asociadas al mes:
- `ingresos` — Ingresos financieros
- `egresos` — Egresos financieros
- `diezmos` — Registro de diezmos
- `asistencia_detalles` / `asistencia_columnas` / `asistencia_datos` — Asistencia general
- `discipulado_participantes` / `discipulado_fechas` / `discipulado_asistencia` — Discipulado por mes
- `configuraciones_mes` — Ministerios, categorías y detalles del mes

### MonthContext (Frontend)
Provee el mes activo a toda la app y métodos para:
- Iniciar nuevo mes
- Cerrar mes actual
- Editar fechas
- Eliminar mes

---

## 6. Sistema de Notificaciones (Multicanal)

### Canales de notificación:
1. **Buzón interno** — Tabla `buzon_mensajes` (con Realtime)
2. **Push notifications** — Web Push via VAPID keys
3. **Email** — SMTP via Hostinger (nodemailer)
4. **WhatsApp** — Servidor Baileys separado

### Buzón de Mensajes (`buzon_mensajes`)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigserial | PK |
| user_id | UUID FK | Destinatario |
| titulo | varchar(200) | Título |
| mensaje | text | Contenido |
| tipo | varchar(50) | info, requerimiento, aprobado, negado, suspenso |
| leido | boolean | Si fue leído |
| referencia_tipo | varchar(50) | Tipo de recurso relacionado |
| referencia_id | bigint | ID del recurso |

### Push Notifications
- Tabla `push_subscriptions` almacena endpoints y keys por usuario
- Service Worker en `worker/index.js` maneja eventos push
- VAPID keys: Público y privado configurados en el cron

### Hook `useNotificaciones`
- Carga mensajes del buzón del usuario actual
- Se suscribe a Realtime para nuevos mensajes
- Permite marcar como leído
- `enviarNotificacion()` — Envía al buzón + push
- `notificarAdmins()` — Notifica a todos los usuarios del grupo "administracion"


---

## 7. Sistema de Email

### Configuración SMTP
- **Host:** smtp.hostinger.com (puerto 465, SSL)
- **From:** notificaciones@iglesiaregalodedios.com
- **Archivo:** `lib/mod/email-service.ts`

### Tipos de email:
1. **asignacion** — "Nuevo Servicio Asignado" (azul)
2. **alerta2** — "Tu servicio es en 5 días" (naranja/amarillo)
3. **alerta1** — "¡Mañana tienes servicio!" (rojo)

### Flujo:
- Se envía vía `POST /api/send-email` 
- El body incluye: `to`, `type`, `data` (userName, asignacion, fecha, horaEntrada, modulo, ministerio, evento)
- El email es HTML responsive con diseño profesional

---

## 8. Sistema de WhatsApp

### Arquitectura
El WhatsApp funciona como un **microservicio separado**:

```
whatsapp-server/           (Express, puerto 3100)
├── src/
│   ├── index.ts          — Endpoints REST
│   └── whatsapp-service.ts — Conexión con Baileys
├── auth_info/            — Credenciales guardadas (multi-file auth state)
```

### Conexión
- Usa `@whiskeysockets/baileys` (conexión directa, NO la API oficial de Meta)
- Requiere escanear QR desde el frontend la primera vez
- Las credenciales se guardan en `auth_info/` y reconecta automáticamente
- Máximo 5 reintentos de conexión antes de detenerse

### Endpoints del servidor WhatsApp:
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/whatsapp/status | Estado de conexión |
| GET | /api/whatsapp/qr | QR code base64 |
| POST | /api/whatsapp/connect | Iniciar conexión |
| POST | /api/whatsapp/disconnect | Desconectar |
| POST | /api/whatsapp/send | Enviar mensaje (phone + message) |
| POST | /api/whatsapp/send-bulk | Envío masivo (phones[] + message) |
| POST | /api/whatsapp/logout | Cerrar sesión (borra credenciales) |

### Proxy en Next.js
El frontend llama a `/api/whatsapp/send` → Next.js API Route → redirige al servidor Express en `WA_SERVER_URL`

### Formato de teléfonos (Ecuador)
- `0980932062` → `593980932062`
- `+593980932062` → `593980932062`
- `593980932062` → sin cambio
- Anti-ban: delay aleatorio de 1-3s entre mensajes masivos

### Historial
Tabla `whatsapp_messages` registra cada mensaje enviado con status (sent/failed).

---

## 9. Sistema de Cronogramas de Servicio

### Tabla `cronograma_servicio`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | serial | PK |
| user_id | UUID FK | Servidor asignado |
| user_name | text | Nombre del servidor |
| asignacion | text | Rol/lugar asignado |
| fecha | date | Fecha del servicio |
| modulo | text | protocolo, administracion, discipulado, mdg, etc. |
| ministerio | text | Ministerio (opcional) |
| evento | text | Evento (opcional) |
| hora_entrada | text | Hora esperada |
| hora_llegada | text | Hora real de llegada |
| atraso | boolean | Si llegó tarde |
| acuse_asignacion | boolean | Confirmó recepción |
| acuse_alerta2 | boolean | Confirmó alerta 5 días |
| acuse_alerta1 | boolean | Confirmó alerta 1 día |
| alerta2_enviada | boolean | Flag de envío |
| alerta1_enviada | boolean | Flag de envío |
| email_*_enviado | boolean | Flags de email por tipo |
| whatsapp_*_enviado | boolean | Flags de WhatsApp por tipo |

### Flujo al crear asignación:
1. Validar que el usuario NO esté asignado el mismo día en ningún módulo
2. Insertar en `cronograma_servicio`
3. Enviar notificación multicanal:
   - Buzón interno
   - Push notification
   - Email (si tiene correo)
   - WhatsApp (si tiene teléfono)
4. Marcar flags de envío

### Sistema de Alertas (Cron)
Endpoint: `GET /api/cron-reminders` (protegido con Bearer token)

Se ejecuta periódicamente y procesa:
- **Alerta 2:** Servicios en exactamente 5 días (sin enviar aún)
- **Alerta 1:** Servicios mañana (sin enviar aún)

Para cada servicio pendiente:
1. Envía al buzón interno
2. Envía push notification
3. Envía email
4. Envía WhatsApp
5. Marca flags en la base de datos

### Sistema de Acuse de Recibo
Los servidores deben confirmar que recibieron la notificación:
- `markAcknowledgment(id, tipo)` — Marca acuse con timestamp
- `getPendingAcknowledgments(userId)` — Obtiene servicios sin confirmar

### Módulos de cronograma existentes:
- cronograma-protocolo
- cronograma-administracion
- cronograma-discipulado
- cronograma-mdg
- cronograma-alabanza
- cronograma-intercesion
- cronograma-herederos
- cronograma-redil


---

## 10. Módulos del Sistema

### 10.1 Ingresos y Egresos
- **Tablas:** `ingresos`, `egresos`
- **Campos:** mes_id, concepto, monto, fecha, ministerio, categoria_principal, detalle, observacion, estado
- **Funcionalidad:** CRUD completo vinculado al mes activo
- **Auditoría:** Cada operación se registra en `audit_logs`

### 10.2 Diezmos
- **Tabla:** `diezmos`
- **Campos:** mes_id, numero (secuencial), fecha, donador, valor
- **Funcionalidad:** Registro numerado de diezmos por mes
- **Búsqueda:** Por donador y rango de fechas (cross-month)

### 10.3 Asistencia General
- **Tablas:** `asistencia_detalles` (filas), `asistencia_columnas` (fechas/columnas), `asistencia_datos` (valores)
- **Estructura:** Tabla dinámica donde filas son categorías (ej: "Hombres", "Mujeres", "Niños") y columnas son fechas
- **Detalle:** Cada celda contiene un valor numérico (cantidad de personas)
- **Defaults:** Al crear un mes nuevo, se inicializan filas predeterminadas

### 10.4 Discipulado (por mes)
- **Tablas:** `discipulado_participantes`, `discipulado_fechas`, `discipulado_asistencia`
- **Funcionalidad:** Control de asistencia de participantes por fecha
- **Estados:** A (asistió), F (faltó), J (justificó), AT (atrasado)

### 10.5 Discipulado por Ciclos (3 sub-módulos)
- **Tablas:** `discipulado_ciclos`, `discipulado_ciclo_participantes`, `discipulado_ciclo_fechas`, `discipulado_ciclo_asistencia`

| Ciclo | Clases | Módulo |
|-------|--------|--------|
| Primeros pasos | 13 | discipulado_primeros_pasos |
| Seguimos avanzando | 15 | discipulado_seguimos_avanzando |
| Siendo iglesia | 11 | discipulado_siendo_iglesia |

- **Ciclos:** Se inicia uno nuevo, el anterior se desactiva automáticamente
- **Fechas:** Se calculan automáticamente como domingos consecutivos desde la fecha de inicio
- **Cambio de fecha:** Si modificas una fecha, recalcula todas las posteriores como domingos consecutivos
- **Participantes:** Tienen estatus: en_curso, aprobado, reprobado
- **Historial:** Se puede ver el historial de ciclos cerrados

### 10.6 Censo (Protocolo)
- **Tabla:** `censo`
- **Campos extensos:** Datos personales (cédula, nombre, fecha nacimiento, tipo sangre, estado civil, sexo, discapacidad, teléfonos, dirección), datos iglesia (jornada, cargo, ministerio, discipulado, bautizo, matrimonio, membresía, célula, hijos)
- **Catálogos:** Tabla `censo_catalogos` con opciones dinámicas por tipo
- **Búsqueda:** Por cédula, nombre, parroquia, barrio

### 10.7 Censo MDG
- **Tabla:** `censo_mdg` (misma estructura que censo)
- **Comparte catálogos** con el censo principal
- **Campo adicional:** `nuevo_creyente`

### 10.8 Control de Asistencia de Servidores
- **Tabla:** `asistencia_servidores`
- **Campos:** modulo, user_id, user_name, fecha, estado (asistio/falto/justifico/pendiente)
- **Unique:** (modulo, user_id, fecha)
- **Módulos:** Uno por cada ministerio (protocolo, mdg, administracion, discipulado, alabanza, intercesion, herederos, redil)

### 10.9 Cronograma de Eventos General
- Cada grupo tiene su propio cronograma de eventos
- Módulos: cronograma-eventos-protocolo, cronograma-eventos-administracion, etc.

### 10.10 Bautizos
- **Tabla:** `bautizos`
- **Campos:** numero (secuencial global), fecha, nombre_bautizado, nombre_padre, nombre_madre, padrinos, observacion
- **Búsqueda:** Por nombre o rango de fechas

### 10.11 Matrimonios
- **Tabla:** `matrimonios`
- **Campos:** numero (secuencial global), fecha, nombres_esposos, cedula_esposo, cedula_esposa, observacion
- **Búsqueda:** Por nombre/cédula o rango de fechas

### 10.12 Inventario
- **Tabla:** `inventory_items`
- **Campos:** cantidad, codigo, detalle, numero_serie, ubicacion, ministerio, estado, fecha_registro
- **Configuraciones:** Ministerios, ubicaciones, estados vienen de `configuraciones_globales`

### 10.13 Flujo de Pago
- **Tablas:** `payment_tables`, `payment_rows`
- **Concepto:** Tablas dinámicas de pagos. Cada tabla tiene filas con: fecha, beneficiarios, detalle, valor
- **CRUD completo** con auditoría

### 10.14 Alfolí
- **Tabla:** `alfoli`
- **Campos:** fecha, mes, anio, tipo (domingo/mdg), valor, recibido, recibido_por, registrado_por
- **Unique:** (fecha, tipo)
- **Funcionalidad:** Registrar ofrendas de domingos y MDG, marcar como recibidas

### 10.15 Ofrenda de Células
- **Tabla:** `ofrendas_celulas`
- **Campos:** celula_nombre, fecha, mes, anio, valor, recibido, recibido_por, registrado_por
- **Unique:** (celula_nombre, fecha)
- **Funcionalidad:** Registro de ofrendas por célula en cada jueves del mes

### 10.16 Células / Somos Uno
- Los miembros del censo pueden tener campos: `celula_asiste`, `celula_nombre`
- Permite agrupar miembros por célula

### 10.17 Gestión de Células
- **Tabla:** `gestion_celulas`
- **Campos:** miembro_id, fuente (protocolo/mdg), celula_nombre, semana_inicio, gestionado, respuesta, asistio, gestionado_por
- **Concepto:** Seguimiento semanal de miembros de cada célula
- **Semana:** Se calcula desde el lunes de la semana actual (zona Ecuador)

### 10.18 Gestión de Atrasados
- **Tabla:** `gestion_atrasados`
- **Campos:** modulo, user_id, user_name, fecha, gestionado, respuesta_gestion, acuerdo, gestionado_por, notificado
- **Flujo:** 
  1. Se marca un atraso en asistencia de servidores
  2. Se notifica al líder del grupo (push + email + WhatsApp)
  3. El líder gestiona: registra si se resolvió y acuerdo alcanzado

### 10.19 Mensajes y Citaciones
- **Tablas:** `mensajes_citaciones`, `mensajes_citaciones_recibidos`
- **Tipos de destinatario:** usuario específico, módulo completo, todos
- **Campos:** remitente, destinatario, tipo (mensaje/invitacion), detalle, fecha, valor, evento_lugar
- **Tracking:** Tabla de recepción con estado leido/no leido por usuario
- **Módulos:** Uno por cada ministerio (mensajes-protocolo, mensajes-mdg, etc.)

### 10.20 Requerimientos de Bienes y Servicios
- **Tabla:** `requerimientos_bienes_servicios`
- **Campos:** modulo, ministerio, persona_id, persona_nombre, requerimiento (max 250), valor, evento_lugar, fecha_requerimiento, fecha_entrega
- **Respuesta:** respuesta (pendiente/aprobado/negado/suspenso), observaciones, respondido_por
- **Flujo:**
  1. Un usuario con acceso al módulo envía un requerimiento
  2. Se notifica a los administradores
  3. Un admin aprueba/niega/suspende con observaciones
  4. Se notifica al solicitante con el resultado

### 10.21 Pastoral
- Vista especial para la pastoral con acceso panorámico

### 10.22 Gestión de Cronogramas
- Vista administrativa para gestionar todos los cronogramas

### 10.23 Historial de Discipulado
- Vista para ver el historial de ciclos de discipulado cerrados


---

## 11. Sistema de Auditoría

### Tabla `audit_logs`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| timestamp | timestamptz | Cuándo ocurrió |
| user_id | text | Quién lo hizo |
| user_name | text | Nombre del usuario |
| module | text | Módulo afectado |
| action | text | crear, editar, eliminar |
| description | text | Descripción legible |
| details | jsonb | Datos antes/después |
| is_ai | boolean | Si lo hizo una IA |
| ai_authorized_by | text | Quién autorizó la IA |

### Integración
Casi todos los servicios (`storage`, `attendance-service`, `cronograma-service`, `diezmos-service`, `bautizo-service`, `matrimonio-service`, `payment-flow-service`, `censo-service`, `discipulado-ciclos-service`) reciben un parámetro opcional `audit?: AuditInfo` que registra la acción.

---

## 12. Sistema de Seguridad (Security Keys)

### Concepto
Para operaciones sensibles en registros con más de 6 horas de antigüedad, se requiere una "clave de seguridad".

### Tabla `security_keys`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| key_code | text | Código de 6 caracteres (A-Z, 2-9) |
| is_used | boolean | Si ya fue usada |
| used_at | timestamptz | Cuándo se usó |
| used_by | UUID | Quién la usó |

### Flujo:
1. Siempre hay 3 claves activas (no usadas) en la base de datos
2. Cuando se edita/elimina algo con +6h de antigüedad, se pide una clave
3. Los usuarios "jaime" y "dev" están exentos
4. Al usar una clave, se marca como usada y se genera una nueva automáticamente
5. Un admin puede regenerar todas las claves

### SecurityCheckContext (Frontend)
- `checkAndExecute(createdAt, callback)` — Verifica si necesita clave y ejecuta el callback

---

## 13. Realtime (Supabase)

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
Se suscribe a múltiples tablas y llama `onChange` cuando cualquiera cambia.

### Tablas con Realtime habilitado:
- buzon_mensajes
- requerimientos_bienes_servicios
- mensajes_citaciones
- mensajes_citaciones_recibidos
- asistencia_servidores
- discipulado_ciclos, discipulado_ciclo_participantes, discipulado_ciclo_fechas, discipulado_ciclo_asistencia

---

## 14. Configuraciones Globales

### Tabla `configuraciones_globales`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | int | PK (siempre 1) |
| ministerios | text[] | Lista de ministerios |
| ubicaciones | text[] | Ubicaciones del inventario |
| estados | text[] | Estados del inventario |
| categorias_principales | text[] | Categorías financieras |
| detalles | text[] | Detalles financieros |

### Tabla `configuraciones_mes`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| mes_id | text FK | Mes |
| ministerios | text[] | Ministerios activos ese mes |
| categorias_principales | text[] | Categorías del mes |
| detalles | text[] | Detalles del mes |

---

## 15. Deployment y Infraestructura

### Flujo de Deploy
1. Push a rama `main`
2. GitHub Action SSH al VPS
3. `git reset --hard origin/main`
4. `npm ci`
5. `npm run build` (Next.js)
6. `pm2 reload iglesia`

### Puertos
- **Next.js app:** 3712 (producción), 3001 (desarrollo)
- **WhatsApp server:** 3100

### Variables de Entorno (.env)
```
NEXT_PUBLIC_SUPABASE_URL=https://servidor.iglesiaregalodedios.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://servidor.iglesiaregalodedios.com
SUPABASE_SERVICE_KEY=... (service role, acceso completo)
JWT_SECRET=...
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=notificaciones@iglesiaregalodedios.com
SMTP_PASS=...
WA_SERVER_URL=http://localhost:3100
CRON_SECRET=...
```

---

## 16. Estructura de Archivos Clave

```
app/
├── api/
│   ├── login/route.ts           — Endpoint de login con rate limiting
│   ├── verify-session/          — Verificación de JWT
│   ├── send-email/route.ts      — Envío de emails
│   ├── send-notification/       — Push notifications
│   ├── cron-reminders/route.ts  — Cron de alertas multicanal
│   └── whatsapp/                — Proxy al servidor WhatsApp
│       ├── send/
│       ├── send-bulk/
│       ├── connect/
│       ├── disconnect/
│       ├── logout/
│       ├── qr/
│       └── status/
├── dashboard/
│   ├── page.tsx                 — Dashboard principal (módulos agrupados)
│   ├── administracion/          — Panel de usuarios y permisos
│   ├── asistencia/              — Asistencia general
│   ├── asistencia-servidores-*/  — Control por ministerio
│   ├── bautizo/
│   ├── celulas/
│   ├── censo/
│   ├── censo-mdg/
│   ├── control-mensual/         — Gestión de meses
│   ├── cronograma-*/            — Cronogramas por ministerio
│   ├── cronograma-eventos-*/    — Eventos por ministerio
│   ├── diezmos/
│   ├── discipulado/
│   ├── discipulado-primeros-pasos/
│   ├── discipulado-seguimos-avanzando/
│   ├── discipulado-siendo-iglesia/
│   ├── flujo-pago/
│   ├── gestion-cronogramas/
│   ├── historial-discipulado/
│   ├── ingresos-egresos/
│   ├── inventario/
│   ├── matrimonio/
│   ├── mdg/
│   ├── mensajes-*/              — Mensajes por ministerio
│   ├── mes/                     — Vista de mes
│   ├── ofrenda-celulas/
│   ├── pastoral/
│   ├── requerimientos/
│   ├── requerimientos-admin/
│   └── somos-uno/
├── login/                       — Página de login
└── layout.tsx                   — Layout raíz con providers

contexts/
├── auth-context.tsx             — Estado de autenticación
├── month-context.tsx            — Mes activo y historial
└── security-context.tsx         — Verificación de claves de seguridad

hooks/
├── use-mobile.ts                — Detección de mobile
├── use-notificaciones.ts        — Buzón + notificaciones
├── use-realtime.ts              — Suscripción Realtime Supabase
├── use-restricted-access.ts     — Acceso restringido
└── use-toast.ts                 — Toast notifications

lib/
├── supabase.ts                  — Cliente Supabase (anon key)
├── auth.ts                      — Login y verificación de permisos
├── admin.ts                     — CRUD usuarios, módulos, permisos
├── database.ts                  — Queries de datos básicos
├── storage.ts                   — SupabaseAdapter (CRUD meses, ingresos, egresos, inventario)
├── jwt.ts                       — Firma y verificación JWT
├── security-keys.ts             — Claves de seguridad
├── permissions-guard.tsx        — Componente de protección de rutas
├── globalConfig.ts              — Configuraciones globales
├── format-phone.ts              — Formateo de teléfonos Ecuador
├── timezone.ts                  — Utilidades de zona horaria Ecuador
├── generate-certificados.ts     — Generación de PDFs
├── utils.ts                     — cn() para tailwind-merge
└── mod/
    ├── alfoli-service.ts
    ├── attendance-service.ts
    ├── audit-service.ts
    ├── bautizo-service.ts
    ├── censo-mdg-service.ts
    ├── censo-service.ts
    ├── cronograma-service.ts
    ├── diezmos-service.ts
    ├── discipulado-ciclos-service.ts
    ├── discipulado-service.ts
    ├── email-service.ts
    ├── gestion-atrasados-service.ts
    ├── gestion-celulas-service.ts
    ├── matrimonio-service.ts
    ├── ofrenda-celulas-service.ts
    ├── payment-flow-service.ts
    ├── push-service.ts
    └── whatsapp-service.ts

whatsapp-server/
├── src/
│   ├── index.ts                 — Express server (puerto 3100)
│   └── whatsapp-service.ts      — WhatsAppService con Baileys
├── auth_info/                   — Credenciales WhatsApp
└── package.json

worker/
└── index.js                     — Service Worker para Push Notifications

sql/                             — Scripts de migración SQL
```


---

## 17. Base de Datos — Esquema Completo de Tablas

### Tablas Principales:
| Tabla | Descripción |
|-------|-------------|
| users | Usuarios del sistema |
| user_sessions | Registro de logins |
| module_groups | Grupos de módulos |
| system_modules | Módulos individuales |
| user_permissions | Permisos usuario↔módulo |
| user_group_leaders | Líderes de grupo |
| security_keys | Claves de seguridad |
| audit_logs | Registro de auditoría |
| configuraciones_globales | Config global (ministerios, ubicaciones, estados) |

### Tablas Financieras:
| Tabla | Descripción |
|-------|-------------|
| meses | Periodos mensuales |
| configuraciones_mes | Config por mes |
| ingresos | Ingresos financieros |
| egresos | Egresos financieros |
| diezmos | Registro de diezmos |
| payment_tables | Tablas de flujo de pago |
| payment_rows | Filas de flujo de pago |
| alfoli | Registro de alfolí |
| ofrendas_celulas | Ofrendas por célula |

### Tablas de Asistencia:
| Tabla | Descripción |
|-------|-------------|
| asistencia_detalles | Filas de la tabla de asistencia |
| asistencia_columnas | Columnas/fechas de asistencia |
| asistencia_datos | Valores numéricos de asistencia |
| asistencia_servidores | Asistencia individual de servidores |

### Tablas de Discipulado:
| Tabla | Descripción |
|-------|-------------|
| discipulado_participantes | Participantes por mes |
| discipulado_fechas | Fechas por mes |
| discipulado_asistencia | Asistencia por mes |
| discipulado_ciclos | Ciclos de discipulado |
| discipulado_ciclo_participantes | Participantes por ciclo |
| discipulado_ciclo_fechas | Fechas por ciclo |
| discipulado_ciclo_asistencia | Asistencia por ciclo |

### Tablas de Cronograma/Servicio:
| Tabla | Descripción |
|-------|-------------|
| cronograma_servicio | Asignaciones de servicio |
| gestion_atrasados | Registro de atrasos |

### Tablas de Comunicación:
| Tabla | Descripción |
|-------|-------------|
| buzon_mensajes | Notificaciones internas |
| push_subscriptions | Suscripciones push |
| whatsapp_messages | Historial de WhatsApp |
| mensajes_citaciones | Mensajes entre ministerios |
| mensajes_citaciones_recibidos | Tracking de recepción |

### Tablas de Censo/Registro:
| Tabla | Descripción |
|-------|-------------|
| censo | Censo de protocolo |
| censo_mdg | Censo de MDG |
| censo_catalogos | Opciones dinámicas para selects |
| bautizos | Registro de bautizos |
| matrimonios | Registro de matrimonios |
| gestion_celulas | Gestión semanal de células |

### Tablas de Inventario:
| Tabla | Descripción |
|-------|-------------|
| inventory_items | Items del inventario |

### Tablas de Requerimientos:
| Tabla | Descripción |
|-------|-------------|
| requerimientos_bienes_servicios | Solicitudes de bienes/servicios |

---

## 18. Grupos de Módulos y sus Módulos

### Grupo: Administración
- administracion — Panel de admin (usuarios, permisos)
- control-mensual — Gestión de meses
- ingresos-egresos
- diezmos
- inventario
- flujo-pago
- bautizo
- matrimonio
- requerimientos-admin

### Grupo: Protocolo
- cronograma-protocolo
- cronograma-eventos-protocolo
- asistencia-servidores-protocolo
- mensajes-protocolo
- censo (protocolo)
- celulas
- somos-uno

### Grupo: MDG
- cronograma-mdg
- cronograma-eventos-mdg
- asistencia-servidores-mdg
- mensajes-mdg
- censo-mdg

### Grupo: Discipulado
- discipulado (por mes)
- discipulado_primeros_pasos
- discipulado_seguimos_avanzando
- discipulado_siendo_iglesia
- cronograma-discipulado
- cronograma-eventos-discipulado
- asistencia-servidores-discipulado
- mensajes-discipulado
- historial-discipulado

### Grupo: Alabanza
- cronograma-alabanza
- cronograma-eventos-alabanza
- asistencia-servidores-alabanza
- mensajes-alabanza

### Grupo: Intercesión
- cronograma-intercesion
- cronograma-eventos-intercesion
- asistencia-servidores-intercesion
- mensajes-intercesion

### Grupo: Herederos
- cronograma-herederos
- cronograma-eventos-herederos
- asistencia-servidores-herederos
- mensajes-herederos

### Grupo: Redil
- cronograma-redil
- cronograma-eventos-redil
- asistencia-servidores-redil
- mensajes-redil

---

## 19. Zona Horaria

El sistema opera en **zona horaria Ecuador (UTC-5)**. El archivo `lib/timezone.ts` provee utilidades:
- `nowEcuador()` — Date actual en Ecuador
- `todayEcuador()` — Fecha string YYYY-MM-DD actual en Ecuador
- `currentMonthEcuador()` — Mes actual (1-12)
- `currentYearEcuador()` — Año actual

---

## 20. PWA (Progressive Web App)

- Configurado con `next-pwa`
- Service Worker personalizado en `worker/index.js`
- Maneja push notifications y click en notificaciones
- Iconos en `public/icon-192.png`
- Instlable en dispositivos móviles

---

## 21. Patrones de Desarrollo

### Patrón de Service Layer
Cada módulo tiene un archivo en `lib/mod/` que encapsula toda la lógica de base de datos:
```typescript
export const miService = {
  async getAll(): Promise<MiTipo[]> { ... },
  async create(data, audit?): Promise<MiTipo> { ... },
  async update(id, data, audit?): Promise<MiTipo> { ... },
  async delete(id, audit?): Promise<void> { ... },
}
```

### Patrón de Auditoría
```typescript
const audit: AuditInfo = { user_id: user.id, user_name: user.displayName }
await miService.create(data, audit)
```

### Patrón de Realtime
```typescript
useRealtime({
  table: "mi_tabla",
  filter: `mes_id=eq.${mesId}`,
  enabled: !!mesId,
  onChange: () => cargarDatos(true),
})
```

### Patrón de Página con Permisos
```tsx
export default function MiPagina() {
  return (
    <PermissionsGuard moduleName="mi-modulo">
      {(canEdit, canAdmin, canLeader) => (
        <MiComponenteInterno canEdit={canEdit} />
      )}
    </PermissionsGuard>
  )
}
```

---

## 22. Resumen de APIs

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| /api/login | POST | Login con JWT |
| /api/verify-session | POST | Validar token |
| /api/send-email | POST | Enviar email de servicio |
| /api/send-notification | POST | Enviar push notification |
| /api/cron-reminders | GET | Procesar alertas automáticas |
| /api/whatsapp/send | POST | Enviar WhatsApp |
| /api/whatsapp/send-bulk | POST | WhatsApp masivo |
| /api/whatsapp/connect | POST | Conectar WhatsApp |
| /api/whatsapp/disconnect | POST | Desconectar |
| /api/whatsapp/logout | POST | Cerrar sesión WA |
| /api/whatsapp/qr | GET | Obtener QR |
| /api/whatsapp/status | GET | Estado de conexión |

---

## 23. Notas Importantes

1. **NO usa Supabase Auth** — Tiene su propio sistema de autenticación con JWT custom
2. **Supabase solo como base de datos** — Se usa el cliente de Supabase para queries, realtime, y storage, pero no la autenticación nativa
3. **Dos clientes Supabase:**
   - `anon key` (cliente) — Para el frontend
   - `service_role key` (server) — Solo en API routes del server
4. **WhatsApp es un microservicio separado** — No forma parte del build de Next.js
5. **El sistema es multitenencia implícita** — Todos comparten la misma base de datos, los permisos determinan qué ve cada usuario
6. **La seguridad de edición/eliminación** se refuerza con el sistema de Security Keys para registros antiguos
7. **Configuraciones se heredan** — Al crear un nuevo mes, se copian las configuraciones (ministerios, categorías) del mes anterior
