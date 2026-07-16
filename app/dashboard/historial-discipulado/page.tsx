"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, FileDown, Trash2, Search, Lock } from "lucide-react"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import {
  discipuladoCiclosService, CICLO_CONFIG,
  type CicloTipo, type Ciclo, type CicloCompleto,
} from "@/lib/mod/discipulado-ciclos-service"
import { downloadCertificados } from "@/lib/generate-certificados"

const TABS: { value: CicloTipo; label: string }[] = [
  { value: "primeros_pasos", label: "Primeros Pasos" },
  { value: "seguimos_avanzando", label: "Seguimos Avanzando" },
  { value: "siendo_iglesia", label: "Siendo Iglesia" },
]

function HistorialContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const audit = user ? { user_id: user.id, user_name: user.username } : undefined

  const [activeTab, setActiveTab] = useState<CicloTipo>("primeros_pasos")
  const [ciclos, setCiclos] = useState<Record<CicloTipo, Ciclo[]>>({
    primeros_pasos: [],
    seguimos_avanzando: [],
    siendo_iglesia: [],
  })
  const [expandedCiclo, setExpandedCiclo] = useState<CicloCompleto | null>(null)
  const [loadingExpanded, setLoadingExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Filtros
  const [filterNombre, setFilterNombre] = useState("")
  const [filterEstatus, setFilterEstatus] = useState<string>("todos")

  const loadCiclos = useCallback(async () => {
    setLoading(true)
    try {
      const [pp, sa, si] = await Promise.all([
        discipuladoCiclosService.getHistorialCiclos("primeros_pasos"),
        discipuladoCiclosService.getHistorialCiclos("seguimos_avanzando"),
        discipuladoCiclosService.getHistorialCiclos("siendo_iglesia"),
      ])
      setCiclos({ primeros_pasos: pp, seguimos_avanzando: sa, siendo_iglesia: si })
    } catch (error) {
      console.error("Error cargando historial:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCiclos() }, [loadCiclos])

  const handleExpandCiclo = async (cicloId: number) => {
    if (expandedCiclo?.ciclo.id === cicloId) {
      setExpandedCiclo(null)
      return
    }
    setLoadingExpanded(true)
    try {
      const data = await discipuladoCiclosService.getCicloCompleto(cicloId)
      setExpandedCiclo(data)
    } catch (error: any) {
      toast.error("Error cargando ciclo: " + error.message)
    } finally {
      setLoadingExpanded(false)
    }
  }

  const handleDeleteCiclo = async (cicloId: number) => {
    try {
      // Eliminar asistencia, fechas, participantes y el ciclo
      await discipuladoCiclosService.deleteAllFechas(cicloId, audit)
      // Eliminar participantes
      const participantes = await discipuladoCiclosService.getParticipantes(cicloId)
      for (const p of participantes) {
        await discipuladoCiclosService.deleteParticipante(p.id)
      }
      // Eliminar el ciclo en sí
      const { supabase } = await import("@/lib/secure-db")
      const { error } = await supabase
        .from("discipulado_ciclos")
        .delete()
        .eq("id", cicloId)
      if (error) throw error

      toast.success("Ciclo eliminado")
      if (expandedCiclo?.ciclo.id === cicloId) setExpandedCiclo(null)
      await loadCiclos()
    } catch (error: any) {
      toast.error("Error eliminando ciclo: " + error.message)
    }
  }

  const handleGenerarCertificados = async (tipo: CicloTipo) => {
    if (!expandedCiclo) return
    const aprobados = filteredParticipantes.filter((p) => p.estatus === "aprobado").map((p) => p.nombre)
    if (aprobados.length === 0) {
      toast.error("No hay participantes aprobados para generar certificados")
      return
    }
    setGeneratingPdf(true)
    try {
      await downloadCertificados(aprobados, tipo)
      toast.success(`Certificados generados para ${aprobados.length} participante(s)`)
    } catch (error: any) {
      toast.error("Error generando certificados: " + error.message)
    } finally {
      setGeneratingPdf(false)
    }
  }

  // Filtrar participantes del ciclo expandido
  const filteredParticipantes = expandedCiclo
    ? expandedCiclo.participantes.filter((p) => {
        const matchNombre = !filterNombre || p.nombre.toLowerCase().includes(filterNombre.toLowerCase())
        const matchEstatus = filterEstatus === "todos" || p.estatus === filterEstatus
        return matchNombre && matchEstatus
      })
    : []

  const getAttendanceStatus = (participanteId: number, fechaId: number) => {
    if (!expandedCiclo) return "none"
    const record = expandedCiclo.asistencia.find((a) => a.participante_id === participanteId && a.fecha_id === fechaId)
    return record?.status || "none"
  }

  const getAttendanceColor = (status: string) => {
    switch (status) {
      case "A": return "bg-green-100 text-green-800"
      case "J": return "bg-blue-100 text-blue-800"
      case "F": return "bg-red-100 text-red-800"
      case "AT": return "bg-yellow-100 text-yellow-800"
      default: return ""
    }
  }

  const getEstatusColor = (estatus: string) => {
    switch (estatus) {
      case "aprobado": return "bg-green-100 text-green-800"
      case "reprobado": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
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
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Historial de Discipulado</h1>
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
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as CicloTipo); setExpandedCiclo(null) }}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
                {tab.label}
                {ciclos[tab.value].length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{ciclos[tab.value].length}</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-4">
              {ciclos[tab.value].length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No hay ciclos cerrados para {tab.label}
                </div>
              ) : (
                <div className="space-y-3">
                  {ciclos[tab.value].map((ciclo) => (
                    <Card key={ciclo.id} className={`transition-all ${expandedCiclo?.ciclo.id === ciclo.id ? "ring-2 ring-blue-300" : ""}`}>
                      <CardContent className="py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleExpandCiclo(ciclo.id)}>
                            <div>
                              <p className="font-medium text-gray-900">
                                {CICLO_CONFIG[tab.value].label}
                              </p>
                              <p className="text-sm text-gray-500">
                                Inicio: {new Date(ciclo.fecha_inicio + "T00:00:00").toLocaleDateString("es-EC")} | {ciclo.total_clases} clases
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleExpandCiclo(ciclo.id)}>
                              {expandedCiclo?.ciclo.id === ciclo.id ? "Ocultar" : "Ver detalle"}
                            </Button>
                            {canEdit && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar este ciclo?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará permanentemente este ciclo, todos sus participantes, fechas y asistencia. Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteCiclo(ciclo.id)}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>

                        {/* Detalle expandido */}
                        {expandedCiclo?.ciclo.id === ciclo.id && (
                          <div className="mt-4 border-t pt-4 space-y-4">
                            {loadingExpanded ? (
                              <div className="flex justify-center py-4">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            ) : (
                              <>
                                {/* Filtros y acciones */}
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                    <Search className="w-4 h-4 text-gray-400" />
                                    <Input
                                      placeholder="Buscar participante..."
                                      value={filterNombre}
                                      onChange={(e) => setFilterNombre(e.target.value)}
                                      className="h-8"
                                    />
                                  </div>
                                  <Select value={filterEstatus} onValueChange={setFilterEstatus}>
                                    <SelectTrigger className="w-[140px] h-8">
                                      <SelectValue placeholder="Estatus" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="todos">Todos</SelectItem>
                                      <SelectItem value="aprobado">Aprobado</SelectItem>
                                      <SelectItem value="reprobado">Reprobado</SelectItem>
                                      <SelectItem value="en_curso">En curso</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {filteredParticipantes.some((p) => p.estatus === "aprobado") && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-green-300 text-green-700 hover:bg-green-50"
                                      disabled={generatingPdf}
                                      onClick={() => handleGenerarCertificados(tab.value)}
                                    >
                                      <FileDown className="w-4 h-4 mr-2" />
                                      {generatingPdf ? "Generando..." : "Generar Certificados"}
                                    </Button>
                                  )}
                                </div>

                                {/* Tabla de participantes y asistencia */}
                                {filteredParticipantes.length === 0 ? (
                                  <p className="text-center text-gray-500 py-4">No hay participantes que coincidan con los filtros</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-sm">
                                      <thead>
                                        <tr className="bg-gray-50">
                                          <th className="border border-gray-200 px-3 py-2 text-left font-medium">#</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left font-medium min-w-[180px]">Participante</th>
                                          {expandedCiclo.fechas.map((f) => (
                                            <th key={f.id} className="border border-gray-200 px-2 py-2 text-center text-xs font-medium min-w-[70px]">
                                              <div className="flex flex-col items-center">
                                                <span className="font-semibold">C{f.numero_clase}</span>
                                                <span>{new Date(f.fecha + "T00:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" })}</span>
                                              </div>
                                            </th>
                                          ))}
                                          <th className="border border-gray-200 px-3 py-2 text-center font-medium min-w-[100px]">Estatus</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {filteredParticipantes.map((p, idx) => (
                                          <tr key={p.id} className="hover:bg-gray-50">
                                            <td className="border border-gray-200 px-3 py-2 text-center">{idx + 1}</td>
                                            <td className="border border-gray-200 px-3 py-2">{p.nombre}</td>
                                            {expandedCiclo.fechas.map((f) => {
                                              const status = getAttendanceStatus(p.id, f.id)
                                              return (
                                                <td key={f.id} className="border border-gray-200 px-1 py-1 text-center">
                                                  {status !== "none" ? (
                                                    <Badge className={`${getAttendanceColor(status)} text-xs`}>{status}</Badge>
                                                  ) : (
                                                    <span className="text-gray-300">-</span>
                                                  )}
                                                </td>
                                              )
                                            })}
                                            <td className="border border-gray-200 px-1 py-1 text-center">
                                              <Badge className={`${getEstatusColor(p.estatus)} text-xs`}>
                                                {p.estatus === "aprobado" ? "Aprobado" : p.estatus === "reprobado" ? "Reprobado" : "En curso"}
                                              </Badge>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* Resumen */}
                                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                  <span>Total: {expandedCiclo.participantes.length}</span>
                                  <span>Aprobados: {expandedCiclo.participantes.filter((p) => p.estatus === "aprobado").length}</span>
                                  <span>Reprobados: {expandedCiclo.participantes.filter((p) => p.estatus === "reprobado").length}</span>
                                  <span>En curso: {expandedCiclo.participantes.filter((p) => p.estatus === "en_curso").length}</span>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  )
}

export default function HistorialDiscipuladoPage() {
  return (
    <PermissionsGuard moduleName="historial_discipulado">
      {(canEdit) => <HistorialContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
