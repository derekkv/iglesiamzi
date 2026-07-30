"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Shuffle, RotateCcw, Users, AlertTriangle } from "lucide-react"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import {
  encuentroService,
  type EncuentroParticipante,
  type Equipo,
  EQUIPOS,
} from "@/lib/mod/encuentro-service"

interface EquiposTabProps {
  canEdit: boolean
  userId: string
  userName: string
  refreshKey: number
}

export function EquiposTab({ canEdit, userId, userName, refreshKey }: EquiposTabProps) {
  const [participantes, setParticipantes] = useState<EncuentroParticipante[]>([])
  const [loading, setLoading] = useState(true)
  const [dividing, setDividing] = useState(false)
  const [razones, setRazones] = useState<string[]>([])
  const [showRazones, setShowRazones] = useState(false)
  const [excluidos, setExcluidos] = useState<EncuentroParticipante[]>([])

  // Modales
  const [showDividirModal, setShowDividirModal] = useState(false)
  const [showLimpiarModal, setShowLimpiarModal] = useState(false)
  const [incluirSinCancelar, setIncluirSinCancelar] = useState(false)

  useEffect(() => {
    loadData()
  }, [refreshKey])

  useRealtimeMultiple(["encuentro_participantes"], loadData)

  async function loadData() {
    try {
      const data = await encuentroService.getAll()
      setParticipantes(data)
    } catch (error) {
      console.error("Error cargando participantes:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDividir = async () => {
    setShowDividirModal(false)
    setDividing(true)
    try {
      const result = await encuentroService.dividirEquipos(
        { userId, userName },
        { incluirSinCancelar }
      )
      setRazones(result.razones)
      setExcluidos(result.excluidos)
      setShowRazones(true)
      toast.success("Equipos divididos exitosamente")
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Error al dividir equipos")
    } finally {
      setDividing(false)
    }
  }

  const handleLimpiar = async () => {
    setShowLimpiarModal(false)
    try {
      await encuentroService.limpiarEquipos({ userId, userName })
      setRazones([])
      setExcluidos([])
      setShowRazones(false)
      toast.success("Equipos reiniciados")
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Error al limpiar equipos")
    }
  }

  const equiposData: Record<Equipo, EncuentroParticipante[]> = {
    amarillo: participantes.filter(p => p.equipo === "amarillo"),
    azul: participantes.filter(p => p.equipo === "azul"),
    verde: participantes.filter(p => p.equipo === "verde"),
    naranja: participantes.filter(p => p.equipo === "naranja"),
  }

  const sinEquipo = participantes.filter(p => !p.equipo)
  const tieneEquipos = participantes.some(p => p.equipo)
  const sinCancelar = participantes.filter(p => p.valor > 0 && p.abono < p.valor)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Acciones */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">División de Equipos</p>
              <p className="text-sm text-gray-500">
                {participantes.length} participantes · {sinEquipo.length} sin equipo
                {sinCancelar.length > 0 && ` · ${sinCancelar.length} con saldo pendiente`}
              </p>
            </div>
            <div className="flex gap-2">
              {tieneEquipos && (
                <Button variant="outline" onClick={() => setShowLimpiarModal(true)} disabled={!canEdit || dividing}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Reiniciar
                </Button>
              )}
              <Button onClick={() => setShowDividirModal(true)} disabled={!canEdit || dividing || participantes.length < 4}>
                <Shuffle className="w-4 h-4 mr-2" />
                {dividing ? "Dividiendo..." : "Dividir en Equipos"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {participantes.length < 4 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm">Se necesitan al menos 4 participantes para dividir en equipos. Actualmente hay {participantes.length}.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4 Equipos */}
      {tieneEquipos && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EQUIPOS.map(eq => {
            const miembros = equiposData[eq.id]
            const masc = miembros.filter(m => m.genero === "masculino").length
            const fem = miembros.filter(m => m.genero === "femenino").length
            const edadProm = miembros.length > 0 ? Math.round(miembros.reduce((s, m) => s + m.edad, 0) / miembros.length) : 0
            const conLimitacion = miembros.filter(m => m.limitacion_fisica).length

            return (
              <Card key={eq.id} className={`border-2 ${eq.borderClass}`}>
                <CardHeader className={`${eq.bgClass} pb-3`}>
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-lg ${eq.textClass}`}>
                      Equipo {eq.label}
                    </CardTitle>
                    <Badge className={`${eq.bgClass} ${eq.textClass} border ${eq.borderClass} text-sm`}>
                      {miembros.length} personas
                    </Badge>
                  </div>
                  <CardDescription className={eq.textClass}>
                    {masc}M / {fem}F · Edad prom: {edadProm} · Limitaciones: {conLimitacion}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3">
                  {miembros.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Sin miembros</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {miembros.map((m, idx) => (
                        <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 border-b border-gray-100 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 font-mono w-5">{idx + 1}</span>
                            <div>
                              <p className="text-sm font-medium">{m.nombre}</p>
                              <p className="text-[10px] text-gray-500">
                                {m.edad} años · {m.genero === "masculino" ? "M" : "F"} · {m.contextura}
                                {m.limitacion_fisica && " · ⚠️ Limitación"}
                              </p>
                            </div>
                          </div>
                          {m.ministerio && (
                            <span className="text-[10px] text-gray-400">{m.ministerio}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Sin equipo */}
      {sinEquipo.length > 0 && tieneEquipos && (
        <Card className="border-gray-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" /> Sin Equipo Asignado ({sinEquipo.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {sinEquipo.map(m => (
                <div key={m.id} className="text-sm p-2 bg-gray-50 rounded border">
                  <p>{m.nombre}</p>
                  {m.valor > 0 && m.abono < m.valor && (
                    <p className="text-[10px] text-red-500">Debe ${(m.valor - m.abono).toFixed(2)}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Razones de la división */}
      {showRazones && razones.length > 0 && (
        <Card className="border-indigo-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-indigo-700">Razones de la División</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowRazones(false)}>
                Ocultar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-indigo-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono text-indigo-900">
              {razones.join("\n")}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Vista vacía */}
      {!tieneEquipos && participantes.length >= 4 && (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No hay equipos formados</p>
          <p className="text-sm">Presione "Dividir en Equipos" para crear los 4 equipos automáticamente</p>
        </div>
      )}

      {/* Modal: Dividir equipos */}
      <Dialog open={showDividirModal} onOpenChange={setShowDividirModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dividir en Equipos</DialogTitle>
            <DialogDescription>
              Se dividirán los participantes en 4 equipos equilibrados (Amarillo, Azul, Verde, Naranja).
              {tieneEquipos && " Esto reemplazará la asignación actual."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="incluirSinCancelar"
                checked={incluirSinCancelar}
                onCheckedChange={(checked) => setIncluirSinCancelar(checked as boolean)}
              />
              <Label htmlFor="incluirSinCancelar" className="text-sm">
                Incluir personas con saldo pendiente ({sinCancelar.length} personas)
              </Label>
            </div>
            {!incluirSinCancelar && sinCancelar.length > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                Se excluirán {sinCancelar.length} personas que no han cancelado su cuota completa.
              </p>
            )}
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <p className="font-medium mb-1">Criterios de equilibrio:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>Proporción de género (M/F)</li>
                <li>Distribución de edades</li>
                <li>Contextura física</li>
                <li>Limitaciones físicas</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDividirModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDividir}>
              Dividir Equipos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Limpiar equipos */}
      <Dialog open={showLimpiarModal} onOpenChange={setShowLimpiarModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reiniciar Equipos</DialogTitle>
            <DialogDescription>
              ¿Está seguro de limpiar la asignación de equipos de todos los participantes? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLimpiarModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleLimpiar}>
              Sí, Reiniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
