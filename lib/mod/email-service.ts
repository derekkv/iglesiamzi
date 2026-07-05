import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "notificaciones@iglesiaregalodedios.com",
    pass: process.env.SMTP_PASS || "Notificaciones_712",
  },
})

export interface EmailServiceParams {
  to: string
  subject?: string
  type: "asignacion" | "alerta2" | "alerta1"
  data: {
    userName: string
    asignacion: string
    fecha: string
    horaEntrada?: string
    modulo: string
    ministerio?: string
    evento?: string
  }
}

function getModuleLabel(modulo: string): string {
  const labels: Record<string, string> = {
    protocolo: "Protocolo",
    administracion: "Administración",
    discipulado: "Discipulado",
    mdg: "MDG",
  }
  return labels[modulo] || modulo
}

function formatFechaLarga(fechaStr: string): string {
  const date = new Date(fechaStr + "T12:00:00")
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`
}

function getEmailTitle(type: EmailServiceParams["type"]): string {
  switch (type) {
    case "asignacion": return "Nuevo Servicio Asignado"
    case "alerta2": return "Recordatorio - Tu servicio es en 5 días"
    case "alerta1": return "¡Mañana tienes servicio!"
  }
}

function getHeaderColor(type: EmailServiceParams["type"]): string {
  switch (type) {
    case "asignacion": return "#2563eb"
    case "alerta2": return "#d97706"
    case "alerta1": return "#dc2626"
  }
}

function getHeaderEmoji(type: EmailServiceParams["type"]): string {
  switch (type) {
    case "asignacion": return "📋"
    case "alerta2": return "⏰"
    case "alerta1": return "🚨"
  }
}

function getIntroText(type: EmailServiceParams["type"], userName: string): string {
  switch (type) {
    case "asignacion":
      return `Hola <strong>${userName}</strong>, se te ha asignado un nuevo servicio. Por favor revisa los detalles a continuación:`
    case "alerta2":
      return `Hola <strong>${userName}</strong>, te recordamos que en <strong>5 días</strong> tienes un servicio asignado:`
    case "alerta1":
      return `Hola <strong>${userName}</strong>, <strong>¡mañana es tu día de servicio!</strong> No olvides llegar puntualmente:`
  }
}

function buildEmailHtml(params: EmailServiceParams): string {
  const { type, data } = params
  const title = getEmailTitle(type)
  const color = getHeaderColor(type)
  const emoji = getHeaderEmoji(type)
  const intro = getIntroText(type, data.userName)
  const fechaFormateada = formatFechaLarga(data.fecha)

  return `
<!DOCTYPE html>
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
          <!-- Header -->
          <tr>
            <td style="background-color:${color};padding:32px 40px;text-align:center;">
              <div style="font-size:40px;margin-bottom:12px;">${emoji}</div>
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${title}</h1>
              <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Iglesia Regalo de Dios</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
                ${intro}
              </p>
              
              <!-- Service Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">📅 Fecha</span><br>
                          <span style="color:#111827;font-size:16px;font-weight:600;">${fechaFormateada}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-top:1px solid #e5e7eb;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">📍 Asignación</span><br>
                          <span style="color:#111827;font-size:16px;font-weight:600;">${data.asignacion}</span>
                        </td>
                      </tr>
                      ${data.horaEntrada ? `
                      <tr>
                        <td style="padding:8px 0;border-top:1px solid #e5e7eb;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">🕐 Hora de entrada</span><br>
                          <span style="color:#111827;font-size:16px;font-weight:600;">${data.horaEntrada}</span>
                        </td>
                      </tr>` : ""}
                      <tr>
                        <td style="padding:8px 0;border-top:1px solid #e5e7eb;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">🏛️ Módulo</span><br>
                          <span style="color:#111827;font-size:16px;font-weight:600;">${getModuleLabel(data.modulo)}</span>
                        </td>
                      </tr>
                      ${data.ministerio ? `
                      <tr>
                        <td style="padding:8px 0;border-top:1px solid #e5e7eb;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">⛪ Ministerio</span><br>
                          <span style="color:#111827;font-size:16px;font-weight:600;">${data.ministerio}</span>
                        </td>
                      </tr>` : ""}
                      ${data.evento ? `
                      <tr>
                        <td style="padding:8px 0;border-top:1px solid #e5e7eb;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">🎯 Evento</span><br>
                          <span style="color:#111827;font-size:16px;font-weight:600;">${data.evento}</span>
                        </td>
                      </tr>` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
                <tr>
                  <td align="center">
                    <a href="https://panel.iglesiaregalodedios.com/dashboard" style="display:inline-block;background-color:${color};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;">
                      Abrir la App para Confirmar
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:13px;text-align:center;margin-top:24px;line-height:1.5;">
                Por favor ingresa a la aplicación y confirma que recibiste esta notificación.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                Iglesia Regalo de Dios — Sistema de Cronogramas<br>
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

export const emailService = {
  /**
   * Enviar email de notificación de servicio
   */
  async sendServiceEmail(params: EmailServiceParams): Promise<{ success: boolean; error?: string }> {
    try {
      const html = buildEmailHtml(params)
      const title = getEmailTitle(params.type)

      await transporter.sendMail({
        from: '"Iglesia Regalo de Dios" <notificaciones@iglesiaregalodedios.com>',
        to: params.to,
        subject: `${getHeaderEmoji(params.type)} ${title} - ${params.data.asignacion}`,
        html,
      })

      return { success: true }
    } catch (error: any) {
      console.error("Error enviando email:", error.message)
      return { success: false, error: error.message }
    }
  },

  /**
   * Verificar conexión SMTP
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await transporter.verify()
      return true
    } catch {
      return false
    }
  },
}
