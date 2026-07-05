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

const CELULA_IMAGES: Record<string, string> = {
  "Carlos y Ruth": "/celulas/CARLOS Y RUTH nombre.png",
  "Sarita y Lady": "/celulas/SARITA Y LADY nombre.png",
  "Jessy Mendoza": "",
  "Líder y Angela": "/celulas/LÍDER Y ÁNGELA nombre.png",
  "Juan Pablo y Angie": "/celulas/JUAN ÁNGEL Y ANGIE nombre.png",
  "Alina y Anita": "/celulas/ALINA Y ANITA nombre.png",
  "Neyda y Carmen": "/celulas/NEYDA Y CARMEN nombre.png",
  "Yadira y Tania": "/celulas/YADIRA Y TANIA nombre.png",
  "Luis y Ariana": "/celulas/LUIS Y ARIANNA nombre.png",
  "Layla Salem": "",
  "Estuardo y Catalina": "/celulas/ESTUARDO Y CATALINA nombre.png",
  "Gabriela López": "/celulas/GABRIELA LÓPEZ nombre.png",
}

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
  const [selectedCelula, setSelectedCelula] = useState<string | null>(null)

  const loadMiembros = useCallback(async () => {
    try {
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

  useRealtime({ table: "censo", onChange: () => loadMiembros() })
  useRealtime({ table: "censo_mdg", onChange: () => loadMiembros() })

  // Miembros que SÍ asisten a célula
  const miembrosActivos = miembros.filter((m) => m.celula_asiste)
  // Miembros que NO asisten pero tienen célula asignada
  const posiblesMiembros = miembros.filter((m) => !m.celula_asiste)

  // Agrupar por célula
  const activosPorCelula = (celula: string) => miembrosActivos.filter((m) => m.celula_nombre === celula)
  const posiblesPorCelula = (celula: string) => posiblesMiembros.filter((m) => m.celula_nombre === celula)

  const renderMiembrosTable = (lista: MiembroCelula[], emptyMsg: string) => {
    if (lista.length === 0) {
      return <p className="text-center text-gray-500 py-6 text-sm">{emptyMsg}</p>
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
              <Button variant="ghost" size="sm" onClick={() => selectedCelula ? setSelectedCelula(null) : router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {selectedCelula ? `Célula: ${selectedCelula}` : "Somos Uno - Células"}
                </h1>
                <p className="text-xs text-gray-500">
                  {miembrosActivos.length} miembros activos | {posiblesMiembros.length} posibles miembros
                </p>
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
        {!selectedCelula ? (
          /* Vista de tarjetas de células */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CELULAS.map((celula) => {
              const activos = activosPorCelula(celula).length
              const posibles = posiblesPorCelula(celula).length
              const image = CELULA_IMAGES[celula]
              return (
                <Card
                  key={celula}
                  className="cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-200 overflow-hidden border-0 rounded-xl group p-0"
                  onClick={() => setSelectedCelula(celula)}
                >
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600">
                    {image ? (
                      <img
                        src={image}
                        alt={celula}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-16 h-16 text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="text-lg font-bold text-white drop-shadow-md">{celula}</h3>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-white/90 text-gray-800 text-xs font-semibold shadow">
                        {activos + posibles}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex gap-3 text-sm">
                        <span className="text-green-600 flex items-center gap-1 font-medium">
                          <Users className="w-3.5 h-3.5" /> {activos} activos
                        </span>
                        {posibles > 0 && (
                          <span className="text-amber-600 flex items-center gap-1 font-medium">
                            <UserPlus className="w-3.5 h-3.5" /> {posibles} posibles
                          </span>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="text-xs">Ver</Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          /* Vista interna de una célula con 2 tabs */
          <Tabs defaultValue="activos" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="activos">
                <Users className="w-4 h-4 mr-2" /> Miembros Activos ({activosPorCelula(selectedCelula).length})
              </TabsTrigger>
              <TabsTrigger value="posibles">
                <UserPlus className="w-4 h-4 mr-2" /> Posibles Miembros ({posiblesPorCelula(selectedCelula).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activos">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Miembros que asisten a esta célula</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderMiembrosTable(activosPorCelula(selectedCelula), "No hay miembros activos en esta célula")}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="posibles">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Posibles miembros (no asisten pero tienen esta célula asignada)</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderMiembrosTable(posiblesPorCelula(selectedCelula), "No hay posibles miembros para esta célula")}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
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
