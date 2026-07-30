# Guía de Replicación — Sistema de Gestión de Iglesias

Esta guía explica, paso a paso, cómo copiar este proyecto y ponerlo en marcha
para **otra iglesia**, personalizando el nombre, el logo y toda la identidad
sin necesidad de tocar el código.

> Público objetivo: una persona con conocimientos técnicos básicos (terminal,
> Git, Node.js) que instalará el sistema para su congregación.

## Índice

1. [Resumen de la arquitectura](#1-resumen-de-la-arquitectura)
2. [Requisitos previos](#2-requisitos-previos)
3. [Clonar el proyecto](#3-clonar-el-proyecto)
4. [Crear el proyecto en Supabase](#4-crear-el-proyecto-en-supabase)
5. [Configurar las variables de entorno](#5-configurar-las-variables-de-entorno)
6. [Personalizar la marca de la iglesia](#6-personalizar-la-marca-de-la-iglesia)
7. [Cargar la base de datos (SQL)](#7-cargar-la-base-de-datos-sql)
8. [Configurar Storage (archivos)](#8-configurar-storage-archivos)
9. [Crear el primer usuario administrador](#9-crear-el-primer-usuario-administrador)
10. [Levantar en desarrollo](#10-levantar-en-desarrollo)
11. [Desplegar en producción](#11-desplegar-en-producción)
12. [Integraciones opcionales (WhatsApp / correo / push)](#12-integraciones-opcionales)
13. [Tareas programadas (cron)](#13-tareas-programadas-cron)
14. [Lista de verificación final](#14-lista-de-verificación-final)

---

## 1. Resumen de la arquitectura

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript.
- **Interfaz:** Tailwind CSS 4, Radix UI, Lucide, Sonner, Recharts.
- **Base de datos:** Supabase / PostgreSQL (con Realtime y Storage).
- **Autenticación:** propia, con JWT (`jose`) y contraseñas `bcryptjs`. **No usa
  Supabase Auth.**
- **PWA:** `next-pwa` + service worker en `worker/`.
- **Integraciones:** WhatsApp Cloud API (Meta), correo SMTP/IMAP, Web Push.

**Flujo de datos (importante para la seguridad):**

```
Navegador
  └─ lib/secure-db.ts  (serializa la consulta)
       └─ POST /api/db  (valida el JWT de sesión)
            └─ lib/module-table-map.ts  (TABLE_ACCESS_MAP: ¿puede esta tabla?)
                 └─ Supabase con SERVICE KEY  (solo tras autorizar)
```

El cliente **nunca** habla directo con la base para operaciones sensibles: pasa
por `/api/db`, que valida permisos por módulo antes de tocar Supabase con la
clave de servicio. Cualquier tabla que no esté en `TABLE_ACCESS_MAP` queda
bloqueada por defecto.

Consulta también:
- Identidad/marca: [`lib/branding.ts`](../lib/branding.ts)
- Mapa de permisos por tabla: [`lib/module-table-map.ts`](../lib/module-table-map.ts)
- Esquema de la base de datos: [`ESQUEMA-BASE-DE-DATOS.md`](ESQUEMA-BASE-DE-DATOS.md)
- WhatsApp y correo: [`CONFIGURACION-WHATSAPP-EMAIL.md`](CONFIGURACION-WHATSAPP-EMAIL.md)

---

## 2. Requisitos previos

| Herramienta | Versión recomendada | Para qué |
| --- | --- | --- |
| Node.js | 20 LTS | ejecutar y compilar la app |
| npm | incluido con Node | dependencias |
| Git | cualquiera reciente | clonar el repositorio |
| Cuenta Supabase | — | base de datos, Realtime y Storage |
| (Producción) VPS Linux + PM2 + Nginx/Caddy + dominio con HTTPS | — | desplegar |
| (Opcional) Cuenta Meta for Developers | — | WhatsApp Cloud API |
| (Opcional) Buzón SMTP/IMAP | — | correo saliente y entrante |

---

## 3. Clonar el proyecto

```bash
git clone <URL-DEL-REPOSITORIO> mi-iglesia
cd mi-iglesia
npm ci
```

`npm ci` instala exactamente las versiones del `package-lock.json`.

---

## 4. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto nuevo
   (o usa una instancia self-hosted).
2. Anota estos datos desde **Project Settings → API**:
   - **Project URL** → será `SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_URL`.
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **service_role key** → `SUPABASE_SERVICE_KEY` (¡secreta!).
3. Abre el **SQL Editor**: allí cargarás el esquema (paso 7).

> **Seguridad:** la `service_role` key da acceso total. Nunca la pongas en
> variables `NEXT_PUBLIC_` ni la subas a Git.

---

## 5. Configurar las variables de entorno

Copia la plantilla y edítala:

```bash
cp .env.example .env.local
```

Completa como mínimo estos bloques (ver [`.env.example`](../.env.example) para
la lista completa y comentada):

```dotenv
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=<service_role>
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>

# Sesión y URL pública
JWT_SECRET=<cadena larga aleatoria>
NEXT_PUBLIC_SITE_URL=https://panel.tuiglesia.com

# Secretos internos
INTERNAL_API_SECRET=<aleatorio>
CRON_SECRET=<aleatorio>
```

Genera secretos fuertes:

```bash
# JWT_SECRET / INTERNAL_API_SECRET / CRON_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Claves Web Push (VAPID)
npx web-push generate-vapid-keys
```

> Sin `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` (servidor) ni
> `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (cliente) la app
> lanzará un error explícito al arrancar. Es intencional: evita usar
> credenciales por defecto de otra iglesia.

---

## 6. Personalizar la marca de la iglesia

Toda la identidad visible está centralizada en
[`lib/branding.ts`](../lib/branding.ts) y se controla con variables de entorno
`NEXT_PUBLIC_CHURCH_*`. **No necesitas editar código.**

Añade a tu `.env.local`:

```dotenv
NEXT_PUBLIC_CHURCH_NAME=Iglesia Nuevo Amanecer
NEXT_PUBLIC_CHURCH_SHORT_NAME=Nuevo Amanecer
NEXT_PUBLIC_CHURCH_INITIALS=INA
NEXT_PUBLIC_CHURCH_APP_TITLE=Nuevo Amanecer
NEXT_PUBLIC_CHURCH_APP_DESCRIPTION=Sistema administrativo de la iglesia
NEXT_PUBLIC_CHURCH_THEME_COLOR=#2563eb
NEXT_PUBLIC_CHURCH_DOMAIN=panel.tuiglesia.com
NEXT_PUBLIC_CHURCH_CONTACT_EMAIL=notificaciones@tuiglesia.com
NEXT_PUBLIC_CHURCH_SIGNATURE_EMOJIS=❤️🙏
```

Esto actualiza automáticamente:
- El título de la pestaña y los metadatos (`app/layout.tsx`).
- El manifiesto PWA (`app/manifest.ts` → `/manifest.webmanifest`).
- El pie y los asuntos de los correos (`lib/mod/email-templates.ts`).
- Los mensajes de cumpleaños (`app/api/cron-cumpleanos`).
- Las notificaciones de nómina/transporte (`flujo-pago`).
- Las etiquetas visibles con siglas (resumen mensual, pastoral).

### Cambiar el logo y los íconos

Reemplaza estos archivos en `public/` conservando el mismo nombre (o cambia la
ruta con las variables `NEXT_PUBLIC_CHURCH_LOGO_URL`, `..._ICON_192`,
`..._ICON_512`):

| Archivo | Uso | Tamaño sugerido |
| --- | --- | --- |
| `public/logo.png` | logo del encabezado y favicon | cuadrado, ≥256px |
| `public/icon-192.png` | ícono PWA | 192×192 |
| `public/icon-512.png` | ícono PWA | 512×512 |

Las imágenes de los grupos de módulos del dashboard (por ejemplo
`Administracion.jpg`, `Alabanza.jpeg`, etc.) también viven en `public/` y pueden
sustituirse. La imagen de cada grupo se guarda además en la columna `image` de
la tabla `module_groups`.

### Textos que se editan en la base de datos (no por env)

Algunos textos son **datos semilla** de la BD y se editan una vez cargada:
- `email_config.from_name` (nombre del remitente) — edítalo desde
  **Comunicaciones → Correo** o con SQL.
- `wa_quick_replies` (respuestas rápidas de WhatsApp) — edítalas desde el módulo
  de Comunicaciones.

### Etiquetas de formularios de censo

Los formularios de censo muestran preguntas como *"¿Se bautizó en la IRDD?"*.
El texto usa las siglas de la iglesia, pero las **columnas** de la base
(`bautizo_irdd`, `discipulado_irdd`, `matrimonio_irdd`) forman parte del esquema
y **no deben renombrarse**. Si quieres cambiar el texto visible, edítalo en los
componentes de `app/dashboard/censo*/components/` sin tocar los nombres de campo.

---

## 7. Cargar la base de datos (SQL)

> ⚠️ **Importante:** este repositorio ahora incluye `sql/schema.sql`, un esquema
> base consolidado que crea las tablas fundamentales y de dominio. El resto de
> archivos siguen siendo migraciones **incrementales**. Ejecuta `schema.sql`
> **primero** y luego las demás en el orden indicado. Revisa cada archivo antes
> de ejecutarlo y hazlo en un entorno de prueba primero.

Orden sugerido en el **SQL Editor** de Supabase:

1. **`sql/schema.sql`** — esquema base: usuarios, módulos, permisos, meses,
   finanzas, censo, asistencia, cronogramas, formación, inventario, etc.
   (Incluye una semilla mínima del grupo *Administración* y *Redil* para que las
   siguientes migraciones no fallen.)
2. `sql/comunicaciones.sql` — WhatsApp, correo, campañas y plantillas.
3. `sql/eventos_tabs.sql` — estructura de eventos.
4. `sql/encuentro_participantes.sql` — participantes de encuentros.
5. `docs/caja-chica-migration.sql`
6. `docs/manual-entries-migration.sql` — `bautizos_manual`, `matrimonios_manual`.
7. `docs/redil-ayuda-social-migration.sql` — incluye el bucket `redil-archivos`.
8. `supabase-proyecto-mario.sql` — Proyecto Mario.
9. `migracion-belleza-integral.sql` — módulo de belleza integral.
10. `sql/resumen-mensual-migration.sql` — ajustes de nombres/orden de módulos.
11. `docs/RLS-POLICIES.sql` — políticas de acceso a nivel de fila.

> **Sobre `schema.sql`:** las columnas se reconstruyeron a partir del uso real
> en el código. Las tablas marcadas `[INFERIDO]` (`service_notifications_log`,
> `inventory_movements`) no tienen uso de columnas observable y traen una
> estructura mínima razonable; revísalas si vas a usar esos módulos a fondo.
> El catálogo completo de módulos (`system_modules`) y grupos se administra
> desde el panel de Administración.

Antes de cada migración:
1. Haz un **respaldo** de la base.
2. Lee qué tablas/políticas crea, altera o elimina.
3. Verifica el orden de dependencias.
4. Confirma que las tablas queden reflejadas en `lib/module-table-map.ts`.

---

## 8. Configurar Storage (archivos)

El sistema guarda adjuntos (censo de niños/jóvenes, ayuda social, correo, etc.)
en Supabase Storage.

1. En Supabase → **Storage**, crea el bucket `redil-archivos`.
2. Ajusta sus políticas de acceso según los módulos que manejarán adjuntos.
3. Si algún módulo usa buckets adicionales, créalos igual y revísalos.

---

## 9. Crear el primer usuario administrador

La app usa autenticación propia: las contraseñas se guardan con hash `bcrypt` en
la columna `password_hash` de la tabla `users`.

1. Genera el hash de una contraseña:

   ```bash
   node -e "console.log(require('bcryptjs').hashSync('TU_CONTRASEÑA', 10))"
   ```

2. Inserta el usuario en Supabase (ajusta columnas al esquema real de `users`):

   ```sql
   insert into users (username, password_hash, display_name, is_active)
   values ('admin', '<hash-generado>', 'Administrador', true);
   ```

3. Asigna permisos de administrador en `user_permissions` para los módulos
   necesarios (`can_view`, `can_edit`, `can_admin`). Revisa `system_modules`
   para conocer los identificadores de módulo disponibles.

> Consejo: revisa la carpeta `scripts/` por si existen utilidades para crear
> usuarios o permisos.

---

## 10. Levantar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001) e inicia sesión con el
usuario administrador creado. La PWA está **desactivada en desarrollo**
(se habilita en producción).

Comprobaciones útiles:

```bash
npm run lint          # análisis estático
npx tsc --noEmit      # verificación de tipos
npm run build         # compilación de producción
```

---

## 11. Desplegar en producción

El flujo original usa **VPS + PM2 + GitHub Actions por SSH**
(`.github/workflows/deploy.yml`). Resumen:

1. En el servidor: clona el repo (p. ej. en `/var/www/mi-iglesia`), instala
   Node.js y PM2.
2. Crea el `.env` de producción con valores reales (incluyendo la marca).
3. Compila y arranca:

   ```bash
   npm ci
   npm run build
   pm2 start "npm run start" --name iglesia   # primera vez
   ```

   > `npm run start` sirve en el puerto `3712`. El script `npm run deploy`
   > ejecuta `next build && pm2 reload iglesia`, así que el proceso PM2 debe
   > existir previamente con ese nombre (`iglesia`) o cámbialo en `package.json`.

4. Configura un proxy inverso (Nginx/Caddy) con **HTTPS** apuntando al puerto de
   la app y a tu dominio.
5. (Opcional) Ajusta los *secrets* de GitHub Actions para el despliegue
   automático: `HOST`, `USERNAME`, `SSH_KEY`, `PORT`.

> Alternativas: también puedes desplegar en cualquier host que soporte Next.js
> (Vercel, contenedores, etc.). Solo asegúrate de definir las mismas variables
> de entorno y de que las tareas cron se ejecuten en algún lugar (paso 13).

---

## 12. Integraciones opcionales

Estas integraciones no son obligatorias para que el sistema funcione, pero
habilitan comunicaciones. La guía detallada está en
[`CONFIGURACION-WHATSAPP-EMAIL.md`](CONFIGURACION-WHATSAPP-EMAIL.md).

### WhatsApp (Meta Cloud API)
- Webhook público: `https://<TU-DOMINIO>/api/whatsapp/webhook`.
- Requiere HTTPS válido y token de verificación (`CLOUD_WHATSAPP_WEBHOOK_SECRET`).
- Las credenciales de Meta (`phone_number_id`, `waba_id`, `access_token`,
  `app_secret`, etc.) se guardan en la tabla `wa_config` desde el módulo de
  Comunicaciones, **no** en variables de entorno.

### Correo (SMTP/IMAP)
- La configuración se resuelve primero desde la tabla `email_config` y, como
  respaldo, desde las variables `SMTP_*` / `IMAP_*`.
- Los adjuntos se guardan en Supabase Storage.

### Web Push
- Genera las claves con `npx web-push generate-vapid-keys` y colócalas en
  `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
- Copia además la clave pública en `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (debe coincidir
  con `VAPID_PUBLIC_KEY`): es la que usa el navegador para suscribirse.

> **Nota de seguridad:** a partir de esta versión, los endpoints de cron
> (`/api/cron-reminders`, `/api/cron-cumpleanos`) y las llamadas internas
> (`X-Internal-Secret`) **fallan cerrado** si `CRON_SECRET` / `INTERNAL_API_SECRET`
> no están definidos. Ya no existe ningún secreto por defecto en el código.

---

## 13. Tareas programadas (cron)

Estos endpoints deben dispararse desde un programador externo (cron del
servidor, un servicio de cron gestionado, etc.). No están versionados porque los
horarios dependen de cada iglesia.

| Endpoint | Sugerencia | Autenticación |
| --- | --- | --- |
| `POST /api/email/sync` | cada 5 min | cabecera `X-Internal-Secret: <INTERNAL_API_SECRET>` |
| `POST /api/cron-reminders` | según operación | `CRON_SECRET` |
| `POST /api/cron-cumpleanos` | diario (mañana) | `CRON_SECRET` |

Ejemplo de crontab (sincronización de correo cada 5 minutos):

```cron
*/5 * * * * curl -s -X POST https://<TU-DOMINIO>/api/email/sync -H "X-Internal-Secret: <INTERNAL_API_SECRET>" > /dev/null 2>&1
```

---

## 14. Lista de verificación final

- [ ] `npm ci` sin errores.
- [ ] `.env.local` (o `.env`) con Supabase, `JWT_SECRET` y `NEXT_PUBLIC_SITE_URL`.
- [ ] Variables `NEXT_PUBLIC_CHURCH_*` con la identidad de tu iglesia.
- [ ] Logo e íconos reemplazados en `public/`.
- [ ] Esquema SQL cargado y revisado en Supabase.
- [ ] Bucket `redil-archivos` creado con sus políticas.
- [ ] Usuario administrador creado con permisos.
- [ ] `npm run build` compila sin errores.
- [ ] HTTPS y proxy inverso configurados (producción).
- [ ] Tareas cron programadas (si usas correo/recordatorios/cumpleaños).
- [ ] Integraciones de WhatsApp/correo/push configuradas (si aplica).
- [ ] Rotaste todos los secretos: no quedó ninguna credencial de la instalación
      original.

> **Antes de publicar tu repositorio:** asegúrate de que `.env` real, claves y
> tokens no estén en el historial de Git. Si alguno estuvo alguna vez en el
> código o en el historial, **rótalo**.
