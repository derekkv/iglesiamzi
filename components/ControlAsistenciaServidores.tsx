"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/contexts/auth-context"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Lock, ClipboardCheck, BarChart3 } from "lucide-react"
import { toast } from "sonner"

interface ControlAsistenciaServidoresProps {
  moduloKey: string
  moduleName: string // nombre del módulo en system_modules para buscar permisos
  title: string
  canEdit: boolean
}

interface ServerUser {
  id: string
  username: string
  displayName: string
}

interface AsistenciaRecord {
  id?: number
  modulo: string
  user_id: string
  user_name: string
  fecha: string
  estado: "asistio" | "falto" | "justifico" | "pendiente"
}

const ESTADO_OPTIONS = [
  { value: "pendiente", label: "-", color: "" },
  { value: "asistio", label: "A", color: "bg-green-100 text-green-800" },
  { value: "falto", label: "F", color: "bg-red-100 text-red-800" },
  { value: "justifico", label: "J", color: "bg-blue-100 text-blue-800" },
]

function getDomingosDelMes(year: number, month: number): string[] {
  const domingos: string[] = []
  const date = new Date(year, month - 1, 1)

  // Avanzar al primer domingo
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1)
  }

  // Recoger todos los domingos del mes
  while (date.getMonth() === month - 1) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    domingos.push(`${y}-${m}-${d}`)
    date.setDate(date.getDate() + 7)
  }

  return domingos
}

function formatDomingo(fecha: string): string {
  const date = new Date(fecha + "T12:00:00")
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export function ControlAsistenciaServidores({ moduloKey, moduleName, title, canEdit }: ControlAsistenciaServidoresProps) {
  const router = useRouter()
  const { user } = useAuth()

  const [users, setUsers] = useState<ServerUser[]>([])
  const [records, setRecords] = useState<AsistenciaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("registro")

  // Mes/año seleccionado
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  const domingos = getDomingosDelMes(selectedYear, selectedMonth)

  // Cargar usuarios con permiso en el módulo
  const loadUsers = useCallback(async () => {
    try {
      const { data: permissions, error: permError } = await supabase
        .from("user_permissions")
        .select(`
          user_id,
          module:system_modules!inner(name)
        `)
        .eq("can_view", true)
        .eq("system_modules.name", moduleName)

      if (permError) throw permError

      const userIds = [...new Set((permissions || []).map((p: any) => p.user_id))]
      if (userIds.length === 0) {
        setUsers([])
        return
      }

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, username, displayName")
        .eq("is_active", true)
        .in("id", userIds)
        .order("displayName", { ascending: true })

      if (usersError) throw usersError
      setUsers(usersData || [])
    } catch (error) {
      console.error("Error loading users:", error)
    }
  }, [moduleName])

  // Cargar registros de asistencia del mes
  const loadRecords = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)

      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-31`

      const { data, error } = await supabase
        .from("asistencia_servidores")
        .select("*")
        .eq("modulo", moduloKey)
        .gte("fecha", startDate)
        .lte("fecha", endDate)

      if (error) throw error
      setRecords((data || []) as AsistenciaRecord[])
    } catch (error) {
      console.error("Error loading records:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [moduloKey, selectedYear, selectedMonth])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  useRealtime({ table: "asistencia_servidores", onChange: () => loadRecords(true) })

  const getEstado = (userId: string, fecha: string): string => {
    const record = records.find((r) => r.user_id === userId && r.fecha === fecha)
    return record?.estado || "pendiente"
  }

  const handleEstadoChange = async (userId: string, userName: string, fecha: string, estado: string) => {
    try {
      if (estado === "pendiente") {
        // Eliminar registro si vuelve a pendiente
        await supabase
          .from("asistencia_servidores")
          .delete()
          .eq("modulo", moduloKey)
          .eq("user_id", userId)
          .eq("fecha", fecha)
      } else {
        // Upsert
        await supabase
          .from("asistencia_servidores")
          .upsert(
            {
              modulo: moduloKey,
              user_id: userId,
              user_name: userName,
              fecha,
              estado,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "modulo,user_id,fecha" }
          )
      }
      // Actualizar local
      setRecords((prev) => {
        const filtered = prev.filter((r) => !(r.user_id === userId && r.fecha === fecha))
        if (estado !== "pendiente") {
          filtered.push({ modulo: moduloKey, user_id: userId, user_name: userName, fecha, estado: estado as any })
        }
        return filtered
      })
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message)
    }
  }

  // Estadísticas
  const getStats = () => {
    const stats = users.map((u) => {
      const userRecords = records.filter((r) => r.user_id === u.id)
      const asistencias = userRecords.filter((r) => r.estado === "asistio").length
      const faltas = userRecords.filter((r) => r.estado === "falto").length
      const justificadas = userRecords.filter((r) => r.estado === "justifico").length
      const total = domingos.length
      const porcentaje = total > 0 ? Math.round((asistencias / total) * 100) : 0
      return { ...u, asistencias, faltas, justificadas, total, porcentaje }
    })
    return stats.sort((a, b) => b.porcentaje - a.porcentaje)
  }

  const getEstadoColor = (estado: string) => {
    const opt = ESTADO_OPTIONS.find((o) => o.value === estado)
    return opt?.color || ""
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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Control de Asistencia de Servidores</h1>
                <p className="text-xs text-gray-500">{title} | {users.length} servidores</p>
              </div>
            </div>
            {!canEdit && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Solo lectura
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Leyenda */}
        <div className="flex flex-wrap gap-3">
          <Badge className="bg-green-100 text-green-800 text-xs">A = Asistió</Badge>
          <Badge className="bg-red-100 text-red-800 text-xs">F = Faltó</Badge>
          <Badge className="bg-blue-100 text-blue-800 text-xs">J = Justificó</Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="registro">
              <ClipboardCheck className="w-4 h-4 mr-2" /> Registro
            </TabsTrigger>
            <TabsTrigger value="estadisticas">
              <BarChart3 className="w-4 h-4 mr-2" /> Historial y Estadísticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registro" className="mt-4 space-y-4">
            {/* Mes actual fijo */}
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm px-3 py-1">
                {MESES[now.getMonth()]} {now.getFullYear()}
              </Badge>
              <Badge variant="secondary">{getDomingosDelMes(now.getFullYear(), now.getMonth() + 1).length} domingos</Badge>
            </div>

            {users.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  No hay servidores con permisos en este módulo
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-semibold min-w-[180px] sticky left-0 bg-white z-10">#  Servidor</TableHead>
                          {getDomingosDelMes(now.getFullYear(), now.getMonth() + 1).map((d) => (
                            <TableHead key={d} className="text-xs text-center min-w-[70px]">
                              {formatDomingo(d)}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u, idx) => (
                          <TableRow key={u.id}>
                            <TableCell className="text-sm font-medium sticky left-0 bg-white z-10">
                              <span className="text-gray-400 mr-2">{idx + 1}</span>
                              {u.displayName}
                            </TableCell>
                            {getDomingosDelMes(now.getFullYear(), now.getMonth() + 1).map((fecha) => {
                              const estado = getEstado(u.id, fecha)
                              return (
                                <TableCell key={fecha} className="text-center p-1">
                                  {canEdit ? (
                                    <select
                                      className={`w-full h-7 text-xs border rounded text-center ${getEstadoColor(estado)}`}
                                      value={estado}
                                      onChange={(e) => handleEstadoChange(u.id, u.displayName, fecha, e.target.value)}
                                    >
                                      {ESTADO_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getEstadoColor(estado)}`}>
                                      {ESTADO_OPTIONS.find((o) => o.value === estado)?.label || "-"}
                                    </span>
                                  )}
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
            )}
          </TabsContent>

          <TabsContent value="estadisticas" className="mt-4 space-y-4">
            {/* Selector de mes solo en estadísticas */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary">{domingos.length} domingos</Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estadísticas - {MESES[selectedMonth - 1]} {selectedYear}</CardTitle>
                <CardDescription>Resumen de asistencia de servidores</CardDescription>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No hay datos</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">Servidor</TableHead>
                          <TableHead className="text-xs text-center">Asistencias</TableHead>
                          <TableHead className="text-xs text-center">Faltas</TableHead>
                          <TableHead className="text-xs text-center">Justificadas</TableHead>
                          <TableHead className="text-xs text-center">% Asistencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getStats().map((s, idx) => (
                          <TableRow key={s.id}>
                            <TableCell className="text-xs">{idx + 1}</TableCell>
                            <TableCell className="text-sm font-medium">{s.displayName}</TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-green-100 text-green-800 text-xs">{s.asistencias}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-red-100 text-red-800 text-xs">{s.faltas}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-blue-100 text-blue-800 text-xs">{s.justificadas}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`text-sm font-bold ${s.porcentaje >= 80 ? "text-green-600" : s.porcentaje >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                                {s.porcentaje}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
