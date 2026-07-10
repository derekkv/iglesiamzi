"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Plus, Trash2, Edit2, Search, Lock, Send } from "lucide-react"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { useRealtime } from "@/hooks/use-realtime"
import { pagoDiarioService, type PagoDiarioRecord } from "@/lib/mod/pago-diario-service"
import { getGlobalConfig } from "@/lib/globalConfig"
import { supabase } from "@/lib/secure-db"
import { todayEcuador } from "@/lib/timezone"
import { toast } from "sonner"

function PagoDiarioContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { currentMonth } = useMonth()
  const { checkAndExecute } = useSecurityCheck()

  const [records, setRecords] = useState<PagoDiarioRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modals
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PagoDiarioRecord | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PagoDiarioRecord | null>(null)

  // Form
  const [form, setForm] = useState({
    fecha: todayEcuador(),
    nombre: "",
    telefono: "",
    email: "",
    ministerio: "",
    categoria: "",
    detalle: "",
    valor: "",
    metodo_pago: "Transferencia" as "Efectivo" | "Transferencia",
  })

  // Ministerios (from module_groups)
  const [ministerios, setMinisterios] = useState<string[]>([])
  const [categorias, setCategorias] = useState<string[]>([])

  // Search/history
  const [searchResults, setSearchResults] = useState<PagoDiarioRecord[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchFilters, setSearchFilters] = useState({ nombre: "", fechaDesde: "", fechaHasta: "", ministerio: "todos" })

  // Beneficiarios guardados (personas únicas de pagos anteriores)
  const [beneficiarios, setBeneficiarios] = useState<{ nombre: string; telefono: string | null; email: string | null }[]>([])

  const today = todayEcuador()

  const loadData = useCallback(async (silent = false) => {
    if (!currentMonth) return
    try {
      if (!silent) setLoading(true)
      const data = await pagoDiarioService.getByMonth(currentMonth.id)
      setRecords(data)

      // Extraer beneficiarios únicos (nombre más reciente con sus datos)
      const map = new Map<string, { nombre: string; telefono: string | null; email: string | null }>()
      for (const r of data) {
        if (!map.has(r.nombre)) {
          map.set(r.nombre, { nombre: r.nombre, telefono: r.telefono, email: r.email })
        }
      }
      // También cargar de todos los meses para tener historial completo
      const { data: allRecords } = await supabase
        .from("pago_diario")
        .select("nombre, telefono, email")
        .order("created_at", { ascending: false })
      if (allRecords) {
        for (const r of allRecords) {
          if (!map.has(r.nombre)) {
            map.set(r.nombre, { nombre: r.nombre, telefono: r.telefono, email: r.email })
          }
        }
      }
      setBeneficiarios(Array.from(map.values()))
    } catch (error) {
      console.error("Error cargando pagos:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [currentMonth])

  const loadMinisterios = async () => {
    const { data } = await supabase.from("module_groups").select("display_name").order("sort_order", { ascending: true })
    if (data) setMinisterios(data.map((g: any) => g.display_name))
    const config = await getGlobalConfig()
    setCategorias(config.categorias_principales || [])
  }

  useEffect(() => { loadData(); loadMinisterios() }, [loadData])
  useRealtime({ table: "pago_diario", onChange: () => loadData(true) })

  // Filtered: today's records
  const todayRecords = records.filter(r => r.fecha === today)
  const totalToday = todayRecords.reduce((s, r) => s + Number(r.valor), 0)
  const totalMonth = records.reduce((s, r) => s + Number(r.valor), 0)
  const totalSearch = searchResults.reduce((s, r) => s + Number(r.valor), 0)

  const resetForm = () => setForm({ fecha: todayEcuador(), nombre: "", telefono: "", email: "", ministerio: "", categoria: "", detalle: "", valor: "", metodo_pago: "Transferencia" })

  const handleCreate = async () => {
    if (!form.nombre.trim() || !form.valor || !form.ministerio || !form.detalle.trim() || !form.categoria || !currentMonth) {
      toast.error("Complete todos los campos obligatorios")
      return
    }
    if (form.detalle.length > 140) {
      toast.error("El detalle no puede exceder 140 caracteres")
      return
    }
    setSaving(true)
    try {
      const record = await pagoDiarioService.create({
        mes_id: currentMonth.id,
        fecha: form.fecha,
        nombre: form.nombre.trim(),
        telefono: form.telefono || null,
        email: form.email || null,
        ministerio: form.ministerio,
        categoria: form.categoria,
        detalle: form.detalle.trim(),
        valor: Number(form.valor),
        metodo_pago: form.metodo_pago,
      }, { user_id: user!.id, user_name: user!.username })

      // Notify
      await pagoDiarioService.notify(record)

      toast.success("Pago registrado y notificado")
      setShowAddDialog(false)
      resetForm()
      await loadData(true)
    } catch (error: any) {
      console.error("Error creando pago:", error)
      toast.error(error.message || "Error al registrar")
    } finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    if (!editingRecord || !form.nombre.trim() || !form.valor || !form.ministerio || !form.detalle.trim()) {
      toast.error("Complete todos los campos obligatorios")
      return
    }
    if (form.detalle.length > 140) {
      toast.error("El detalle no puede exceder 140 caracteres")
      return
    }
    setSaving(true)
    try {
      await pagoDiarioService.update(editingRecord.id, {
        fecha: form.fecha,
        nombre: form.nombre.trim(),
        telefono: form.telefono || null,
        email: form.email || null,
        ministerio: form.ministerio,
        categoria: form.categoria,
        detalle: form.detalle.trim(),
        valor: Number(form.valor),
        metodo_pago: form.metodo_pago,
      }, { user_id: user!.id, user_name: user!.username })

      toast.success("Pago actualizado")
      setShowEditDialog(false)
      setEditingRecord(null)
      resetForm()
      await loadData(true)
    } catch (error: any) {
      console.error("Error editando:", error)
      toast.error(error.message || "Error al actualizar")
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await pagoDiarioService.delete(pendingDelete.id, { user_id: user!.id, user_name: user!.username })
      toast.success("Pago eliminado")
      setPendingDelete(null)
      await loadData(true)
    } catch (error) {
      console.error("Error eliminando:", error)
      toast.error("Error al eliminar")
    }
  }

  const openEdit = (record: PagoDiarioRecord) => {
    setEditingRecord(record)
    setForm({
      fecha: record.fecha,
      nombre: record.nombre,
      telefono: record.telefono || "",
      email: record.email || "",
      ministerio: record.ministerio,
      categoria: record.categoria || "",
      detalle: record.detalle,
      valor: String(record.valor),
      metodo_pago: record.metodo_pago,
    })
    setShowEditDialog(true)
  }

  const handleSearch = async () => {
    try {
      setSearchLoading(true)
      const results = await pagoDiarioService.search(searchFilters)
      setSearchResults(results)
    } catch (error) {
      console.error("Error buscando:", error)
    } finally { setSearchLoading(false) }
  }

  const formatDate = (d: string) => {
    if (!d) return ""
    const date = new Date(d + "T12:00:00")
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
  }

  if (!currentMonth) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Requiere mes activo</p></div>
  }

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Fecha *</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
        <div><Label>Valor *</Label><Input type="number" min="0" step="0.01" placeholder="0.00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
      </div>
      <div>
        <Label>Nombre / Beneficiario *</Label>
        <Input
          value={form.nombre}
          onChange={(e) => {
            const newName = e.target.value
            setForm({ ...form, nombre: newName })
            // Auto-fill datos si selecciona un beneficiario existente
            const match = beneficiarios.find(b => b.nombre === newName)
            if (match) {
              setForm(prev => ({ ...prev, nombre: newName, telefono: match.telefono || prev.telefono, email: match.email || prev.email }))
            }
          }}
          placeholder="Nombre del beneficiario"
          list="beneficiarios-list"
        />
        <datalist id="beneficiarios-list">
          {beneficiarios.map((b) => <option key={b.nombre} value={b.nombre} />)}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Teléfono (WhatsApp)</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="0980000000" /></div>
        <div><Label>Correo</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" /></div>
      </div>
      <div>
        <Label>Ministerio *</Label>
        <Select value={form.ministerio} onValueChange={(v) => setForm({ ...form, ministerio: v })}>
          <SelectTrigger><SelectValue placeholder="Seleccionar ministerio" /></SelectTrigger>
          <SelectContent>
            {ministerios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            <SelectItem value="Administración">Administración</SelectItem>
            <SelectItem value="General">General</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Categoría *</Label>
        <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
          <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
          <SelectContent>
            {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label>Detalle *</Label>
          <span className={`text-xs ${form.detalle.length > 140 ? "text-red-500" : "text-gray-400"}`}>{form.detalle.length}/140</span>
        </div>
        <Input value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value.slice(0, 140) })} placeholder="Descripción breve del pago" maxLength={140} />
      </div>
      <div>
        <Label>Método de Pago *</Label>
        <Select value={form.metodo_pago} onValueChange={(v) => setForm({ ...form, metodo_pago: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Transferencia">Transferencia</SelectItem>
            <SelectItem value="Efectivo">Efectivo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 sm:h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Pago Diario</h1>
                <p className="text-sm text-gray-600">Mes: {currentMonth?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!canEdit && <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1"><Lock className="w-3 h-3" /> Solo lectura</Badge>}
              {canEdit && (
                <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true) }}>
                  <Plus className="w-4 h-4 mr-1" /> Registrar Pago
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="hoy" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="hoy">Hoy</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          {/* === HOY === */}
          <TabsContent value="hoy" className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-purple-600">${totalToday.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Total Hoy</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{todayRecords.length}</p><p className="text-xs text-gray-500">Pagos Hoy</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">${totalMonth.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Total Mes</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pagos de Hoy — {formatDate(today)}</CardTitle>
                <CardDescription>{todayRecords.length} registros</CardDescription>
              </CardHeader>
              <CardContent>
                {todayRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Beneficiario</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Ministerio</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Detalle</th>
                          <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Método</th>
                          <th className="border border-gray-300 px-3 py-2 text-right font-semibold">Valor</th>
                          {canEdit && <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-20">Acc.</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {todayRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-1.5 font-medium">{r.nombre}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{r.ministerio}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-xs">{r.detalle}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-center">
                              <Badge className={`text-xs ${r.metodo_pago === "Efectivo" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200"}`}>{r.metodo_pago}</Badge>
                            </td>
                            <td className="border border-gray-300 px-3 py-1.5 text-right font-medium">${Number(r.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                            {canEdit && (
                              <td className="border border-gray-300 px-3 py-1.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => checkAndExecute(r.created_at, () => openEdit(r))}><Edit2 className="w-3 h-3" /></Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => checkAndExecute(r.created_at, () => setPendingDelete(r))}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-purple-50 font-bold">
                          <td colSpan={4} className="border border-gray-300 px-3 py-2 text-right">TOTAL:</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">${totalToday.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay pagos registrados hoy.</p>
                    {canEdit && <p className="text-sm mt-1">Haga clic en "Registrar Pago" para comenzar.</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === HISTORIAL === */}
          <TabsContent value="historial" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Buscar Pagos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><Label>Beneficiario</Label><Input placeholder="Buscar..." value={searchFilters.nombre} onChange={(e) => setSearchFilters({ ...searchFilters, nombre: e.target.value })} /></div>
                  <div><Label>Desde</Label><Input type="date" value={searchFilters.fechaDesde} onChange={(e) => setSearchFilters({ ...searchFilters, fechaDesde: e.target.value })} /></div>
                  <div><Label>Hasta</Label><Input type="date" value={searchFilters.fechaHasta} onChange={(e) => setSearchFilters({ ...searchFilters, fechaHasta: e.target.value })} /></div>
                  <div>
                    <Label>Ministerio</Label>
                    <Select value={searchFilters.ministerio} onValueChange={(v) => setSearchFilters({ ...searchFilters, ministerio: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {ministerios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSearch} disabled={searchLoading}><Search className="w-4 h-4 mr-2" />{searchLoading ? "Buscando..." : "Buscar"}</Button>
              </CardContent>
            </Card>

            {searchResults.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{searchResults.length}</p><p className="text-xs text-gray-500">Resultados</p></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">${totalSearch.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Total</p></CardContent></Card>
                </div>
                <Card><CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Fecha</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Beneficiario</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Ministerio</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Detalle</th>
                          <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Método</th>
                          <th className="border border-gray-300 px-3 py-2 text-right font-semibold">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-1.5">{formatDate(r.fecha)}</td>
                            <td className="border border-gray-300 px-3 py-1.5 font-medium">{r.nombre}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{r.ministerio}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-xs">{r.detalle}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-center">
                              <Badge className={`text-xs ${r.metodo_pago === "Efectivo" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200"}`}>{r.metodo_pago}</Badge>
                            </td>
                            <td className="border border-gray-300 px-3 py-1.5 text-right font-medium">${Number(r.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent></Card>
              </>
            )}
            {searchResults.length === 0 && !searchLoading && (
              <Card><CardContent className="py-12 text-center text-gray-500"><Search className="w-12 h-12 mx-auto mb-4 text-gray-400" /><p>Use los filtros para buscar pagos</p></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog: Agregar */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-purple-500" /> Registrar Pago</DialogTitle>
              <DialogDescription>Se notificará por WhatsApp y correo si se proporcionan</DialogDescription>
            </DialogHeader>
            {renderForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? "Guardando..." : "Registrar y Notificar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Pago</DialogTitle>
              <DialogDescription>Modifique los datos del pago</DialogDescription>
            </DialogHeader>
            {renderForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingRecord(null) }}>Cancelar</Button>
              <Button onClick={handleUpdate} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AlertDialog: Confirmar eliminar */}
        <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará el pago de {pendingDelete?.nombre} por ${pendingDelete?.valor}. También se eliminará el egreso vinculado. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

export default function PagoDiarioPage() {
  return (
    <PermissionsGuard moduleName="pago_diario">
      {(canEdit) => <PagoDiarioContent canEdit={!!canEdit} />}
    </PermissionsGuard>
  )
}
