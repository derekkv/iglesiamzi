"use client"

import { useState } from "react"

/**
 * Hook para manejar el orden de una lista.
 * Por defecto ordena ascendente (1→30 / A→Z).
 * El botón permite invertir.
 */
export function useSortOrder(defaultAsc: boolean = true) {
  const [ascending, setAscending] = useState(defaultAsc)
  const toggle = () => setAscending((prev) => !prev)
  return { ascending, toggle }
}

/**
 * Ordena un array por un campo de fecha (string ISO o "YYYY-MM-DD").
 * Si el campo es null/undefined, va al final.
 */
export function sortByDate<T>(items: T[], field: keyof T, ascending: boolean): T[] {
  return [...items].sort((a, b) => {
    const dateA = a[field] ? new Date(a[field] as any).getTime() : 0
    const dateB = b[field] ? new Date(b[field] as any).getTime() : 0
    return ascending ? dateA - dateB : dateB - dateA
  })
}

/**
 * Ordena un array por un campo de texto (alfabético).
 */
export function sortByName<T>(items: T[], field: keyof T, ascending: boolean): T[] {
  return [...items].sort((a, b) => {
    const nameA = (a[field] as any)?.toString().toLowerCase() || ""
    const nameB = (b[field] as any)?.toString().toLowerCase() || ""
    return ascending ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
  })
}
