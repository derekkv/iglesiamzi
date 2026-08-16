"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Lock, Plus, Minus, Pencil, Trash2, Package, PackagePlus, PackageMinus, Settings } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import {
  existenciaAyudaService as service,
  type ExistenciaItem,
  type MovimientoExistencia,
  type CategoriaExistencia,
  type TipoMovimiento,
} from "@/lib/mod/existencia-ayuda-service"

// Paleta de colores para badges de categoría (determinista por nombre)
const BADGE_PALETTE = [
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
]

function badgeColor(nombre: string): string {
  let hash = 0
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0
  return BADGE_PALETTE[hash % BADGE_PALETTE.length]
}

const emptyItemForm = {
  nombre: "",
  categoria: "",
  cantidad_actual: "0",
  descripcion: "",
}

const todayStr = () => new Date().toISOString().split("T")[0]

function ExistenciaAyudaContent({ canEdit, canAdmin }: { canEdit: boolean; canAdmin?: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()

  const [categorias, setCategorias] = useState<CategoriaExistencia[]>([])
  const [items, setItems] = useState<ExistenciaItem[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoExistencia[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState("")
  const [filterCategoria, setFilterCategoria] = useState<string>("all")
  const [filterTipoMov, setFilterTipoMov] = useState<string>("all")

  // Dialog item
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ExistenciaItem | null>(null)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [savingItem, setSavingItem] = useState(false)

  // Dialog movimiento (nuevo)
  const [movDialogOpen, setMovDialogOpen] = useState(false)
  const [movForm, setMovForm] = useState({
    item_id: "",
    tipo: "ingreso" as TipoMovimiento,
    cantidad: "",
    motivo: "",
    fecha: todayStr(),
  })
  const [savingMov, setSavingMov] = useState(false)

  // Dialog editar movimiento
  const [editMovDialogOpen, setEditMovDialogOpen] = useState(false)
  const [editingMov, setEditingMov] = useState<MovimientoExistencia | null>(null)
  const [editMovForm, setEditMovForm] = useState({
    tipo: "ingreso" as TipoMovimiento,
    cantidad: "",
    motivo: "",
    fecha: todayStr(),
  })
  const [savingEditMov, setSavingEditMov] = useState(false)

  // Dialog configuración de categorías
  const [configOpen, setConfigOpen] = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState("")

  const usuario = () => ({ id: user!.id, nombre: user!.username })

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [cats, its, movs] = await Promise.all([
        service.getCategorias(),
        service.getItems(),
        service.getMovimientos(),
      ])
      setCategorias(cats)
      setItems(its)
      setMovimientos(movs)
    } catch (error: any) {
      console.error("Error cargando existencia de ayuda:", error)
      toast.error(error?.message || "Error al cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useRealtimeMultiple(
    ["existencia_ayuda_categorias", "existencia_ayuda_items", "existencia_ayuda_movimientos"],
    () => loadData(true)
  )

  // ---------- CATEGORÍAS ----------
  const handleAddCategoria = async () => {
    const nombre = nuevaCategoria.trim()
    if (!nombre) return
    if (categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      toast.error("Esa categoría ya existe")
      return
    }
    try {
      await service.addCategoria(nombre, usuario())
      setNuevaCategoria("")
      toast.success("Categoría agregada")
      await loadData(true)
    } catch (error: any) {
      toast.error(error?.message || "Error al agregar la categoría")
    }
  }

  const handleDeleteCategoria = async (cat: CategoriaExistencia) => {
    const enUso = items.filter((i) => i.categoria === cat.nombre).length
    if (enUso > 0) {
      toast.error(`No se puede eliminar: ${enUso} producto(s) usan la categoría "${cat.nombre}"`)
      return
    }
    try {
      await service.deleteCategoria(cat.id, usuario())
      toast.success("Categoría eliminada")
      await loadData(true)
    } catch (error: any) {
      toast.error(error?.message || "Error al eliminar la categoría")
    }
  }

  // ---------- ITEMS ----------
  const openNewItem = () => {
    setEditingItem(null)
    setItemForm({ ...emptyItemForm, categoria: categorias[0]?.nombre || "" })
    setItemDialogOpen(true)
  }

  const openEditItem = (item: ExistenciaItem) => {
    checkAndExecute(item.created_at || new Date().toISOString(), () => {
      setEditingItem(item)
      setItemForm({
        nombre: item.nombre,
        categoria: item.categoria,
        cantidad_actual: String(item.cantidad_actual),
        descripcion: item.descripcion || "",
      })
      setItemDialogOpen(true)
    })
  }

  const handleSaveItem = async () => {
    if (!itemForm.nombre.trim()) {
      toast.error("Ingrese el nombre del producto")
      return
    }
    if (!itemForm.categoria) {
      toast.error("Seleccione una categoría")
      return
    }
    const cantidad = Number(itemForm.cantidad_actual)
    if (isNaN(cantidad) || cantidad < 0) {
      toast.error("La cantidad debe ser un número válido")
      return
    }

    setSavingItem(true)
    try {
      const payload = {
        nombre: itemForm.nombre,
        categoria: itemForm.categoria,
        cantidad_actual: cantidad,
        descripcion: itemForm.descripcion,
      }
      if (editingItem) {
        await service.updateItem(editingItem.id, payload, usuario())
        toast.success("Producto actualizado")
      } else {
        await service.addItem(payload, usuario())
        toast.success("Producto agregado")
      }
      setItemDialogOpen(false)
      await loadData(true)
    } catch (error: any) {
      toast.error(error?.message || "Error al guardar el producto")
    } finally {
      setSavingItem(false)
    }
  }

  const handleDeleteItem = async (item: ExistenciaItem) => {
    try {
      await service.deleteItem(item.id, usuario())
      toast.success("Producto eliminado")
      await loadData(true)
    } catch (error: any) {
      toast.error(error?.message || "Error al eliminar el producto")
    }
  }

  // ---------- MOVIMIENTOS ----------
  const openMovimiento = (tipo: TipoMovimiento, item?: ExistenciaItem) => {
    setMovForm({
      item_id: item ? String(item.id) : "",
      tipo,
      cantidad: "",
      motivo: "",
      fecha: todayStr(),
    })
    setMovDialogOpen(true)
  }

  const handleSaveMovimiento = async () => {
    if (!movForm.item_id) {
      toast.error("Seleccione un producto")
      return
    }
    const cantidad = Number(movForm.cantidad)
    if (isNaN(cantidad) || cantidad <= 0) {
      toast.error("Ingrese una cantidad mayor a 0")
      return
    }

    setSavingMov(true)
    try {
      await service.registrarMovimiento(
        {
          item_id: Number(movForm.item_id),
          tipo: movForm.tipo,
          cantidad,
          motivo: movForm.motivo,
          fecha: movForm.fecha,
        },
        usuario()
      )
      toast.success(movForm.tipo === "ingreso" ? "Ingreso registrado" : "Egreso registrado")
      setMovDialogOpen(false)
      await loadData(true)
    } catch (error: any) {
      toast.error(error?.message || "Error al registrar el movimiento")
    } finally {
      setSavingMov(false)
    }
  }

  const openEditMov = (mov: MovimientoExistencia) => {
    checkAndExecute(mov.created_at || new Date().toISOString(), () => {
      setEditingMov(mov)
      setEditMovForm({
        tipo: mov.tipo,
        cantidad: String(mov.cantidad),
        motivo: mov.motivo || "",
        fecha: mov.fecha,
      })
      setEditMovDialogOpen(true)
    })
  }

  const handleSaveEditMov = async () => {
    if (!editingMov) return
    const cantidad = Number(editMovForm.cantidad)
    if (isNaN(cantidad) || cantidad <= 0) {
      toast.error("Ingrese una cantidad mayor a 0")
      return
    }
    setSavingEditMov(true)
    try {
      await service.updateMovimiento(
        editingMov.id,
        {
          tipo: editMovForm.tipo,
          cantidad,
          motivo: editMovForm.motivo,
          fecha: editMovForm.fecha,
        },
        usuario()
      )
      toast.success("Movimiento actualizado")
      setEditMovDialogOpen(false)
      await loadData(true)
    } catch (error: any) {
      toast.error(error?.message || "Error al actualizar el movimiento")
    } finally {
      setSavingEditMov(false)
    }
  }

  const handleDeleteMov = async (mov: MovimientoExistencia) => {
    try {
      await service.deleteMovimiento(mov.id, usuario())
      toast.success("Movimiento eliminado")
      await loadData(true)
    } catch (error: any) {
      toast.error(error?.message || "Error al eliminar el movimiento")
    }
  }

  // ---------- DERIVADOS ----------
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = item.nombre.toLowerCase().includes(search.toLowerCase())
      const matchCat = filterCategoria === "all" || item.categoria === filterCategoria
      return matchSearch && matchCat
    })
  }, [items, search, filterCategoria])

  const filteredMovimientos = useMemo(() => {
    return movimientos.filter((mov) => {
      const matchSearch = mov.item_nombre.toLowerCase().includes(search.toLowerCase())
      const matchTipo = filterTipoMov === "all" || mov.tipo === filterTipoMov
      const matchCat = filterCategoria === "all" || mov.categoria === filterCategoria
      return matchSearch && matchTipo && matchCat
    })
  }, [movimientos, search, filterTipoMov, filterCategoria])

  const totales = useMemo(() => {
    const totalUnidades = items.reduce((s, i) => s + Number(i.cantidad_actual), 0)
    const sinExistencia = items.filter((i) => Number(i.cantidad_actual) <= 0).length
    const ingresos = movimientos.filter((m) => m.tipo === "ingreso").length
    const egresos = movimientos.filter((m) => m.tipo === "egreso").length
    return { totalUnidades, sinExistencia, ingresos, egresos }
  }, [items, movimientos])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando existencia de ayuda...</p>
        </div>
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
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </Button>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Existencia de Ayuda</h1>
                  <p className="text-sm text-gray-600">Inventario de ayuda social — REDIL</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                  <Settings className="w-4 h-4 mr-1" /> Categorías
                </Button>
              )}
              {!canEdit && (
                <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  <Lock className="w-3 h-3" /> Solo lectura
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{items.length}</div>
              <div className="text-sm text-gray-600">Productos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-600">{totales.totalUnidades}</div>
              <div className="text-sm text-gray-600">Unidades en existencia</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-600">{totales.sinExistencia}</div>
              <div className="text-sm text-gray-600">Sin existencia</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-700">{totales.ingresos + totales.egresos}</div>
              <div className="text-sm text-gray-600">Movimientos</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="existencia" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="existencia">Existencia</TabsTrigger>
            <TabsTrigger value="movimientos">Ingresos / Egresos</TabsTrigger>
          </TabsList>

          {/* ===================== EXISTENCIA ===================== */}
          <TabsContent value="existencia">
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                    <div>
                      <Label htmlFor="search">Buscar producto</Label>
                      <Input id="search" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div>
                      <Label>Categoría</Label>
                      <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las categorías</SelectItem>
                          {categorias.map((c) => (
                            <SelectItem key={c.id} value={c.nombre}>{c.icon ? `${c.icon} ` : ""}{c.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button onClick={openNewItem}>
                        <Plus className="w-4 h-4 mr-1" /> Agregar producto
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Productos ({filteredItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-semibold">Producto</th>
                        <th className="text-left p-2 font-semibold">Categoría</th>
                        <th className="text-right p-2 font-semibold">Existencia</th>
                        {canEdit && <th className="text-right p-2 font-semibold">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">
                            {item.nombre}
                            {item.descripcion && <div className="text-xs text-gray-500">{item.descripcion}</div>}
                          </td>
                          <td className="p-2">
                            <Badge className={badgeColor(item.categoria)}>{item.categoria}</Badge>
                          </td>
                          <td className="p-2 text-right">
                            <span className={`font-semibold ${Number(item.cantidad_actual) <= 0 ? "text-amber-600" : "text-gray-900"}`}>
                              {item.cantidad_actual}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="p-2">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200" title="Registrar ingreso" onClick={() => openMovimiento("ingreso", item)}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-700 border-red-200" title="Registrar egreso" onClick={() => openMovimiento("egreso", item)}>
                                  <Minus className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" title="Editar producto" onClick={() => openEditItem(item)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive" title="Eliminar producto">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Se eliminará permanentemente "{item.nombre}". Esta acción no se puede deshacer.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={() => checkAndExecute(item.created_at || new Date().toISOString(), () => handleDeleteItem(item))}
                                      >
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredItems.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No se encontraron productos</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===================== MOVIMIENTOS ===================== */}
          <TabsContent value="movimientos">
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                    <div>
                      <Label htmlFor="searchMov">Buscar producto</Label>
                      <Input id="searchMov" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={filterTipoMov} onValueChange={setFilterTipoMov}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="ingreso">Ingresos</SelectItem>
                          <SelectItem value="egreso">Egresos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Categoría</Label>
                      <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {categorias.map((c) => (
                            <SelectItem key={c.id} value={c.nombre}>{c.icon ? `${c.icon} ` : ""}{c.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openMovimiento("ingreso")}>
                        <PackagePlus className="w-4 h-4 mr-1" /> Ingreso
                      </Button>
                      <Button variant="destructive" onClick={() => openMovimiento("egreso")}>
                        <PackageMinus className="w-4 h-4 mr-1" /> Egreso
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registro de movimientos ({filteredMovimientos.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-semibold">Fecha</th>
                        <th className="text-left p-2 font-semibold">Tipo</th>
                        <th className="text-left p-2 font-semibold">Producto</th>
                        <th className="text-right p-2 font-semibold">Cantidad</th>
                        <th className="text-left p-2 font-semibold">Motivo</th>
                        <th className="text-left p-2 font-semibold">Registrado por</th>
                        {canEdit && <th className="text-right p-2 font-semibold">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovimientos.map((mov) => (
                        <tr key={mov.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-sm text-gray-600">{mov.fecha}</td>
                          <td className="p-2">
                            {mov.tipo === "ingreso" ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Ingreso</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 border-red-200">Egreso</Badge>
                            )}
                          </td>
                          <td className="p-2 font-medium">{mov.item_nombre}</td>
                          <td className={`p-2 text-right font-semibold ${mov.tipo === "ingreso" ? "text-emerald-700" : "text-red-700"}`}>
                            {mov.tipo === "ingreso" ? "+" : "-"}{mov.cantidad}
                          </td>
                          <td className="p-2 text-sm text-gray-600">{mov.motivo || "-"}</td>
                          <td className="p-2 text-sm text-gray-600">{mov.usuario_nombre || "-"}</td>
                          {canEdit && (
                            <td className="p-2">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" title="Editar movimiento" onClick={() => openEditMov(mov)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive" title="Eliminar movimiento">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Se revertirá su efecto sobre la existencia de "{mov.item_nombre}". Esta acción no se puede deshacer.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={() => checkAndExecute(mov.created_at || new Date().toISOString(), () => handleDeleteMov(mov))}
                                      >
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredMovimientos.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No hay movimientos registrados</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ===================== DIALOG: CONFIGURACIÓN DE CATEGORÍAS ===================== */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Categorías</DialogTitle>
            <DialogDescription>Agregue o elimine categorías de productos.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Nueva categoría"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCategoria() }}
            />
            <Button onClick={handleAddCategoria}>Agregar</Button>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto mt-2">
            {categorias.map((cat) => {
              const enUso = items.filter((i) => i.categoria === cat.nombre).length
              return (
                <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="flex items-center gap-2">
                    <Badge className={badgeColor(cat.nombre)}>{cat.icon ? `${cat.icon} ` : ""}{cat.nombre}</Badge>
                    {enUso > 0 && <span className="text-xs text-gray-500">{enUso} producto(s)</span>}
                  </span>
                  <Button size="sm" variant="destructive" disabled={enUso > 0} onClick={() => handleDeleteCategoria(cat)} title={enUso > 0 ? "Hay productos usando esta categoría" : "Eliminar"}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )
            })}
            {categorias.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">No hay categorías. Agregue una.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== DIALOG: AGREGAR/EDITAR PRODUCTO ===================== */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar producto" : "Agregar producto"}</DialogTitle>
            <DialogDescription>Complete la información del producto de ayuda.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="i-nombre">Nombre *</Label>
              <Input id="i-nombre" value={itemForm.nombre} onChange={(e) => setItemForm({ ...itemForm, nombre: e.target.value })} placeholder="Ej: Arroz" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoría *</Label>
                <Select value={itemForm.categoria} onValueChange={(v) => setItemForm({ ...itemForm, categoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.nombre}>{c.icon ? `${c.icon} ` : ""}{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="i-cantidad">Existencia actual</Label>
                <Input id="i-cantidad" type="number" min="0" value={itemForm.cantidad_actual} onChange={(e) => setItemForm({ ...itemForm, cantidad_actual: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-gray-500 -mt-2">La existencia también se modifica con los ingresos/egresos.</p>
            <div>
              <Label htmlFor="i-desc">Descripción</Label>
              <Textarea id="i-desc" rows={2} value={itemForm.descripcion} onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveItem} disabled={savingItem}>{savingItem ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== DIALOG: NUEVO MOVIMIENTO ===================== */}
      <Dialog open={movDialogOpen} onOpenChange={setMovDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{movForm.tipo === "ingreso" ? "Registrar ingreso" : "Registrar egreso"}</DialogTitle>
            <DialogDescription>
              {movForm.tipo === "ingreso" ? "Entrada de productos al inventario." : "Salida de productos del inventario."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select value={movForm.tipo} onValueChange={(v) => setMovForm({ ...movForm, tipo: v as TipoMovimiento })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso (entrada)</SelectItem>
                  <SelectItem value="egreso">Egreso (salida)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Producto *</Label>
              <Select value={movForm.item_id} onValueChange={(v) => setMovForm({ ...movForm, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                <SelectContent>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={String(it.id)}>
                      {it.nombre} — existencia: {it.cantidad_actual}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="m-cantidad">Cantidad *</Label>
                <Input id="m-cantidad" type="number" min="1" value={movForm.cantidad} onChange={(e) => setMovForm({ ...movForm, cantidad: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="m-fecha">Fecha *</Label>
                <Input id="m-fecha" type="date" value={movForm.fecha} onChange={(e) => setMovForm({ ...movForm, fecha: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="m-motivo">Motivo / observación</Label>
              <Textarea id="m-motivo" rows={2} value={movForm.motivo} onChange={(e) => setMovForm({ ...movForm, motivo: e.target.value })} placeholder="Ej: Donación, entrega a familia, compra..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMovimiento} disabled={savingMov}>{savingMov ? "Guardando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== DIALOG: EDITAR MOVIMIENTO ===================== */}
      <Dialog open={editMovDialogOpen} onOpenChange={setEditMovDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar movimiento</DialogTitle>
            <DialogDescription>{editingMov?.item_nombre}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select value={editMovForm.tipo} onValueChange={(v) => setEditMovForm({ ...editMovForm, tipo: v as TipoMovimiento })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso (entrada)</SelectItem>
                  <SelectItem value="egreso">Egreso (salida)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="em-cantidad">Cantidad *</Label>
                <Input id="em-cantidad" type="number" min="1" value={editMovForm.cantidad} onChange={(e) => setEditMovForm({ ...editMovForm, cantidad: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="em-fecha">Fecha *</Label>
                <Input id="em-fecha" type="date" value={editMovForm.fecha} onChange={(e) => setEditMovForm({ ...editMovForm, fecha: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="em-motivo">Motivo / observación</Label>
              <Textarea id="em-motivo" rows={2} value={editMovForm.motivo} onChange={(e) => setEditMovForm({ ...editMovForm, motivo: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMovDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEditMov} disabled={savingEditMov}>{savingEditMov ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ExistenciaAyudaPage() {
  return (
    <PermissionsGuard moduleName="existencia_ayuda" alternateModules={["redil_ayuda_social"]}>
      {(canEdit, canAdmin) => <ExistenciaAyudaContent canEdit={canEdit} canAdmin={canAdmin} />}
    </PermissionsGuard>
  )
}
