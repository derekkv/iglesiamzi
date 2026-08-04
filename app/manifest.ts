import type { MetadataRoute } from "next"
import { CHURCH } from "@/lib/branding"

/**
 * Manifest de la PWA generado dinámicamente a partir de la configuración de
 * marca (lib/branding.ts). Se sirve en /manifest.webmanifest.
 *
 * Para personalizarlo en otra iglesia basta con definir las variables
 * NEXT_PUBLIC_CHURCH_* en el .env; no es necesario editar este archivo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${CHURCH.shortName} - Sistema`,
    short_name: CHURCH.shortName,
    description: CHURCH.appDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: CHURCH.themeColor,
    orientation: "portrait",
    icons: [
      { src: CHURCH.icon192Url, sizes: "192x192", type: "image/png" },
      { src: CHURCH.icon512Url, sizes: "512x512", type: "image/png" },
    ],
  }
}
