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
import { ArrowLeft, Trash2, Search, Lock, ChevronDown, ChevronRight } from "lucide-react"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { toast } from "sonner"
import {
  herederosCiclosService, HEREDEROS_CICLO_CONFIG,
  type HerederosCicloTipo, type HerederosCiclo, type HerederosCicloCompleto,
} from "@/lib/mod/herederos-ciclos-service"


const TABS: { value: HerederosCicloTipo; label: string }[] = [
  { value: "herederos_baby", label: "Baby (0-2)" },
  { value: "herederos_kids", label: "Kids (3-5)" },
  { value: "herederos_explores", label: "Explores (6-8)" },
  { value: "herederos_champions", label: "Champions (9-11)" },
]

const getAttendanceColor = (status: string) => {
  switch (status) {
    case "A": return "bg-green-100 text-green-800"
    case "J": return "bg-blue-100 text-blue-800"
    case "F": return "bg-red-100 text-red-800"
    case "AT": return "bg-yellow-100 text-yellow-800"
    default: return ""
  }
}

function HistorialHerederosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()
  const audit = user ? { user_id: user.id, user_name: user.username } : undefined

  const [activeTab, setActiveTab] = useState<HerederosCicloTipo>("herederos_baby")
  const [ciclos, setCiclos] = useState<Record<HerederosCicloTipo, HerederosCiclo[]>>({
    herederos_baby: [], herederos_kids: [], herederos_explores: [], herederos_champions: [],
  })
  const [expandedCiclo, setExpandedCiclo] = useState<HerederosCicloCompleto | null>(null)
  const [loadingExpanded, setLoadingExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filterNombre, setFilterNombre] = useState("")

  const loadCiclos = useCallback(async () => {
    setLoading(true)
    try {
      const [baby, kids, explores, champions] = await Promise.all([
        herederosCiclosService.getHistorialCiclos("herederos_baby"),
        herederosCiclosService.getHistorialCiclos("herederos_kids"),
        herederosCiclosService.getHistorialCiclos("herederos_explores"),
        herederosCiclosService.getHistorialCiclos("herederos_champions"),
      ])
      setCiclos({ herederos_baby: baby, herederos_kids: kids, herederos_explores: explores, herederos_champions: champions })
    } catch (error) {
      console.error("Error cargando historial:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCiclos() }, [loadCiclos])


  const handleExpandCiclo = async (cicloId: number) => {
    if (expandedCiclo?.ciclo.id === cicloId) { setExpandedCiclo(null); return }
    setLoadingExpanded(true)
    try {
      const data = await herederosCiclosService.getCicloCompleto(cicloId)
      setExpandedCiclo(data)
      setFilterNombre("")
    } catch (error: any) {
      toast.error("Error cargando ciclo: " + error.message)
    } finally {
      setLoadingExpanded(false)
    }
  }

  const handleDeleteCiclo = async (cicloId: number) => {
    try {
      await herederosCiclosService.deleteCicloCompleto(cicloId, audit)
      toast.success("Ciclo eliminado correctamente")
      if (expandedCiclo?.ciclo.id === cicloId) setExpandedCiclo(null)
      await loadCiclos()
    } catch (error: any) {
      toast.error("Error eliminando ciclo: " + error.message)
    }
  }

  const handleDeleteParticipante = async (participanteId: number, nombre: string) => {
    try {
      await herederosCiclosService.deleteParticipante(participanteId, audit)
      toast.success(`${nombre} eliminado`)
      // Refrescar ciclo expandido
      if (expandedCiclo) {
        const data = await herederosCiclosService.getCicloCompleto(expandedCiclo.ciclo.id)
        setExpandedCiclo(data)
      }
    } catch (error: any) {
      toast.error("Error eliminando participante: " + error.message)
    }
  }

  const getAttendanceStatus = (participanteId: number, fechaId: number) => {
    if (!expandedCiclo) return "none"
    return expandedCiclo.asistencia.find((a) => a.participante_id === participanteId && a.fecha_id === fechaId)?.status || "none"
  }

  const formatDate = (fecha: string) => {
    const d = new Date(fecha + "T00:00:00")
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "2-digit" })
  }

  const formatDateShort = (fecha: string) => {
    const d = new Date(fecha + "T00:00:00")
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" })
  }

  const filteredParticipantes = expandedCiclo
    ? expandedCiclo.participantes.filter((p) =>
        !filterNombre || p.nombre.toLowerCase().includes(filterNombre.toLowerCase()) ||
        (p.nombre_representante || "").toLowerCase().includes(filterNombre.toLowerCase())
      )
    : []

  const resumen = expandedCiclo ? {
    total: expandedCiclo.participantes.length,
    nuevos: expandedCiclo.participantes.filter((p) => p.nuevo).length,
  } : null

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
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Historial Herederos del Reino</h1>
            </div>
            {!canEdit && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Solo lectura
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as HerederosCicloTipo); setExpandedCiclo(null) }}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
                {tab.label}
                {ciclos[tab.value].length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">{ciclos[tab.value].length}</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-4">
              {ciclos[tab.value].length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No hay ciclos cerrados para {HEREDEROS_CICLO_CONFIG[tab.value].label}
                </div>
              ) : (
                <div className="space-y-3">
                  {ciclos[tab.value].map((ciclo) => (
                    <Card key={ciclo.id} className={`transition-all ${expandedCiclo?.ciclo.id === ciclo.id ? "ring-2 ring-blue-300" : ""}`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => handleExpandCiclo(ciclo.id)}>
                            {expandedCiclo?.ciclo.id === ciclo.id ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                            <div>
                              <p className="font-medium text-gray-900">{HEREDEROS_CICLO_CONFIG[tab.value].label}</p>
                              <p className="text-sm text-gray-500">Inicio: {formatDate(ciclo.fecha_inicio)} | {ciclo.total_clases} clases</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleExpandCiclo(ciclo.id)}>
                              {expandedCiclo?.ciclo.id === ciclo.id ? "Ocultar" : "Ver"}
                            </Button>
                            {canEdit && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar este ciclo completo?</AlertDialogTitle>
                                    <AlertDialogDescription>Se eliminará permanentemente el ciclo, todos sus participantes, fechas y asistencia. No se puede deshacer.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteCiclo(ciclo.id)}>Eliminar todo</AlertDialogAction>
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
                              <div className="flex justify-center py-4"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
                            ) : (
                              <>
                                {/* Resumen */}
                                <div className="flex flex-wrap gap-3">
                                  <Badge className="bg-indigo-100 text-indigo-800">{resumen?.total} niños</Badge>
                                  <Badge className="bg-emerald-100 text-emerald-800">{resumen?.nuevos} nuevos</Badge>
                                  <Badge className="bg-purple-100 text-purple-800">{expandedCiclo.fechas.length} clases</Badge>
                                  {/* Leyenda */}
                                  <div className="flex gap-1.5 ml-auto">
                                    <Badge className="bg-green-100 text-green-800 text-[10px]">A</Badge>
                                    <Badge className="bg-blue-100 text-blue-800 text-[10px]">J</Badge>
                                    <Badge className="bg-red-100 text-red-800 text-[10px]">F</Badge>
                                    <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">AT</Badge>
                                  </div>
                                </div>

                                {/* Filtro */}
                                <div className="flex items-center gap-2 max-w-sm">
                                  <Search className="w-4 h-4 text-gray-400" />
                                  <Input placeholder="Buscar niño o representante..." value={filterNombre} onChange={(e) => setFilterNombre(e.target.value)} className="h-8" />
                                </div>

                                {/* Tabla completa */}
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-gray-50">
                                        <th className="border border-gray-200 px-2 py-2 text-center font-medium w-8">N°</th>
                                        <th className="border border-gray-200 px-2 py-2 text-left font-medium min-w-[140px]">Nombre</th>
                                        <th className="border border-gray-200 px-2 py-2 text-center font-medium">F.Nac</th>
                                        <th className="border border-gray-200 px-2 py-2 text-center font-medium w-10">Edad</th>
                                        <th className="border border-gray-200 px-2 py-2 text-center font-medium">Salón</th>
                                        <th className="border border-gray-200 px-2 py-2 text-center font-medium w-10">Nvo</th>
                                        {expandedCiclo.fechas.map((f) => (
                                          <th key={f.id} className="border border-gray-200 px-1 py-1 text-center font-medium min-w-[45px]">
                                            <span className="font-semibold">C{f.numero_clase}</span><br />
                                            <span className="text-[9px] text-gray-500">{formatDateShort(f.fecha)}</span>
                                          </th>
                                        ))}
                                        <th className="border border-gray-200 px-2 py-2 text-left font-medium min-w-[110px]">Representante</th>
                                        <th className="border border-gray-200 px-2 py-2 text-center font-medium">Celular</th>
                                        {canEdit && <th className="border border-gray-200 px-1 py-2 text-center font-medium w-10"></th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredParticipantes.map((p, idx) => (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                          <td className="border border-gray-200 px-2 py-1 text-center">{idx + 1}</td>
                                          <td className="border border-gray-200 px-2 py-1 font-medium">{p.nombre}</td>
                                          <td className="border border-gray-200 px-2 py-1 text-center">{p.fecha_nacimiento ? formatDateShort(p.fecha_nacimiento) : "-"}</td>
                                          <td className="border border-gray-200 px-2 py-1 text-center">{p.edad ?? "-"}</td>
                                          <td className="border border-gray-200 px-2 py-1 text-center">{p.salon || "-"}</td>
                                          <td className="border border-gray-200 px-2 py-1 text-center">{p.nuevo ? "✓" : ""}</td>
                                          {expandedCiclo.fechas.map((f) => {
                                            const status = getAttendanceStatus(p.id, f.id)
                                            return (
                                              <td key={f.id} className={`border border-gray-200 px-1 py-1 text-center font-semibold ${getAttendanceColor(status)}`}>
                                                {status !== "none" ? status : ""}
                                              </td>
                                            )
                                          })}
                                          <td className="border border-gray-200 px-2 py-1">{p.nombre_representante || "-"}</td>
                                          <td className="border border-gray-200 px-2 py-1 text-center">{p.celular || "-"}</td>
                                          {canEdit && (
                                            <td className="border border-gray-200 px-1 py-1 text-center">
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                  <button className="text-red-500 hover:text-red-700 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Eliminar a {p.nombre}?</AlertDialogTitle>
                                                    <AlertDialogDescription>Se eliminará al participante y toda su asistencia de este ciclo.</AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteParticipante(p.id, p.nombre)}>Eliminar</AlertDialogAction>
                                                  </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {filteredParticipantes.length === 0 && (
                                  <p className="text-center py-4 text-gray-500 text-sm">No hay participantes{filterNombre ? " con ese filtro" : ""}</p>
                                )}
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

export default function HistorialHerederosPage() {
  return (
    <PermissionsGuard moduleName="historial_herederos">
      {(canEdit) => <HistorialHerederosContent canEdit={!!canEdit} />}
    </PermissionsGuard>
  )
}
