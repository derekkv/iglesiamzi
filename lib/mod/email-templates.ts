/**
 * Plantillas de correo por defecto.
 *
 * Son el respaldo del código: si existe una fila activa en email_templates con
 * el mismo slug, esa gana (editable desde el panel). Si no, se usa la de aquí.
 * Así el sistema sigue funcionando con la tabla vacía y se puede restaurar
 * cualquier plantilla a su versión original.
 *
 * Variables con sintaxis {{nombre}} para que el editor del panel funcione igual
 * sobre las versiones de BD.
 */

import { CHURCH } from "@/lib/branding"

export type DefaultTemplateSlug =
  | "asignacion"
  | "alerta2"
  | "alerta1"
  | "cumpleanos"
  | "resumen_cumpleanos"
  | "recuperacion"
  | "citacion"
  | "aviso_pago"
  | "requerimiento"
  | "generico"

export interface DefaultTemplate {
  nombre: string
  asunto: string
  categoria: string
  descripcion: string
  variables: string[]
  build: (data: Record<string, any>) => string
}

const BRAND = {
  azul: "#2563eb",
  ambar: "#d97706",
  rojo: "#dc2626",
  verde: "#059669",
  violeta: "#7c3aed",
  panel: (CHURCH.domain ? `https://${CHURCH.domain}` : (process.env.NEXT_PUBLIC_SITE_URL || "")) + "/dashboard",
}

function esc(value: any): string {
  if (value === undefined || value === null) return ""
  return String(value)
}

/** Envoltorio común: cabecera de color, cuerpo, CTA y pie. */
function shell(opts: {
  color: string
  emoji: string
  titulo: string
  cuerpo: string
  cta?: string
  ctaLabel?: string
  nota?: string
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:${opts.color};padding:32px 40px;text-align:center;">
              <div style="font-size:40px;margin-bottom:12px;">${opts.emoji}</div>
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${opts.titulo}</h1>
              <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${CHURCH.name}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              ${opts.cuerpo}
              ${opts.cta === undefined ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
                <tr>
                  <td align="center">
                    <a href="${BRAND.panel}" style="display:inline-block;background-color:${opts.color};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;">
                      ${opts.ctaLabel || "Abrir la App"}
                    </a>
                  </td>
                </tr>
              </table>` : opts.cta}
              ${opts.nota ? `<p style="color:#6b7280;font-size:13px;text-align:center;margin-top:24px;line-height:1.5;">${opts.nota}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                ${CHURCH.name}<br>
                Este es un correo automático, no responda a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Fila de dato dentro de la tarjeta de detalles. */
function row(label: string, value: any, first = false): string {
  if (value === undefined || value === null || value === "") return ""
  return `<tr>
    <td style="padding:8px 0;${first ? "" : "border-top:1px solid #e5e7eb;"}">
      <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">${label}</span><br>
      <span style="color:#111827;font-size:16px;font-weight:600;">${esc(value)}</span>
    </td>
  </tr>`
}

function card(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:24px;"><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
  </table>`
}

function getModuleLabel(modulo: string): string {
  const labels: Record<string, string> = {
    protocolo: "Protocolo",
    administracion: "Administración",
    discipulado: "Discipulado",
    mdg: "MDG",
  }
  return labels[modulo] || modulo || ""
}

export function formatFechaLarga(fechaStr: string): string {
  if (!fechaStr) return ""
  // Ya viene formateada (contiene letras)
  if (/[a-záéíóú]/i.test(fechaStr) && !/^\d{4}-\d{2}-\d{2}/.test(fechaStr)) return fechaStr
  const date = new Date(fechaStr.slice(0, 10) + "T12:00:00")
  if (Number.isNaN(date.getTime())) return fechaStr
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`
}

// ---------------------------------------------------------------------------
// Plantillas de cronograma
// ---------------------------------------------------------------------------

function servicioBody(intro: string, data: Record<string, any>): string {
  return `<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">${intro}</p>
  ${card(
    row("📅 Fecha", formatFechaLarga(data.fecha), true) +
    row("📍 Asignación", data.asignacion) +
    row("🕐 Hora de entrada", data.horaEntrada) +
    row("🏛️ Módulo", getModuleLabel(data.modulo)) +
    row("⛪ Ministerio", data.ministerio) +
    row("🎯 Evento", data.evento)
  )}`
}

export const DEFAULT_TEMPLATES: Record<DefaultTemplateSlug, DefaultTemplate> = {
  asignacion: {
    nombre: "Asignación de servicio",
    asunto: "📋 Nuevo Servicio Asignado - {{asignacion}}",
    categoria: "Cronograma",
    descripcion: "Se envía cuando se asigna un nuevo servicio en el cronograma.",
    variables: ["userName", "asignacion", "fecha", "horaEntrada", "modulo", "ministerio", "evento"],
    build: (data) =>
      shell({
        color: BRAND.azul,
        emoji: "📋",
        titulo: "Nuevo Servicio Asignado",
        cuerpo: servicioBody(
          `Hola <strong>${esc(data.userName)}</strong>, se te ha asignado un nuevo servicio. Por favor revisa los detalles a continuación:`,
          data
        ),
        ctaLabel: "Abrir la App para Confirmar",
        nota: "Por favor ingresa a la aplicación y confirma que recibiste esta notificación.",
      }),
  },

  alerta2: {
    nombre: "Recordatorio: servicio en 5 días",
    asunto: "⏰ Recordatorio - Tu servicio es en 5 días - {{asignacion}}",
    categoria: "Cronograma",
    descripcion: "Recordatorio automático 5 días antes del servicio.",
    variables: ["userName", "asignacion", "fecha", "horaEntrada", "modulo", "ministerio", "evento"],
    build: (data) =>
      shell({
        color: BRAND.ambar,
        emoji: "⏰",
        titulo: "Recordatorio - Tu servicio es en 5 días",
        cuerpo: servicioBody(
          `Hola <strong>${esc(data.userName)}</strong>, te recordamos que en <strong>5 días</strong> tienes un servicio asignado:`,
          data
        ),
        ctaLabel: "Abrir la App para Confirmar",
        nota: "Por favor ingresa a la aplicación y confirma que recibiste esta notificación.",
      }),
  },

  alerta1: {
    nombre: "Recordatorio: servicio mañana",
    asunto: "🚨 ¡Mañana tienes servicio! - {{asignacion}}",
    categoria: "Cronograma",
    descripcion: "Recordatorio automático el día anterior al servicio.",
    variables: ["userName", "asignacion", "fecha", "horaEntrada", "modulo", "ministerio", "evento"],
    build: (data) =>
      shell({
        color: BRAND.rojo,
        emoji: "🚨",
        titulo: "¡Mañana tienes servicio!",
        cuerpo: servicioBody(
          `Hola <strong>${esc(data.userName)}</strong>, <strong>¡mañana es tu día de servicio!</strong> No olvides llegar puntualmente:`,
          data
        ),
        ctaLabel: "Abrir la App para Confirmar",
        nota: "Por favor ingresa a la aplicación y confirma que recibiste esta notificación.",
      }),
  },

  // -------------------------------------------------------------------------
  cumpleanos: {
    nombre: "Felicitación de cumpleaños",
    asunto: `🎂 ¡Feliz Cumpleaños, {{nombre}}! — ${CHURCH.name}`,
    categoria: "Cumpleaños",
    descripcion:
      "Felicitación individual. Compatible con Outlook (VML). Si se adjunta la imagen generada con cid:cumpleanos-imagen y tieneImagen=true, se muestra inline.",
    variables: ["nombre", "edad", "tieneImagen"],
    build: (data) => {
      const nombre = esc(data.nombre)
      const tieneImagen = data.tieneImagen === true || data.tieneImagen === "true"
      return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <title>Feliz Cumplea&#241;os</title>
</head>
<body style="margin:0; padding:0; background-color:#fff5f7; font-family:Arial, Helvetica, sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fff5f7;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(236,72,153,0.1);">

          <tr>
            <td style="background:linear-gradient(135deg, #ec4899, #f97316); padding:32px 24px; text-align:center;">
              <!--[if mso]>
              <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:100px;">
                <v:fill type="gradient" color="#ec4899" color2="#f97316" angle="135"/>
                <v:textbox inset="0,0,0,0" style="mso-fit-shape-to-text:true">
              <![endif]-->
              <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:bold; font-family:Arial, Helvetica, sans-serif;">&#127874; &#161;Feliz Cumplea&#241;os! &#127881;</h1>
              <p style="color:rgba(255,255,255,0.9); margin:8px 0 0; font-size:18px; font-family:Arial, Helvetica, sans-serif;">${nombre}</p>
              <!--[if mso]></v:textbox></v:rect><![endif]-->
            </td>
          </tr>

          ${tieneImagen ? `<tr>
            <td style="padding:24px 24px 0; text-align:center;">
              <img src="cid:cumpleanos-imagen" alt="Feliz Cumplea&#241;os ${nombre}" width="520" style="display:block; max-width:100%; height:auto; border-radius:8px; margin:0 auto;" />
            </td>
          </tr>` : ""}

          <tr>
            <td style="padding:24px 28px;">
              <p style="font-size:15px; color:#374151; line-height:1.7; margin:0 0 14px; font-family:Arial, Helvetica, sans-serif;">
                Querido/a <strong>${nombre}</strong>,
              </p>
              <p style="font-size:15px; color:#374151; line-height:1.7; margin:0 0 14px; font-family:Arial, Helvetica, sans-serif;">
                En este d&#237;a damos gracias a Dios por tu vida y por el privilegio de celebrar un a&#241;o m&#225;s de las bendiciones que &#201;l te ha concedido.
              </p>
              <p style="font-size:15px; color:#374151; line-height:1.7; margin:0 0 14px; font-family:Arial, Helvetica, sans-serif;">
                Oramos para que el Se&#241;or contin&#250;e fortaleci&#233;ndote, llen&#225;ndote de sabidur&#237;a, salud, paz y gozo. Que Su presencia te acompa&#241;e cada d&#237;a y que este nuevo a&#241;o est&#233; lleno de victorias, crecimiento espiritual y del cumplimiento de los prop&#243;sitos que Dios tiene para tu vida.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#fdf2f8; border-left:4px solid #ec4899; padding:14px 18px; border-radius:0 8px 8px 0;">
                    <p style="font-style:italic; color:#9d174d; margin:0; font-size:14px; line-height:1.6; font-family:Arial, Helvetica, sans-serif;">
                      &ldquo;Este es el d&#237;a que hizo el Se&#241;or; nos gozaremos y alegraremos en &#233;l.&rdquo;
                    </p>
                    <p style="color:#be185d; margin:8px 0 0; font-weight:bold; font-size:13px; font-family:Arial, Helvetica, sans-serif;">&mdash; Salmo 118:24</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 28px;">
              <p style="font-size:15px; color:#374151; line-height:1.7; margin:0 0 14px; font-family:Arial, Helvetica, sans-serif;">
                &#161;Que Dios te bendiga abundantemente! Recibe un fuerte abrazo y nuestros mejores deseos en este d&#237;a tan especial.
              </p>
              <p style="font-size:14px; color:#6b7280; margin:20px 0 0; font-family:Arial, Helvetica, sans-serif;">
                Con cari&#241;o y en el amor de Cristo,<br>
                <strong>${CHURCH.name}</strong> &#10084;&#65039;&#128591;
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#fdf2f8; padding:14px 24px; text-align:center; border-top:1px solid #fce7f3;">
              <p style="color:#9d174d; margin:0; font-size:12px; font-family:Arial, Helvetica, sans-serif;">&#127880; &#161;Que tengas un maravilloso d&#237;a! &#127880;</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
    },
  },

  resumen_cumpleanos: {
    nombre: "Resumen de cumpleaños del día",
    asunto: "🎂 Cumpleaños de hoy ({{fecha}}) — {{total}} persona(s)",
    categoria: "Cumpleaños",
    descripcion: "Resumen diario que reciben los administradores.",
    variables: ["fecha", "total", "lista"],
    build: (data) =>
      shell({
        color: BRAND.violeta,
        emoji: "🎂",
        titulo: "Cumpleaños de hoy",
        cuerpo: `
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hoy <strong>${esc(data.fecha)}</strong> cumplen años <strong>${esc(data.total)}</strong> persona(s):
          </p>
          <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:20px;">
            ${esc(data.lista)}
          </div>`,
      }),
  },

  recuperacion: {
    nombre: "Código de recuperación de contraseña",
    asunto: "Código de recuperación de contraseña — IRDD",
    categoria: "Seguridad",
    descripcion: "Código de 6 dígitos con validez de 15 minutos.",
    variables: ["codigo", "minutos"],
    build: (data) =>
      shell({
        color: BRAND.azul,
        emoji: "🔐",
        titulo: "Recuperación de contraseña",
        cuerpo: `
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Use el siguiente código para restablecer su contraseña:
          </p>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:24px;text-align:center;">
            <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:${BRAND.azul};font-family:monospace;">
              ${esc(data.codigo)}
            </div>
          </div>
          <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:20px 0 0;text-align:center;">
            El código expira en ${esc(data.minutos || 15)} minutos. Si no solicitó este cambio, ignore este mensaje.
          </p>`,
        cta: "",
      }),
  },

  citacion: {
    nombre: "Citación / mensaje de ministerio",
    asunto: `📩 {{asunto}} - {{modulo}} | ${CHURCH.name}`,
    categoria: "Mensajes",
    descripcion: "Citaciones y mensajes enviados desde el módulo de mensajes.",
    variables: ["destinatario", "remitente", "asunto", "detalle", "fecha", "eventoLugar", "valor", "modulo"],
    build: (data) =>
      shell({
        color: data.tipoMensaje === "invitacion" ? BRAND.violeta : BRAND.azul,
        emoji: "📩",
        titulo: esc(data.asunto),
        cuerpo: `
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hola <strong>${esc(data.destinatario)}</strong>, has recibido un mensaje de <strong>${esc(data.remitente)}</strong>:
          </p>
          ${card(
            row("📝 Detalle", data.detalle, true) +
            row("📅 Fecha", data.fecha) +
            row("📍 Evento / Lugar", data.eventoLugar) +
            row("💰 Valor", data.valor)
          )}`,
        nota: `Enviado por ${esc(data.remitente)} desde el módulo de ${esc(data.modulo)}`,
      }),
  },

  aviso_pago: {
    nombre: "Aviso de pago",
    asunto: "💰 {{concepto}} — IRDD",
    categoria: "Pagos",
    descripcion: "Aviso de nómina, transporte o pago diario cancelado.",
    variables: ["nombre", "concepto", "valor", "metodo", "detalle"],
    build: (data) =>
      shell({
        color: BRAND.verde,
        emoji: "💰",
        titulo: esc(data.concepto || "Aviso de pago"),
        cuerpo: `
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hola <strong>${esc(data.nombre)}</strong>, se ha registrado un pago a tu nombre.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 16px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#6b7280;letter-spacing:0.5px;">VALOR</p>
            <p style="font-size:28px;font-weight:700;color:${BRAND.verde};margin:6px 0;">${esc(data.valor)}</p>
            <p style="margin:0;font-size:13px;color:#6b7280;">${esc(data.metodo)}</p>
          </div>
          ${card(row("📝 Concepto", data.concepto, true) + row("ℹ️ Detalle", data.detalle))}`,
      }),
  },

  requerimiento: {
    nombre: "Requerimiento de bienes y servicios",
    asunto: "📋 {{titulo}} — IRDD",
    categoria: "Requerimientos",
    descripcion: "Alta de un requerimiento o respuesta a uno existente.",
    variables: ["titulo", "destinatario", "solicitante", "requerimiento", "estado", "observaciones", "valor"],
    build: (data) => {
      const color =
        data.estado === "aprobado" ? "#16a34a" : data.estado === "negado" ? BRAND.rojo : "#ea580c"
      return shell({
        color,
        emoji: "📋",
        titulo: esc(data.titulo || "Requerimiento"),
        cuerpo: `
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hola <strong>${esc(data.destinatario)}</strong>,
          </p>
          ${card(
            row("👤 Solicitante", data.solicitante, true) +
            row("📝 Requerimiento", data.requerimiento) +
            row("📊 Estado", data.estado) +
            row("💰 Valor", data.valor) +
            row("💬 Observaciones", data.observaciones)
          )}`,
      })
    },
  },

  generico: {
    nombre: "Mensaje genérico",
    asunto: "{{asunto}}",
    categoria: "General",
    descripcion: "Plantilla libre con la marca de la iglesia; el cuerpo se pasa como HTML.",
    variables: ["asunto", "titulo", "cuerpo"],
    build: (data) =>
      shell({
        color: BRAND.azul,
        emoji: "✉️",
        titulo: esc(data.titulo || data.asunto),
        cuerpo: data.cuerpo || "",
      }),
  },
}

/** Renderiza una plantilla por defecto (asunto interpolado + HTML). */
export function renderDefaultTemplate(
  slug: DefaultTemplateSlug,
  data: Record<string, any>
): { subject: string; html: string } {
  const tpl = DEFAULT_TEMPLATES[slug]
  const subject = tpl.asunto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = key.split(".").reduce<any>((acc, part) => (acc == null ? acc : acc[part]), data)
    return value === undefined || value === null ? "" : String(value)
  })
  return { subject, html: tpl.build(data) }
}

/** Catálogo para el panel (sin las funciones build). */
export function listDefaultTemplates() {
  return (Object.keys(DEFAULT_TEMPLATES) as DefaultTemplateSlug[]).map((slug) => {
    const t = DEFAULT_TEMPLATES[slug]
    return {
      slug,
      nombre: t.nombre,
      asunto: t.asunto,
      categoria: t.categoria,
      descripcion: t.descripcion,
      variables: t.variables,
    }
  })
}
