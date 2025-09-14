"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { storage } from "@/lib/storage"

interface MonthData {
  id: string
  name: string
  year: number
  month: number
  start_date: string
  endDate?: string
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
  startNewMonth: () => void
  closeCurrentMonth: () => void
  updateMonthData: (section: keyof MonthData["data"], data: any) => void
  updateConfigurations: (config: Partial<MonthData["data"]["configuraciones"]>) => void
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

  const createInitialMonth = async () => {
    const now = new Date()
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]

    const newMonth: MonthData = {
      id: `${now.getFullYear()}-${now.getMonth() + 1}-${Date.now()}`,
      name: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      start_date: now.toISOString(),
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

  const startNewMonth = async () => {
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
      const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ]

      const newMonth: MonthData = {
        id: `${now.getFullYear()}-${now.getMonth() + 1}`,
        name: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        start_date: now.toISOString(),
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
          configuraciones: { ...currentMonth.data.configuraciones },
        },
      }

      // Guardar en Supabase
      await storage.saveMonth(newMonth)
      await storage.updateConfiguraciones(newMonth.id, newMonth.data.configuraciones)
      
      setCurrentMonth(newMonth)
    } else {
      // Si no hay mes actual, crear uno nuevo
      await createInitialMonth()
    }
  }

  const closeCurrentMonth = async () => {
    if (!currentMonth) return

    const closedMonth = {
      ...currentMonth,
      end_date: new Date().toISOString(),
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