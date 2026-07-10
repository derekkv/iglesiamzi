"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { storage } from "@/lib/storage"

interface MonthData {
  id: string
  name: string
  year: number
  month: number
  start_date: string
  end_date?: string | null; 
  status: "active" | "closed"
  data: {
    ingresos: any[]
    egresos: any[]
    asistencia: any[]
    diezmos: any[]
    discipulado?: {
      participants: string[]
      dates: string[]
      attendance: Record<string, Record<string, string>>
    }
    // Configuraciones que se preservan entre meses
    configuraciones: {
      ministerios: string[]
      categoriasPrincipales: string[]
      detalles: string[]
    }
  }
}

interface MonthContextType {
  currentMonth: MonthData | null
  monthHistory: MonthData[]
  startNewMonth: (startDate: string, endDate: string | null) => Promise<void>
  closeCurrentMonth: (endDate: string) => Promise<void>
  updateMonthData: (section: keyof MonthData["data"], data: any) => void
  updateConfigurations: (config: Partial<MonthData["data"]["configuraciones"]>) => void
  editMonthDates: (id: string, startDate: string, endDate: string | null) => Promise<void>
  deleteMonth: (id: string) => Promise<void>
}

const MonthContext = createContext<MonthContextType | undefined>(undefined)

export function MonthProvider({ children }: { children: ReactNode }) {
  const [currentMonth, setCurrentMonth] = useState<MonthData | null>(null)
  const [monthHistory, setMonthHistory] = useState<MonthData[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        const activeMonth = await storage.getActiveMonth()
        const closedMonths = await storage.getClosedMonths()

        if (activeMonth) {
          setCurrentMonth(activeMonth)
        }

        if (closedMonths) {
          setMonthHistory(closedMonths)
        }
      } catch (error) {
        console.error("Error loading data:", error)
      }
    }

    loadData()
  }, [])

  const createInitialMonth = async (startDate: string, endDate: string | null) => {

    const now = new Date()
    const selectedDate = new Date(startDate)
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]

    // ID determinista: solo año-mes (no Date.now()) para evitar duplicados
    const monthId = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}`

    // Verificar si ya existe un mes activo (cualquier ID) antes de crear uno nuevo
    const existing = await storage.getActiveMonth()
    if (existing) {
      // Si ya hay un mes activo del mismo año/mes, usarlo directamente
      if (existing.year === selectedDate.getFullYear() && existing.month === selectedDate.getMonth() + 1) {
        setCurrentMonth(existing)
        return existing
      }
      // Si es de otro mes, algo raro pasó — igualmente no duplicar
      setCurrentMonth(existing)
      return existing
    }

    const newMonth: MonthData = {
      id: monthId,
      name: `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`,
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      start_date: startDate,
      status: "active",
      data: {
        ingresos: [],
        egresos: [],
        asistencia: [],
        diezmos: [],
        discipulado: {
          participants: [],
          dates: [],
          attendance: {},
        },
        configuraciones: {
          ministerios: ["Pastoral", "Música", "Jóvenes", "Niños", "Evangelismo"],
          categoriasPrincipales: ["Ofrenda", "Diezmo", "Donación", "Gastos Operativos", "Mantenimiento"],
          detalles: ["Servicio Dominical", "Servicio Miércoles", "Evento Especial", "Gastos Generales"],
        },
      },
    }

    // Guardar en Supabase
    await storage.saveMonth(newMonth)
    await storage.updateConfiguraciones(newMonth.id, newMonth.data.configuraciones)
    
    setCurrentMonth(newMonth)
    return newMonth
  }


const editMonthDates = async (
  id: string,
  startDate: string,
  endDate: string | null
) => {
  const date = new Date(startDate)

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ]

  const name = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  await storage.updateMonthDates({
    id,
    start_date: startDate,
    end_date: endDate,
    name,
    year,
    month,
  })

  if (currentMonth?.id === id) {
    setCurrentMonth({
      ...currentMonth,
      start_date: startDate,
      end_date: endDate,
      name,
      year,
      month,
    })
  }

  setMonthHistory(prev =>
    prev.map(m =>
      m.id === id
        ? {
            ...m,
            start_date: startDate,
            end_date: endDate,
            name,
            year,
            month,
          }
        : m
    )
  )
}

  // 🗑 NUEVO -> Eliminar mes
  const deleteMonth = async (id: string) => {
    await storage.deleteMonth(id)

    setMonthHistory(prev => prev.filter(m => m.id !== id))

    if (currentMonth?.id === id) {
      setCurrentMonth(null)
    }
  }

  const startNewMonth = async (startDate: string, endDate: string | null) => {

    if (currentMonth) {
      // Cerrar el mes actual
      const closedMonth = {
        ...currentMonth,
        end_date: new Date().toISOString(),
        status: "closed" as const,
      }

      // Actualizar en Supabase
      await storage.saveMonth(closedMonth)
      
      // Agregar al historial
      const updatedHistory = [...monthHistory, closedMonth]
      setMonthHistory(updatedHistory)

      // Crear nuevo mes preservando configuraciones
      const now = new Date()
      const selectedDate = new Date(startDate)
      const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ]

      // ID determinista: solo año-mes
      const monthId = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}`

      // Verificar que no exista ya un mes activo (protección contra duplicados)
      const existing = await storage.getActiveMonth()
      if (existing) {
        // Ya hay un mes activo (puede ser que otro tab lo creó), usarlo
        setCurrentMonth(existing)
        return
      }

      const newMonth: MonthData = {
        id: monthId,
        name: `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`,
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
        start_date: startDate,
        status: "active",
        data: {
          ingresos: [],
          egresos: [],
          asistencia: [],
          diezmos: [],
          discipulado: {
            participants: [],
            dates: [],
            attendance: {},
          },
          // Preservar configuraciones del mes anterior
          configuraciones: { ...(currentMonth.data.configuraciones || {}) },
        },
      }

      // Guardar en Supabase
      await storage.saveMonth(newMonth)
      await storage.updateConfiguraciones(newMonth.id, newMonth.data.configuraciones)
      
      setCurrentMonth(newMonth)
    } else {
      // Si no hay mes actual, crear uno nuevo
      await createInitialMonth(startDate, endDate)
    }
  }

  const closeCurrentMonth = async (endDate: string) => {
    if (!currentMonth) return

    const closedMonth = {
      ...currentMonth,
      end_date: endDate,
      status: "closed" as const,
    }

    // Actualizar en Supabase
    await storage.saveMonth(closedMonth)
    
    // Agregar al historial
    const updatedHistory = [closedMonth, ...monthHistory]
    setMonthHistory(updatedHistory)

    setCurrentMonth(null)
  }

  const updateMonthData = async (section: keyof MonthData["data"], data: any) => {
    if (!currentMonth) return

    const updatedMonth = {
      ...currentMonth,
      data: {
        ...currentMonth.data,
        [section]: data,
      },
    }

    setCurrentMonth(updatedMonth)
    
    // Actualizar en Supabase según la sección
    if (section === 'discipulado') {
      await storage.updateDiscipulado(currentMonth.id, data)
    } 
    // Para otras secciones (ingresos, egresos, etc.) necesitaríamos funciones específicas
    // ya que ahora se almacenan en tablas individuales
  }

  const updateConfigurations = async (config: Partial<MonthData["data"]["configuraciones"]>) => {
    if (!currentMonth) return

    const updatedConfig = {
      ...currentMonth.data.configuraciones,
      ...config,
    }

    const updatedMonth = {
      ...currentMonth,
      data: {
        ...currentMonth.data,
        configuraciones: updatedConfig,
      },
    }

    setCurrentMonth(updatedMonth)
    await storage.updateConfiguraciones(currentMonth.id, updatedConfig)
  }

  return (
    <MonthContext.Provider
      value={{
        currentMonth,
        monthHistory,
        startNewMonth,
        closeCurrentMonth,
        updateMonthData,
        editMonthDates,
        deleteMonth,
        updateConfigurations,
      }}
    >
      {children}
    </MonthContext.Provider>
  )
}

export function useMonth() {
  const context = useContext(MonthContext)
  if (context === undefined) {
    throw new Error("useMonth must be used within a MonthProvider")
  }
  return context
}