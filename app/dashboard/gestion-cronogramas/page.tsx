"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/secure-db"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/contexts/auth-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { cronogramaService, type CronogramaEntry } from "@/lib/mod/cronograma-service"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Lock } from "lucide-react"

// Mapa de key → label para todos los ministerios conocidos
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
  pastoral: "Pastoral",
}

function GestionCronogramasContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const [entries, setEntries] = useState<CronogramaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("")
  const [filterFecha, setFilterFecha] = useState("")
  const [modulos, setModulos] = useState<{ key: string; label: string }[]>([])

  const loadEntries = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const { data, error } = await supabase
        .from("cronograma_servicio")
        .select("*")
        .order("fecha", { ascending: false })

      if (error) throw error
      setEntries(data || [])

      // Extraer módulos únicos dinámicamente
      if (data && data.length > 0) {
        const uniqueModulos = Array.from(new Set(data.map((e: CronogramaEntry) => e.modulo))).filter(Boolean) as string[]
        const sorted = uniqueModulos.sort((a, b) => {
          const order = Object.keys(MODULO_LABELS)
          return order.indexOf(a) - order.indexOf(b)
        })
        const modulosList = sorted.map((key) => ({
          key,
          label: MODULO_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1),
        }))
        setModulos(modulosList)
        // Si no hay tab activo o el activo ya no existe, seleccionar el primero
        if (!activeTab || !sorted.includes(activeTab)) {
          setActiveTab(sorted[0] || "")
        }
      }
    } catch (error) {
      console.error("Error loading:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  useRealtime({ table: "cronograma_servicio", onChange: () => loadEntries(true) })

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${days[date.getDay()]} ${day}/${month}`
  }

  // Filtrar por módulo activo y fecha
  const filteredEntries = entries.filter((e) => {
    if (e.modulo !== activeTab) return false
    if (filterFecha && e.fecha !== filterFecha) return false
    return true
  })

  // Stats
  const totalModulo = entries.filter((e) => e.modulo === activeTab).length
  const puntuales = entries.filter((e) => e.modulo === activeTab && e.atraso === false).length
  const tardanzas = entries.filter((e) => e.modulo === activeTab && e.atraso === true).length
  const sinMarcar = entries.filter((e) => e.modulo === activeTab && e.atraso === null || e.atraso === undefined).length

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
                <p className="text-xs text-gray-500">Registrar hora de llegada y puntualidad</p>
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
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{totalModulo}</p>
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full`} style={{ gridTemplateColumns: `repeat(${modulos.length}, minmax(0, 1fr))` }}>
            {modulos.map((m) => (
              <TabsTrigger key={m.key} value={m.key} className="text-xs sm:text-sm">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {modulos.map((mod) => (
            <TabsContent key={mod.key} value={mod.key} className="space-y-4 mt-4">
              {/* Filtro de fecha */}
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={filterFecha}
                  onChange={(e) => setFilterFecha(e.target.value)}
                  className="w-44"
                />
                {filterFecha && (
                  <Button variant="ghost" size="sm" onClick={() => setFilterFecha("")}>
                    Limpiar
                  </Button>
                )}
                <Badge variant="secondary">{filteredEntries.length} registros</Badge>
              </div>

              {filteredEntries.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No hay servicios registrados{filterFecha ? " para esta fecha" : ""}
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Fecha</TableHead>
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
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs">{formatDate(entry.fecha)}</TableCell>
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
                                <option value="no">No (puntual)</option>
                                <option value="si">Sí (tarde)</option>
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
              )}
            </TabsContent>
          ))}
        </Tabs>
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
