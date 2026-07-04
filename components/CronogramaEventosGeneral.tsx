"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { cronogramaService, type CronogramaEntry } from "@/lib/mod/cronograma-service"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
      const data = await cronogramaService.getAll(moduloKey)
      setEntries(data)
    } catch (error) {
      console.error("Error loading cronograma:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [moduloKey])

  useEffect(() => { loadEntries() }, [loadEntries])

  useRealtime({ table: "cronograma_servicio", onChange: () => loadEntries(true) })

  const formatDateFull = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  // Agrupar por fecha
  const entriesByDate = entries.reduce((acc, entry) => {
    if (!acc[entry.fecha]) acc[entry.fecha] = []
    acc[entry.fecha].push(entry)
    return acc
  }, {} as Record<string, CronogramaEntry[]>)

  // Ordenar fechas descendente (más reciente primero)
  const sortedDates = Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a))

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {sortedDates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay servicios registrados en el cronograma</p>
            </CardContent>
          </Card>
        ) : (
          sortedDates.map((fecha) => {
            const entriesForDate = entriesByDate[fecha]
            // Agrupar por ministerio dentro de la fecha
            const byMinisterio = entriesForDate.reduce((acc, entry) => {
              const min = entry.ministerio || "Sin ministerio"
              if (!acc[min]) acc[min] = []
              acc[min].push(entry)
              return acc
            }, {} as Record<string, CronogramaEntry[]>)

            const ministerios = Object.keys(byMinisterio).sort()
            // Máximo de personas en un ministerio (para saber cuántas columnas)
            const maxPersonas = Math.max(...ministerios.map((m) => byMinisterio[m].length))

            return (
              <div key={fecha} className="space-y-3">
                {/* Separador de fecha */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{formatDateFull(fecha)}</h2>
                    <p className="text-xs text-gray-500">{entriesForDate.length} persona{entriesForDate.length !== 1 ? "s" : ""} asignada{entriesForDate.length !== 1 ? "s" : ""}</p>
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
                                return (
                                  <TableCell key={i} className="text-sm text-center">
                                    {person ? person.user_name : ""}
                                  </TableCell>
                                )
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
          })
        )}
      </main>
    </div>
  )
}
