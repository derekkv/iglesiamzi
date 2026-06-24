"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { bautizoService, type Bautizo, type BautizoInput } from "@/lib/mod/bautizo-service"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Trash2, Edit, Plus, Lock, ArrowLeft } from "lucide-react"

function BautizoContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const { checkAndExecute } = useSecurityCheck()

  const [bautizos, setBautizos] = useState<Bautizo[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingBautizo, setEditingBautizo] = useState<Bautizo | null>(null)
  const [deleteBautizoId, setDeleteBautizoId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    numero: 1,
    fecha: new Date().toISOString().split("T")[0],
    nombre_bautizado: "",
    nombre_padre: "",
    nombre_madre: "",
    padrinos: "",
    observacion: "",
  })

  useEffect(() => {
    const initializePage = async () => {
      try {
        await loadBautizos()
      } catch (error) {
        console.error("Error initializing page:", error)
        toast({
          title: "Error",
          description: "Error al cargar los datos",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    initializePage()
  }, [])

  const loadBautizos = async () => {
    try {
      const data = await bautizoService.getAll()
      setBautizos(data)
    } catch (error: any) {
      console.error("Error loading bautizos:", error)
      toast({
        title: "Error",
        description: "Error al cargar los bautizos",
        variant: "destructive",
      })
    }
  }

  const handleOpenAddModal = async () => {
    if (!canEdit) {
      toast({ title: "Sin permiso", description: "No tiene permiso de edición en este módulo", variant: "destructive" })
      return
    }
    try {
      const nextNumber = await bautizoService.getNextNumber()
      setFormData({
        numero: nextNumber,
        fecha: new Date().toISOString().split("T")[0],
        nombre_bautizado: "",
        nombre_padre: "",
        nombre_madre: "",
        padrinos: "",
        observacion: "",
      })
      setIsAddModalOpen(true)
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al obtener el siguiente número",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.nombre_bautizado || !formData.nombre_padre || !formData.nombre_madre) {
      setError("Por favor complete todos los campos obligatorios")
      setIsSaving(false)
      return
    }

    try {
      setIsSaving(true)
      const bautizoData: BautizoInput = {
        numero: formData.numero,
        fecha: formData.fecha,
        nombre_bautizado: formData.nombre_bautizado,
        nombre_padre: formData.nombre_padre,
        nombre_madre: formData.nombre_madre,
        padrinos: formData.padrinos,
        observacion: formData.observacion,
      }

      await bautizoService.create(bautizoData, { user_id: user!.id, user_name: user!.username })
      await loadBautizos()

      toast({
        title: "Éxito",
        description: "Bautizo registrado correctamente",
      })

      setIsAddModalOpen(false)
    } catch (error: any) {
      console.error("Error saving bautizo:", error)
      setError(`Error al guardar: ${error.message}`)
      toast({
        title: "Error",
        description: "Error al guardar el bautizo",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const day = String(date.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const formatDateForTable = (dateString: string) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    const day = String(date.getUTCDate()).padStart(2, "0")
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const year = date.getUTCFullYear()
    return `${day}/${month}/${year}`
  }

  const handleEdit = (bautizo: Bautizo) => {
    checkAndExecute(bautizo.created_at, () => {
      setEditingBautizo(bautizo)
      setFormData({
        numero: bautizo.numero,
        fecha: formatDateForInput(bautizo.fecha),
        nombre_bautizado: bautizo.nombre_bautizado,
        nombre_padre: bautizo.nombre_padre,
        nombre_madre: bautizo.nombre_madre,
        padrinos: bautizo.padrinos || "",
        observacion: bautizo.observacion || "",
      })
      setIsEditModalOpen(true)
    })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSaving(true)

    if (!editingBautizo) {
      setIsSaving(false)
      return
    }

    if (!formData.nombre_bautizado || !formData.nombre_padre || !formData.nombre_madre) {
      setError("Por favor complete todos los campos obligatorios")
      setIsSaving(false)
      return
    }

    try {
      const updates: Partial<BautizoInput> = {
        numero: formData.numero,
        fecha: formData.fecha,
        nombre_bautizado: formData.nombre_bautizado,
        nombre_padre: formData.nombre_padre,
        nombre_madre: formData.nombre_madre,
        padrinos: formData.padrinos,
        observacion: formData.observacion,
      }

      await bautizoService.update(editingBautizo.id, updates, { user_id: user!.id, user_name: user!.username })
      await loadBautizos()

      toast({
        title: "Éxito",
        description: "Bautizo actualizado correctamente",
      })

      setIsEditModalOpen(false)
      setEditingBautizo(null)
    } catch (error: any) {
      console.error("Error updating bautizo:", error)
      setError(`Error al actualizar: ${error.message}`)
      toast({
        title: "Error",
        description: "Error al actualizar el bautizo",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteRequest = (bautizo: Bautizo) => {
    checkAndExecute(bautizo.created_at, () => {
      setDeleteBautizoId(bautizo.id)
    })
  }

  const confirmDelete = async () => {
    if (!deleteBautizoId) return

    try {
      await bautizoService.delete(deleteBautizoId, { user_id: user!.id, user_name: user!.username })
      await loadBautizos()

      toast({
        title: "Éxito",
        description: "Bautizo eliminado correctamente",
      })

      setDeleteBautizoId(null)
    } catch (error: any) {
      console.error("Error deleting bautizo:", error)
      toast({
        title: "Error",
        description: "Error al eliminar el bautizo",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando bautizos...</p>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Registro de Bautizos</h1>
            </div>
            <div className="flex items-center space-x-4">
              {!canEdit && (
                <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  <Lock className="w-3 h-3" /> Solo lectura
                </span>
              )}
              {canEdit && (
                <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Bautizo
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Bautizos Registrados</CardTitle>
            <CardDescription>Lista de todos los bautizos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {bautizos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">N°</th>
                      <th className="text-left p-3 font-medium">Fecha</th>
                      <th className="text-left p-3 font-medium">Nombre Bautizado</th>
                      <th className="text-left p-3 font-medium">Padre</th>
                      <th className="text-left p-3 font-medium">Madre</th>
                      <th className="text-left p-3 font-medium">Padrinos</th>
                      <th className="text-left p-3 font-medium">Observación</th>
                      {canEdit && <th className="text-left p-3 font-medium">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {bautizos.map((bautizo) => (
                      <tr key={bautizo.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{bautizo.numero}</td>
                        <td className="p-3">{formatDateForTable(bautizo.fecha)}</td>
                        <td className="p-3">{bautizo.nombre_bautizado}</td>
                        <td className="p-3">{bautizo.nombre_padre}</td>
                        <td className="p-3">{bautizo.nombre_madre}</td>
                        <td className="p-3">{bautizo.padrinos || "-"}</td>
                        <td className="p-3">{bautizo.observacion || "-"}</td>
                        {canEdit && (
                          <td className="p-3">
                            <div className="flex space-x-2">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(bautizo)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 bg-transparent"
                                onClick={() => handleDeleteRequest(bautizo)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No hay bautizos registrados</p>
                {canEdit && (
                  <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700">
                    Agregar Primer Bautizo
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Bautizo</DialogTitle>
            <DialogDescription>Complete la información del bautizo</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="numero">Número *</Label>
                <Input
                  id="numero"
                  type="number"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: Number.parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="fecha">Fecha *</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="nombre_bautizado">Nombre del Bautizado *</Label>
              <Input
                id="nombre_bautizado"
                value={formData.nombre_bautizado}
                onChange={(e) => setFormData({ ...formData, nombre_bautizado: e.target.value })}
                placeholder="Ej: Juan Carlos Pérez"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre_padre">Nombre del Padre *</Label>
                <Input
                  id="nombre_padre"
                  value={formData.nombre_padre}
                  onChange={(e) => setFormData({ ...formData, nombre_padre: e.target.value })}
                  placeholder="Ej: Carlos Pérez"
                  required
                />
              </div>
              <div>
                <Label htmlFor="nombre_madre">Nombre de la Madre *</Label>
                <Input
                  id="nombre_madre"
                  value={formData.nombre_madre}
                  onChange={(e) => setFormData({ ...formData, nombre_madre: e.target.value })}
                  placeholder="Ej: María García"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="padrinos">Padrinos</Label>
              <Input
                id="padrinos"
                value={formData.padrinos}
                onChange={(e) => setFormData({ ...formData, padrinos: e.target.value })}
                placeholder="Ej: José López y Ana Martínez (opcional)"
              />
            </div>

            <div>
              <Label htmlFor="observacion">Observación</Label>
              <Textarea
                id="observacion"
                value={formData.observacion}
                onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                placeholder="Observaciones adicionales (opcional)"
              />
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar Bautizo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Bautizo</DialogTitle>
            <DialogDescription>Modifique la información del bautizo</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-numero">Número *</Label>
                <Input
                  id="edit-numero"
                  type="number"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: Number.parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-fecha">Fecha *</Label>
                <Input
                  id="edit-fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-nombre_bautizado">Nombre del Bautizado *</Label>
              <Input
                id="edit-nombre_bautizado"
                value={formData.nombre_bautizado}
                onChange={(e) => setFormData({ ...formData, nombre_bautizado: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-nombre_padre">Nombre del Padre *</Label>
                <Input
                  id="edit-nombre_padre"
                  value={formData.nombre_padre}
                  onChange={(e) => setFormData({ ...formData, nombre_padre: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-nombre_madre">Nombre de la Madre *</Label>
                <Input
                  id="edit-nombre_madre"
                  value={formData.nombre_madre}
                  onChange={(e) => setFormData({ ...formData, nombre_madre: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-padrinos">Padrinos</Label>
              <Input
                id="edit-padrinos"
                value={formData.padrinos}
                onChange={(e) => setFormData({ ...formData, padrinos: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-observacion">Observación</Label>
              <Textarea
                id="edit-observacion"
                value={formData.observacion}
                onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                placeholder="Observaciones adicionales (opcional)"
              />
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Actualizar Bautizo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteBautizoId !== null} onOpenChange={() => setDeleteBautizoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar bautizo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El registro será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function BautizoPage() {
  return (
    <PermissionsGuard moduleName="bautizo">
      {(canEdit) => <BautizoContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
