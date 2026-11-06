"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Filter, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"

export interface ColumnFilterProps {
  /** Título visible de la columna (para el encabezado del panel) */
  label: string
  /** Lista de valores únicos disponibles en la columna (ya formateados a texto) */
  options: string[]
  /** Valores actualmente seleccionados. Si está vacío = sin filtro (todos) */
  selected: Set<string>
  /** Callback con el nuevo set de seleccionados */
  onChange: (next: Set<string>) => void
  /** Alinea el panel a la derecha del botón (para columnas cerca del borde) */
  align?: "left" | "right"
}

/**
 * Filtro de columna estilo Excel: botón de embudo que abre un panel con
 * la lista de valores únicos y casillas para incluir/excluir. Incluye
 * buscador, "Seleccionar todo" y "Limpiar". Cuando no hay nada seleccionado,
 * la columna no filtra (muestra todo). El embudo se resalta si el filtro
 * está activo.
 */
export function ColumnFilter({ label, options, selected, onChange, align = "left" }: ColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const active = selected.size > 0

  // Cerrar al hacer click fuera o con Escape
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const visibleOptions = options.filter(o =>
    !search || o.toLowerCase().includes(search.toLowerCase())
  )

  const toggleValue = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  const selectAll = () => onChange(new Set(options))
  const clear = () => onChange(new Set())

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        title={active ? `Filtrando ${label}` : `Filtrar ${label}`}
        aria-label={`Filtrar ${label}`}
        className={`inline-flex items-center justify-center rounded p-0.5 transition-colors ${
          active ? "text-blue-600 bg-blue-100" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Filter className="w-3.5 h-3.5" fill={active ? "currentColor" : "none"} />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="p-2 border-b border-gray-100">
            <p className="text-[11px] font-semibold text-gray-700 mb-1.5 normal-case">{label}</p>
            <Input
              autoFocus
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 text-[11px]">
            <button type="button" onClick={selectAll} className="flex items-center gap-1 text-blue-600 hover:underline normal-case">
              <Check className="w-3 h-3" /> Todos
            </button>
            <button type="button" onClick={clear} className="flex items-center gap-1 text-gray-500 hover:underline normal-case">
              <X className="w-3 h-3" /> Limpiar
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 normal-case">Sin valores</p>
            ) : (
              visibleOptions.map((opt) => {
                const checked = selected.has(opt)
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 normal-case"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(opt)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                    />
                    <span className="truncate" title={opt}>{opt}</span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Definición de una columna filtrable: id lógico, etiqueta y extractor de valor. */
export interface FilterColumn<T> {
  key: string
  label: string
  /** Devuelve el texto por el que se agrupa/filtra esa fila en esa columna */
  getValue: (row: T) => string
  /** Alineación del panel (para columnas cerca del borde derecho) */
  align?: "left" | "right"
}

/**
 * Hook genérico para filtros de columna estilo Excel sobre cualquier lista.
 *
 * Uso:
 *   const f = useColumnFilters(rows, COLUMNS)
 *   // rows ya filtradas:        f.filteredRows
 *   // en cada <TableHead>:       {f.renderFilter("estado")}
 *   // hay filtros activos:       f.hasActiveFilters
 *   // limpiar todo:              f.clearAll()
 *
 * Reglas: AND entre columnas, OR dentro de una columna. Set vacío = sin filtrar.
 */
export function useColumnFilters<T>(rows: T[], columns: FilterColumn<T>[]) {
  const [filters, setFilters] = useState<Record<string, Set<string>>>({})

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      for (const col of columns) {
        const sel = filters[col.key]
        if (sel && sel.size > 0 && !sel.has(col.getValue(row))) return false
      }
      return true
    })
  }, [rows, columns, filters])

  const optionsByKey = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const col of columns) {
      const vals = Array.from(new Set(rows.map(col.getValue))).sort((a, b) => a.localeCompare(b, "es"))
      map[col.key] = vals
    }
    return map
  }, [rows, columns])

  const hasActiveFilters = columns.some((c) => (filters[c.key]?.size ?? 0) > 0)

  const setColumn = (key: string, next: Set<string>) => {
    setFilters((prev) => ({ ...prev, [key]: next }))
  }

  const clearAll = () => setFilters({})

  /** Renderiza el embudo de una columna por su key. */
  const renderFilter = (key: string) => {
    const col = columns.find((c) => c.key === key)
    if (!col) return null
    return (
      <ColumnFilter
        label={col.label}
        options={optionsByKey[col.key] || []}
        selected={filters[col.key] ?? new Set<string>()}
        onChange={(next) => setColumn(col.key, next)}
        align={col.align}
      />
    )
  }

  return { filteredRows, hasActiveFilters, clearAll, renderFilter, optionsByKey, filters, setColumn }
}
