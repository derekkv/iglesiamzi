"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Wallet, Lock, DollarSign, Calculator, Trash2 } from "lucide-react"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { useRealtime } from "@/hooks/use-realtime"
import { todayEcuador } from "@/lib/timezone"
import { toast } from "sonner"
import {
  cajaChicaService,
  METODOS_PAGO_CAJA,
  RESPONSABLES_ARQUEO,
  DENOMINACIONES,
  type CajaChicaMovimiento,
  type CajaChicaArqueo,
  type MetodoPagoCaja,
} from "@/lib/mod/caja-chica-service"


function CajaChicaContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { currentMonth } = useMonth()
  const { checkAndExecute } = useSecurityCheck()
  const audit = user ? { user_id: user.id, user_name: user.username } : undefined

  // Estado
  const [arqueos, setArqueos] = useState<CajaChicaArqueo[]>([])
  const [loading, setLoading] = useState(true)

  // Form Gestion de Efectivo
  const [gestionForm, setGestionForm] = useState({
    fecha: todayEcuador(), responsable: "", valor: "", detalle: "", metodo_pago: "" as MetodoPagoCaja | "",
  })
  const [savingGestion, setSavingGestion] = useState(false)
  const [gestiones, setGestiones] = useState<CajaChicaMovimiento[]>([])
  const [editingGestionId, setEditingGestionId] = useState<number | null>(null)

  // Arqueo
  const [arqueoForm, setArqueoForm] = useState({
    contado_por: "",
    billetes_20: 0, billetes_10: 0, billetes_5: 0, billetes_1: 0,
    monedas_050: 0, monedas_025: 0, monedas_010: 0, monedas_005: 0,
    observacion: "",
  })
  const [savingArqueo, setSavingArqueo] = useState(false)

  // Carga de datos
  const loadData = useCallback(async (silent = false) => {
    if (!currentMonth) return
    try {
      if (!silent) setLoading(true)
      const [arqs, gest] = await Promise.all([
        cajaChicaService.getArqueos(currentMonth.id),
        cajaChicaService.getGestionEfectivo(currentMonth.id),
      ])
      setArqueos(arqs)
      setGestiones(gest)
    } catch (error: any) {
      console.error("Error cargando caja chica:", error)
      if (!silent) toast.error("Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => { loadData() }, [loadData])
  useRealtime({ table: "caja_chica_movimientos", onChange: () => loadData(true) })
  useRealtime({ table: "caja_chica_arqueos", onChange: () => loadData(true) })

  // Arqueo total calculado
  const arqueoTotal = cajaChicaService.calcularTotalArqueo({
    billetes_20: arqueoForm.billetes_20, billetes_10: arqueoForm.billetes_10,
    billetes_5: arqueoForm.billetes_5, billetes_1: arqueoForm.billetes_1,
    monedas_050: arqueoForm.monedas_050, monedas_025: arqueoForm.monedas_025,
    monedas_010: arqueoForm.monedas_010, monedas_005: arqueoForm.monedas_005,
  })


  // --- Handlers ---
  const handleGestionEfectivo = async () => {
    if (!currentMonth || !gestionForm.responsable || !gestionForm.valor || !gestionForm.detalle || !gestionForm.metodo_pago) {
      toast.error("Complete todos los campos"); return
    }
    setSavingGestion(true)
    try {
      await cajaChicaService.registrarGestionEfectivo({
        fecha: gestionForm.fecha, responsable: gestionForm.responsable,
        valor: Number(gestionForm.valor), detalle: gestionForm.detalle,
        metodo_pago: gestionForm.metodo_pago as MetodoPagoCaja,
        mes_id: currentMonth.id,
      }, audit)
      toast.success("Gestion de efectivo registrada")
      setGestionForm({ fecha: todayEcuador(), responsable: "", valor: "", detalle: "", metodo_pago: "" })
      loadData(true)
    } catch (error: any) {
      toast.error(error.message || "Error al registrar")
    } finally { setSavingGestion(false) }
  }

  const handleEditGestion = (g: CajaChicaMovimiento) => {
    checkAndExecute(g.created_at, () => {
      setEditingGestionId(g.id)
      setGestionForm({
        fecha: g.fecha, responsable: g.responsable,
        valor: String(g.monto), detalle: g.detalle,
        metodo_pago: g.metodo_pago as MetodoPagoCaja,
      })
    })
  }

  const handleUpdateGestion = async () => {
    if (!currentMonth || !editingGestionId || !gestionForm.responsable || !gestionForm.valor || !gestionForm.detalle || !gestionForm.metodo_pago) {
      toast.error("Complete todos los campos"); return
    }
    setSavingGestion(true)
    try {
      await cajaChicaService.updateGestionEfectivo(editingGestionId, {
        fecha: gestionForm.fecha, responsable: gestionForm.responsable,
        valor: Number(gestionForm.valor), detalle: gestionForm.detalle,
        metodo_pago: gestionForm.metodo_pago as MetodoPagoCaja,
        mes_id: currentMonth.id,
      }, audit)
      toast.success("Registro actualizado")
      setEditingGestionId(null)
      setGestionForm({ fecha: todayEcuador(), responsable: "", valor: "", detalle: "", metodo_pago: "" })
      loadData(true)
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar")
    } finally { setSavingGestion(false) }
  }

  const handleDeleteGestion = (g: CajaChicaMovimiento) => {
    checkAndExecute(g.created_at, async () => {
      try {
        await cajaChicaService.deleteGestionEfectivo(g.id, audit)
        toast.success("Registro eliminado")
        loadData(true)
      } catch (error: any) {
        toast.error(error.message || "Error al eliminar")
      }
    })
  }

  const handleGuardarArqueo = async () => {
    if (!currentMonth || !arqueoForm.contado_por) {
      toast.error("Seleccione quien realizo el conteo"); return
    }
    if (arqueoTotal <= 0) {
      toast.error("El total del arqueo debe ser mayor a $0"); return
    }
    setSavingArqueo(true)
    try {
      await cajaChicaService.createArqueo({
        fecha: todayEcuador(), contado_por: arqueoForm.contado_por,
        billetes_20: arqueoForm.billetes_20, billetes_10: arqueoForm.billetes_10,
        billetes_5: arqueoForm.billetes_5, billetes_1: arqueoForm.billetes_1,
        monedas_050: arqueoForm.monedas_050, monedas_025: arqueoForm.monedas_025,
        monedas_010: arqueoForm.monedas_010, monedas_005: arqueoForm.monedas_005,
        total: arqueoTotal, observacion: arqueoForm.observacion,
        mes_id: currentMonth.id,
      }, audit)
      toast.success(`Arqueo guardado: $${arqueoTotal.toFixed(2)}`)
      setArqueoForm({
        contado_por: "", billetes_20: 0, billetes_10: 0, billetes_5: 0, billetes_1: 0,
        monedas_050: 0, monedas_025: 0, monedas_010: 0, monedas_005: 0, observacion: "",
      })
      loadData(true)
    } catch (error: any) {
      toast.error(error.message || "Error al guardar arqueo")
    } finally { setSavingArqueo(false) }
  }

  const handleDeleteArqueo = (a: CajaChicaArqueo) => {
    checkAndExecute(a.created_at, async () => {
      try {
        await cajaChicaService.deleteArqueo(a.id, audit)
        toast.success("Arqueo eliminado")
        loadData(true)
      } catch (error: any) {
        toast.error(error.message || "Error al eliminar")
      }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!currentMonth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">No hay un mes activo. Cree uno desde Control Mensual.</p>
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
                <h1 className="text-xl font-semibold text-gray-900">Caja Chica</h1>
                <p className="text-xs text-gray-500">Mes: {currentMonth.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="caja" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="caja"><Wallet className="w-4 h-4 mr-2" /> Caja Chica</TabsTrigger>
            <TabsTrigger value="gestion"><DollarSign className="w-4 h-4 mr-2" /> Gestion Efectivo</TabsTrigger>
          </TabsList>


          {/* === TAB 1: CAJA CHICA (Arqueo) === */}
          <TabsContent value="caja">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Formulario de conteo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-blue-600" /> Conteo Fisico
                  </CardTitle>
                  <CardDescription>Ingrese la cantidad de cada denominacion</CardDescription>
                </CardHeader>
                <CardContent>
                  {!canEdit ? (
                    <p className="text-center text-gray-500 py-8">No tiene permisos de edicion</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm">Contado por *</Label>
                        <Select value={arqueoForm.contado_por} onValueChange={(v) => setArqueoForm({ ...arqueoForm, contado_por: v })}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                          <SelectContent>
                            {RESPONSABLES_ARQUEO.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Fecha</Label>
                        <Input value={todayEcuador()} disabled className="mt-1 bg-gray-50" />
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Denominacion</TableHead>
                            <TableHead className="text-xs text-center">Cantidad</TableHead>
                            <TableHead className="text-xs text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {DENOMINACIONES.map((den) => {
                            const cantidad = arqueoForm[den.key as keyof typeof arqueoForm] as number
                            const valor = cantidad * den.valor
                            return (
                              <TableRow key={den.key}>
                                <TableCell className="text-sm font-medium">{den.label}</TableCell>
                                <TableCell className="text-center">
                                  <Input
                                    type="number" min="0" className="w-20 mx-auto text-center h-8"
                                    value={cantidad || ""}
                                    onChange={(e) => setArqueoForm({ ...arqueoForm, [den.key]: Number(e.target.value) || 0 })}
                                  />
                                </TableCell>
                                <TableCell className="text-sm text-right font-semibold">${valor.toFixed(2)}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>

                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-600">TOTAL DEL ARQUEO</p>
                        <p className="text-3xl font-bold text-emerald-700">${arqueoTotal.toFixed(2)}</p>
                      </div>

                      <div>
                        <Label className="text-sm">Observacion (opcional)</Label>
                        <Textarea value={arqueoForm.observacion}
                          onChange={(e) => setArqueoForm({ ...arqueoForm, observacion: e.target.value })}
                          placeholder="Notas adicionales..." className="mt-1" rows={2} />
                      </div>

                      <Button onClick={handleGuardarArqueo} disabled={savingArqueo} className="w-full bg-blue-600 hover:bg-blue-700">
                        {savingArqueo ? "Guardando..." : "Guardar Arqueo"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historial de arqueos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historial de Arqueos</CardTitle>
                  <CardDescription>Arqueos realizados este mes</CardDescription>
                </CardHeader>
                <CardContent>
                  {arqueos.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No hay arqueos registrados este mes</p>
                  ) : (
                    <div className="space-y-3">
                      {arqueos.map((a) => (
                        <div key={a.id} className="border rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{a.contado_por}</p>
                            <p className="text-xs text-gray-500">{a.fecha}</p>
                            {a.observacion && <p className="text-xs text-gray-400 mt-1">{a.observacion}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-lg font-bold text-emerald-600">${Number(a.total).toFixed(2)}</p>
                            {canEdit && (
                              <Button variant="ghost" size="sm" className="text-red-500 h-7 px-2" onClick={() => handleDeleteArqueo(a)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          {/* === TAB 2: GESTION DE EFECTIVO === */}
          <TabsContent value="gestion">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" /> Gestion del Efectivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!canEdit ? (
                  <p className="text-center text-gray-500 py-8">No tiene permisos de edicion</p>
                ) : (
                  <div className="space-y-6">
                    {/* Formulario */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                      <div>
                        <Label className="text-sm">Fecha *</Label>
                        <Input type="date" value={gestionForm.fecha}
                          onChange={(e) => setGestionForm({ ...gestionForm, fecha: e.target.value })} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Nombre del Responsable *</Label>
                        <Input value={gestionForm.responsable}
                          onChange={(e) => setGestionForm({ ...gestionForm, responsable: e.target.value })}
                          placeholder="Nombre completo" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Valor ($) *</Label>
                        <Input type="number" step="0.01" min="0" value={gestionForm.valor}
                          onChange={(e) => setGestionForm({ ...gestionForm, valor: e.target.value })}
                          placeholder="0.00" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Metodo de Pago *</Label>
                        <Select value={gestionForm.metodo_pago} onValueChange={(v) => setGestionForm({ ...gestionForm, metodo_pago: v as MetodoPagoCaja })}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                          <SelectContent>
                            {METODOS_PAGO_CAJA.map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Detalle *</Label>
                        <Textarea value={gestionForm.detalle}
                          onChange={(e) => setGestionForm({ ...gestionForm, detalle: e.target.value })}
                          placeholder="Descripcion del movimiento..." className="mt-1" rows={2} />
                      </div>
                      <div className="md:col-span-2">
                        <Button onClick={editingGestionId ? handleUpdateGestion : handleGestionEfectivo} disabled={savingGestion} className="w-full bg-emerald-600 hover:bg-emerald-700">
                          {savingGestion ? "Guardando..." : editingGestionId ? "Actualizar Registro" : "Registrar Gestion de Efectivo"}
                        </Button>
                        {editingGestionId && (
                          <Button variant="outline" className="w-full mt-2" onClick={() => { setEditingGestionId(null); setGestionForm({ fecha: todayEcuador(), responsable: "", valor: "", detalle: "", metodo_pago: "" }) }}>
                            Cancelar Edicion
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Tabla de registros */}
                    {gestiones.length > 0 && (
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-semibold mb-3">Registros del mes</h3>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Fecha</TableHead>
                                <TableHead className="text-xs">Responsable</TableHead>
                                <TableHead className="text-xs">Detalle</TableHead>
                                <TableHead className="text-xs">Metodo</TableHead>
                                <TableHead className="text-xs text-right">Valor</TableHead>
                                <TableHead className="text-xs text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {gestiones.map((g) => (
                                <TableRow key={g.id}>
                                  <TableCell className="text-xs">{g.fecha}</TableCell>
                                  <TableCell className="text-xs font-medium">{g.responsable}</TableCell>
                                  <TableCell className="text-xs max-w-[200px] truncate">{g.detalle}</TableCell>
                                  <TableCell className="text-xs">{g.metodo_pago}</TableCell>
                                  <TableCell className="text-xs text-right font-semibold text-emerald-600">${Number(g.monto).toFixed(2)}</TableCell>
                                  <TableCell className="text-xs text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600" onClick={() => handleEditGestion(g)}>
                                        Editar
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => handleDeleteGestion(g)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="mt-3 p-3 bg-emerald-50 rounded-lg text-center">
                          <p className="text-xs text-gray-500">Total Gestion del Mes</p>
                          <p className="text-xl font-bold text-emerald-700">${gestiones.reduce((s, g) => s + Number(g.monto), 0).toFixed(2)}</p>
                        </div>
                      </div>
                    )}
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

export default function CajaChicaPage() {
  return (
    <PermissionsGuard moduleName="caja_chica">
      {(canEdit) => <CajaChicaContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
