"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Plus, Trash2, Edit2, Search, Lock } from "lucide-react"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { useSortOrder } from "@/hooks/use-sort-order"
import { SortToggleButton } from "@/components/SortToggleButton"
import { diezmosService, type DiezmoRecord, type DiezmoWithMonth } from "@/lib/mod/diezmos-service"
import { todayEcuador } from "@/lib/timezone"

type TipoOfrenda = "diezmo" | "primicia" | "diezmo_especial"
const TIPO_LABELS: Record<TipoOfrenda, string> = { diezmo: "Diezmo", primicia: "Primicia", diezmo_especial: "Ofrenda Especial" }
const TIPO_COLORS: Record<TipoOfrenda, string> = { diezmo: "bg-blue-100 text-blue-800 border-blue-200", primicia: "bg-purple-100 text-purple-800 border-purple-200", diezmo_especial: "bg-rose-100 text-rose-800 border-rose-200" }


function DiezmosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { currentMonth } = useMonth()
  const { checkAndExecute } = useSecurityCheck()
  const [records, setRecords] = useState<DiezmoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DiezmoRecord | null>(null)
  const [editingRecord, setEditingRecord] = useState<DiezmoRecord | null>(null)
  const [form, setForm] = useState({ fecha: todayEcuador(), donador: "", valor: "", tipo_ofrenda: "diezmo" as TipoOfrenda, transaccion: "transferencia" as "efectivo" | "transferencia" })

  // Filtros
  const [filterTipo, setFilterTipo] = useState<string>("todos")
  const [filterTransaccion, setFilterTransaccion] = useState<string>("todos")
  const { ascending: sortAsc, toggle: toggleSort } = useSortOrder(true)

  // Search
  const [searchResults, setSearchResults] = useState<DiezmoWithMonth[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchFilters, setSearchFilters] = useState({ donador: "", fechaDesde: "", fechaHasta: "" })


  const loadData = useCallback(async (silent = false) => {
    if (!currentMonth) return
    try {
      if (!silent) setLoading(true)
      const data = await diezmosService.getDiezmosByMonth(currentMonth.id)
      setRecords(data)
    } catch (error) {
      console.error("Error cargando diezmos:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => { loadData() }, [loadData])
  useRealtime({ table: "diezmos", onChange: () => loadData(true) })

  const handleCreate = async () => {
    if (!form.donador.trim() || !form.valor || !form.fecha || !currentMonth) return
    setSaving(true)
    try {
      const numero = await diezmosService.getNextNumber(currentMonth.id)
      await diezmosService.createDiezmo(
        { mes_id: currentMonth.id, numero, fecha: form.fecha, donador: form.donador.trim(), valor: Number(form.valor), tipo_ofrenda: form.tipo_ofrenda, transaccion: form.transaccion },
        { user_id: user!.id, user_name: user!.username }
      )
      setForm({ fecha: todayEcuador(), donador: "", valor: "", tipo_ofrenda: "diezmo", transaccion: "transferencia" })
      setShowAddDialog(false)
      await loadData(true)
    } catch (error) {
      console.error("Error creando:", error)
    } finally { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!editingRecord || !form.donador.trim() || !form.valor || !form.fecha) return
    setSaving(true)
    try {
      await diezmosService.updateDiezmo(
        editingRecord.id,
        { fecha: form.fecha, donador: form.donador.trim(), valor: Number(form.valor), tipo_ofrenda: form.tipo_ofrenda, transaccion: form.transaccion },
        { user_id: user!.id, user_name: user!.username }
      )
      setShowEditDialog(false)
      setEditingRecord(null)
      setForm({ fecha: todayEcuador(), donador: "", valor: "", tipo_ofrenda: "diezmo", transaccion: "transferencia" })
      await loadData(true)
    } catch (error) {
      console.error("Error editando:", error)
    } finally { setSaving(false) }
  }

  const handleDelete = async (record: DiezmoRecord) => {
    try {
      await diezmosService.deleteDiezmo(record.id, { user_id: user!.id, user_name: user!.username })
      await loadData(true)
    } catch (error) {
      console.error("Error eliminando:", error)
    }
  }

  const openEdit = (record: DiezmoRecord) => {
    setEditingRecord(record)
    setForm({ fecha: record.fecha, donador: record.donador, valor: String(record.valor), tipo_ofrenda: record.tipo_ofrenda || "diezmo", transaccion: record.transaccion || "transferencia" })
    setShowEditDialog(true)
  }

  const handleSearch = async () => {
    try {
      setSearchLoading(true)
      const results = await diezmosService.searchDiezmos(searchFilters)
      setSearchResults(results.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()))
    } catch (error) {
      console.error("Error buscando:", error)
    } finally { setSearchLoading(false) }
  }


  // Filtrar registros
  const filtered = records.filter(r => {
    if (filterTipo !== "todos" && r.tipo_ofrenda !== filterTipo) return false
    if (filterTransaccion !== "todos" && r.transaccion !== filterTransaccion) return false
    return true
  }).sort((a, b) => {
    const diff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    return sortAsc ? diff : -diff
  })

  // Totales
  const totalDiezmoTransf = records.filter(r => (r.tipo_ofrenda === "diezmo" || !r.tipo_ofrenda) && r.transaccion === "transferencia").reduce((s, r) => s + Number(r.valor), 0)
  const totalDiezmoEfectivo = records.filter(r => (r.tipo_ofrenda === "diezmo" || !r.tipo_ofrenda) && r.transaccion === "efectivo").reduce((s, r) => s + Number(r.valor), 0)
  const totalPrimiciaTransf = records.filter(r => r.tipo_ofrenda === "primicia" && r.transaccion === "transferencia").reduce((s, r) => s + Number(r.valor), 0)
  const totalPrimiciaEfectivo = records.filter(r => r.tipo_ofrenda === "primicia" && r.transaccion === "efectivo").reduce((s, r) => s + Number(r.valor), 0)
  const totalEspecialTransf = records.filter(r => r.tipo_ofrenda === "diezmo_especial" && r.transaccion === "transferencia").reduce((s, r) => s + Number(r.valor), 0)
  const totalEspecialEfectivo = records.filter(r => r.tipo_ofrenda === "diezmo_especial" && r.transaccion === "efectivo").reduce((s, r) => s + Number(r.valor), 0)
  const totalGeneral = records.reduce((s, r) => s + Number(r.valor), 0)
  const totalSearchResults = searchResults.reduce((s, r) => s + Number(r.valor), 0)

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    const date = new Date(dateStr + "T12:00:00")
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
  }

  if (loading) {
    return (<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>)
  }
  if (!currentMonth) {
    return (<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>)
  }


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
                <h1 className="text-xl font-semibold text-gray-900">Diezmos y Primicias</h1>
                <p className="text-sm text-gray-600">Mes: {currentMonth?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <SortToggleButton ascending={sortAsc} onToggle={toggleSort} />
              {!canEdit && (<Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1"><Lock className="w-3 h-3" /> Solo lectura</Badge>)}
              {canEdit && (<Button size="sm" onClick={() => { setForm({ fecha: todayEcuador(), donador: "", valor: "", tipo_ofrenda: "diezmo", transaccion: "transferencia" }); setShowAddDialog(true) }}><Plus className="w-4 h-4 mr-1" /> Registrar</Button>)}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="mes" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="mes">Mes Actual</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="mes" className="space-y-6">
            {/* Stats */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
              <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-green-600">${totalDiezmoTransf.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Diezmo Transf.</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-amber-600">${totalDiezmoEfectivo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Diezmo Efectivo</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-purple-600">${totalPrimiciaTransf.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Primicia Transf.</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-purple-400">${totalPrimiciaEfectivo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Primicia Efectivo</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-rose-600">${totalEspecialTransf.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Ofrenda Esp. Transf.</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-rose-400">${totalEspecialEfectivo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Ofrenda Esp. Efectivo</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-lg font-bold text-blue-600">${totalGeneral.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Total General</p></CardContent></Card>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
              <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white">
                <option value="todos">Todos los tipos</option>
                <option value="diezmo">Diezmo</option>
                <option value="primicia">Primicia</option>
                <option value="diezmo_especial">Ofrenda Especial</option>
              </select>
              <select value={filterTransaccion} onChange={(e) => setFilterTransaccion(e.target.value)} className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white">
                <option value="todos">Todas las transacciones</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
              {(filterTipo !== "todos" || filterTransaccion !== "todos") && (
                <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFilterTipo("todos"); setFilterTransaccion("todos") }}>Limpiar</Button>
              )}
              <Badge variant="secondary" className="h-9 flex items-center">{filtered.length} registros</Badge>
            </div>


            {/* Tabla */}
            <Card>
              <CardContent className="pt-6">
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay registros{filterTipo !== "todos" || filterTransaccion !== "todos" ? " con estos filtros" : " para este mes"}.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">#</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Fecha</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Donante</th>
                          <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Tipo</th>
                          <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Transacción</th>
                          <th className="border border-gray-300 px-3 py-2 text-right font-semibold">Valor</th>
                          {canEdit && <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Acc.</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-1.5 font-medium">{record.numero}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{formatDate(record.fecha)}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{record.donador}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-center">
                              <Badge className={`text-xs ${TIPO_COLORS[record.tipo_ofrenda || "diezmo"]}`}>{TIPO_LABELS[record.tipo_ofrenda || "diezmo"]}</Badge>
                            </td>
                            <td className="border border-gray-300 px-3 py-1.5 text-center">
                              <Badge className={`text-xs ${record.transaccion === "transferencia" ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200"}`}>{record.transaccion === "transferencia" ? "Transferencia" : "Efectivo"}</Badge>
                            </td>
                            <td className="border border-gray-300 px-3 py-1.5 text-right font-medium">${Number(record.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                            {canEdit && (
                              <td className="border border-gray-300 px-3 py-1.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => checkAndExecute(record.created_at || new Date().toISOString(), () => openEdit(record))}><Edit2 className="w-3 h-3" /></Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => checkAndExecute(record.created_at || new Date().toISOString(), () => setPendingDelete(record))}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-green-50 font-semibold text-sm">
                          <td colSpan={4} className="border border-gray-300 px-3 py-1.5 text-right">Diezmo Transferencia:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Transf.</Badge></td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalDiezmoTransf.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                        <tr className="bg-amber-50 font-semibold text-sm">
                          <td colSpan={4} className="border border-gray-300 px-3 py-1.5 text-right">Diezmo Efectivo:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Efectivo</Badge></td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalDiezmoEfectivo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                        <tr className="bg-purple-50 font-semibold text-sm">
                          <td colSpan={4} className="border border-gray-300 px-3 py-1.5 text-right">Primicia Transferencia:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">Transf.</Badge></td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalPrimiciaTransf.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                        <tr className="bg-purple-50/50 font-semibold text-sm">
                          <td colSpan={4} className="border border-gray-300 px-3 py-1.5 text-right">Primicia Efectivo:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Efectivo</Badge></td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalPrimiciaEfectivo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                        <tr className="bg-rose-50 font-semibold text-sm">
                          <td colSpan={4} className="border border-gray-300 px-3 py-1.5 text-right">Ofrenda Especial Transferencia:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Transf.</Badge></td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalEspecialTransf.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                        <tr className="bg-rose-50/50 font-semibold text-sm">
                          <td colSpan={4} className="border border-gray-300 px-3 py-1.5 text-right">Ofrenda Especial Efectivo:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Efectivo</Badge></td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalEspecialEfectivo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                        <tr className="bg-blue-50 font-bold text-sm">
                          <td colSpan={5} className="border border-gray-300 px-3 py-1.5 text-right">TOTAL GENERAL:</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right">${totalGeneral.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          {canEdit && <td className="border border-gray-300"></td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* Tab: Historial */}
          <TabsContent value="historial" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Buscar (Todos los meses)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><Label>Donante</Label><Input placeholder="Buscar por nombre..." value={searchFilters.donador} onChange={(e) => setSearchFilters({ ...searchFilters, donador: e.target.value })} /></div>
                  <div><Label>Fecha Desde</Label><Input type="date" value={searchFilters.fechaDesde} onChange={(e) => setSearchFilters({ ...searchFilters, fechaDesde: e.target.value })} /></div>
                  <div><Label>Fecha Hasta</Label><Input type="date" value={searchFilters.fechaHasta} onChange={(e) => setSearchFilters({ ...searchFilters, fechaHasta: e.target.value })} /></div>
                </div>
                <Button onClick={handleSearch} disabled={searchLoading} className="w-full md:w-auto"><Search className="w-4 h-4 mr-2" />{searchLoading ? "Buscando..." : "Buscar"}</Button>
              </CardContent>
            </Card>

            {searchResults.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{searchResults.length}</p><p className="text-xs text-gray-500">Resultados</p></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">${totalSearchResults.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-xs text-gray-500">Total</p></CardContent></Card>
                </div>
                <Card><CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead><tr className="bg-gray-50">
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">#</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Mes</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Fecha</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Donante</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Tipo</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold">Transacción</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-semibold">Valor</th>
                      </tr></thead>
                      <tbody>
                        {searchResults.map((record, i) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-1.5">{i + 1}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{record.mes_name}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{formatDate(record.fecha)}</td>
                            <td className="border border-gray-300 px-3 py-1.5">{record.donador}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className={`text-xs ${TIPO_COLORS[record.tipo_ofrenda || "diezmo"]}`}>{TIPO_LABELS[record.tipo_ofrenda || "diezmo"]}</Badge></td>
                            <td className="border border-gray-300 px-3 py-1.5 text-center"><Badge className={`text-xs ${record.transaccion === "transferencia" ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200"}`}>{record.transaccion === "transferencia" ? "Transferencia" : "Efectivo"}</Badge></td>
                            <td className="border border-gray-300 px-3 py-1.5 text-right font-medium">${Number(record.valor).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent></Card>
              </>
            )}
            {searchResults.length === 0 && !searchLoading && (
              <Card><CardContent className="py-12 text-center text-gray-500"><Search className="w-12 h-12 mx-auto mb-4 text-gray-400" /><p>Usa los filtros para buscar</p></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>


        {/* Dialog: Agregar */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Diezmo / Primicia</DialogTitle><DialogDescription>Ingrese los datos</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
              <div><Label>Donante</Label><Input placeholder="Nombre del donante" value={form.donador} onChange={(e) => setForm({ ...form, donador: e.target.value })} /></div>
              <div><Label>Valor</Label><Input type="number" min="0" step="0.01" placeholder="0.00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo_ofrenda} onValueChange={(v) => setForm({ ...form, tipo_ofrenda: v as TipoOfrenda })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diezmo">Diezmo</SelectItem>
                    <SelectItem value="primicia">Primicia</SelectItem>
                    <SelectItem value="diezmo_especial">Ofrenda Especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Transacción</Label>
                <Select value={form.transaccion} onValueChange={(v) => setForm({ ...form, transaccion: v as "efectivo" | "transferencia" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !form.donador.trim() || !form.valor}>{saving ? "Guardando..." : "Registrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Registro</DialogTitle><DialogDescription>Modifique los datos</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
              <div><Label>Donante</Label><Input placeholder="Nombre del donante" value={form.donador} onChange={(e) => setForm({ ...form, donador: e.target.value })} /></div>
              <div><Label>Valor</Label><Input type="number" min="0" step="0.01" placeholder="0.00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo_ofrenda} onValueChange={(v) => setForm({ ...form, tipo_ofrenda: v as TipoOfrenda })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diezmo">Diezmo</SelectItem>
                    <SelectItem value="primicia">Primicia</SelectItem>
                    <SelectItem value="diezmo_especial">Ofrenda Especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Transacción</Label>
                <Select value={form.transaccion} onValueChange={(v) => setForm({ ...form, transaccion: v as "efectivo" | "transferencia" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving || !form.donador.trim() || !form.valor}>{saving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AlertDialog: Confirmar eliminar */}
        <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
              <AlertDialogDescription>Se eliminará el registro #{pendingDelete?.numero} de {pendingDelete?.donador} (${pendingDelete?.valor}). Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (pendingDelete) handleDelete(pendingDelete); setPendingDelete(null) }}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

export default function DiezmosPage() {
  return (
    <PermissionsGuard moduleName="diezmos">
      {(canEdit) => <DiezmosContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
