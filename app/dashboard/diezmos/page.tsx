"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { ArrowLeft, Search, Lock } from "lucide-react"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"

interface DiezmoFromIngreso {
  id: number
  mes_id: string
  concepto: string
  monto: number
  fecha: string
  ministerio: string
  categoria_principal: string
  detalle: string
  observacion: string
  estado: string
  created_at: string
}

function DiezmosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { currentMonth } = useMonth()
  const [records, setRecords] = useState<DiezmoFromIngreso[]>([])
  const [loading, setLoading] = useState(true)

  const [searchResults, setSearchResults] = useState<(DiezmoFromIngreso & { mes_name?: string })[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchFilters, setSearchFilters] = useState({
    observacion: "",
    fechaDesde: "",
    fechaHasta: "",
  })

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      if (!currentMonth) return

      const { data, error } = await supabase
        .from("ingresos")
        .select("*")
        .eq("mes_id", currentMonth.id)
        .eq("categoria_principal", "DIEZMO")
        .order("fecha", { ascending: true })

      if (error) throw error
      setRecords(data || [])
    } catch (error) {
      console.error("Error cargando diezmos:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentMonth])

  // Realtime: refrescar cuando cambian los ingresos
  useRealtime({ table: "ingresos", onChange: () => { if (currentMonth) loadData(true) } })

  const handleSearch = async () => {
    try {
      setSearchLoading(true)

      let query = supabase
        .from("ingresos")
        .select("*")
        .eq("categoria_principal", "DIEZMO")
        .order("fecha", { ascending: false })

      if (searchFilters.observacion) {
        query = query.ilike("observacion", `%${searchFilters.observacion}%`)
      }
      if (searchFilters.fechaDesde) {
        query = query.gte("fecha", searchFilters.fechaDesde)
      }
      if (searchFilters.fechaHasta) {
        query = query.lte("fecha", `${searchFilters.fechaHasta}T23:59:59`)
      }

      const { data, error } = await query

      if (error) throw error
      setSearchResults(data || [])
    } catch (error) {
      console.error("Error buscando diezmos:", error)
    } finally {
      setSearchLoading(false)
    }
  }

  const totalDiezmos = records.reduce((sum, record) => sum + Number(record.monto), 0)
  const totalSearchResults = searchResults.reduce((sum, record) => sum + Number(record.monto), 0)

  function formatDateForTable(dateString: string) {
    if (!dateString) return ""
    const date = new Date(dateString)
    const day = String(date.getUTCDate()).padStart(2, "0")
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const year = date.getUTCFullYear()
    return `${day}/${month}/${year}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de diezmos...</p>
        </div>
      </div>
    )
  }

  if (!currentMonth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
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
                <h1 className="text-xl font-semibold text-gray-900">Listado de Diezmos</h1>
                <p className="text-sm text-gray-600">Mes activo: {currentMonth?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                Datos desde Ingresos y Egresos
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="mes" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="mes">Diezmos del Mes</TabsTrigger>
            <TabsTrigger value="buscar">Buscar Diezmos</TabsTrigger>
          </TabsList>

          {/* Tab: Diezmos del mes actual */}
          <TabsContent value="mes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Registros</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{records.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Diezmos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ${totalDiezmos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Registros de Diezmos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold">#</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Fecha</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Observación</th>
                        <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, index) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-3 font-medium">{index + 1}</td>
                          <td className="border border-gray-300 px-4 py-3">{formatDateForTable(record.fecha)}</td>
                          <td className="border border-gray-300 px-4 py-3">{record.observacion || "-"}</td>
                          <td className="border border-gray-300 px-4 py-3 text-right font-medium">
                            ${Number(record.monto).toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {records.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay registros de diezmos para este mes.</p>
                    <p className="text-sm">Los diezmos se registran desde el módulo de Ingresos y Egresos con la categoría "DIEZMO".</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Buscar diezmos */}
          <TabsContent value="buscar" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Buscar Diezmos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="searchObservacion">Observación</Label>
                    <Input
                      id="searchObservacion"
                      placeholder="Buscar en observación..."
                      value={searchFilters.observacion}
                      onChange={(e) => setSearchFilters({ ...searchFilters, observacion: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="searchFechaDesde">Fecha Desde</Label>
                    <Input
                      id="searchFechaDesde"
                      type="date"
                      value={searchFilters.fechaDesde}
                      onChange={(e) => setSearchFilters({ ...searchFilters, fechaDesde: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="searchFechaHasta">Fecha Hasta</Label>
                    <Input
                      id="searchFechaHasta"
                      type="date"
                      value={searchFilters.fechaHasta}
                      onChange={(e) => setSearchFilters({ ...searchFilters, fechaHasta: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleSearch} disabled={searchLoading} className="w-full md:w-auto">
                  <Search className="w-4 h-4 mr-2" />
                  {searchLoading ? "Buscando..." : "Buscar"}
                </Button>
              </CardContent>
            </Card>

            {searchResults.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Resultados Encontrados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">{searchResults.length}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        ${totalSearchResults.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Resultados de Búsqueda</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold">#</th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Fecha</th>
                            <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Observación</th>
                            <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchResults.map((record, index) => (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-3 font-medium">{index + 1}</td>
                              <td className="border border-gray-300 px-4 py-3">{formatDateForTable(record.fecha)}</td>
                              <td className="border border-gray-300 px-4 py-3">{record.observacion || "-"}</td>
                              <td className="border border-gray-300 px-4 py-3 text-right font-medium">
                                ${Number(record.monto).toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {searchResults.length === 0 && !searchLoading && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No se encontraron resultados</p>
                    <p className="text-sm">Intente con otros criterios de búsqueda</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function DiezmosPage() {
  return (
    <PermissionsGuard moduleName="diezmos">
      {(canEdit) => <DiezmosContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
