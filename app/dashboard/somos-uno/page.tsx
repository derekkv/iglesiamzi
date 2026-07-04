"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useRealtime } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Users, UserPlus, Lock } from "lucide-react"

const CELULAS = [
  "Carlos y Ruth",
  "Sarita y Lady",
  "Jessy Mendoza",
  "Líder y Angela",
  "Juan Pablo y Angie",
  "Alina y Anita",
  "Neyda y Carmen",
  "Yadira y Tania",
  "Luis y Ariana",
  "Layla Salem",
  "Estuardo y Catalina",
  "Gabriela López",
]

interface MiembroCelula {
  id: number
  apellidos_nombres: string
  celular?: string
  convencional?: string
  conyuge?: string
  hijos?: { nombre: string; edad: string }[]
  celula_asiste: boolean
  celula_nombre: string
  fuente: "protocolo" | "mdg"
}

function SomosUnoContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const [miembros, setMiembros] = useState<MiembroCelula[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"celulas" | "nuevos">("celulas")
  const [selectedCelula, setSelectedCelula] = useState<string | null>(null)

  const loadMiembros = useCallback(async () => {
    try {
      // Cargar de ambos censos los que tienen celula_nombre asignada
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase
          .from("censo")
          .select("id, apellidos_nombres, celular, convencional, conyuge, hijos, celula_asiste, celula_nombre")
          .not("celula_nombre", "is", null),
        supabase
          .from("censo_mdg")
          .select("id, apellidos_nombres, celular, convencional, conyuge, hijos, celula_asiste, celula_nombre")
          .not("celula_nombre", "is", null),
      ])

      const all: MiembroCelula[] = [
        ...(protocolo || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
        ...(mdg || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
      ]

      setMiembros(all)
    } catch (error) {
      console.error("Error cargando miembros:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMiembros() }, [loadMiembros])

  // Realtime en ambas tablas
  useRealtime({ table: "censo", onChange: () => loadMiembros() })
  useRealtime({ table: "censo_mdg", onChange: () => loadMiembros() })

  // Miembros que SÍ asisten a célula
  const miembrosActivos = miembros.filter((m) => m.celula_asiste)
  // Miembros que NO asisten pero tienen célula asignada (nuevos por gestionar)
  const nuevosNoAsisten = miembros.filter((m) => !m.celula_asiste)

  // Agrupar por célula
  const miembrosPorCelula = CELULAS.reduce((acc, celula) => {
    acc[celula] = miembrosActivos.filter((m) => m.celula_nombre === celula)
    return acc
  }, {} as Record<string, MiembroCelula[]>)

  const nuevosPorCelula = CELULAS.reduce((acc, celula) => {
    acc[celula] = nuevosNoAsisten.filter((m) => m.celula_nombre === celula)
    return acc
  }, {} as Record<string, MiembroCelula[]>)

  const renderMiembrosTable = (lista: MiembroCelula[]) => {
    if (lista.length === 0) {
      return <p className="text-center text-gray-500 py-4 text-sm">No hay miembros en esta célula</p>
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">#</TableHead>
              <TableHead className="text-xs">Nombres y Apellidos</TableHead>
              <TableHead className="text-xs">Celular</TableHead>
              <TableHead className="text-xs">Tel. Opcional</TableHead>
              <TableHead className="text-xs">Cónyuge</TableHead>
              <TableHead className="text-xs">Hijos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((m, idx) => (
              <TableRow key={`${m.fuente}-${m.id}`}>
                <TableCell className="text-xs">{idx + 1}</TableCell>
                <TableCell className="text-xs font-medium">{m.apellidos_nombres}</TableCell>
                <TableCell className="text-xs">{m.celular || "-"}</TableCell>
                <TableCell className="text-xs">{m.convencional || "-"}</TableCell>
                <TableCell className="text-xs">{m.conyuge || "-"}</TableCell>
                <TableCell className="text-xs">
                  {m.hijos && m.hijos.length > 0
                    ? m.hijos.map((h) => `${h.nombre} (${h.edad})`).join(", ")
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Somos Uno - Células</h1>
                <p className="text-xs text-gray-500">{miembrosActivos.length} miembros activos | {nuevosNoAsisten.length} nuevos por gestionar</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSelectedCelula(null) }}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="celulas">
              <Users className="w-4 h-4 mr-2" /> Células ({miembrosActivos.length})
            </TabsTrigger>
            <TabsTrigger value="nuevos">
              <UserPlus className="w-4 h-4 mr-2" /> Gestión de Nuevos Miembros ({nuevosNoAsisten.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="celulas" className="space-y-4">
            {!selectedCelula ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {CELULAS.map((celula) => {
                  const count = miembrosPorCelula[celula]?.length || 0
                  return (
                    <Card
                      key={celula}
                      className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
                      onClick={() => setSelectedCelula(celula)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>{celula}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-500">{count} miembro{count !== 1 ? "s" : ""} activo{count !== 1 ? "s" : ""}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCelula(null)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Volver
                  </Button>
                  <h2 className="text-xl font-semibold">Célula: {selectedCelula}</h2>
                  <Badge variant="secondary">{miembrosPorCelula[selectedCelula]?.length || 0} miembros</Badge>
                </div>
                <Card>
                  <CardContent className="pt-4">
                    {renderMiembrosTable(miembrosPorCelula[selectedCelula] || [])}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="nuevos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gestión de Nuevos Miembros</CardTitle>
                <p className="text-sm text-gray-500">
                  Personas que NO asisten a célula pero tienen una asignada cerca de su casa
                </p>
              </CardHeader>
              <CardContent>
                {nuevosNoAsisten.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No hay nuevos miembros por gestionar</p>
                ) : (
                  <div className="space-y-6">
                    {CELULAS.map((celula) => {
                      const lista = nuevosPorCelula[celula]
                      if (!lista || lista.length === 0) return null
                      return (
                        <div key={celula}>
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-sm">{celula}</h3>
                            <Badge variant="outline" className="text-xs">{lista.length}</Badge>
                          </div>
                          {renderMiembrosTable(lista)}
                        </div>
                      )
                    })}
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

export default function SomosUnoPage() {
  return (
    <PermissionsGuard moduleName="somos_uno">
      {(canEdit) => <SomosUnoContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
