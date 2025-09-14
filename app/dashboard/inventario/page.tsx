"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { storage, type InventoryItem } from "@/lib/storage"
import { getGlobalConfig, updateGlobalConfig, type GlobalConfig } from "@/lib/globalConfig"

export default function InventarioPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [config, setConfig] = useState<GlobalConfig | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterUbicacion, setFilterUbicacion] = useState("all")
  const [filterMinisterio, setFilterMinisterio] = useState("all")
  const [filterEstado, setFilterEstado] = useState("all")

  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    cantidad: "",
    codigo: "",
    detalle: "",
    numeroSerie: "",
    ubicacion: "",
    ministerio: "",
    estado: "",
  })

  // Config form states
  const [newMinisterio, setNewMinisterio] = useState("")
  const [newUbicacion, setNewUbicacion] = useState("")
  const [newEstado, setNewEstado] = useState("")

  useEffect(() => {
    loadItems()
    loadConfig()
  }, [])

  const loadItems = async () => {
    try {
      const items = await storage.getInventoryItems()
      setItems(items)
    } catch (error) {
      console.error("Error loading items:", error)
    }
  }

  const loadConfig = async () => {
    try {
      const config = await getGlobalConfig()
      setConfig(config)
    } catch (error) {
      console.error("Error loading config:", error)
    }
  }

  const resetForm = () => {
    setFormData({
      cantidad: "",
      codigo: "",
      detalle: "",
      numeroSerie: "",
      ubicacion: "",
      ministerio: "",
      estado: "",
    })
  }

  const handleAddItem = async () => {
    if (
      !formData.cantidad ||
      !formData.codigo ||
      !formData.detalle ||
      !formData.ubicacion ||
      !formData.ministerio ||
      !formData.estado
    ) {
      alert("Por favor complete todos los campos obligatorios")
      return
    }

    setIsSaving(true)
    try {
      const newItem = await storage.addInventoryItem({
        cantidad: Number.parseInt(formData.cantidad),
        codigo: formData.codigo,
        detalle: formData.detalle,
        numeroSerie: formData.numeroSerie,
        ubicacion: formData.ubicacion,
        ministerio: formData.ministerio,
        estado: formData.estado,
        fechaRegistro: new Date().toISOString().split("T")[0],
      })

      setItems((prev) => [newItem, ...prev])
      resetForm()
      setIsAddModalOpen(false)
    } catch (error) {
      console.error("Error adding item:", error)
      alert("Error al guardar el artículo")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditItem = async () => {
    if (
      !editingItem ||
      !formData.cantidad ||
      !formData.codigo ||
      !formData.detalle ||
      !formData.ubicacion ||
      !formData.ministerio ||
      !formData.estado
    ) {
      alert("Por favor complete todos los campos obligatorios")
      return
    }

    setIsEditing(true)
    try {
      const updatedItem = await storage.updateInventoryItem(editingItem.id, {
        cantidad: Number.parseInt(formData.cantidad),
        codigo: formData.codigo,
        detalle: formData.detalle,
        numeroSerie: formData.numeroSerie,
        ubicacion: formData.ubicacion,
        ministerio: formData.ministerio,
        estado: formData.estado,
        fechaRegistro: editingItem.fechaRegistro,
      })

      setItems((prev) => prev.map((item) => (item.id === editingItem.id ? updatedItem : item)))
      resetForm()
      setEditingItem(null)
      setIsEditModalOpen(false)
    } catch (error) {
      console.error("Error updating item:", error)
      alert("Error al actualizar el artículo")
    } finally {
      setIsEditing(false)
    }
  }

  const handleDeleteItem = async (id: string) => {
    try {
      await storage.deleteInventoryItem(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      console.error("Error deleting item:", error)
      alert("Error al eliminar el artículo")
    }
  }

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      cantidad: item.cantidad.toString(),
      codigo: item.codigo,
      detalle: item.detalle,
      numeroSerie: item.numeroSerie,
      ubicacion: item.ubicacion,
      ministerio: item.ministerio,
      estado: item.estado,
    })
    setIsEditModalOpen(true)
  }

  // Config functions
  const addMinisterio = async () => {
    if (!config || !newMinisterio.trim() || config.ministerios.includes(newMinisterio.trim())) return

    const newConfig = {
      ...config,
      ministerios: [...config.ministerios, newMinisterio.trim()],
    }
    setConfig(newConfig)
    await updateGlobalConfig(newConfig)
    setNewMinisterio("")
  }

  const removeMinisterio = async (ministerio: string) => {
    if (!config) return

    const newConfig = {
      ...config,
      ministerios: config.ministerios.filter((m) => m !== ministerio),
    }
    setConfig(newConfig)
    await updateGlobalConfig(newConfig)
  }

  const addUbicacion = async () => {
    if (!config || !newUbicacion.trim() || config.ubicaciones.includes(newUbicacion.trim())) return

    const newConfig = {
      ...config,
      ubicaciones: [...config.ubicaciones, newUbicacion.trim()],
    }
    setConfig(newConfig)
    await updateGlobalConfig(newConfig)
    setNewUbicacion("")
  }

  const removeUbicacion = async (ubicacion: string) => {
    if (!config) return

    const newConfig = {
      ...config,
      ubicaciones: config.ubicaciones.filter((u) => u !== ubicacion),
    }
    setConfig(newConfig)
    await updateGlobalConfig(newConfig)
  }

  const addEstado = async () => {
    if (!config || !newEstado.trim() || config.estados.includes(newEstado.trim())) return

    const newConfig = {
      ...config,
      estados: [...config.estados, newEstado.trim()],
    }
    setConfig(newConfig)
    await updateGlobalConfig(newConfig)
    setNewEstado("")
  }

  const removeEstado = async (estado: string) => {
    if (!config) return

    const newConfig = {
      ...config,
      estados: config.estados.filter((e) => e !== estado),
    }
    setConfig(newConfig)
    await updateGlobalConfig(newConfig)
  }

  if (!config) {
    return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de inventario...</p>
        </div>
      </div>
    )
  }

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.detalle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.numeroSerie.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesUbicacion = filterUbicacion === "all" || item.ubicacion === filterUbicacion
    const matchesMinisterio = filterMinisterio === "all" || item.ministerio === filterMinisterio
    const matchesEstado = filterEstado === "all" || item.estado === filterEstado

    return matchesSearch && matchesUbicacion && matchesMinisterio && matchesEstado
  })

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case "Bueno":
        return "bg-green-100 text-green-800 border-green-200"
      case "Dañado":
        return "bg-red-100 text-red-800 border-red-200"
      case "En Reparación":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Perdido":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "Prestado":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-6">
          <Button variant="outline" onClick={() => window.history.back()} className="mr-4">
            ← Volver
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
            <p className="text-gray-600">Gestión de artículos y equipos de la iglesia</p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div></div>
          <div className="flex space-x-2">
            <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">⚙️ Configuración</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Configuración de Inventario</DialogTitle>
                  <DialogDescription>Gestione los ministerios, ubicaciones y estados disponibles</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="ministerios" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="ministerios">Ministerios</TabsTrigger>
                    <TabsTrigger value="ubicaciones">Ubicaciones</TabsTrigger>
                    <TabsTrigger value="estados">Estados</TabsTrigger>
                  </TabsList>

                  <TabsContent value="ministerios" className="space-y-4">
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Nuevo ministerio"
                        value={newMinisterio}
                        onChange={(e) => setNewMinisterio(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addMinisterio()}
                      />
                      <Button onClick={addMinisterio}>Agregar</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {config.ministerios.map((ministerio) => (
                        <div key={ministerio} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span>{ministerio}</span>
                          <Button size="sm" variant="destructive" onClick={() => removeMinisterio(ministerio)}>
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="ubicaciones" className="space-y-4">
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Nueva ubicación"
                        value={newUbicacion}
                        onChange={(e) => setNewUbicacion(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addUbicacion()}
                      />
                      <Button onClick={addUbicacion}>Agregar</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {config.ubicaciones.map((ubicacion) => (
                        <div key={ubicacion} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span>{ubicacion}</span>
                          <Button size="sm" variant="destructive" onClick={() => removeUbicacion(ubicacion)}>
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="estados" className="space-y-4">
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Nuevo estado"
                        value={newEstado}
                        onChange={(e) => setNewEstado(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addEstado()}
                      />
                      <Button onClick={addEstado}>Agregar</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {config.estados.map((estado) => (
                        <div key={estado} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span>{estado}</span>
                          <Button size="sm" variant="destructive" onClick={() => removeEstado(estado)}>
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button>➕ Agregar Artículo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Agregar Nuevo Artículo</DialogTitle>
                  <DialogDescription>Complete la información del artículo</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cantidad">Cantidad *</Label>
                    <Input
                      id="cantidad"
                      type="number"
                      min="1"
                      value={formData.cantidad}
                      onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      placeholder="Ej: CODIRDD:001"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="detalle">Detalle (Nombre del artículo) *</Label>
                    <Input
                      id="detalle"
                      placeholder="Nombre del artículo"
                      value={formData.detalle}
                      onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="numeroSerie">Número de Serie</Label>
                    <Input
                      id="numeroSerie"
                      placeholder="Ej: AEFGX21"
                      value={formData.numeroSerie}
                      onChange={(e) => setFormData({ ...formData, numeroSerie: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ubicacion">Ubicación *</Label>
                    <Select
                      value={formData.ubicacion}
                      onValueChange={(value) => setFormData({ ...formData, ubicacion: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar ubicación" />
                      </SelectTrigger>
                      <SelectContent>
                        {config.ubicaciones.map((ubicacion) => (
                          <SelectItem key={ubicacion} value={ubicacion}>
                            {ubicacion}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ministerio">Ministerio *</Label>
                    <Select
                      value={formData.ministerio}
                      onValueChange={(value) => setFormData({ ...formData, ministerio: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar ministerio" />
                      </SelectTrigger>
                      <SelectContent>
                        {config.ministerios.map((ministerio) => (
                          <SelectItem key={ministerio} value={ministerio}>
                            {ministerio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="estado">Estado *</Label>
                    <Select
                      value={formData.estado}
                      onValueChange={(value) => setFormData({ ...formData, estado: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {config.estados.map((estado) => (
                          <SelectItem key={estado} value={estado}>
                            {estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddItem} disabled={isSaving}>
                    {isSaving ? "Guardando..." : "Agregar Artículo"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros y Búsqueda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Buscar</Label>
                <Input
                  id="search"
                  placeholder="Buscar por detalle, código o serie..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filterUbicacion">Ubicación</Label>
                <Select value={filterUbicacion} onValueChange={setFilterUbicacion}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las ubicaciones</SelectItem>
                    {config.ubicaciones.map((ubicacion) => (
                      <SelectItem key={ubicacion} value={ubicacion}>
                        {ubicacion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterMinisterio">Ministerio</Label>
                <Select value={filterMinisterio} onValueChange={setFilterMinisterio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los ministerios</SelectItem>
                    {config.ministerios.map((ministerio) => (
                      <SelectItem key={ministerio} value={ministerio}>
                        {ministerio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterEstado">Estado</Label>
                <Select value={filterEstado} onValueChange={setFilterEstado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {config.estados.map((estado) => (
                      <SelectItem key={estado} value={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{items.length}</div>
              <div className="text-sm text-gray-600">Total de Artículos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {items.filter((item) => item.estado === "Bueno").length}
              </div>
              <div className="text-sm text-gray-600">En Buen Estado</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {items.filter((item) => item.estado === "Dañado").length}
              </div>
              <div className="text-sm text-gray-600">Dañados</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {items.filter((item) => item.estado === "En Reparación").length}
              </div>
              <div className="text-sm text-gray-600">En Reparación</div>
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Artículos del Inventario ({filteredItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Cantidad</th>
                    <th className="text-left p-2 font-semibold">Código</th>
                    <th className="text-left p-2 font-semibold">Detalle</th>
                    <th className="text-left p-2 font-semibold">N° Serie</th>
                    <th className="text-left p-2 font-semibold">Ubicación</th>
                    <th className="text-left p-2 font-semibold">Ministerio</th>
                    <th className="text-left p-2 font-semibold">Estado</th>
                    <th className="text-left p-2 font-semibold">Fecha</th>
                    <th className="text-left p-2 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{item.cantidad}</td>
                      <td className="p-2 font-mono text-sm">{item.codigo}</td>
                      <td className="p-2 font-medium">{item.detalle}</td>
                      <td className="p-2 font-mono text-sm">{item.numeroSerie || "-"}</td>
                      <td className="p-2">{item.ubicacion}</td>
                      <td className="p-2">{item.ministerio}</td>
                      <td className="p-2">
                        <Badge className={getEstadoBadgeColor(item.estado)}>{item.estado}</Badge>
                      </td>
                      <td className="p-2 text-sm text-gray-600">{item.fechaRegistro}</td>
                      <td className="p-2">
                        <div className="flex space-x-1">
                          <Button size="sm" variant="outline" onClick={() => openEditModal(item)}>
                            ✏️
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                🗑️
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar artículo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente el artículo "
                                  {item.detalle}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron artículos que coincidan con los filtros
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Artículo</DialogTitle>
              <DialogDescription>Modifique la información del artículo</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-cantidad">Cantidad *</Label>
                <Input
                  id="edit-cantidad"
                  type="number"
                  min="1"
                  value={formData.cantidad}
                  onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-codigo">Código *</Label>
                <Input
                  id="edit-codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="edit-detalle">Detalle *</Label>
                <Input
                  id="edit-detalle"
                  value={formData.detalle}
                  onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-numeroSerie">Número de Serie</Label>
                <Input
                  id="edit-numeroSerie"
                  value={formData.numeroSerie}
                  onChange={(e) => setFormData({ ...formData, numeroSerie: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-ubicacion">Ubicación *</Label>
                <Select
                  value={formData.ubicacion}
                  onValueChange={(value) => setFormData({ ...formData, ubicacion: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.ubicaciones.map((ubicacion) => (
                      <SelectItem key={ubicacion} value={ubicacion}>
                        {ubicacion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-ministerio">Ministerio *</Label>
                <Select
                  value={formData.ministerio}
                  onValueChange={(value) => setFormData({ ...formData, ministerio: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.ministerios.map((ministerio) => (
                      <SelectItem key={ministerio} value={ministerio}>
                        {ministerio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-estado">Estado *</Label>
                <Select value={formData.estado} onValueChange={(value) => setFormData({ ...formData, estado: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.estados.map((estado) => (
                      <SelectItem key={estado} value={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditItem} disabled={isEditing}>
                {isEditing ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
