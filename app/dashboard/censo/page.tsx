"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { useToast } from "@/hooks/use-toast"
import { useSecurityCheck } from "@/contexts/security-context"
import { useAuth } from "@/contexts/auth-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { censoService, type CensoRecord, type CatalogOption } from "@/lib/mod/censo-service"
import { validarCedulaEnCensos } from "@/lib/mod/censo-validacion-service"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

import { Pencil, Trash2, Eye, Search, Plus, ArrowLeft } from "lucide-react"

// Componentes Modularizados
import { CensoForm } from "./components/CensoForm"
import { CensoDetailView } from "./components/CensoDetailView"
import { CatalogManager } from "./components/CatalogManager"
import { CensoSavedModal } from "./components/CensoSavedModal"

function CensoContent({ canEdit }: { canEdit: boolean }) {
  const [records, setRecords] = useState<CensoRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<CensoRecord[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingB, setIsLoadingB] = useState(false)
  const router = useRouter()

  // Modales
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false)
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false)
  const [savedRecord, setSavedRecord] = useState<CensoRecord | null>(null)

  // Current record y datos del formulario
  const [currentRecord, setCurrentRecord] = useState<CensoRecord | null>(null)
  const [formData, setFormData] = useState<CensoRecord>({
    cedula: "",
    apellidos_nombres: "",
  })

  // Gestión de Catálogos
  const [catalogType, setCatalogType] = useState<string>("")
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([])
  const [allCatalogs, setAllCatalogs] = useState<Record<string, CatalogOption[]>>({})

  const { toast } = useToast()
  const { checkAndExecute } = useSecurityCheck()
  const { user } = useAuth()

  useEffect(() => {
    loadRecords()
    loadAllCatalogs()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredRecords(records)
    } else {
      const filtered = records.filter(
        (r) =>
          r.cedula.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.apellidos_nombres.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.cargo?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setFilteredRecords(filtered)
    }
  }, [searchQuery, records])

  const loadRecords = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const data = await censoService.getAll()
      setRecords(data)
      setFilteredRecords(data)
    } catch (error) {
      console.error("Error loading records:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los registros",
        variant: "destructive",
      })
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  // Realtime: refrescar cuando cambia la tabla censo
  useRealtime({ table: "censo", onChange: () => loadRecords(true) })

  const loadAllCatalogs = async () => {
    try {
      const data = await censoService.getAllCatalogOptions()
      const grouped = data.reduce(
        (acc, option) => {
          if (!acc[option.tipo]) {
            acc[option.tipo] = []
          }
          acc[option.tipo].push(option)
          return acc
        },
        {} as Record<string, CatalogOption[]>,
      )
      setAllCatalogs(grouped)
    } catch (error) {
      console.error("Error loading catalogs:", error)
    }
  }

  const loadCatalogOptions = async (tipo: string) => {
    try {
      const data = await censoService.getCatalogOptions(tipo)
      setCatalogOptions(data)
    } catch (error) {
      console.error("Error loading catalog options:", error)
    }
  }

  const handleEdit = (record: CensoRecord) => {
    checkAndExecute(record.created_at || "", () => {
      setCurrentRecord(record)
      setFormData(record)
      setIsEditDialogOpen(true)
    })
  }

  const handleView = (record: CensoRecord) => {
    setCurrentRecord(record)
    setIsViewDialogOpen(true)
  }

  const handleDelete = (record: CensoRecord) => {
    if (!canEdit) {
      toast({ title: "Sin permiso", description: "No tiene permiso de edición en este módulo", variant: "destructive" })
      return
    }
    checkAndExecute(record.created_at || "", () => {
      setCurrentRecord(record)
      setIsDeleteDialogOpen(true)
    })
  }

  const handleSave = async () => {
    if (!canEdit) {
      toast({ title: "Sin permiso", description: "No tiene permiso de edición en este módulo", variant: "destructive" })
      return
    }
    if (!formData.cedula || !formData.apellidos_nombres) {
      toast({
        title: "Error",
        description: "Cédula y Apellidos y Nombres son obligatorios",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoadingB(true)
      // Validar cédula duplicada en todos los censos
      const validacion = await validarCedulaEnCensos(formData.cedula, "censo")
      if (validacion.existe) {
        toast({
          title: "Cédula ya registrada",
          description: `Esta cédula ya existe en ${validacion.tabla} (${validacion.nombre}). No se puede duplicar.`,
          variant: "destructive",
        })
        setIsLoadingB(false)
        return
      }
      await censoService.create(formData, { user_id: user!.id, user_name: user!.username })
      setSavedRecord(formData)
      setIsSavedModalOpen(true)
      setFormData({ cedula: "", apellidos_nombres: "" })
      setIsAddDialogOpen(false)
      loadRecords()
    } catch (error: any) {
      console.error("Error saving record:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el registro",
        variant: "destructive",
      })
    } finally {
      setIsLoadingB(false)
    }
  }

  const handleUpdate = async () => {
    if (!canEdit) {
      toast({ title: "Sin permiso", description: "No tiene permiso de edición en este módulo", variant: "destructive" })
      return
    }
    if (!currentRecord?.id || !formData.cedula || !formData.apellidos_nombres) {
      toast({
        title: "Error",
        description: "Cédula y Apellidos y Nombres son obligatorios",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoadingB(true)
      // Validar cédula duplicada en todos los censos (excluyendo el registro actual)
      const validacion = await validarCedulaEnCensos(formData.cedula, "censo", currentRecord.id)
      if (validacion.existe) {
        toast({
          title: "Cédula ya registrada",
          description: `Esta cédula ya existe en ${validacion.tabla} (${validacion.nombre}). No se puede duplicar.`,
          variant: "destructive",
        })
        setIsLoadingB(false)
        return
      }
      await censoService.update(currentRecord.id, formData, { user_id: user!.id, user_name: user!.username })
      setSavedRecord(formData)
      setIsSavedModalOpen(true)
      setIsEditDialogOpen(false)
      loadRecords()
    } catch (error: any) {
      console.error("Error updating record:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el registro",
        variant: "destructive",
      })
    } finally {
      setIsLoadingB(false)
    }
  }

  const confirmDelete = async () => {
    if (!canEdit) {
      toast({ title: "Sin permiso", description: "No tiene permiso de edición en este módulo", variant: "destructive" })
      return
    }
    if (!currentRecord?.id) return

    try {
      setIsLoadingB(true)
      await censoService.delete(currentRecord.id, { user_id: user!.id, user_name: user!.username })
      toast({
        title: "Éxito",
        description: "Registro eliminado correctamente",
      })
      setIsDeleteDialogOpen(false)
      loadRecords()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el registro",
        variant: "destructive",
      })
    } finally {
      setIsLoadingB(false)
    }
  }

  const handleManageCatalog = (tipo: string) => {
    setCatalogType(tipo)
    loadCatalogOptions(tipo)
    setIsCatalogDialogOpen(true)
  }

  const handleAddCatalogOption = async (value: string) => {
    try {
      await censoService.createCatalogOption({
        tipo: catalogType,
        valor: value,
      })
      toast({
        title: "Éxito",
        description: "Opción agregada correctamente",
      })
      loadCatalogOptions(catalogType)
      loadAllCatalogs()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar la opción",
        variant: "destructive",
      })
    }
  }

  const handleDeleteCatalogOption = async (id: number) => {
    try {
      await censoService.deleteCatalogOption(id)
      toast({
        title: "Éxito",
        description: "Opción eliminada correctamente",
      })
      loadCatalogOptions(catalogType)
      loadAllCatalogs()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la opción",
        variant: "destructive",
      })
    }
  }

  const getCatalogLabel = (tipo: string): string => {
    const labels: Record<string, string> = {
      si_a_cristo: "Si a Cristo",
      bautizo: "Bautizo",
      tipo_sangre: "Tipo de Sangre",
      estado_civil: "Estado Civil",
      sexo: "Sexo",
      capacidad_esp: "Capacidad Especial",
      nivel_estudio: "Nivel de Estudio",
      jornada_trabajo: "Jornada de Trabajo",
    }
    return labels[tipo] || tipo
  }

  return (
    <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3 sm:h-16">
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
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Gestión de registros de censo</h1>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <Tabs defaultValue={canEdit ? "add" : "list"} className="w-full">
          <TabsList className={canEdit ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
            <TabsTrigger value="list">Lista de Registros</TabsTrigger>
            {canEdit && <TabsTrigger value="add">Agregar Nuevo</TabsTrigger>}
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Registros de Censo</CardTitle>
                <CardDescription>Lista completa de personas registradas en el censo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cédula, nombre o cargo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>

                {isLoading ? (
                  <div className="text-center py-8">Cargando registros...</div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cédula</TableHead>
                          <TableHead>Apellidos y Nombres</TableHead>
                          <TableHead>Edad</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Lugar de Trabajo</TableHead>
                          <TableHead>Fecha Registro</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRecords.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8">
                              No hay registros
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">{record.cedula}</TableCell>
                              <TableCell>{record.apellidos_nombres}</TableCell>
                              <TableCell>{record.edad || "-"}</TableCell>
                              <TableCell>{record.cargo || "-"}</TableCell>
                              <TableCell>{record.lugar_trabajo || "-"}</TableCell>
                              <TableCell>{record.created_at ? new Date(record.created_at).toLocaleDateString("es-EC") : "-"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => handleView(record)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(record)} disabled={!canEdit}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDelete(record)} disabled={!canEdit}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Agregar Nuevo Registro</CardTitle>
                <CardDescription>Complete el formulario para agregar una nueva persona</CardDescription>
              </CardHeader>
              <CardContent>
                <CensoForm
                  formData={formData}
                  onChangeFormData={setFormData}
                  allCatalogs={allCatalogs}
                  onManageCatalog={handleManageCatalog}
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSave()
                  }}
                  onCancel={() => setFormData({ cedula: "", apellidos_nombres: "" })}
                  isSaving={isLoadingB}
                  submitLabel="Guardar Registro"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Detalle */}
        <CensoDetailView
          isOpen={isViewDialogOpen}
          onOpenChange={setIsViewDialogOpen}
          record={currentRecord}
        />

        {/* Modal de Edición */}
        <AlertDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <AlertDialogContent className="w-[calc(100%-1rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Editar Registro</AlertDialogTitle>
              <AlertDialogDescription>Modifique los datos de la persona</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <CensoForm
                formData={formData}
                onChangeFormData={setFormData}
                allCatalogs={allCatalogs}
                onManageCatalog={handleManageCatalog}
                onSubmit={(e) => {
                  e.preventDefault()
                  handleUpdate()
                }}
                onCancel={() => setIsEditDialogOpen(false)}
                isSaving={isLoadingB}
                submitLabel="Actualizar"
              />
            </div>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal de Confirmación de Borrado */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Está seguro de eliminar este registro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará de forma permanente el registro de{" "}
                {currentRecord?.apellidos_nombres}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isLoadingB} className="bg-red-600 hover:bg-red-700">
                {isLoadingB ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal de Configuración de Opciones de Catálogos */}
        <CatalogManager
          isOpen={isCatalogDialogOpen}
          onOpenChange={setIsCatalogDialogOpen}
          catalogType={catalogType}
          catalogLabel={getCatalogLabel(catalogType)}
          options={catalogOptions}
          onAddOption={handleAddCatalogOption}
          onDeleteOption={handleDeleteCatalogOption}
        />

        {/* Modal de Guardado Exitoso */}
        <CensoSavedModal
          isOpen={isSavedModalOpen}
          onOpenChange={setIsSavedModalOpen}
          record={savedRecord}
        />
        </main>
      </div>
  )
}

export default function CensoPage() {
  return (
    <PermissionsGuard moduleName="censo">
      {(canEdit) => <CensoContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
