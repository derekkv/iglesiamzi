"use client"

import { Maximize2, Minimize2 } from "lucide-react"
import { useLayoutWidth } from "@/contexts/layout-width-context"

/**
 * Botón flotante global para alternar el ancho de los módulos.
 * - "Ancho completo" (wide): el contenido ocupa toda la pantalla en horizontal.
 * - "Centrado" (centered): el contenido queda centrado como estaba originalmente.
 *
 * Por defecto todos los módulos están en modo ancho completo.
 */
export function LayoutWidthToggle() {
  const { isWide, setWidthMode } = useLayoutWidth()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full bg-white/95 p-1 shadow-lg ring-1 ring-black/10 backdrop-blur print:hidden">
      <button
        type="button"
        onClick={() => setWidthMode("wide")}
        aria-pressed={isWide}
        title="Ancho completo"
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          isWide
            ? "bg-blue-600 text-white shadow"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Maximize2 className="h-4 w-4" />
        <span className="hidden sm:inline normal-case">Ancho completo</span>
      </button>
      <button
        type="button"
        onClick={() => setWidthMode("centered")}
        aria-pressed={!isWide}
        title="Vista centrada"
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          !isWide
            ? "bg-blue-600 text-white shadow"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Minimize2 className="h-4 w-4" />
        <span className="hidden sm:inline normal-case">Centrado</span>
      </button>
    </div>
  )
}
