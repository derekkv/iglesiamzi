"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { matrimonioService, type Matrimonio, type MatrimonioInput } from "@/lib/mod/matrimonio-service"
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

function MatrimonioContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const { checkAndExecute } = useSecurityCheck()

  const [matrimonios, setMatrimonios] = useState<Matrimonio[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingMatrimonio, setEditingMatrimonio] = useState<Matrimonio | null>(null)
  const [deleteMatrimonioId, setDeleteMatrimonioId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    numero: 1,
    fecha: new Date().toISOString().split("T")[0],
    nombres_esposos: "",
    cedula_esposo: "",
    cedula_esposa: "",
    observacion: "",
  })

  useEffect(() => {
    const initializePage = async () => {
      try {
        await loadMatrimonios()
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
  }, [router])

  const loadMatrimonios = async () => {
    try {
      const data = await matrimonioService.getAll()
      setMatrimonios(data)
    } catch (error: any) {
      console.error("Error loading matrimonios:", error)
      toast({
        title: "Error",
        description: "Error al cargar los matrimonios",
        variant: "destructive",
      })
    }
  }

  const handleOpenAddModal = async () => {
    try {
      const nextNumber = await matrimonioService.getNextNumber()
      setFormData({
        numero: nextNumber,
        fecha: new Date().toISOString().split("T")[0],
        nombres_esposos: "",
        cedula_esposo: "",
        cedula_esposa: "",
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
    setIsSaving(true)

    if (!formData.nombres_esposos || !formData.cedula_esposo || !formData.cedula_esposa) {
      setError("Por favor complete todos los campos obligatorios")
      setIsSaving(false)
      return
    }

    try {
      const matrimonioData: MatrimonioInput = {
        numero: formData.numero,
        fecha: formData.fecha,
        nombres_esposos: formData.nombres_esposos,
        cedula_esposo: formData.cedula_esposo,
        cedula_esposa: formData.cedula_esposa,
        observacion: formData.observacion,
      }

      await matrimonioService.create(matrimonioData, { user_id: user!.id, user_name: user!.username })
      await loadMatrimonios()

      toast({
        title: "Éxito",
        description: "Matrimonio registrado correctamente",
      })

      setIsAddModalOpen(false)
    } catch (error: any) {
      console.error("Error saving matrimonio:", error)
      setError(`Error al guardar: ${error.message}`)
      toast({
        title: "Error",
        description: "Error al guardar el matrimonio",
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

  const handleEdit = (matrimonio: Matrimonio) => {
    checkAndExecute(matrimonio.created_at, () => {
      setEditingMatrimonio(matrimonio)
      setFormData({
        numero: matrimonio.numero,
        fecha: formatDateForInput(matrimonio.fecha),
        nombres_esposos: matrimonio.nombres_esposos,
        cedula_esposo: matrimonio.cedula_esposo,
        cedula_esposa: matrimonio.cedula_esposa,
        observacion: matrimonio.observacion || "",
      })
      setIsEditModalOpen(true)
    })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSaving(true)

    if (!editingMatrimonio) {
      setIsSaving(false)
      return
    }

    if (!formData.nombres_esposos || !formData.cedula_esposo || !formData.cedula_esposa) {
      setError("Por favor complete todos los campos obligatorios")
      setIsSaving(false)
      return
    }

    try {
      const updates: Partial<MatrimonioInput> = {
        numero: formData.numero,
        fecha: formData.fecha,
        nombres_esposos: formData.nombres_esposos,
        cedula_esposo: formData.cedula_esposo,
        cedula_esposa: formData.cedula_esposa,
        observacion: formData.observacion,
      }

      await matrimonioService.update(editingMatrimonio.id, updates, { user_id: user!.id, user_name: user!.username })
      await loadMatrimonios()

      toast({
        title: "Éxito",
        description: "Matrimonio actualizado correctamente",
      })

      setIsEditModalOpen(false)
      setEditingMatrimonio(null)
    } catch (error: any) {
      console.error("Error updating matrimonio:", error)
      setError(`Error al actualizar: ${error.message}`)
      toast({
        title: "Error",
        description: "Error al actualizar el matrimonio",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteRequest = (matrimonio: Matrimonio) => {
    checkAndExecute(matrimonio.created_at, () => {
      setDeleteMatrimonioId(matrimonio.id)
    })
  }

  const confirmDelete = async () => {
    if (!deleteMatrimonioId) return

    try {
      await matrimonioService.delete(deleteMatrimonioId, { user_id: user!.id, user_name: user!.username })
      await loadMatrimonios()

      toast({
        title: "Éxito",
        description: "Matrimonio eliminado correctamente",
      })

      setDeleteMatrimonioId(null)
    } catch (error: any) {
      console.error("Error deleting matrimonio:", error)
      toast({
        title: "Error",
        description: "Error al eliminar el matrimonio",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando matrimonios...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirigiendo...</p>
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
                <h1 className="text-xl font-semibold text-gray-900">Registro de Matrimonios</h1>
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
                    Agregar Matrimonio
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Matrimonios Registrados</CardTitle>
              <CardDescription>Lista de todos los matrimonios registrados</CardDescription>
            </CardHeader>
            <CardContent>
              {matrimonios.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">N°</th>
                        <th className="text-left p-3 font-medium">Fecha</th>
                        <th className="text-left p-3 font-medium">Nombres Esposos</th>
                        <th className="text-left p-3 font-medium">Cédula Esposo</th>
                        <th className="text-left p-3 font-medium">Cédula Esposa</th>
                        <th className="text-left p-3 font-medium">Observación</th>
                        {canEdit && <th className="text-left p-3 font-medium">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {matrimonios.map((matrimonio) => (
                        <tr key={matrimonio.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">{matrimonio.numero}</td>
                          <td className="p-3">{formatDateForTable(matrimonio.fecha)}</td>
                          <td className="p-3">{matrimonio.nombres_esposos}</td>
                          <td className="p-3">{matrimonio.cedula_esposo}</td>
                          <td className="p-3">{matrimonio.cedula_esposa}</td>
                          <td className="p-3">{matrimonio.observacion || "-"}</td>
                          {canEdit && (
                            <td className="p-3">
                              <div className="flex space-x-2">
                                <Button size="sm" variant="outline" onClick={() => handleEdit(matrimonio)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 bg-transparent"
                                  onClick={() => handleDeleteRequest(matrimonio)}
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
                  <p className="text-gray-500 mb-4">No hay matrimonios registrados</p>
                  {canEdit && (
                    <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700">
                      Agregar Primer Matrimonio
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
              <DialogTitle>Agregar Nuevo Matrimonio</DialogTitle>
              <DialogDescription>Complete la información del matrimonio</DialogDescription>
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
                <Label htmlFor="nombres_esposos">Nombres de los Esposos *</Label>
                <Input
                  id="nombres_esposos"
                  value={formData.nombres_esposos}
                  onChange={(e) => setFormData({ ...formData, nombres_esposos: e.target.value })}
                  placeholder="Ej: Juan Pérez y María García"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cedula_esposo">Cédula Esposo *</Label>
                  <Input
                    id="cedula_esposo"
                    value={formData.cedula_esposo}
                    onChange={(e) => setFormData({ ...formData, cedula_esposo: e.target.value })}
                    placeholder="Ej: 1234567890"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cedula_esposa">Cédula Esposa *</Label>
                  <Input
                    id="cedula_esposa"
                    value={formData.cedula_esposa}
                    onChange={(e) => setFormData({ ...formData, cedula_esposa: e.target.value })}
                    placeholder="Ej: 0987654321"
                    required
                  />
                </div>
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
                  {isSaving ? "Guardando..." : "Guardar Matrimonio"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Matrimonio</DialogTitle>
              <DialogDescription>Modifique la información del matrimonio</DialogDescription>
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
                <Label htmlFor="edit-nombres_esposos">Nombres de los Esposos *</Label>
                <Input
                  id="edit-nombres_esposos"
                  value={formData.nombres_esposos}
                  onChange={(e) => setFormData({ ...formData, nombres_esposos: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-cedula_esposo">Cédula Esposo *</Label>
                  <Input
                    id="edit-cedula_esposo"
                    value={formData.cedula_esposo}
                    onChange={(e) => setFormData({ ...formData, cedula_esposo: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cedula_esposa">Cédula Esposa *</Label>
                  <Input
                    id="edit-cedula_esposa"
                    value={formData.cedula_esposa}
                    onChange={(e) => setFormData({ ...formData, cedula_esposa: e.target.value })}
                    required
                  />
                </div>
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
                  {isSaving ? "Guardando..." : "Actualizar Matrimonio"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteMatrimonioId !== null} onOpenChange={() => setDeleteMatrimonioId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar matrimonio?</AlertDialogTitle>
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

export default function MatrimonioPage() {
  return (
    <PermissionsGuard moduleName="matrimonio">
      {(canEdit) => <MatrimonioContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
