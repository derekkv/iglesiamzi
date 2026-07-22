"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface SmartDateInputProps {
  /** Valor en formato ISO yyyy-MM-dd */
  value: string
  /** Callback con valor en formato ISO yyyy-MM-dd */
  onChange: (isoDate: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Input inteligente de fecha que permite al usuario escribir en formatos flexibles:
 * dd/mm/yyyy, dd-mm-yyyy, dd mm yyyy, dd,mm,yyyy
 * y lo convierte automáticamente a formato ISO (yyyy-MM-dd) para el estado.
 * 
 * Muestra al usuario el formato dd/mm/yyyy pero guarda internamente yyyy-MM-dd.
 */
export function SmartDateInput({ value, onChange, placeholder = "dd / mm / aaaa", className, disabled }: SmartDateInputProps) {
  const [display, setDisplay] = useState("")

  // Cuando el valor ISO cambia desde fuera, actualizar el display
  useEffect(() => {
    if (value) {
      const parts = value.split("-")
      if (parts.length === 3 && parts[0].length === 4) {
        const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`
        // Solo actualizar si el display actual no corresponde al mismo valor
        if (parseDisplay(display) !== value) {
          setDisplay(formatted)
        }
      }
    } else {
      if (!display || parseDisplay(display) !== "") {
        setDisplay("")
      }
    }
  }, [value])

  function parseDisplay(raw: string): string {
    const cleaned = raw.replace(/[/,\-]/g, " ").replace(/\s+/g, " ").trim()
    const parts = cleaned.split(" ")
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const year = parseInt(parts[2], 10)
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      }
    }
    return ""
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setDisplay(raw)

    const parsed = parseDisplay(raw)
    if (parsed) {
      onChange(parsed)
    } else if (raw === "") {
      onChange("")
    }
  }

  return (
    <Input
      type="text"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      noUppercase
    />
  )
}
