/**
 * ============================================================================
 *  CONFIGURACIÓN DE MARCA / IDENTIDAD DE LA IGLESIA (BRANDING)
 * ============================================================================
 *
 * Este archivo centraliza TODA la identidad visible de la iglesia: nombre,
 * siglas, logo, correos, dominio, colores, etc.
 *
 * Para replicar el sistema en otra iglesia NO es necesario tocar el código:
 * basta con definir las variables de entorno `NEXT_PUBLIC_CHURCH_*` en el
 * archivo `.env.local` (o `.env`). Los valores por defecto que aparecen aquí
 * corresponden a la instalación original y sirven como respaldo si la variable
 * no está definida.
 *
 * IMPORTANTE:
 *  - Todas las variables usan el prefijo `NEXT_PUBLIC_` porque este objeto se
 *    usa tanto en el navegador (client components) como en el servidor.
 *  - Las variables `NEXT_PUBLIC_` se incrustan en el bundle durante el build,
 *    así que NO pongas aquí ningún secreto (tokens, contraseñas, service keys).
 *  - Los nombres de columnas de la base de datos (por ejemplo `bautizo_irdd`)
 *    NO forman parte de la marca y no deben cambiarse desde aquí.
 * ============================================================================
 */

/** Lee una variable de entorno pública con un valor por defecto. */
function env(key: string, fallback: string): string {
  const value = process.env[key]
  return value && value.trim().length > 0 ? value.trim() : fallback
}

export const CHURCH = {
  /** Nombre completo de la iglesia. Ej: "Iglesia Regalo de Dios". */
  name: env("NEXT_PUBLIC_CHURCH_NAME", "Iglesia Regalo de Dios"),

  /** Nombre corto / comercial. Ej: "Regalo de Dios". */
  shortName: env("NEXT_PUBLIC_CHURCH_SHORT_NAME", "Regalo de Dios"),

  /** Siglas o acrónimo. Ej: "IRDD". Se usa en etiquetas compactas. */
  initials: env("NEXT_PUBLIC_CHURCH_INITIALS", "IRDD"),

  /** Nombre que aparece en la pestaña del navegador y el título de la app. */
  appTitle: env("NEXT_PUBLIC_CHURCH_APP_TITLE", "Regalo de Dios"),

  /** Descripción corta del sistema (PWA / metadatos). */
  appDescription: env(
    "NEXT_PUBLIC_CHURCH_APP_DESCRIPTION",
    "Sistema administrativo para la iglesia",
  ),

  /** Ruta pública del logo principal (dentro de /public). */
  logoUrl: env("NEXT_PUBLIC_CHURCH_LOGO_URL", "/logo.png"),

  /** Íconos PWA (dentro de /public). */
  icon192Url: env("NEXT_PUBLIC_CHURCH_ICON_192", "/icon-192.png"),
  icon512Url: env("NEXT_PUBLIC_CHURCH_ICON_512", "/icon-512.png"),

  /** Color principal de la marca (usado por la PWA y algunos acentos). */
  themeColor: env("NEXT_PUBLIC_CHURCH_THEME_COLOR", "#2563eb"),

  /** Dominio público del sistema. Ej: "panel.iglesiaregalodedios.com". */
  domain: env("NEXT_PUBLIC_CHURCH_DOMAIN", ""),

  /** Correo remitente por defecto para notificaciones. */
  contactEmail: env("NEXT_PUBLIC_CHURCH_CONTACT_EMAIL", ""),

  /** Emojis de firma usados en mensajes de WhatsApp/correo. */
  signatureEmojis: env("NEXT_PUBLIC_CHURCH_SIGNATURE_EMOJIS", "❤️🙏"),
} as const

/**
 * Firma de correo/WhatsApp lista para usar.
 * Ej: "Iglesia Regalo de Dios ❤️🙏"
 */
export const CHURCH_SIGNATURE = `${CHURCH.name} ${CHURCH.signatureEmojis}`.trim()

/**
 * Pie de página para plantillas de correo/sistema.
 * Ej: "Iglesia Regalo de Dios — Sistema Administrativo"
 */
export const CHURCH_SYSTEM_FOOTER = `${CHURCH.name} — Sistema Administrativo`

export type ChurchConfig = typeof CHURCH
