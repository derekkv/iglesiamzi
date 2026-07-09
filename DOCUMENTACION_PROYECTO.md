# Documentacion Completa del Proyecto - Iglesia Regalo de Dios

## 1. Informacion General

**Nombre:** Panel Administrativo Iglesia Regalo de Dios
**URL Produccion:** https://panel.iglesiaregalodedios.com
**Supabase URL:** https://servidor.iglesiaregalodedios.com
**Repositorio:** Se despliega via GitHub Actions a un VPS
**Zona Horaria:** America/Guayaquil (UTC-5)

### Stack Tecnologico
- **Frontend:** Next.js 15.4.6 con React 19, TypeScript, Tailwind CSS 4
- **UI Components:** Radix UI (Dialog, Select, Checkbox, Tabs, AlertDialog, Label, Slot, Toast) + shadcn/ui
- **Backend:** Next.js API Routes (App Router) + Middleware JWT
- **Base de datos:** Supabase (PostgreSQL auto-hospedado)
- **Autenticacion:** Custom JWT (jose) + bcryptjs (NO usa Supabase Auth)
- **Realtime:** Supabase Realtime (postgres_changes)
- **WhatsApp:** Servidor Express separado con @whiskeysockets/baileys + multer (media)
- **Email:** Nodemailer via SMTP Hostinger (notificaciones@iglesiaregalodedios.com)
- **Push Notifications:** web-push (VAPID)
- **PWA:** next-pwa con service worker personalizado
- **Charts:** Recharts
- **PDF:** pdf-lib (certificados y documentos)
- **Imagenes:** ImageMagick (convert) para PDF->PNG en servidor
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
4. **WhatsApp** — Servidor Baileys separado (texto, imagenes, audio)

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
