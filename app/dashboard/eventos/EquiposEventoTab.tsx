"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Shuffle, RotateCcw, Users, AlertTriangle } from "lucide-react"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import {
  eventoParticipantesService,
  type EventoParticipante,
  type EventoTab,
  type Equipo,
  EQUIPOS,
} from "@/lib/mod/eventos-service"


interface EquiposEventoTabProps {
  tabs: EventoTab[]
  canEdit: boolean
  userId: string
  userName: string
}

export function EquiposEventoTab({ tabs, canEdit, userId, userName }: EquiposEventoTabProps) {
  const [selectedEventoId, setSelectedEventoId] = useState<string>(tabs.length > 0 ? String(tabs[0].id) : "")
  const [participantes, setParticipantes] = useState<EventoParticipante[]>([])
  const [loading, setLoading] = useState(false)
  const [dividing, setDividing] = useState(false)
  const [razones, setRazones] = useState<string[]>([])
  const [showRazones, setShowRazones] = useState(false)
  const [excluidos, setExcluidos] = useState<EventoParticipante[]>([])

  // Modales
  const [showDividirModal, setShowDividirModal] = useState(false)
  const [showLimpiarModal, setShowLimpiarModal] = useState(false)
  const [excluirFaltantes, setExcluirFaltantes] = useState(true)
  const [ocultarPendientes, setOcultarPendientes] = useState(true)
  const [participantesIncluidos, setParticipantesIncluidos] = useState<Record<number, boolean>>({})

  // Cuando se abre el modal, inicializar checks de todos los participantes
  const abrirDividirModal = () => {
    const initial: Record<number, boolean> = {}
    participantes.forEach(p => {
      // Los que tienen saldo pendiente se excluyen por defecto
      const tieneSaldo = p.valor > 0 && p.abono < p.valor
      initial[p.id] = !tieneSaldo // true = incluido, false = excluido
    })
    setParticipantesIncluidos(initial)
    setExcluirFaltantes(true)
    setOcultarPendientes(true)
    setShowDividirModal(true)
  }

  useEffect(() => {
    if (selectedEventoId) {
      loadData()
    }
  }, [selectedEventoId])

  useRealtimeMultiple(["evento_participantes"], () => {
    if (selectedEventoId) loadData()
  })

  async function loadData() {
    if (!selectedEventoId) return
    setLoading(true)
    try {
      const data = await eventoParticipantesService.getByEvento(parseInt(selectedEventoId))
      setParticipantes(data)
    } catch (error) {
      console.error("Error cargando participantes:", error)
    } finally {
      setLoading(false)
    }
  }


  const handleDividir = async () => {
    if (participantes.length < 4) {
      toast.error("Se necesitan al menos 4 participantes para dividir en equipos")
      return
    }
    setShowDividirModal(false)
    setDividing(true)
    try {
      // IDs excluidos = los que tienen check en false (no incluidos)
      const idsExcluidos = participantes
        .filter(p => !participantesIncluidos[p.id])
        .map(p => p.id)

      const result = await eventoParticipantesService.dividirEquipos(
        parseInt(selectedEventoId),
        { userId, userName },
        { incluirSinCancelar: idsExcluidos.length === 0, idsExcluidos }
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
      await eventoParticipantesService.limpiarEquipos(parseInt(selectedEventoId), { userId, userName })
      setRazones([])
      setExcluidos([])
      setShowRazones(false)
      toast.success("Equipos reiniciados")
      await loadData()
    } catch (error: any) {
      toast.error(error.message || "Error al limpiar equipos")
    }
  }

  const handleClickDividir = () => {
    if (participantes.length < 4) {
      toast.error("Se necesitan al menos 4 participantes para dividir en equipos. Actualmente hay " + participantes.length + ".")
      return
    }
    abrirDividirModal()
  }

  const equiposData: Record<Equipo, EventoParticipante[]> = {
    amarillo: participantes.filter(p => p.equipo === "amarillo"),
    azul: participantes.filter(p => p.equipo === "azul"),
    verde: participantes.filter(p => p.equipo === "verde"),
    naranja: participantes.filter(p => p.equipo === "naranja"),
  }

  const sinEquipo = participantes.filter(p => !p.equipo)
  const tieneEquipos = participantes.some(p => p.equipo)
  const sinCancelar = participantes.filter(p => p.valor > 0 && p.abono < p.valor)
  const selectedEvento = tabs.find(t => String(t.id) === selectedEventoId)


  if (tabs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">No hay eventos creados</p>
        <p className="text-sm">Cree un evento primero para poder organizar equipos</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Selector de evento + acciones */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 w-full sm:max-w-xs">
              <Label className="text-sm text-gray-600 mb-1 block">Evento</Label>
              <Select value={selectedEventoId} onValueChange={(v) => { setSelectedEventoId(v); setShowRazones(false) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar evento..." />
                </SelectTrigger>
                <SelectContent>
                  {tabs.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                {tieneEquipos && (
                  <Button variant="outline" onClick={() => setShowLimpiarModal(true)} disabled={!canEdit || dividing}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Reiniciar
                  </Button>
                )}
                <Button onClick={handleClickDividir} disabled={!canEdit || dividing || !selectedEventoId}>
                  <Shuffle className="w-4 h-4 mr-2" />
                  {dividing ? "Dividiendo..." : "Dividir en Equipos"}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                {participantes.length} participantes · {sinEquipo.length} sin equipo
                {sinCancelar.length > 0 && ` · ${sinCancelar.length} con saldo pendiente`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}


      {/* Alerta mínimo 4 personas */}
      {!loading && participantes.length > 0 && participantes.length < 4 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm">Se necesitan al menos 4 participantes para dividir en equipos. Actualmente hay {participantes.length}.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4 Equipos con detalle completo */}
      {!loading && tieneEquipos && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EQUIPOS.map(eq => {
            const miembros = equiposData[eq.id]
            const masc = miembros.filter(m => m.genero === "masculino").length
            const fem = miembros.filter(m => m.genero === "femenino").length
            const edadProm = miembros.length > 0 ? Math.round(miembros.reduce((s, m) => s + m.edad, 0) / miembros.length) : 0
            const conLimitacion = miembros.filter(m => m.limitacion_fisica).length
            const delgados = miembros.filter(m => m.contextura === "delgada").length
            const medios = miembros.filter(m => m.contextura === "media").length
            const robustos = miembros.filter(m => m.contextura === "robusta").length

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
                  <p className={`text-[10px] ${eq.textClass} opacity-75`}>
                    Contextura: {delgados} delgada, {medios} media, {robustos} robusta
                  </p>
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


      {/* Sin equipo (excluidos por saldo) */}
      {!loading && sinEquipo.length > 0 && tieneEquipos && (
        <Card className="border-gray-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" /> Sin Equipo Asignado ({sinEquipo.length})
            </CardTitle>
            <CardDescription>Personas excluidas de la división (saldo pendiente o agregadas después)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {sinEquipo.map(m => (
                <div key={m.id} className="text-sm p-2 bg-gray-50 rounded border">
                  <p className="font-medium">{m.nombre}</p>
                  <p className="text-[10px] text-gray-500">{m.edad} años · {m.genero === "masculino" ? "M" : "F"}</p>
                  {m.valor > 0 && m.abono < m.valor && (
                    <p className="text-[10px] text-red-500">Debe ${(m.valor - m.abono).toFixed(2)}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Razones detalladas de la división */}
      {showRazones && razones.length > 0 && (
        <Card className="border-indigo-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-indigo-700">Razones de la División</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowRazones(false)}>
                Ocultar
              </Button>
            </div>
            <CardDescription>Detalle de cómo se distribuyeron los participantes en cada equipo</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-indigo-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono text-indigo-900">
              {razones.join("\n")}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Excluidos por saldo */}
      {showRazones && excluidos.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Excluidos de la División ({excluidos.length})
            </CardTitle>
            <CardDescription>No fueron incluidos por tener saldo pendiente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {excluidos.map(m => (
                <div key={m.id} className="text-sm p-2 bg-amber-50 rounded border border-amber-200">
                  <p className="font-medium">{m.nombre}</p>
                  <p className="text-[10px] text-amber-700">
                    Debe ${(m.valor - m.abono).toFixed(2)} de ${Number(m.valor).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado vacío: no hay equipos */}
      {!loading && !tieneEquipos && participantes.length > 0 && (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No hay equipos formados</p>
          <p className="text-sm">Presione &quot;Dividir en Equipos&quot; para crear los 4 equipos automáticamente</p>
        </div>
      )}

      {/* Estado vacío: no hay participantes */}
      {!loading && participantes.length === 0 && selectedEventoId && (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Este evento no tiene participantes</p>
          <p className="text-sm">Agregue participantes en el tab del evento para poder dividir equipos</p>
        </div>
      )}


      {/* Modal: Dividir equipos */}
      <Dialog open={showDividirModal} onOpenChange={setShowDividirModal}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Dividir en Equipos</DialogTitle>
            <DialogDescription>
              Se dividirán los participantes de <strong>&quot;{selectedEvento?.nombre}&quot;</strong> en 4 equipos equilibrados.
              {tieneEquipos && " Esto reemplazará la asignación actual."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-4 flex-1 overflow-y-auto">
            {/* Toggle excluir faltantes */}
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-amber-50 border-amber-200">
              <Checkbox
                id="excluirFaltantes"
                checked={excluirFaltantes}
                className="h-6 w-6"
                onCheckedChange={(checked) => {
                  const val = checked as boolean
                  setExcluirFaltantes(val)
                  // Actualizar checks individuales según toggle
                  const updated = { ...participantesIncluidos }
                  sinCancelar.forEach(p => {
                    updated[p.id] = !val // si excluir=true, no incluir a los faltantes
                  })
                  setParticipantesIncluidos(updated)
                }}
              />
              <Label htmlFor="excluirFaltantes" className="text-sm font-medium cursor-pointer text-amber-800">
                Excluir a los que no han cancelado ({sinCancelar.length})
              </Label>
            </div>

            {/* Lista de TODOS los participantes */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-3 py-2 border-b flex items-center justify-between">
                <p className="text-xs font-medium text-gray-700">
                  Participantes — desmarque para excluir:
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="ocultarPendientes"
                      className="h-3.5 w-3.5"
                      checked={ocultarPendientes}
                      onCheckedChange={(checked) => setOcultarPendientes(checked as boolean)}
                    />
                    <Label htmlFor="ocultarPendientes" className="text-[10px] text-gray-500 cursor-pointer">
                      Ocultar pendientes
                    </Label>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    {participantes.filter(p => participantesIncluidos[p.id]).length} incluidos · {participantes.filter(p => !participantesIncluidos[p.id]).length} excluidos
                  </p>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y">
                {participantes
                  .filter(p => !(ocultarPendientes && p.valor > 0 && p.abono < p.valor))
                  .map(p => {
                  const tieneSaldo = p.valor > 0 && p.abono < p.valor
                  return (
                    <div key={p.id} className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${!participantesIncluidos[p.id] ? "bg-red-50/50" : ""}`}>
                      <Checkbox
                        id={`part-${p.id}`}
                        className="h-5 w-5"
                        checked={!!participantesIncluidos[p.id]}
                        onCheckedChange={(checked) => {
                          setParticipantesIncluidos(prev => ({ ...prev, [p.id]: checked as boolean }))
                        }}
                      />
                      <Label htmlFor={`part-${p.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{p.nombre}</p>
                          {tieneSaldo && (
                            <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 ml-2">
                              Debe ${(p.valor - p.abono).toFixed(2)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500">
                          {p.edad} años · {p.genero === "masculino" ? "M" : "F"} · {p.contextura}
                          {p.limitacion_fisica && " · ⚠️ Limitación"}
                        </p>
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <p className="font-medium mb-1">Criterios de equilibrio:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>Proporción de género (M/F)</li>
                <li>Distribución de edades (promedio similar)</li>
                <li>Contextura física (delgada/media/robusta repartida)</li>
                <li>Limitaciones físicas (distribuidas equitativamente)</li>
                <li>Tamaño de equipos (±1 persona máximo)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDividirModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDividir} disabled={participantes.filter(p => participantesIncluidos[p.id]).length < 4}>
              Dividir Equipos ({participantes.filter(p => participantesIncluidos[p.id]).length} personas)
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
              ¿Está seguro de limpiar la asignación de equipos de todos los participantes de <strong>&quot;{selectedEvento?.nombre}&quot;</strong>? Esta acción no se puede deshacer.
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
