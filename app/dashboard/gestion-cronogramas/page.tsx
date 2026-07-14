"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/secure-db"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/contexts/auth-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { cronogramaService, type CronogramaEntry } from "@/lib/mod/cronograma-service"
import { nowEcuador } from "@/lib/timezone"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Lock, Calendar } from "lucide-react"

// Mapa de key -> label para mostrar nombres bonitos
const MODULO_LABELS: Record<string, string> = {
  protocolo: "Protocolo",
  administracion: "Administración",
  mdg: "Mujeres de Gracia",
  discipulado: "Discipulado",
  alabanza: "Alabanza",
  intercesion: "Intercesión",
  herederos: "Herederos",
  redil: "Redil",
  comunicacion: "Comunicación",
  jovenes: "Jóvenes",
  hombres: "Hombres",
}

function GestionCronogramasContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const [entries, setEntries] = useState<CronogramaEntry[]>([])
  const [historialEntries, setHistorialEntries] = useState<CronogramaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [viewTab, setViewTab] = useState<"semana" | "historial">("semana")
  const [searchHistorial, setSearchHistorial] = useState("")

  // Calcular rango de semana actual (lunes a domingo, zona Ecuador)
  const { weekStart, weekEnd } = useMemo(() => {
    const now = nowEcuador()
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    return { weekStart: fmt(monday), weekEnd: fmt(sunday) }
  }, [])

  const loadEntries = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const { data, error } = await supabase
        .from("cronograma_servicio")
        .select("*")
        .gte("fecha", weekStart)
        .lte("fecha", weekEnd)
        .neq("modulo", "pastoral")
        .order("fecha", { ascending: true })

      if (error) throw error
      setEntries(data || [])
    } catch (error) {
      console.error("Error loading:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [weekStart, weekEnd])

  useEffect(() => { loadEntries() }, [loadEntries])

  useRealtime({ table: "cronograma_servicio", onChange: () => loadEntries(true) })

  const loadHistorial = async () => {
    try {
      const { data, error } = await supabase
        .from("cronograma_servicio")
        .select("*")
        .lt("fecha", weekStart)
        .neq("modulo", "pastoral")
        .order("fecha", { ascending: false })
        .limit(200)
      if (error) throw error
      setHistorialEntries(data || [])
    } catch (e) { console.error("Error loading historial:", e) }
  }

  useEffect(() => { if (viewTab === "historial" && historialEntries.length === 0) loadHistorial() }, [viewTab])

  const handleInlineUpdate = async (entryId: number, field: "hora_llegada" | "atraso", value: any) => {
    try {
      await cronogramaService.updateField(entryId, { [field]: value })
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, [field]: value } : e))
      )
    } catch (error) {
      console.error("Error updating:", error)
    }
  }

  const formatDateFull = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`
  }

  // Stats
  const puntuales = entries.filter((e) => e.atraso === false).length
  const tardanzas = entries.filter((e) => e.atraso === true).length
  const sinMarcar = entries.filter((e) => e.atraso === null || e.atraso === undefined).length

  // Historial filtrado
  const filteredHistorial = historialEntries.filter((e) => {
    if (!searchHistorial.trim()) return true
    const q = searchHistorial.toLowerCase()
    return (e.user_name || "").toLowerCase().includes(q) ||
      (e.asignacion || "").toLowerCase().includes(q) ||
      (e.ministerio || "").toLowerCase().includes(q) ||
      (e.evento || "").toLowerCase().includes(q) ||
      (e.fecha || "").includes(q)
  })

  // Entradas activas según tab
  const displayEntries = viewTab === "semana" ? entries : filteredHistorial

  // Agrupar por fecha (dinámico según tab)
  const entriesByDate = useMemo(() => {
    const byDate: Record<string, CronogramaEntry[]> = {}
    for (const entry of displayEntries) {
      if (!byDate[entry.fecha]) byDate[entry.fecha] = []
      byDate[entry.fecha].push(entry)
    }
    return byDate
  }, [displayEntries])

  const sortedDates = Object.keys(entriesByDate).sort((a, b) => viewTab === "semana" ? a.localeCompare(b) : b.localeCompare(a))

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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Gestión de Cronogramas</h1>
                <p className="text-xs text-gray-500">Semana: {weekStart.split("-").reverse().join("/")} — {weekEnd.split("-").reverse().join("/")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
              <Badge variant="secondary">{entries.length} asignaciones</Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{entries.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{puntuales}</p>
              <p className="text-xs text-gray-500">Puntuales</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{tardanzas}</p>
              <p className="text-xs text-gray-500">Tardanzas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-400">{sinMarcar}</p>
              <p className="text-xs text-gray-500">Sin marcar</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewTab === "semana" ? "border-blue-500 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setViewTab("semana")}>
            Esta Semana ({entries.length})
          </button>
          <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewTab === "historial" ? "border-blue-500 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setViewTab("historial")}>
            Historial ({filteredHistorial.length})
          </button>
        </div>

        {viewTab === "historial" && (
          <Input
            placeholder="Buscar por persona, ministerio, asignación, fecha..."
            value={searchHistorial}
            onChange={(e) => setSearchHistorial(e.target.value)}
            className="max-w-md"
          />
        )}

        {/* Contenido agrupado por fecha */}
        {sortedDates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay servicios programados para esta semana</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((fecha) => {
              const entriesForDate = entriesByDate[fecha]
              return (
                <div key={fecha} className="space-y-3">
                  {/* Cabecera de fecha */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">{formatDateFull(fecha)}</h2>
                      <p className="text-xs text-gray-500">{entriesForDate.length} persona{entriesForDate.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {/* Tabla con campos de gestión */}
                  <Card className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table className="min-w-[1000px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Ministerio</TableHead>
                              <TableHead className="text-xs">Persona</TableHead>
                              <TableHead className="text-xs">Asignación</TableHead>
                              <TableHead className="text-xs">H. Entrada</TableHead>
                              <TableHead className="text-xs">H. Llegada</TableHead>
                              <TableHead className="text-xs">¿Llegó tarde?</TableHead>
                              <TableHead className="text-xs text-center">Acuse</TableHead>
                              <TableHead className="text-xs text-center">Alerta 2</TableHead>
                              <TableHead className="text-xs text-center">Alerta 1</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entriesForDate.map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell className="text-xs font-medium text-blue-700">
                                  {MODULO_LABELS[entry.modulo] || entry.modulo}
                                </TableCell>
                                <TableCell className="text-sm font-medium">{entry.user_name}</TableCell>
                                <TableCell className="text-xs">{entry.asignacion}</TableCell>
                                <TableCell className="text-xs">{entry.hora_entrada || "-"}</TableCell>
                                <TableCell>
                                  {canEdit ? (
                                    <Input
                                      type="time"
                                      className="h-7 w-24 text-xs"
                                      value={entry.hora_llegada || ""}
                                      onChange={(e) => handleInlineUpdate(entry.id!, "hora_llegada", e.target.value || null)}
                                    />
                                  ) : (
                                    <span className="text-xs">{entry.hora_llegada || "-"}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {canEdit ? (
                                    <select
                                      className="h-7 text-xs border rounded px-2 bg-white"
                                      value={entry.atraso === true ? "si" : entry.atraso === false ? "no" : ""}
                                      onChange={(e) => {
                                        const val = e.target.value === "si" ? true : e.target.value === "no" ? false : null
                                        handleInlineUpdate(entry.id!, "atraso", val)
                                      }}
                                    >
                                      <option value="">-</option>
                                      <option value="no">Llegó puntual</option>
                                      <option value="si">Llegó tarde</option>
                                    </select>
                                  ) : (
                                    entry.atraso === false ? (
                                      <span className="inline-block w-4 h-4 rounded-full bg-green-500" title="Puntual" />
                                    ) : entry.atraso === true ? (
                                      <span className="inline-block w-4 h-4 rounded-full bg-red-500" title="Llegó tarde" />
                                    ) : (
                                      <span className="text-gray-300 text-xs">-</span>
                                    )
                                  )}
                                </TableCell>
                                {/* Acuse de asignación */}
                                <TableCell className="text-center">
                                  {entry.acuse_asignacion ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full" title={entry.acuse_asignacion_at ? `Confirmado: ${new Date(entry.acuse_asignacion_at).toLocaleString("es-ES")}` : ""}>
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full" title="Pendiente de confirmar">
                                      ⏳
                                    </span>
                                  )}
                                </TableCell>
                                {/* Alerta 2 (5 días) */}
                                <TableCell className="text-center">
                                  {!entry.alerta2_enviada ? (
                                    <span className="text-[10px] text-gray-400">—</span>
                                  ) : entry.acuse_alerta2 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full" title={entry.acuse_alerta2_at ? `Confirmado: ${new Date(entry.acuse_alerta2_at).toLocaleString("es-ES")}` : ""}>
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full" title={entry.alerta2_enviada_at ? `Enviada: ${new Date(entry.alerta2_enviada_at).toLocaleString("es-ES")}` : "Enviada"}>
                                      ⏳
                                    </span>
                                  )}
                                </TableCell>
                                {/* Alerta 1 (1 día) */}
                                <TableCell className="text-center">
                                  {!entry.alerta1_enviada ? (
                                    <span className="text-[10px] text-gray-400">—</span>
                                  ) : entry.acuse_alerta1 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full" title={entry.acuse_alerta1_at ? `Confirmado: ${new Date(entry.acuse_alerta1_at).toLocaleString("es-ES")}` : ""}>
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full" title={entry.alerta1_enviada_at ? `Enviada: ${new Date(entry.alerta1_enviada_at).toLocaleString("es-ES")}` : "Enviada"}>
                                      ⏳
                                    </span>
                                  )}
                                </TableCell>
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
        )}
      </main>
    </div>
  )
}

export default function GestionCronogramasPage() {
  return (
    <PermissionsGuard moduleName="gestion-cronogramas">
      {(canEdit) => <GestionCronogramasContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
