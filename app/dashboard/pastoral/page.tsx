"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft } from "lucide-react"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/secure-db"
import { getTodosLosAtrasados, type GestionAtrasado } from "@/lib/mod/gestion-atrasados-service"

interface ColumnData {
  id: number
  nombre: string
  fecha: string
  orden: number
}

interface DetailData {
  id: number
  nombre: string
  orden: number
}

interface AttendanceEntry {
  detalle_id: number
  columna_id: number
  cantidad: number
}

function PastoralContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { currentMonth } = useMonth()
  const { user } = useAuth()

  const [columns, setColumns] = useState<ColumnData[]>([])
  const [details, setDetails] = useState<DetailData[]>([])
  const [data, setData] = useState<AttendanceEntry[]>([])
  const [atrasados, setAtrasados] = useState<GestionAtrasado[]>([])
  const [loading, setLoading] = useState(true)

  // Fecha de hoy en formato YYYY-MM-DD
  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    if (currentMonth) loadData()
    loadAtrasados()
  }, [currentMonth])

  const loadAtrasados = async () => {
    const data = await getTodosLosAtrasados()
    setAtrasados(data)
  }

  // Realtime: refrescar cuando cambian datos de asistencia
  useRealtimeMultiple(["asistencia_columnas", "asistencia_detalles", "asistencia_datos", "gestion_atrasados"], () => {
    if (currentMonth) loadData(true)
    loadAtrasados()
  })

  const loadData = async (silent = false) => {
    if (!currentMonth) return
    try {
      if (!silent) setLoading(true)

      // Cargar todas las columnas del mes que tengan fecha
      const { data: cols, error: colsErr } = await supabase
        .from("asistencia_columnas")
        .select("*")
        .eq("mes_id", currentMonth.id)
        .not("fecha", "is", null)
        .order("fecha", { ascending: true })

      if (colsErr) throw colsErr
      setColumns(cols || [])

      // Cargar detalles
      const { data: dets, error: detsErr } = await supabase
        .from("asistencia_detalles")
        .select("*")
        .eq("mes_id", currentMonth.id)
        .order("orden", { ascending: true })

      if (detsErr) throw detsErr
      setDetails(dets || [])

      // Cargar datos de asistencia
      const { data: attData, error: attErr } = await supabase
        .from("asistencia_datos")
        .select("*")
        .eq("mes_id", currentMonth.id)

      if (attErr) throw attErr
      setData(attData || [])
    } catch (error) {
      console.error("Error cargando datos pastorales:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const getValue = (detalleId: number, columnaId: number): number => {
    const entry = data.find((d) => d.detalle_id === detalleId && d.columna_id === columnaId)
    return entry?.cantidad || 0
  }

  const getColumnTotal = (columnaId: number): number => {
    return data
      .filter((d) => d.columna_id === columnaId)
      .reduce((sum, d) => sum + (d.cantidad || 0), 0)
  }

  const getDetailTotal = (detalleId: number): number => {
    const colIds = columns.map((c) => c.id)
    return data
      .filter((d) => d.detalle_id === detalleId && colIds.includes(d.columna_id))
      .reduce((sum, d) => sum + (d.cantidad || 0), 0)
  }

  const getGrandTotal = (): number => {
    const colIds = columns.map((c) => c.id)
    return data
      .filter((d) => colIds.includes(d.columna_id))
      .reduce((sum, d) => sum + (d.cantidad || 0), 0)
  }

  // Columna de hoy (si existe)
  const todayColumn = columns.find((col) => col.fecha === today)

  function formatDate(dateString: string) {
    if (!dateString) return "-"
    const date = new Date(dateString + "T12:00:00")
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${days[date.getDay()]} ${day}/${month}`
  }

  function formatDateShort(dateString: string) {
    if (!dateString) return "-"
    const date = new Date(dateString + "T12:00:00")
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${days[date.getDay()]} ${day}/${month}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos pastorales...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Módulo Pastoral</h1>
                <p className="text-sm text-gray-600">Mes: {currentMonth?.name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ===== ASISTENCIA DE HOY ===== */}
        <Card className={todayColumn ? "border-blue-300 bg-blue-50/30" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Asistencia de Hoy</span>
              <span className="text-sm font-normal text-gray-500">— {formatDate(today)}</span>
            </CardTitle>
            <CardDescription>
              {todayColumn
                ? "Registro de asistencia del día de hoy"
                : "No hay registro de asistencia para hoy. Se mostrará cuando se registre en Estadísticas de Asistencia."
              }
            </CardDescription>
          </CardHeader>
          {todayColumn && (
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {details.map((detail) => {
                  const val = getValue(detail.id, todayColumn.id)
                  return (
                    <div key={detail.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border">
                      <span className="text-sm text-gray-700">{detail.nombre}</span>
                      <span className={`text-lg font-bold ${val > 0 ? "text-blue-600" : "text-gray-300"}`}>
                        {val > 0 ? val : "-"}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-3 border-t flex justify-between items-center">
                <span className="font-medium text-gray-700">Total del día</span>
                <span className="text-2xl font-bold text-blue-700">{getColumnTotal(todayColumn.id)}</span>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ===== RESUMEN DEL MES ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Días Registrados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{columns.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Asistencia Total del Mes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{getGrandTotal()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Promedio por Día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {columns.length > 0 ? Math.round(getGrandTotal() / columns.length) : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== TABLA COMPLETA DEL MES ===== */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Asistencia del Mes</CardTitle>
            <CardDescription>Todos los días registrados en el mes actual</CardDescription>
          </CardHeader>
          <CardContent>
            {columns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold sticky left-0 bg-gray-100">
                        Categoría
                      </th>
                      {columns.map((col) => (
                        <th key={col.id} className="border border-gray-300 px-3 py-2 text-center font-semibold min-w-[70px]">
                          <div className="text-xs">{formatDateShort(col.fecha)}</div>
                        </th>
                      ))}
                      <th className="border border-gray-300 px-3 py-2 text-center font-semibold bg-blue-50">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((detail) => (
                      <tr key={detail.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 font-medium sticky left-0 bg-white text-xs">
                          {detail.nombre}
                        </td>
                        {columns.map((col) => {
                          const val = getValue(detail.id, col.id)
                          return (
                            <td key={col.id} className="border border-gray-300 px-3 py-2 text-center">
                              {val > 0 ? val : <span className="text-gray-300">-</span>}
                            </td>
                          )
                        })}
                        <td className="border border-gray-300 px-3 py-2 text-center font-semibold bg-blue-50">
                          {getDetailTotal(detail.id) || <span className="text-gray-300">-</span>}
                        </td>
                      </tr>
                    ))}
                    {/* Fila de totales */}
                    <tr className="bg-gray-100 font-semibold">
                      <td className="border border-gray-300 px-3 py-2 sticky left-0 bg-gray-100">
                        TOTAL
                      </td>
                      {columns.map((col) => (
                        <td key={col.id} className="border border-gray-300 px-3 py-2 text-center">
                          {getColumnTotal(col.id)}
                        </td>
                      ))}
                      <td className="border border-gray-300 px-3 py-2 text-center bg-blue-100">
                        {getGrandTotal()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No hay registros de asistencia para este mes.</p>
                <p className="text-sm mt-1">Registre la asistencia en el módulo de Estadísticas de Asistencia.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen de Atrasados */}
        <Card className="border-amber-200 mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-amber-600">Resumen de Atrasados</span>
              <Badge variant="outline" className="text-amber-600 border-amber-300">{atrasados.length}</Badge>
            </CardTitle>
            <CardDescription>Estado de gestión de servidores con atrasos en todos los módulos</CardDescription>
          </CardHeader>
          <CardContent>
            {atrasados.length === 0 ? (
              <p className="text-center text-gray-500 py-6 text-sm">No hay atrasados registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Módulo</TableHead>
                      <TableHead className="text-xs">Persona</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Gestionado</TableHead>
                      <TableHead className="text-xs">Acuerdo</TableHead>
                      <TableHead className="text-xs">Gestionado Por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {atrasados.map((a) => (
                      <TableRow key={a.id} className={!a.gestionado ? "bg-amber-50/50" : ""}>
                        <TableCell className="text-xs font-medium capitalize">{a.modulo}</TableCell>
                        <TableCell className="text-xs">{a.user_name}</TableCell>
                        <TableCell className="text-xs">{a.fecha}</TableCell>
                        <TableCell className="text-xs">
                          {a.gestionado ? (
                            <Badge className={a.respuesta_gestion ? "bg-green-100 text-green-700 text-[10px]" : "bg-red-100 text-red-700 text-[10px]"}>
                              {a.respuesta_gestion ? "Sí" : "No"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{a.acuerdo || "-"}</TableCell>
                        <TableCell className="text-xs text-gray-500">{a.gestionado_por_nombre || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function PastoralPage() {
  return (
    <PermissionsGuard moduleName="resumen-pastoral">
      {(canEdit) => <PastoralContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
