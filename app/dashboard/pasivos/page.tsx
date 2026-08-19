"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Plus, Trash2, Pencil, Lock, Wallet, HandCoins } from "lucide-react"
import { pasivosService, type Pasivo, type PasivoAbono } from "@/lib/mod/pasivos-service"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

const METODOS_PAGO = ["Efectivo", "Transferencia", "Cheque", "Tarjeta", "Otro"]

const fmtMoney = (n: number) =>
  `$${(Number(n) || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (s: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("es-EC") : "-")

function PasivosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { currentMonth } = useMonth()
  const { user } = useAuth()
  const audit = user ? { user_id: user.id, user_name: user.username } : undefined

  const [pasivos, setPasivos] = useState<Pasivo[]>([])
  const [abonos, setAbonos] = useState<PasivoAbono[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendiente" | "pagado">("todos")

  // Crear/editar pasivo
  const [showPasivo, setShowPasivo] = useState(false)
  const [editing, setEditing] = useState<Pasivo | null>(null)
  const [form, setForm] = useState({ acreedor: "", detalle: "", monto_total: "", fecha: new Date().toISOString().split("T")[0], observacion: "" })

  // Registrar abono
  const [showAbono, setShowAbono] = useState(false)
  const [abonoTarget, setAbonoTarget] = useState<Pasivo | null>(null)
  const [abonoForm, setAbonoForm] = useState({ monto: "", fecha: new Date().toISOString().split("T")[0], metodo_pago: "Efectivo", observacion: "" })

  // Ver abonos
  const [showHistorial, setShowHistorial] = useState(false)
  const [historialTarget, setHistorialTarget] = useState<Pasivo | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([pasivosService.getPasivos(), pasivosService.getAbonos()])
      setPasivos(p)
      setAbonos(a)
    } catch (error) {
      console.error("Error cargando pasivos:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useRealtimeMultiple(["pasivos", "pasivos_abonos"], () => loadData())

  const abonadoDe = (pasivoId: number) =>
    abonos.filter((a) => a.pasivo_id === pasivoId).reduce((s, a) => s + Number(a.monto), 0)
  const saldoDe = (p: Pasivo) => Number(p.monto_total) - abonadoDe(p.id)

  const totalDeuda = pasivos.reduce((s, p) => s + Number(p.monto_total), 0)
  const totalAbonado = abonos.reduce((s, a) => s + Number(a.monto), 0)
  const totalSaldo = totalDeuda - totalAbonado

  const pasivosFiltrados = pasivos.filter((p) => filtroEstado === "todos" || p.estado === filtroEstado)

  // --- Handlers pasivo ---
  const openNuevo = () => {
    setEditing(null)
    setForm({ acreedor: "", detalle: "", monto_total: "", fecha: new Date().toISOString().split("T")[0], observacion: "" })
    setShowPasivo(true)
  }
  const openEditar = (p: Pasivo) => {
    setEditing(p)
    setForm({ acreedor: p.acreedor, detalle: p.detalle || "", monto_total: String(p.monto_total), fecha: p.fecha, observacion: p.observacion || "" })
    setShowPasivo(true)
  }

  const handleSavePasivo = async () => {
    const monto = parseFloat(form.monto_total)
    if (!form.acreedor.trim() || !monto || monto <= 0) {
      toast.error("Ingrese acreedor y un monto válido")
      return
    }
    setSaving(true)
    try {
      const input = { acreedor: form.acreedor, detalle: form.detalle, monto_total: monto, fecha: form.fecha, observacion: form.observacion }
      if (editing) {
        await pasivosService.updatePasivo(editing.id, input, audit)
        toast.success("Pasivo actualizado")
      } else {
        await pasivosService.createPasivo(input, audit)
        toast.success("Pasivo creado")
      }
      setShowPasivo(false)
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePasivo = async (p: Pasivo) => {
    try {
      await pasivosService.deletePasivo(p, audit)
      toast.success("Pasivo eliminado (y sus egresos)")
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    }
  }

  // --- Handlers abono ---
  const openAbono = (p: Pasivo) => {
    setAbonoTarget(p)
    const saldo = saldoDe(p)
    setAbonoForm({ monto: saldo > 0 ? String(saldo) : "", fecha: new Date().toISOString().split("T")[0], metodo_pago: "Efectivo", observacion: "" })
    setShowAbono(true)
  }

  const handleSaveAbono = async () => {
    if (!abonoTarget) return
    const monto = parseFloat(abonoForm.monto)
    if (!monto || monto <= 0) {
      toast.error("Ingrese un monto de abono válido")
      return
    }
    if (!currentMonth?.id) {
      toast.error("No hay un mes activo; no se puede registrar el egreso del abono")
      return
    }
    setSaving(true)
    try {
      await pasivosService.addAbono(
        abonoTarget,
        currentMonth.id,
        { monto, fecha: abonoForm.fecha, metodo_pago: abonoForm.metodo_pago, observacion: abonoForm.observacion },
        audit,
      )
      toast.success("Abono registrado y egreso creado")
      setShowAbono(false)
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAbono = async (abono: PasivoAbono, acreedor: string) => {
    try {
      await pasivosService.deleteAbono(abono, acreedor, audit)
      toast.success("Abono y egreso eliminados")
      await loadData()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    }
  }

  const abonosHistorial = historialTarget ? abonos.filter((a) => a.pasivo_id === historialTarget.id) : []

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
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">Lista de Pasivos</h1>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="py-4">
            <p className="text-sm text-gray-500">Deuda total</p>
            <p className="text-2xl font-bold text-gray-900">{fmtMoney(totalDeuda)}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-sm text-gray-500">Abonado</p>
            <p className="text-2xl font-bold text-green-600">{fmtMoney(totalAbonado)}</p>
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <p className="text-sm text-gray-500">Saldo pendiente</p>
            <p className="text-2xl font-bold text-red-600">{fmtMoney(totalSaldo)}</p>
          </CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-600">Estado:</Label>
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as any)}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="pagado">Pagados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canEdit && (
            <Button size="sm" onClick={openNuevo}><Plus className="w-4 h-4 mr-2" /> Nuevo pasivo</Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pasivos ({pasivosFiltrados.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acreedor</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Monto total</TableHead>
                    <TableHead className="text-right">Abonado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pasivosFiltrados.map((p) => {
                    const abonado = abonadoDe(p.id)
                    const saldo = Number(p.monto_total) - abonado
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.acreedor}</TableCell>
                        <TableCell className="text-sm text-gray-600">{p.detalle || "-"}</TableCell>
                        <TableCell className="text-sm">{fmtDate(p.fecha)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(p.monto_total)}</TableCell>
                        <TableCell className="text-right text-green-700">{fmtMoney(abonado)}</TableCell>
                        <TableCell className="text-right font-semibold text-red-700">{fmtMoney(saldo)}</TableCell>
                        <TableCell>
                          <Badge className={p.estado === "pagado" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                            {p.estado === "pagado" ? "Pagado" : "Pendiente"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="outline" size="sm" className="h-8" onClick={() => { setHistorialTarget(p); setShowHistorial(true) }}>
                              Abonos
                            </Button>
                            {canEdit && (
                              <>
                                <Button variant="outline" size="sm" className="h-8 border-green-300 text-green-700 hover:bg-green-50" onClick={() => openAbono(p)} disabled={saldo <= 0} title={saldo <= 0 ? "Sin saldo pendiente" : "Registrar abono"}>
                                  <HandCoins className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditar(p)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600"><Trash2 className="w-4 h-4" /></Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar pasivo?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Se eliminará &quot;{p.acreedor}&quot;, sus {abonos.filter((a) => a.pasivo_id === p.id).length} abono(s) y los egresos generados por ellos. Esta acción no se puede deshacer.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeletePasivo(p)}>Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {pasivosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">No hay pasivos registrados.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {!currentMonth && (
          <p className="text-sm text-amber-600">No hay mes activo. Podrás ver y crear pasivos, pero para registrar abonos (que generan un egreso) primero debe existir un mes activo.</p>
        )}
      </main>

      {/* Modal crear/editar pasivo */}
      {canEdit && (
        <Dialog open={showPasivo} onOpenChange={setShowPasivo}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar pasivo" : "Nuevo pasivo"}</DialogTitle>
              <DialogDescription>Deuda que la iglesia tiene con un tercero.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Acreedor (a quién se le debe) *</Label>
                <Input value={form.acreedor} onChange={(e) => setForm({ ...form, acreedor: e.target.value })} placeholder="Nombre" />
              </div>
              <div>
                <Label>Detalle</Label>
                <Input value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} placeholder="Concepto de la deuda" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monto total *</Label>
                  <Input type="number" min="0" step="0.01" value={form.monto_total} onChange={(e) => setForm({ ...form, monto_total: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Observación</Label>
                <Input value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPasivo(false)}>Cancelar</Button>
              <Button onClick={handleSavePasivo} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal registrar abono */}
      {canEdit && (
        <Dialog open={showAbono} onOpenChange={setShowAbono}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar abono</DialogTitle>
              <DialogDescription>
                {abonoTarget ? `${abonoTarget.acreedor} — saldo ${fmtMoney(saldoDe(abonoTarget))}` : ""}
                . Se creará un egreso en el mes activo{currentMonth ? ` (${currentMonth.name})` : ""}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monto *</Label>
                  <Input type="number" min="0" step="0.01" value={abonoForm.monto} onChange={(e) => setAbonoForm({ ...abonoForm, monto: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={abonoForm.fecha} onChange={(e) => setAbonoForm({ ...abonoForm, fecha: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Método de pago</Label>
                <Select value={abonoForm.metodo_pago} onValueChange={(v) => setAbonoForm({ ...abonoForm, metodo_pago: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGO.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observación</Label>
                <Input value={abonoForm.observacion} onChange={(e) => setAbonoForm({ ...abonoForm, observacion: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAbono(false)}>Cancelar</Button>
              <Button onClick={handleSaveAbono} disabled={saving || !currentMonth}>{saving ? "Guardando..." : "Registrar abono"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal historial de abonos */}
      <Dialog open={showHistorial} onOpenChange={setShowHistorial}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abonos — {historialTarget?.acreedor}</DialogTitle>
            <DialogDescription>Historial de pagos de este pasivo.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {abonosHistorial.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Sin abonos registrados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Método</TableHead>
                    {canEdit && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abonosHistorial.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{fmtDate(a.fecha)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(a.monto)}</TableCell>
                      <TableCell className="text-sm">{a.metodo_pago || "-"}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar abono?</AlertDialogTitle>
                                <AlertDialogDescription>Se eliminará este abono de {fmtMoney(a.monto)} y su egreso asociado.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteAbono(a, historialTarget?.acreedor || "")}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistorial(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PasivosPage() {
  return (
    <PermissionsGuard moduleName="pasivos">
      {(canEdit) => <PasivosContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
