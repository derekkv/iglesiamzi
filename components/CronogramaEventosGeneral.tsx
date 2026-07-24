"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { cronogramaService, type CronogramaEntry } from "@/lib/mod/cronograma-service"
import { nowEcuador } from "@/lib/timezone"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Calendar } from "lucide-react"

interface CronogramaEventosGeneralProps {
  moduloKey: string
  title: string
}


export function CronogramaEventosGeneral({ moduloKey, title }: CronogramaEventosGeneralProps) {
  const router = useRouter()
  const [entries, setEntries] = useState<CronogramaEntry[]>([])
  const [loading, setLoading] = useState(true)

  const loadEntries = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await cronogramaService.getAllGlobal()
      setEntries(data)
    } catch (error) {
      console.error("Error loading cronograma:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])
  useRealtime({ table: "cronograma_servicio", onChange: () => loadEntries(true) })

  // Calcular rango de semana actual (lunes a domingo, zona Ecuador)
  const { weekStart, weekEnd, monthStart, monthEnd } = useMemo(() => {
    const now = nowEcuador()
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const ms = new Date(now.getFullYear(), now.getMonth(), 1)
    const me = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    return { weekStart: fmt(monday), weekEnd: fmt(sunday), monthStart: fmt(ms), monthEnd: fmt(me) }
  }, [])

  // Filtrar por periodo
  const weekEntries = entries.filter(e => e.fecha >= weekStart && e.fecha <= weekEnd)
  const monthEntries = entries.filter(e => e.fecha >= monthStart && e.fecha <= monthEnd)

  const formatDateFull = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]} ${date.getFullYear()}`
  }


  const renderEntries = (list: CronogramaEntry[], emptyMsg: string) => {
    if (list.length === 0) {
      return (
        <Card><CardContent className="py-12 text-center text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{emptyMsg}</p>
        </CardContent></Card>
      )
    }

    // Agrupar por fecha
    const byDate = list.reduce((acc, entry) => {
      if (!acc[entry.fecha]) acc[entry.fecha] = []
      acc[entry.fecha].push(entry)
      return acc
    }, {} as Record<string, CronogramaEntry[]>)

    const sortedDates = Object.keys(byDate).sort((a, b) => a.localeCompare(b))

    return (
      <div className="space-y-6">
        {sortedDates.map((fecha) => {
          const entriesForDate = byDate[fecha]
          const byMinisterio = entriesForDate.reduce((acc, entry) => {
            const min = entry.ministerio || "Sin ministerio"
            if (!acc[min]) acc[min] = []
            acc[min].push(entry)
            return acc
          }, {} as Record<string, CronogramaEntry[]>)

          const ministerios = Object.keys(byMinisterio).sort()
          const maxPersonas = Math.max(...ministerios.map((m) => byMinisterio[m].length))

          return (
            <div key={fecha} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{formatDateFull(fecha)}</h2>
                  <p className="text-xs text-gray-500">{entriesForDate.length} persona{entriesForDate.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-semibold min-w-[150px]">Ministerio</TableHead>
                          {Array.from({ length: maxPersonas }).map((_, i) => (
                            <TableHead key={i} className="text-xs text-center">Asignado {i + 1}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ministerios.map((ministerio) => (
                          <TableRow key={ministerio}>
                            <TableCell className="font-medium text-sm bg-gray-50">{ministerio}</TableCell>
                            {Array.from({ length: maxPersonas }).map((_, i) => {
                              const person = byMinisterio[ministerio][i]
                              return (<TableCell key={i} className="text-sm text-center">{person ? (<>{person.user_name}{person.asignacion && <span className="block text-[10px] text-purple-600">{person.asignacion}</span>}</>) : ""}</TableCell>)
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    )
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 sm:h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Cronograma y Eventos General</h1>
                <p className="text-sm text-gray-600">{title}</p>
              </div>
            </div>
            <Badge variant="secondary">{entries.length} asignaciones</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="semana" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mes</TabsTrigger>
            <TabsTrigger value="anual">Anual</TabsTrigger>
          </TabsList>

          <TabsContent value="semana" className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">{weekStart.split("-").reverse().join("/")} — {weekEnd.split("-").reverse().join("/")}</Badge>
              <Badge variant="secondary" className="text-xs">{weekEntries.length} asignaciones</Badge>
            </div>
            {renderEntries(weekEntries, "No hay eventos programados para esta semana")}
          </TabsContent>

          <TabsContent value="mes" className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">{monthStart.split("-").reverse().join("/")} — {monthEnd.split("-").reverse().join("/")}</Badge>
              <Badge variant="secondary" className="text-xs">{monthEntries.length} asignaciones</Badge>
            </div>
            {renderEntries(monthEntries, "No hay eventos programados para este mes")}
          </TabsContent>

          <TabsContent value="anual" className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">{entries.length} asignaciones totales</Badge>
            </div>
            {renderEntries(entries, "No hay eventos registrados")}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
