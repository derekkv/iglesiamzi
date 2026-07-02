"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface MatrimonioCenso {
  id: number
  cedula: string
  apellidos_nombres: string
  conyuge: string
  cedula_conyugue: string
  fecha_matrimonio: string
  celular: string
  created_at: string
}

function MatrimonioContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()

  const [records, setRecords] = useState<MatrimonioCenso[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadMatrimonios()
  }, [])

  const loadMatrimonios = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const { data, error } = await supabase
        .from("censo")
        .select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, celular, created_at")
        .eq("matrimonio_irdd", true)
        .order("fecha_matrimonio", { ascending: false })

      if (error) throw error

      // Filtrar duplicados por cedula_conyugue (si ambos cónyuges están registrados, mostrar solo uno)
      const seen = new Set<string>()
      const filtered = (data || []).filter((record) => {
        // Si la cédula de esta persona ya apareció como cónyuge de otro registro, es duplicado
        if (seen.has(record.cedula)) return false
        // Marcar al cónyuge como visto
        if (record.cedula_conyugue) seen.add(record.cedula_conyugue)
        seen.add(record.cedula)
        return true
      })

      setRecords(filtered)
    } catch (error) {
      console.error("Error cargando matrimonios:", error)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  // Realtime: refrescar cuando cambia el censo
  useRealtime({ table: "censo", onChange: () => loadMatrimonios(true) })

  const handleSearch = async () => {
    try {
      setIsLoading(true)
      let query = supabase
        .from("censo")
        .select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, celular, created_at")
        .eq("matrimonio_irdd", true)

      if (searchQuery.trim()) {
        query = query.or(`apellidos_nombres.ilike.%${searchQuery}%,conyuge.ilike.%${searchQuery}%,cedula.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query.order("fecha_matrimonio", { ascending: false })

      if (error) throw error

      // Filtrar duplicados
      const seen = new Set<string>()
      const filtered = (data || []).filter((record) => {
        if (seen.has(record.cedula)) return false
        if (record.cedula_conyugue) seen.add(record.cedula_conyugue)
        seen.add(record.cedula)
        return true
      })

      setRecords(filtered)
    } catch (error) {
      console.error("Error buscando:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function formatDateForTable(dateString: string) {
    if (!dateString) return "-"
    const date = new Date(dateString)
    const day = String(date.getUTCDate()).padStart(2, "0")
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const year = date.getUTCFullYear()
    return `${day}/${month}/${year}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando matrimonios...</p>
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
              <h1 className="text-xl font-semibold text-gray-900">Registro de Matrimonios</h1>
            </div>
            <span className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
              Datos desde Censo
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Búsqueda */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input
                placeholder="Buscar por nombre, cónyuge o cédula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch}>
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
              <Button variant="outline" onClick={() => { setSearchQuery(""); loadMatrimonios() }}>
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Matrimonios en IRDD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{records.length}</div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle>Matrimonios Registrados</CardTitle>
            <CardDescription>Parejas casadas en la Iglesia IRDD (registradas desde el censo)</CardDescription>
          </CardHeader>
          <CardContent>
            {records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">#</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Nombre</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Cédula</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Cónyuge</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Cédula Cónyuge</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Fecha Matrimonio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3">{index + 1}</td>
                        <td className="border border-gray-300 px-4 py-3">{record.apellidos_nombres}</td>
                        <td className="border border-gray-300 px-4 py-3">{record.cedula}</td>
                        <td className="border border-gray-300 px-4 py-3">{record.conyuge || "-"}</td>
                        <td className="border border-gray-300 px-4 py-3">{record.cedula_conyugue || "-"}</td>
                        <td className="border border-gray-300 px-4 py-3">{formatDateForTable(record.fecha_matrimonio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No hay matrimonios registrados.</p>
                <p className="text-sm mt-1">Los matrimonios se registran desde el módulo de Censo marcando "Matrimonio en la Iglesia IRDD".</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function MatrimonioPage() {
  return (
    <PermissionsGuard moduleName="matrimonio">
      {(canEdit) => <MatrimonioContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
