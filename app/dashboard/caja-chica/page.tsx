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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft, Wallet, Plus, Trash2, Lock, DollarSign, Calculator, ClipboardList,
} from "lucide-react"
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
  const [movimientos, setMovimientos] = useState<CajaChicaMovimiento[]>([])
  const [arqueos, setArqueos] = useState<CajaChicaArqueo[]>([])
  const [loading, setLoading] = useState(true)

  // Modal agregar movimiento
  const [showAddMov, setShowAddMov] = useState(false)
  const [movForm, setMovForm] = useState({
    fecha: todayEcuador(), tipo: "Egreso" as "Ingreso" | "Egreso",
    concepto: "", detalle: "", monto: "", metodo_pago: "Efectivo", responsable: "",
  })

  // Form Gestión de Efectivo
  const [gestionForm, setGestionForm] = useState({
    fecha: todayEcuador(), responsable: "", valor: "", detalle: "", metodo_pago: "" as MetodoPagoCaja | "",
  })
  const [savingGestion, setSavingGestion] = useState(false)

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
      const [movs, arqs] = await Promise.all([
        cajaChicaService.getMovimientos(currentMonth.id),
        cajaChicaService.getArqueos(currentMonth.id),
      ])
      setMovimientos(movs)
      setArqueos(arqs)
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

  // Saldo
  const saldo = cajaChicaService.calcularSaldo(movimientos)
  const totalIngresos = movimientos.filter(m => m.tipo === "Ingreso").reduce((s, m) => s + Number(m.monto), 0)
  const totalEgresos = movimientos.filter(m => m.tipo === "Egreso").reduce((s, m) => s + Number(m.monto), 0)

  // Arqueo total calculado
  const arqueoTotal = cajaChicaService.calcularTotalArqueo({
    billetes_20: arqueoForm.billetes_20, billetes_10: arqueoForm.billetes_10,
    billetes_5: arqueoForm.billetes_5, billetes_1: arqueoForm.billetes_1,
    monedas_050: arqueoForm.monedas_050, monedas_025: arqueoForm.monedas_025,
    monedas_010: arqueoForm.monedas_010, monedas_005: arqueoForm.monedas_005,
  })


  // --- Handlers ---
  const handleAddMovimiento = async () => {
    if (!currentMonth || !movForm.concepto || !movForm.monto || !movForm.responsable) {
      toast.error("Complete los campos obligatorios"); return
    }
    try {
      await cajaChicaService.createMovimiento({
        fecha: movForm.fecha, tipo: movForm.tipo, concepto: movForm.concepto,
        detalle: movForm.detalle, monto: Number(movForm.monto),
        metodo_pago: movForm.metodo_pago, responsable: movForm.responsable,
        mes_id: currentMonth.id,
      }, audit)
      toast.success(`${movForm.tipo} registrado`)
      setShowAddMov(false)
      setMovForm({ fecha: todayEcuador(), tipo: "Egreso", concepto: "", detalle: "", monto: "", metodo_pago: "Efectivo", responsable: "" })
      loadData(true)
    } catch (error: any) {
      toast.error(error.message || "Error al registrar")
    }
  }

  const handleDeleteMovimiento = async (id: number) => {
    try {
      await cajaChicaService.deleteMovimiento(id, audit)
      toast.success("Movimiento eliminado")
      loadData(true)
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar")
    }
  }

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
      toast.success("Gestion de efectivo registrada (ingreso creado)")
      setGestionForm({ fecha: todayEcuador(), responsable: "", valor: "", detalle: "", metodo_pago: "" })
      loadData(true)
    } catch (error: any) {
      toast.error(error.message || "Error al registrar")
    } finally { setSavingGestion(false) }
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

  const handleDeleteArqueo = async (id: number) => {
    try {
      await cajaChicaService.deleteArqueo(id, audit)
      toast.success("Arqueo eliminado")
      loadData(true)
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar")
    }
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
              <div className="text-right">
                <p className="text-xs text-gray-500">Saldo actual</p>
                <p className={`text-lg font-bold ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  ${saldo.toFixed(2)}
                </p>
              </div>
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
        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="border-emerald-200">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Total Ingresos</p>
              <p className="text-xl font-bold text-emerald-600">${totalIngresos.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Total Egresos</p>
              <p className="text-xl font-bold text-red-600">${totalEgresos.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Saldo</p>
              <p className={`text-xl font-bold ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>${saldo.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>


        <Tabs defaultValue="detalle" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="detalle"><ClipboardList className="w-4 h-4 mr-2" /> Detalle</TabsTrigger>
            <TabsTrigger value="gestion"><DollarSign className="w-4 h-4 mr-2" /> Gestion Efectivo</TabsTrigger>
            <TabsTrigger value="arqueo"><Calculator className="w-4 h-4 mr-2" /> Arqueo</TabsTrigger>
          </TabsList>

          {/* === TAB 1: DETALLE DE INGRESOS Y EGRESOS === */}
          <TabsContent value="detalle">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Detalle de Ingresos y Egresos</CardTitle>
                  {canEdit && (
                    <Button size="sm" onClick={() => setShowAddMov(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Agregar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {movimientos.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No hay movimientos registrados este mes</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">Concepto</TableHead>
                          <TableHead className="text-xs">Detalle</TableHead>
                          <TableHead className="text-xs">Metodo</TableHead>
                          <TableHead className="text-xs">Responsable</TableHead>
                          <TableHead className="text-xs text-right">Monto</TableHead>
                          {canEdit && <TableHead className="text-xs text-right">Accion</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientos.map((mov) => (
                          <TableRow key={mov.id}>
                            <TableCell className="text-xs">{mov.fecha}</TableCell>
                            <TableCell className="text-xs">
                              <Badge className={mov.tipo === "Ingreso" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                                {mov.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{mov.concepto}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{mov.detalle}</TableCell>
                            <TableCell className="text-xs">{mov.metodo_pago}</TableCell>
                            <TableCell className="text-xs">{mov.responsable}</TableCell>
                            <TableCell className={`text-xs text-right font-semibold ${mov.tipo === "Ingreso" ? "text-emerald-600" : "text-red-600"}`}>
                              {mov.tipo === "Ingreso" ? "+" : "-"}${Number(mov.monto).toFixed(2)}
                            </TableCell>
                            {canEdit && (
                              <TableCell className="text-xs text-right">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-red-500 h-7 px-2">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Eliminar movimiento</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Se eliminara: {mov.concepto} - ${Number(mov.monto).toFixed(2)}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction className="bg-red-600" onClick={() => handleDeleteMovimiento(mov.id)}>Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* === TAB 2: GESTION DE EFECTIVO === */}
          <TabsContent value="gestion">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" /> Gestion del Efectivo
                </CardTitle>
                <CardDescription>
                  Registre aportes o movimientos de efectivo. Al guardar, se crea automaticamente un INGRESO en el detalle de Caja Chica.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!canEdit ? (
                  <p className="text-center text-gray-500 py-8">No tiene permisos de edicion</p>
                ) : (
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
                        placeholder="Descripcion del movimiento..." className="mt-1" rows={3} />
                    </div>
                    <div className="md:col-span-2">
                      <Button onClick={handleGestionEfectivo} disabled={savingGestion} className="w-full bg-emerald-600 hover:bg-emerald-700">
                        {savingGestion ? "Guardando..." : "Registrar Gestion de Efectivo"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* === TAB 3: ARQUEO === */}
          <TabsContent value="arqueo">
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
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-red-500 h-7 px-2">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminar arqueo</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Arqueo de ${Number(a.total).toFixed(2)} por {a.contado_por}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600" onClick={() => handleDeleteArqueo(a.id)}>Eliminar</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
        </Tabs>
      </main>


      {/* Modal: Agregar Movimiento */}
      <Dialog open={showAddMov} onOpenChange={setShowAddMov}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Movimiento</DialogTitle>
            <DialogDescription>Registre un ingreso o egreso en la caja chica</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Fecha *</Label>
                <Input type="date" value={movForm.fecha}
                  onChange={(e) => setMovForm({ ...movForm, fecha: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Tipo *</Label>
                <Select value={movForm.tipo} onValueChange={(v) => setMovForm({ ...movForm, tipo: v as "Ingreso" | "Egreso" })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ingreso">Ingreso</SelectItem>
                    <SelectItem value="Egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm">Concepto *</Label>
              <Input value={movForm.concepto} onChange={(e) => setMovForm({ ...movForm, concepto: e.target.value })}
                placeholder="Ej: Compra de insumos" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Detalle</Label>
              <Textarea value={movForm.detalle} onChange={(e) => setMovForm({ ...movForm, detalle: e.target.value })}
                placeholder="Descripcion adicional..." className="mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Monto ($) *</Label>
                <Input type="number" step="0.01" min="0" value={movForm.monto}
                  onChange={(e) => setMovForm({ ...movForm, monto: e.target.value })} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Metodo de Pago</Label>
                <Input value={movForm.metodo_pago} onChange={(e) => setMovForm({ ...movForm, metodo_pago: e.target.value })}
                  placeholder="Efectivo" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Responsable *</Label>
              <Input value={movForm.responsable} onChange={(e) => setMovForm({ ...movForm, responsable: e.target.value })}
                placeholder="Nombre del responsable" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMov(false)}>Cancelar</Button>
            <Button onClick={handleAddMovimiento}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
