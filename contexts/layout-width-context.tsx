"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type WidthMode = "wide" | "centered"

interface LayoutWidthContextValue {
  widthMode: WidthMode
  isWide: boolean
  setWidthMode: (mode: WidthMode) => void
  toggleWidthMode: () => void
}

const STORAGE_KEY = "layout_width_mode"
const BODY_WIDE_CLASS = "wide-mode"

const LayoutWidthContext = createContext<LayoutWidthContextValue | undefined>(undefined)

function applyBodyClass(mode: WidthMode) {
  if (typeof document === "undefined") return
  if (mode === "wide") {
    document.body.classList.add(BODY_WIDE_CLASS)
  } else {
    document.body.classList.remove(BODY_WIDE_CLASS)
  }
}

export function LayoutWidthProvider({ children }: { children: ReactNode }) {
  // Por defecto: ancho completo ("wide")
  const [widthMode, setWidthModeState] = useState<WidthMode>("wide")

  // Restaurar preferencia guardada al montar
  useEffect(() => {
    let initial: WidthMode = "wide"
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === "wide" || saved === "centered") {
        initial = saved
      }
    } catch {
      // localStorage no disponible: mantener default
    }
    setWidthModeState(initial)
    applyBodyClass(initial)
  }, [])

  // Mantener la clase del body sincronizada
  useEffect(() => {
    applyBodyClass(widthMode)
  }, [widthMode])

  const setWidthMode = (mode: WidthMode) => {
    setWidthModeState(mode)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // ignorar si no se puede persistir
    }
  }

  const toggleWidthMode = () => {
    setWidthMode(widthMode === "wide" ? "centered" : "wide")
  }

  return (
    <LayoutWidthContext.Provider
      value={{
        widthMode,
        isWide: widthMode === "wide",
        setWidthMode,
        toggleWidthMode,
      }}
    >
      {children}
    </LayoutWidthContext.Provider>
  )
}

export function useLayoutWidth() {
  const ctx = useContext(LayoutWidthContext)
  if (!ctx) {
    throw new Error("useLayoutWidth debe usarse dentro de un LayoutWidthProvider")
  }
  return ctx
}
