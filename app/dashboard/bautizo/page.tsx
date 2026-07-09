"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search } from "lucide-react"
import { supabase } from "@/lib/secure-db"

interface BautizoCenso {
  id: number
  cedula: string
  apellidos_nombres: string
  fecha_bautizo: string
  celular: string
  created_at: string
  fuente: "protocolo" | "mdg"
}

function BautizoContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()

  const [records, setRecords] = useState<BautizoCenso[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadBautizos()
  }, [])

  const loadBautizos = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)

      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase
          .from("censo")
          .select("id, cedula, apellidos_nombres, fecha_bautizo, celular, created_at")
          .eq("bautizo_irdd", true)
          .order("fecha_bautizo", { ascending: false }),
        supabase
          .from("censo_mdg")
          .select("id, cedula, apellidos_nombres, fecha_bautizo, celular, created_at")
          .eq("bautizo_irdd", true)
          .order("fecha_bautizo", { ascending: false }),
      ])

      const all: BautizoCenso[] = [
        ...(protocolo || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
        ...(mdg || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
      ]

      // Deduplicar por cédula
      const seen = new Set<string>()
      const filtered = all.filter((r) => {
        if (seen.has(r.cedula)) return false
        seen.add(r.cedula)
        return true
      })

      // Ordenar por fecha descendente
      filtered.sort((a, b) => {
        if (!a.fecha_bautizo) return 1
        if (!b.fecha_bautizo) return -1
        return b.fecha_bautizo.localeCompare(a.fecha_bautizo)
      })

      setRecords(filtered)
    } catch (error) {
      console.error("Error cargando bautizos:", error)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  useRealtimeMultiple(["censo", "censo_mdg"], () => loadBautizos(true))

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadBautizos()
      return
    }
    try {
      setIsLoading(true)
      const q = searchQuery.trim()

      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase
          .from("censo")
          .select("id, cedula, apellidos_nombres, fecha_bautizo, celular, created_at")
          .eq("bautizo_irdd", true)
          .or(`apellidos_nombres.ilike.%${q}%,cedula.ilike.%${q}%`),
        supabase
          .from("censo_mdg")
          .select("id, cedula, apellidos_nombres, fecha_bautizo, celular, created_at")
          .eq("bautizo_irdd", true)
          .or(`apellidos_nombres.ilike.%${q}%,cedula.ilike.%${q}%`),
      ])

      const all: BautizoCenso[] = [
        ...(protocolo || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
        ...(mdg || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
      ]

      const seen = new Set<string>()
      const filtered = all.filter((r) => {
        if (seen.has(r.cedula)) return false
        seen.add(r.cedula)
        return true
      })

      filtered.sort((a, b) => {
        if (!a.fecha_bautizo) return 1
        if (!b.fecha_bautizo) return -1
        return b.fecha_bautizo.localeCompare(a.fecha_bautizo)
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
          <p className="text-gray-600">Cargando bautizos...</p>
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
              <h1 className="text-xl font-semibold text-gray-900">Registro de Bautizos</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                {records.length} bautizados
              </Badge>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Censo Protocolo + MDG
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Búsqueda */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input
                placeholder="Buscar por nombre o cédula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch}>
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
              <Button variant="outline" onClick={() => { setSearchQuery(""); loadBautizos() }}>
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle>Bautizos Registrados</CardTitle>
            <CardDescription>Personas bautizadas en la Iglesia IRDD (censo Protocolo y MDG)</CardDescription>
          </CardHeader>
          <CardContent>
            {records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">#</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Cédula</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Nombre</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Fecha Bautizo</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Celular</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={`${record.fuente}-${record.id}`} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3">{index + 1}</td>
                        <td className="border border-gray-300 px-4 py-3">{record.cedula}</td>
                        <td className="border border-gray-300 px-4 py-3 font-medium">{record.apellidos_nombres}</td>
                        <td className="border border-gray-300 px-4 py-3">{formatDateForTable(record.fecha_bautizo)}</td>
                        <td className="border border-gray-300 px-4 py-3">{record.celular || "-"}</td>
                        <td className="border border-gray-300 px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {record.fuente === "protocolo" ? "Protocolo" : "MDG"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No hay bautizos registrados.</p>
                <p className="text-sm mt-1">Se registran desde el Censo marcando "Se bautizó en la IRDD".</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function BautizoPage() {
  return (
    <PermissionsGuard moduleName="bautizo">
      {(canEdit) => <BautizoContent canEdit={!!canEdit} />}
    </PermissionsGuard>
  )
}
