"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { censoService, type CensoRecord, type CatalogOption } from "@/lib/mod/censo-service"
import { useSecurityCheck } from "@/hooks/use-security-check"
import { useAuth } from "@/contexts/auth-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { Pencil, Trash2, Eye, Search, Settings, Plus, ArrowLeft} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"

export default function CensoPage() {
  const [records, setRecords] = useState<CensoRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<CensoRecord[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingB, setIsLoadingB] = useState(false)
  const router = useRouter()

  // Modals
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false)

  // Current record
  const [currentRecord, setCurrentRecord] = useState<CensoRecord | null>(null)
  const [formData, setFormData] = useState<CensoRecord>({
    cedula: "",
    apellidos_nombres: "",
  })

  // Catalog management
  const [catalogType, setCatalogType] = useState<string>("")
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([])
  const [allCatalogs, setAllCatalogs] = useState<Record<string, CatalogOption[]>>({})
  const [newCatalogValue, setNewCatalogValue] = useState("")

  const { toast } = useToast()
  const { checkAndExecute, SecurityKeyDialog } = useSecurityCheck()
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

  const loadRecords = async () => {
    try {
      setIsLoading(true)
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
      setIsLoading(false)
    }
  }

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

  const handleAdd = () => {
    setFormData({
      cedula: "",
      apellidos_nombres: "",
      sueldo: 0,
    })
    setIsAddDialogOpen(true)
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
    checkAndExecute(record.created_at || "", () => {
      setCurrentRecord(record)
      setIsDeleteDialogOpen(true)
    })
  }

  const handleSave = async () => {
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
      await censoService.create(formData)
      toast({
        title: "Éxito",
        description: "Registro creado correctamente",
      })
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
      await censoService.update(currentRecord.id, formData)
      toast({
        title: "Éxito",
        description: "Registro actualizado correctamente",
      })
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
    if (!currentRecord?.id) return

    try {
      setIsLoadingB(true)
      await censoService.delete(currentRecord.id)
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

  const handleAddCatalogOption = async () => {
    if (!newCatalogValue.trim()) return

    try {
      await censoService.createCatalogOption({
        tipo: catalogType,
        valor: newCatalogValue.trim(),
      })
      toast({
        title: "Éxito",
        description: "Opción agregada correctamente",
      })
      setNewCatalogValue("")
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
      acumula_decimos: "Acumula Décimos",
      hoja_vida: "Hoja de Vida",
      estado: "Estado",
      jornada_trabajo: "Jornada de Trabajo",
      cargo: "Cargo",
      local: "Local",
      pagos: "Pagos",
      banco: "Banco",
    }
    return labels[tipo] || tipo
  }

  const renderFormField = (
    label: string,
    field: keyof CensoRecord,
    type: "text" | "date" | "number" | "select" | "textarea" = "text",
    selectType?: string,
  ) => {
    if (type === "select" && selectType) {
      return (
        <div className="space-y-2">
          <Label htmlFor={field}>{label}</Label>
          <div className="flex gap-2">
            <Select
              value={(formData[field] as string) || ""}
              onValueChange={(value) => setFormData({ ...formData, [field]: value })}
            >
              <SelectTrigger id={field}>
                <SelectValue placeholder={`Seleccionar ${label}`} />
              </SelectTrigger>
              <SelectContent>
                {allCatalogs[selectType]?.map((option) => (
                  <SelectItem key={option.id} value={option.valor}>
                    {option.valor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" onClick={() => handleManageCatalog(selectType)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )
    }

    if (type === "textarea") {
      return (
        <div className="space-y-2">
          <Label htmlFor={field}>{label}</Label>
          <Textarea
            id={field}
            value={(formData[field] as string) || ""}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            placeholder={label}
          />
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Label htmlFor={field}>{label}</Label>
        <Input
          id={field}
          type={type}
          value={(formData[field] as string) || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              [field]: type === "number" ? Number.parseFloat(e.target.value) || 0 : e.target.value,
            })
          }
          placeholder={label}
        />
      </div>
    )
  }

  return (
    <PermissionsGuard moduleName="censo">
      <div className="container mx-auto py-6 space-y-6">
        <header className="bg-white shadow-sm border-b">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
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

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Lista de Registros</TabsTrigger>
            <TabsTrigger value="add">Agregar Nuevo</TabsTrigger>
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
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cédula</TableHead>
                          <TableHead>Apellidos y Nombres</TableHead>
                          <TableHead>Edad</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Local</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRecords.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
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
                              <TableCell>{record.local || "-"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => handleView(record)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDelete(record)}>
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSave()
                  }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* DATOS PERSONALES */}
                    <div className="space-y-4 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold bg-green-100 dark:bg-green-900 p-2 rounded">
                        DATOS PERSONALES
                      </h3>
                      {renderFormField("Cédula *", "cedula")}
                      {renderFormField("Apellidos y Nombres *", "apellidos_nombres")}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Fecha de Nacimiento", "fecha_nacimiento", "date")}
                        {renderFormField("Edad", "edad", "number")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Si a Cristo", "si_a_cristo", "select", "si_a_cristo")}
                        {renderFormField("Bautizo", "bautizo", "select", "bautizo")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Tipo de Sangre", "tipo_sangre", "select", "tipo_sangre")}
                        {renderFormField("Estado Civil", "estado_civil", "select", "estado_civil")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Sexo", "sexo", "select", "sexo")}
                        {renderFormField("Capacidad Especial", "capacidad_esp", "select", "capacidad_esp")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Porcentaje", "porcentaje", "number")}
                        {renderFormField("Tipo de Discapacidad", "tipo_discapacidad")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {renderFormField("Celular", "celular")}
                        {renderFormField("Convencional", "convencional")}
                        {renderFormField("Familiar", "familiar")}
                      </div>
                      {renderFormField("Cónyuge", "conyuge")}
                      {renderFormField("Correo", "correo")}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Nivel de Estudio", "nivel_estudio", "select", "nivel_estudio")}
                        {renderFormField("Curso", "curso")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Acumula Décimos", "acumula_decimos", "select", "acumula_decimos")}
                        {renderFormField("Hoja de Vida", "hoja_vida", "select", "hoja_vida")}
                      </div>
                      {renderFormField("Estado", "estado", "select", "estado")}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Fecha Registro SAITE", "fecha_registro_saite", "date")}
                        {renderFormField("Fecha Registro IESS", "fecha_registro_iess", "date")}
                      </div>
                      {renderFormField("Dirección", "direccion", "textarea")}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Ciudad", "ciudad")}
                        {renderFormField("Parroquia", "parroquia")}
                      </div>
                      {renderFormField("Barrio", "barrio")}
                    </div>

                    {/* DATOS IGLESIA */}
                    <div className="space-y-4 bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold bg-orange-100 dark:bg-orange-900 p-2 rounded">
                        DATOS IGLESIA
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Jornada de Trabajo", "jornada_trabajo", "select", "jornada_trabajo")}
                        {renderFormField("Cargo", "cargo", "select", "cargo")}
                      </div>
                      {renderFormField("Local", "local", "select", "local")}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Fecha Ingreso", "fecha_ingreso", "date")}
                        {renderFormField("Fecha Reingreso", "fecha_reingreso", "date")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Fecha Salida", "fecha_salida", "date")}
                        {renderFormField("Días por Mes", "dias_por_mes", "number")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Horas Diarias", "horas_diarias", "number")}
                        {renderFormField("Horas Semanal", "horas_semanal", "number")}
                      </div>
                      {renderFormField("Sueldo", "sueldo", "number")}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderFormField("Pagos", "pagos", "select", "pagos")}
                        {renderFormField("Banco", "banco", "select", "banco")}
                      </div>
                      {renderFormField("# Cuenta", "numero_cuenta")}
                      {renderFormField("Intersección", "interseccion", "textarea")}
                      {renderFormField("Redil", "redil")}
                      {renderFormField("Niños", "ninos", "textarea")}
                      {renderFormField("Otros", "otros", "textarea")}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFormData({ cedula: "", apellidos_nombres: "" })
                      }}
                    >
                      Limpiar
                    </Button>
                    <Button type="submit" disabled={isLoadingB}>
                      {isLoadingB ? "Guardando..." : "Guardar Registro"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View Details Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles del Registro</DialogTitle>
              <DialogDescription>Información completa de la persona</DialogDescription>
            </DialogHeader>
            {currentRecord && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold bg-green-100 dark:bg-green-900 p-2 rounded">DATOS PERSONALES</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Cédula:</strong> {currentRecord.cedula}
                    </p>
                    <p>
                      <strong>Apellidos y Nombres:</strong> {currentRecord.apellidos_nombres}
                    </p>
                    <p>
                      <strong>Fecha de Nacimiento:</strong> {currentRecord.fecha_nacimiento || "-"}
                    </p>
                    <p>
                      <strong>Edad:</strong> {currentRecord.edad || "-"}
                    </p>
                    <p>
                      <strong>Si a Cristo:</strong> {currentRecord.si_a_cristo || "-"}
                    </p>
                    <p>
                      <strong>Bautizo:</strong> {currentRecord.bautizo || "-"}
                    </p>
                    <p>
                      <strong>Tipo de Sangre:</strong> {currentRecord.tipo_sangre || "-"}
                    </p>
                    <p>
                      <strong>Estado Civil:</strong> {currentRecord.estado_civil || "-"}
                    </p>
                    <p>
                      <strong>Sexo:</strong> {currentRecord.sexo || "-"}
                    </p>
                    <p>
                      <strong>Capacidad Especial:</strong> {currentRecord.capacidad_esp || "-"}
                    </p>
                    <p>
                      <strong>Porcentaje:</strong> {currentRecord.porcentaje || "-"}
                    </p>
                    <p>
                      <strong>Tipo de Discapacidad:</strong> {currentRecord.tipo_discapacidad || "-"}
                    </p>
                    <p>
                      <strong>Celular:</strong> {currentRecord.celular || "-"}
                    </p>
                    <p>
                      <strong>Convencional:</strong> {currentRecord.convencional || "-"}
                    </p>
                    <p>
                      <strong>Familiar:</strong> {currentRecord.familiar || "-"}
                    </p>
                    <p>
                      <strong>Cónyuge:</strong> {currentRecord.conyuge || "-"}
                    </p>
                    <p>
                      <strong>Correo:</strong> {currentRecord.correo || "-"}
                    </p>
                    <p>
                      <strong>Nivel de Estudio:</strong> {currentRecord.nivel_estudio || "-"}
                    </p>
                    <p>
                      <strong>Curso:</strong> {currentRecord.curso || "-"}
                    </p>
                    <p>
                      <strong>Acumula Décimos:</strong> {currentRecord.acumula_decimos || "-"}
                    </p>
                    <p>
                      <strong>Hoja de Vida:</strong> {currentRecord.hoja_vida || "-"}
                    </p>
                    <p>
                      <strong>Estado:</strong> {currentRecord.estado || "-"}
                    </p>
                    <p>
                      <strong>Fecha Registro SAITE:</strong> {currentRecord.fecha_registro_saite || "-"}
                    </p>
                    <p>
                      <strong>Fecha Registro IESS:</strong> {currentRecord.fecha_registro_iess || "-"}
                    </p>
                    <p>
                      <strong>Dirección:</strong> {currentRecord.direccion || "-"}
                    </p>
                    <p>
                      <strong>Ciudad:</strong> {currentRecord.ciudad || "-"}
                    </p>
                    <p>
                      <strong>Parroquia:</strong> {currentRecord.parroquia || "-"}
                    </p>
                    <p>
                      <strong>Barrio:</strong> {currentRecord.barrio || "-"}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsViewDialogOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Registro</DialogTitle>
              <DialogDescription>Modifique los datos de la persona</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleUpdate()
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* DATOS PERSONALES */}
                <div className="space-y-4 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold bg-green-100 dark:bg-green-900 p-2 rounded">DATOS PERSONALES</h3>
                  {renderFormField("Cédula *", "cedula")}
                  {renderFormField("Apellidos y Nombres *", "apellidos_nombres")}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Fecha de Nacimiento", "fecha_nacimiento", "date")}
                    {renderFormField("Edad", "edad", "number")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Si a Cristo", "si_a_cristo", "select", "si_a_cristo")}
                    {renderFormField("Bautizo", "bautizo", "select", "bautizo")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Tipo de Sangre", "tipo_sangre", "select", "tipo_sangre")}
                    {renderFormField("Estado Civil", "estado_civil", "select", "estado_civil")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Sexo", "sexo", "select", "sexo")}
                    {renderFormField("Capacidad Especial", "capacidad_esp", "select", "capacidad_esp")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Porcentaje", "porcentaje", "number")}
                    {renderFormField("Tipo de Discapacidad", "tipo_discapacidad")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {renderFormField("Celular", "celular")}
                    {renderFormField("Convencional", "convencional")}
                    {renderFormField("Familiar", "familiar")}
                  </div>
                  {renderFormField("Cónyuge", "conyuge")}
                  {renderFormField("Correo", "correo")}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Nivel de Estudio", "nivel_estudio", "select", "nivel_estudio")}
                    {renderFormField("Curso", "curso")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Acumula Décimos", "acumula_decimos", "select", "acumula_decimos")}
                    {renderFormField("Hoja de Vida", "hoja_vida", "select", "hoja_vida")}
                  </div>
                  {renderFormField("Estado", "estado", "select", "estado")}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Fecha Registro SAITE", "fecha_registro_saite", "date")}
                    {renderFormField("Fecha Registro IESS", "fecha_registro_iess", "date")}
                  </div>
                  {renderFormField("Dirección", "direccion", "textarea")}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Ciudad", "ciudad")}
                    {renderFormField("Parroquia", "parroquia")}
                  </div>
                  {renderFormField("Barrio", "barrio")}
                </div>

                {/* DATOS IGLESIA */}
                <div className="space-y-4 bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold bg-orange-100 dark:bg-orange-900 p-2 rounded">DATOS IGLESIA</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Jornada de Trabajo", "jornada_trabajo", "select", "jornada_trabajo")}
                    {renderFormField("Cargo", "cargo", "select", "cargo")}
                  </div>
                  {renderFormField("Local", "local", "select", "local")}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Fecha Ingreso", "fecha_ingreso", "date")}
                    {renderFormField("Fecha Reingreso", "fecha_reingreso", "date")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Fecha Salida", "fecha_salida", "date")}
                    {renderFormField("Días por Mes", "dias_por_mes", "number")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Horas Diarias", "horas_diarias", "number")}
                    {renderFormField("Horas Semanal", "horas_semanal", "number")}
                  </div>
                  {renderFormField("Sueldo", "sueldo", "number")}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Pagos", "pagos", "select", "pagos")}
                    {renderFormField("Banco", "banco", "select", "banco")}
                  </div>
                  {renderFormField("# Cuenta", "numero_cuenta")}
                  {renderFormField("Intersección", "interseccion", "textarea")}
                  {renderFormField("Redil", "redil")}
                  {renderFormField("Niños", "ninos", "textarea")}
                  {renderFormField("Otros", "otros", "textarea")}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoadingB}>
                  {isLoadingB ? "Actualizando..." : "Actualizar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente el registro de{" "}
                <strong>{currentRecord?.apellidos_nombres}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isLoadingB}>
                {isLoadingB ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Catalog Management Dialog */}
        <Dialog open={isCatalogDialogOpen} onOpenChange={setIsCatalogDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gestionar {getCatalogLabel(catalogType)}</DialogTitle>
              <DialogDescription>Agregue o elimine opciones para este campo</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nueva opción"
                  value={newCatalogValue}
                  onChange={(e) => setNewCatalogValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddCatalogOption()
                    }
                  }}
                />
                <Button onClick={handleAddCatalogOption}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {catalogOptions.map((option) => (
                  <div key={option.id} className="flex items-center justify-between p-2 border rounded">
                    <span>{option.valor}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => option.id && handleDeleteCatalogOption(option.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsCatalogDialogOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SecurityKeyDialog />
      </div>
    </PermissionsGuard>
  )
}
