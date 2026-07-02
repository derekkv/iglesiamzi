"use client"

import { useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

type EventType = "INSERT" | "UPDATE" | "DELETE" | "*"

interface UseRealtimeOptions {
  table: string
  schema?: string
  event?: EventType
  filter?: string
  enabled?: boolean
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
  onChange?: () => void
}

/**
 * Hook para suscribirse a cambios en tiempo real de una tabla de Supabase.
 * Usa refs internos para evitar problemas de stale closures.
 * 
 * Uso simple:
 *   useRealtime({ table: "ingresos", onChange: () => loadData(true) })
 * 
 * Uso con filtro:
 *   useRealtime({ table: "ingresos", filter: "mes_id=eq.123", onChange: () => loadData(true) })
 * 
 * Desactivar condicionalmente:
 *   useRealtime({ table: "ingresos", enabled: !!currentMonth, onChange: refresh })
 */
export function useRealtime(options: UseRealtimeOptions) {
  const { table, schema = "public", event = "*", filter, enabled = true } = options

  // Refs para callbacks - evita stale closures y re-suscripciones innecesarias
  const onChangeRef = useRef(options.onChange)
  const onInsertRef = useRef(options.onInsert)
  const onUpdateRef = useRef(options.onUpdate)
  const onDeleteRef = useRef(options.onDelete)

  // Mantener refs actualizados
  useEffect(() => { onChangeRef.current = options.onChange }, [options.onChange])
  useEffect(() => { onInsertRef.current = options.onInsert }, [options.onInsert])
  useEffect(() => { onUpdateRef.current = options.onUpdate }, [options.onUpdate])
  useEffect(() => { onDeleteRef.current = options.onDelete }, [options.onDelete])

  useEffect(() => {
    if (!enabled) return

    const channelName = `rt-${table}-${filter || "all"}-${Math.random().toString(36).slice(2, 8)}`

    const channelConfig: any = {
      event,
      schema,
      table,
    }

    if (filter) {
      channelConfig.filter = filter
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        channelConfig,
        (payload: RealtimePostgresChangesPayload<any>) => {
          // Callback general (siempre se llama)
          if (onChangeRef.current) onChangeRef.current()

          // Callbacks específicos por tipo de evento
          if (payload.eventType === "INSERT" && onInsertRef.current) {
            onInsertRef.current(payload.new)
          }
          if (payload.eventType === "UPDATE" && onUpdateRef.current) {
            onUpdateRef.current(payload.new)
          }
          if (payload.eventType === "DELETE" && onDeleteRef.current) {
            onDeleteRef.current(payload.old)
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(`[Realtime] Error en canal ${table}, reintentando...`)
          // Supabase client maneja reconexión automática
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, schema, event, filter, enabled])
}

/**
 * Hook para suscribirse a múltiples tablas a la vez.
 * Llama onChange cuando cualquiera de las tablas cambia (INSERT, UPDATE o DELETE).
 * Usa ref para el callback, evitando stale closures.
 */
export function useRealtimeMultiple(tables: string[], onChange: () => void, filter?: string) {
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    if (!tables.length) return

    const channelName = `rt-multi-${tables.join("-")}-${Math.random().toString(36).slice(2, 8)}`

    let channel = supabase.channel(channelName)

    tables.forEach((table) => {
      const config: any = {
        event: "*",
        schema: "public",
        table,
      }
      if (filter) config.filter = filter

      channel = channel.on("postgres_changes" as any, config, () => {
        if (onChangeRef.current) onChangeRef.current()
      })
    })

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn(`[Realtime] Error en canal multi [${tables.join(",")}], reintentando...`)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tables.join(","), filter])
}
