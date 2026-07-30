# Configuración del módulo WhatsApp / Email

Guía para dejar operativo el módulo **WhatsApp / Email** (`/dashboard/comunicaciones`).

El código ya está desplegado y la base de datos ya tiene las tablas. Lo que falta es
conectar las credenciales y aprobar las plantillas en Meta.

**Orden recomendado:** Parte 1 → 2 → 3 → 5 (WhatsApp) y luego 6 → 7 (Email).
La Parte 4 (plantillas) tarda horas por la aprobación de Meta, así que conviene
lanzarla en cuanto termines la Parte 2.

---

## Índice

1. [Antes de empezar](#1-antes-de-empezar)
2. [Obtener las credenciales en Meta](#2-obtener-las-credenciales-en-meta)
3. [Registrar las credenciales en el panel](#3-registrar-las-credenciales-en-el-panel)
4. [Crear las plantillas de mensaje](#4-crear-las-plantillas-de-mensaje)
5. [Vincular las plantillas a los casos de uso](#5-vincular-las-plantillas-a-los-casos-de-uso)
6. [Configurar el correo (SMTP + IMAP)](#6-configurar-el-correo-smtp--imap)
7. [Programar la sincronización de correo](#7-programar-la-sincronización-de-correo)
8. [Limpieza del servidor](#8-limpieza-del-servidor)
9. [Comprobación final](#9-comprobación-final)
10. [Problemas frecuentes](#10-problemas-frecuentes)

---

## 1. Antes de empezar

### Qué necesitas

- Una cuenta en [Meta for Developers](https://developers.facebook.com/).
- Un **Business Manager** verificado (si no está verificado, el límite es de 250
  mensajes por día).
- Un **número de teléfono** que no esté registrado en la app de WhatsApp ni en
  WhatsApp Business.

### Decisión sobre el número — leer con atención

Un número registrado en la Cloud API **solo se puede operar por API**. Deja de
funcionar en la aplicación de WhatsApp del teléfono, y volver atrás requiere un
trámite de desregistro.

- **Si vas a usar el número actual** (el que estaba en WhatsApp Web): primero
  ciérralo desde el teléfono en *Dispositivos vinculados*, y luego dalo de baja
  de WhatsApp Business antes de registrarlo en Meta.
- **Si vas a usar un número nuevo**: mucho más seguro. Puedes hacer todas las
  pruebas sin tocar el número que la iglesia usa a diario.

> Meta da un **número de prueba gratuito** que sirve para validar toda la
> integración antes de decidir. Solo permite enviar a 5 destinatarios que
> registres a mano, pero es suficiente para comprobar que el módulo funciona.

### Qué cambia respecto a antes

El sistema ya no usa WhatsApp Web. La API oficial **no permite escribir texto
libre** a alguien que no te haya escrito en las últimas 24 horas: para eso
exige una plantilla aprobada por Meta.

Esto significa que **los mensajes automáticos (cumpleaños, recordatorios de
servicio, citaciones, avisos de pago) no saldrán hasta que las plantillas de la
Parte 4 estén aprobadas y vinculadas**. Mientras no lo estén, el sistema los
registra como fallidos en la bandeja, con el motivo explicado.

---

## 2. Obtener las credenciales en Meta

Necesitas cinco datos. Anótalos todos antes de pasar a la Parte 3.

### 2.1 Crear la aplicación

1. Entra en <https://developers.facebook.com/apps> → **Crear aplicación**.
2. Tipo de aplicación: **Empresa**.
3. En el panel de la app, busca **WhatsApp** y pulsa **Configurar**.
4. Asocia la app a tu Business Manager.

### 2.2 Phone Number ID y WABA ID

En **WhatsApp → Configuración de la API**:

- **Identificador del número de teléfono** → este es el `Phone Number ID`.
- **Identificador de la cuenta de WhatsApp Business** → este es el `WABA ID`.

> No confundas el Phone Number ID con el número de teléfono. Es un número largo
> de unos 15 dígitos.

### 2.3 Token de acceso permanente

El token que aparece por defecto en esa pantalla **caduca en 24 horas**. No lo
uses. Hay que crear uno permanente:

1. Ve a <https://business.facebook.com/settings/system-users>.
2. **Agregar** → nombre, por ejemplo `sistema-iglesia` → rol **Administrador**.
3. Con el usuario del sistema seleccionado: **Agregar activos** → pestaña
   **Aplicaciones** → selecciona tu app → activa **Control total**.
4. Repite con **Agregar activos** → **Cuentas de WhatsApp** → tu WABA →
   **Control total**.
5. Pulsa **Generar nuevo token**:
   - Aplicación: la tuya.
   - Caducidad: **Nunca**.
   - Permisos: marca `whatsapp_business_messaging` y
     `whatsapp_business_management`.
6. **Copia el token ahora**. No se puede volver a ver.

### 2.4 App Secret

En el panel de la app: **Configuración de la aplicación → Básica → Clave secreta
de la aplicación** → *Mostrar*.

Sirve para verificar que los eventos del webhook vienen realmente de Meta. Sin
él el sistema los acepta, pero los marca como "sin verificar".

### 2.5 Verify Token

Este te lo inventas tú. Es una cadena cualquiera que se usa una sola vez, cuando
Meta valida la URL del webhook. Genera algo largo y aleatorio, por ejemplo:

```
irdd-webhook-7f3a91c48be25d06
```

### Resumen de lo que debes tener

| Dato | Dónde se obtiene |
|---|---|
| Phone Number ID | WhatsApp → Configuración de la API |
| WABA ID | WhatsApp → Configuración de la API |
| Token de acceso permanente | Business Settings → Usuarios del sistema |
| App Secret | Configuración de la aplicación → Básica |
| Verify Token | Lo inventas tú |

---

## 3. Registrar las credenciales en el panel

### 3.1 Guardar los datos

1. Entra al panel → **Administración → WhatsApp / Email → WhatsApp →
   Configuración**.
2. Rellena los cinco campos de la Parte 2.
3. Marca **Activar el canal**. Sin esta casilla no se envía ningún mensaje.
4. Pulsa **Guardar y validar con Meta**.

Si todo está bien verás un aviso verde y arriba aparecerá *Canal operativo* con
el número, el nombre verificado y la calidad. Si algo falla, el mensaje de error
te dice exactamente qué corregir.

> Los secretos no se devuelven nunca al navegador. Cuando vuelvas a esta
> pantalla verás la etiqueta *Guardado* y los campos vacíos: déjalos vacíos si
> no quieres cambiarlos.

### 3.2 Registrar el webhook

Este paso es el que hace que el módulo sea un CRM y no solo un emisor. Sin
webhook no hay estados de entrega, ni mensajes entrantes, ni bandeja, ni
ventana de 24 horas.

1. En la misma pantalla, sección **Webhook**, copia la URL con el botón de
   copiar. Debería ser:

   ```
   https://panel.iglesiaregalodedios.com/api/whatsapp/webhook
   ```

2. En Meta: **WhatsApp → Configuración → Webhooks → Editar**.
3. Pega la URL en *URL de devolución de llamada*.
4. En *Verificar token* pega el mismo Verify Token que guardaste en el panel.
5. Pulsa **Verificar y guardar**. Meta hará una petición de comprobación; si el
   token coincide, la acepta.
6. Vuelve a la lista de campos y pulsa **Administrar**. Suscríbete a **messages**
   (marca la casilla *Suscribirse*).

> Si Meta dice que no puede validar la URL: el dominio debe ser HTTPS público y
> con certificado válido. Comprueba también que el Verify Token guardado en el
> panel es idéntico al que escribes en Meta.

### 3.3 Comprobar que llegan los eventos

1. Escribe un WhatsApp **al número de la iglesia** desde tu teléfono personal.
2. En el panel, sección **Bandeja**: debería aparecer la conversación en unos
   segundos, con la etiqueta verde de ventana abierta.
3. Responde desde el panel. El mensaje debe salir y mostrar los checks de
   entregado.
4. En **Configuración → Últimos eventos del webhook** deberías ver los eventos
   con la firma marcada como *Válida*.

Si esto funciona, la integración está correcta. Lo que queda es habilitar los
mensajes automáticos.

---

## 4. Crear las plantillas de mensaje

Las plantillas se crean en Meta y las aprueba Meta (suele tardar entre unos
minutos y 24 horas). Son necesarias para contactar a alguien que no te ha
escrito en las últimas 24 horas.

**Dónde:** <https://business.facebook.com/wa/manage/message-templates/> →
**Crear plantilla**.

### Reglas que Meta aplica

- Idioma: **Español** (código `es`).
- Las variables son `{{1}}`, `{{2}}`, … en orden y sin saltos.
- El cuerpo **no puede empezar ni terminar** con una variable.
- **No puede haber dos variables seguidas** sin texto en medio.
- Categoría: usa **Utilidad** para avisos operativos y **Marketing** para
  felicitaciones. Marketing tiene más restricciones y coste mayor.
- Nada de lenguaje promocional agresivo ni enlaces acortados: es motivo de
  rechazo.

> El sistema sustituye automáticamente por `—` cualquier variable que llegue
> vacía, porque Meta rechaza los parámetros vacíos. No hace falta que te
> preocupes por los campos opcionales.

A continuación tienes las 12 plantillas listas para copiar y pegar. El nombre
debe escribirse exactamente como aparece (minúsculas y guiones bajos).

---

### 4.1 `asignacion_servicio` — Utilidad

```
📋 *Nuevo servicio asignado*

Hola {{1}}, se te ha asignado un servicio en el cronograma.

📅 Fecha: {{2}}
📍 Asignación: {{3}}
🕐 Hora de entrada: {{4}}
🏛️ Módulo: {{5}}
⛪ Ministerio: {{6}}

Por favor ingresa a la aplicación y confirma que recibiste esta notificación.
```

Variables: `1` nombre · `2` fecha · `3` asignación · `4` hora · `5` módulo · `6` ministerio

---

### 4.2 `recordatorio_5dias` — Utilidad

```
⏰ *Recordatorio de servicio*

Hola {{1}}, te recordamos que en 5 días tienes un servicio asignado.

📅 Fecha: {{2}}
📍 Asignación: {{3}}
🕐 Hora de entrada: {{4}}
🏛️ Módulo: {{5}}
⛪ Ministerio: {{6}}

Ingresa a la aplicación para confirmar tu asistencia.
```

Variables: iguales a 4.1

---

### 4.3 `recordatorio_manana` — Utilidad

```
🚨 *¡Mañana tienes servicio!*

Hola {{1}}, mañana es tu día de servicio. No olvides llegar puntualmente.

📅 Fecha: {{2}}
📍 Asignación: {{3}}
🕐 Hora de entrada: {{4}}
🏛️ Módulo: {{5}}
⛪ Ministerio: {{6}}

Ingresa a la aplicación para confirmar tu asistencia.
```

Variables: iguales a 4.1

---

### 4.4 `felicitacion_cumpleanos` — Marketing

**Importante:** en el paso de contenido, en *Encabezado* elige **Medios →
Imagen**. Meta te pedirá subir una imagen de muestra; sube cualquiera. En los
envíos reales el sistema adjunta la imagen personalizada con el nombre de cada
cumpleañero.

```
🎉🎂 *¡Feliz cumpleaños, {{1}}!*

En este día damos gracias a Dios por tu vida y por el privilegio de celebrar {{2}} años de bendiciones.

Oramos para que el Señor continúe fortaleciéndote, llenándote de sabiduría, salud, paz y gozo.

_"Este es el día que hizo el Señor; nos gozaremos y alegraremos en él."_ (Salmo 118:24)

Con cariño, *Iglesia Regalo de Dios* ❤️🙏
```

Variables: `1` nombre · `2` edad

---

### 4.5 `citacion_ministerio` — Utilidad

```
📩 *{{1}}*

Hola {{2}}, has recibido un mensaje de {{3}}.

📝 Detalle: {{4}}
📅 Fecha: {{5}}

Ingresa a la aplicación para ver todos los detalles.
```

Variables: `1` asunto · `2` destinatario · `3` remitente · `4` detalle · `5` fecha

---

### 4.6 `aviso_pago` — Utilidad

```
💰 *Aviso de pago*

Hola {{1}}, se ha registrado un pago a tu nombre.

📝 Concepto: {{2}}
💵 Valor: {{3}}
🏦 Método: {{4}}

Queda registrado en el sistema. ¡Dios te bendiga!
```

Variables: `1` nombre · `2` concepto · `3` valor · `4` método

---

### 4.7 `alerta_atraso_servidor` — Utilidad

```
⚠️ *Alerta de atraso*

Hola {{1}}, te informamos que {{2}} fue marcado como atrasado en {{3}} el día {{4}}.

Ingresa al sistema para gestionar la situación.
```

Variables: `1` líder · `2` servidor · `3` módulo · `4` fecha

---

### 4.8 `alerta_sistema` — Utilidad

```
🔧 *Alerta técnica del sistema*

Se detectó un error en el sistema administrativo.

📍 Contexto: {{1}}
❌ Error: {{2}}
🕐 Fecha: {{3}}

Revisa el panel para más detalles.
```

Variables: `1` contexto · `2` error · `3` fecha

---

### 4.9 `resumen_admin` — Utilidad

```
📋 *Resumen del día*

{{1}}

Ingresa al panel para ver el detalle completo.
```

Variables: `1` resumen

---

### 4.10 `aviso_requerimiento` — Utilidad

```
📋 *Requerimiento de bienes y servicios*

Hola {{1}}, hay una novedad en un requerimiento de {{2}}.

📝 Detalle: {{3}}

Ingresa al sistema para revisarlo.
```

Variables: `1` destinatario · `2` solicitante · `3` detalle

---

### 4.11 `aviso_ayuda_social` — Utilidad

```
🤝 *Redil — Ayuda social*

Hola {{1}}, tienes una novedad en tu solicitud de ayuda social.

📝 Detalle: {{2}}

Ingresa al sistema para más información.
```

Variables: `1` destinatario · `2` detalle

---

### 4.12 `aviso_herederos` — Utilidad

```
👶 *Herederos del Reino*

Le informamos sobre {{1}}.

📍 Estado: {{2}}
🏫 Salón: {{3}}

Ingresa a la aplicación para más detalles.
```

Variables: `1` niño · `2` estado · `3` salón

---

### Prioridad si quieres empezar con pocas

Si no quieres crear las 12 de golpe, este es el orden por impacto:

1. `recordatorio_manana` y `recordatorio_5dias` — se usan cada día.
2. `asignacion_servicio` — cada vez que se arma un cronograma.
3. `felicitacion_cumpleanos` — a diario si hay cumpleañeros.
4. `citacion_ministerio` — envíos a ministerios.
5. El resto según los uses.

---

## 5. Vincular las plantillas a los casos de uso

Aprobar la plantilla en Meta no basta: hay que decirle al sistema cuál usar en
cada situación.

1. Panel → **WhatsApp / Email → WhatsApp → Plantillas**.
2. Pulsa **Sincronizar con Meta**. Aparecerán las plantillas con su estado.
3. En cada plantilla **aprobada**, pulsa el botón de vincular (icono de cadena):
   - **Caso de uso del sistema**: elige el que corresponda.
   - **Mapeo de variables**: indica qué dato va en cada `{{n}}`, siguiendo la
     lista de variables de la Parte 4.
4. Guarda.

El aviso ámbar de la parte superior te dice cuántos casos de uso siguen sin
plantilla. Cuando desaparezca, todos los envíos automáticos están cubiertos.

> Las plantillas rechazadas o pendientes no se pueden vincular. El estado se
> actualiza solo cuando Meta avisa por el webhook.

### Cómo probar que funciona

La forma limpia de comprobar una plantilla es enviarla a un número que **no**
te haya escrito en las últimas 24 horas:

1. **WhatsApp → Enviar → Individual**.
2. Escribe el número, marca **Enviar una plantilla aprobada**, elige la
   plantilla y rellena las variables.
3. Envía y comprueba que llega.

---

## 6. Configurar el correo (SMTP + IMAP)

Ir a **WhatsApp / Email → Email → Configuración**.

### 6.1 Salida (SMTP)

El envío ya funciona porque las credenciales están en las variables de entorno
del servidor. Aun así conviene guardarlas en el panel para poder cambiarlas sin
tocar el servidor:

| Campo | Valor |
|---|---|
| Servidor | `smtp.hostinger.com` |
| Puerto | `465` |
| Conexión segura | Activada |
| Usuario | `notificaciones@iglesiaregalodedios.com` |
| Contraseña | la del buzón |
| Nombre del remitente | `Iglesia Regalo de Dios` |
| Correo del remitente | `notificaciones@iglesiaregalodedios.com` |

Pulsa **Probar conexión SMTP** para confirmar.

### 6.2 Entrada (IMAP) — pendiente de configurar

Esto es lo que permite **ver en la bandeja los correos que llegan**. Todavía no
está configurado.

| Campo | Valor |
|---|---|
| Servidor | `imap.hostinger.com` |
| Puerto | `993` |
| Conexión segura | Activada |
| Usuario | `notificaciones@iglesiaregalodedios.com` |
| Contraseña | la misma del buzón |
| Carpetas a sincronizar | `INBOX` |
| Máximo por sincronización | `100` |
| Activar sincronización automática | Activada |

1. Pulsa **Probar conexión IMAP**. Si funciona, te lista las carpetas reales del
   buzón y puedes añadirlas con un clic (por ejemplo `INBOX.Sent`).
2. **Guardar configuración**.
3. Pulsa **Sincronizar** arriba a la derecha para la primera descarga.

> La primera vez solo baja los correos más recientes (según el máximo que
> pongas), no todo el historial. A partir de ahí solo descarga los nuevos.

---

## 7. Programar la sincronización de correo

Para que los correos entrantes aparezcan solos, hay que llamar al endpoint de
sincronización cada pocos minutos. Los cron de este sistema viven en el
**crontab del VPS**, no en el repositorio.

Conéctate por SSH y ejecuta `crontab -e`. Añade:

```cron
# Sincronizar correo entrante cada 5 minutos
*/5 * * * * curl -s -X POST https://panel.iglesiaregalodedios.com/api/email/sync -H "X-Internal-Secret: TU_SECRETO" > /dev/null 2>&1
```

Sustituye `TU_SECRETO` por el valor de `INTERNAL_API_SECRET`. Si esa variable no
existe en el `.env`, el sistema usa `CRON_SECRET`, y si tampoco existe, un valor
por defecto que **deberías cambiar**:

```bash
# En el .env del servidor
INTERNAL_API_SECRET=una-cadena-larga-y-aleatoria
CRON_SECRET=otra-cadena-larga-y-aleatoria
```

Después de tocar el `.env`, recarga la aplicación: `pm2 reload iglesia`.

> Comprueba que los cron de `cron-reminders` y `cron-cumpleanos` siguen en el
> crontab. Esos no han cambiado.

---

## 8. Limpieza del servidor

El servidor de WhatsApp Web (Baileys) ya no existe en el código. En el VPS
quedan restos que conviene quitar.

### 8.1 Proceso de PM2

```bash
pm2 list
```

Si aparece un proceso del antiguo servidor de WhatsApp (algo como
`whatsapp-server` o `whatsapp`), elimínalo:

```bash
pm2 delete whatsapp-server
pm2 save
```

### 8.2 Carpeta de sesión

La carpeta `whatsapp-server/` desaparece con el próximo despliegue. Si quedó la
carpeta `auth_info` con las credenciales de la sesión de WhatsApp Web, bórrala:
ya no sirve y contiene datos de sesión.

```bash
rm -rf /var/www/iglesiamzi/whatsapp-server
```

### 8.3 Variable obsoleta

En el `.env` del servidor, `WA_SERVER_URL` ya no se usa. Puedes borrar esa línea.

### 8.4 Desplegar

```bash
cd /var/www/iglesiamzi
git pull
npm ci
npm run build
pm2 reload iglesia
```

O simplemente haz *push* a `main`: el workflow de GitHub Actions hace esto solo.

> El despliegue instala dos dependencias nuevas (`imapflow` y `mailparser`), por
> eso hace falta `npm ci` y no solo un reload.

---

## 9. Comprobación final

Recorre esta lista. Cada punto se verifica desde el propio panel.

### WhatsApp

- [ ] La cabecera muestra **Canal operativo** en verde, con número y calidad.
- [ ] En Meta, el webhook está verificado y suscrito a `messages`.
- [ ] Escribo al número desde mi teléfono → aparece en **Bandeja** en segundos.
- [ ] Respondo desde la bandeja → llega y muestra los checks de entrega.
- [ ] En **Configuración → Últimos eventos**, la firma sale como *Válida*.
- [ ] En **Plantillas** ya no aparece el aviso ámbar de casos sin cubrir.
- [ ] Envío una plantilla a un número "frío" y llega.
- [ ] En **Contactos**, uso *Importar usuarios* y aparecen los servidores.

### Email

- [ ] **Probar conexión SMTP** da correcto.
- [ ] **Probar conexión IMAP** da correcto y lista las carpetas.
- [ ] **Sincronizar** trae los correos y se ven en la bandeja.
- [ ] Envío un correo de prueba desde **Redactar** y aparece registrado.
- [ ] En **Plantillas**, la previsualización de `asignacion` se ve bien.

### Que nada se rompió

- [ ] Creo una asignación en un cronograma → llega el correo y el WhatsApp.
- [ ] Un cumpleañero del día recibe la felicitación con su imagen.
- [ ] Un envío desde *Mensajes y Citaciones* llega por ambos canales.
- [ ] Todo lo anterior queda registrado en las bandejas correspondientes.

---

## 10. Problemas frecuentes

### El canal aparece en rojo

Lee el mensaje de error, que viene traducido. Los casos habituales:

| Mensaje | Causa y solución |
|---|---|
| El token de acceso expiró o es inválido | Usaste el token temporal de 24 h. Genera uno permanente (Parte 2.3). |
| El phone_number_id no existe | Copiaste el número de teléfono en lugar del identificador. |
| La aplicación no tiene los permisos necesarios | Faltan `whatsapp_business_messaging` o `whatsapp_business_management` en el token. |
| El número no está registrado en la Cloud API | Falta completar el registro del número en Meta. |

### Los mensajes automáticos fallan con "se requiere una plantilla aprobada"

Es lo esperado si la plantilla de ese caso de uso no está creada, aprobada o
vinculada. Revisa la Parte 5. El aviso ámbar te dice qué falta.

### Un envío falla con "la cantidad de parámetros no coincide"

El mapeo de variables no cuadra con la plantilla. Abre la plantilla en el panel,
comprueba cuántas `{{n}}` tiene el texto y asigna un campo a cada una.

### El webhook no llega a validarse

- El dominio debe ser HTTPS público con certificado válido.
- El Verify Token del panel y el de Meta deben ser idénticos.
- Comprueba que la aplicación responde:
  `curl https://panel.iglesiaregalodedios.com/api/whatsapp/webhook`
  Debe contestar `403` o `503`, no `404`. Si da `404`, el despliegue no incluye
  la ruta nueva.

### Los eventos aparecen como "Sin verificar"

Falta el App Secret (Parte 2.4). Los eventos se procesan igual, pero sin
comprobar que vienen de Meta. Conviene completarlo.

### IMAP da error de autenticación

- En Hostinger la contraseña de IMAP es la del buzón, no la del panel de
  hosting.
- Confirma el servidor y el puerto: `imap.hostinger.com:993` con SSL.
- Si el buzón tiene verificación en dos pasos, necesitas una contraseña de
  aplicación.

### El audio de cumpleaños no llega

Es una limitación de la API oficial: el audio no se puede enviar por plantilla.
Solo sale si la persona escribió al número en las últimas 24 horas. La imagen y
el texto sí llegan siempre. Queda registrado como omitido, no como error.

### Un contacto no recibe nada

Mira su ficha en **Contactos**. Si está **Bloqueado** o marcado como
**Opt-out**, el sistema no le envía nada a propósito y lo registra como omitido.

---

## Referencias

- [Documentación de WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Códigos de error](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
- [Guía de plantillas](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines)
- [Ventana de servicio de 24 horas](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#customer-service-windows)
- Esquema de la base de datos: `sql/comunicaciones.sql`
