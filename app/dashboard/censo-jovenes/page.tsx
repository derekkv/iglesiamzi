"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { useToast } from "@/hooks/use-toast"
import { useSecurityCheck } from "@/contexts/security-context"
import { useAuth } from "@/contexts/auth-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { censoJovenesService, type CensoRecord } from "@/lib/mod/censo-jovenes-service"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Pencil, Trash2, Eye, Search, ArrowLeft } from "lucide-react"

import { CensoJovenesForm } from "./components/CensoJovenesForm"
import { CensoJovenesDetailView } from "./components/CensoJovenesDetailView"


function CensoJovenesContent({ canEdit }: { canEdit: boolean }) {
  const [records, setRecords] = useState<CensoRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<CensoRecord[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingB, setIsLoadingB] = useState(false)
  const router = useRouter()

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false)

  const [currentRecord, setCurrentRecord] = useState<CensoRecord | null>(null)
  const [formData, setFormData] = useState<CensoRecord>({ cedula: "", apellidos_nombres: "" })
  const [savedRecord, setSavedRecord] = useState<CensoRecord | null>(null)

  const { toast } = useToast()
  const { checkAndExecute } = useSecurityCheck()
  const { user } = useAuth()

  useEffect(() => { loadRecords() }, [])

  useEffect(() => {
    if (searchQuery.trim() === "") { setFilteredRecords(records) } else {
      const filtered = records.filter((r) =>
        r.cedula.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.apellidos_nombres.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.celular || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredRecords(filtered)
    }
  }, [searchQuery, records])

  const loadRecords = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const data = await censoJovenesService.getAll()
      setRecords(data)
      setFilteredRecords(data)
    } catch (error) { console.error("Error loading records:", error) }
    finally { if (!silent) setIsLoading(false) }
  }

  useRealtime({ table: "censo_jovenes", onChange: () => loadRecords(true) })


  const handleEdit = (record: CensoRecord) => {
    checkAndExecute(record.created_at || "", () => { setCurrentRecord(record); setFormData(record); setIsEditDialogOpen(true) })
  }
  const handleView = (record: CensoRecord) => { setCurrentRecord(record); setIsViewDialogOpen(true) }
  const handleDelete = (record: CensoRecord) => {
    if (!canEdit) return
    checkAndExecute(record.created_at || "", () => { setCurrentRecord(record); setIsDeleteDialogOpen(true) })
  }

  const handleSave = async () => {
    if (!canEdit || !formData.cedula || !formData.apellidos_nombres) {
      toast({ title: "Error", description: "Cédula y Nombres son obligatorios", variant: "destructive" }); return
    }
    try {
      setIsLoadingB(true)
      await censoJovenesService.create(formData, { user_id: user!.id, user_name: user!.username })
      setSavedRecord(formData); setIsSavedModalOpen(true)
      setFormData({ cedula: "", apellidos_nombres: "" }); loadRecords()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo guardar", variant: "destructive" })
    } finally { setIsLoadingB(false) }
  }

  const handleUpdate = async () => {
    if (!canEdit || !currentRecord?.id || !formData.cedula || !formData.apellidos_nombres) {
      toast({ title: "Error", description: "Cédula y Nombres son obligatorios", variant: "destructive" }); return
    }
    try {
      setIsLoadingB(true)
      await censoJovenesService.update(currentRecord.id, formData, { user_id: user!.id, user_name: user!.username })
      setSavedRecord(formData); setIsSavedModalOpen(true); setIsEditDialogOpen(false); loadRecords()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo actualizar", variant: "destructive" })
    } finally { setIsLoadingB(false) }
  }

  const confirmDelete = async () => {
    if (!currentRecord?.id) return
    try {
      setIsLoadingB(true)
      await censoJovenesService.delete(currentRecord.id, { user_id: user!.id, user_name: user!.username })
      toast({ title: "Eliminado", description: "Registro eliminado correctamente" })
      setIsDeleteDialogOpen(false); loadRecords()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo eliminar", variant: "destructive" })
    } finally { setIsLoadingB(false) }
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
              <div><h1 className="text-xl font-semibold text-gray-900">Censo - Jóvenes</h1></div>
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
                <CardTitle>Registros de Censo Jóvenes</CardTitle>
                <CardDescription>Censo del ministerio de Jóvenes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por cédula, nombre o celular..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-sm" />
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
                          <TableHead>Celular</TableHead>
                          <TableHead>Ministerio</TableHead>
                          <TableHead>Fecha Registro</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRecords.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-8">No hay registros</TableCell></TableRow>
                        ) : (
                          filteredRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">{record.cedula}</TableCell>
                              <TableCell>{record.apellidos_nombres}</TableCell>
                              <TableCell>{record.edad || "-"}</TableCell>
                              <TableCell>{record.celular || "-"}</TableCell>
                              <TableCell>{record.ministerio || "-"}</TableCell>
                              <TableCell>{record.created_at ? new Date(record.created_at).toLocaleDateString("es-EC") : "-"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => handleView(record)}><Eye className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(record)} disabled={!canEdit}><Pencil className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDelete(record)} disabled={!canEdit}><Trash2 className="h-4 w-4" /></Button>
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


          {canEdit && (
            <TabsContent value="add" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Agregar Nuevo Registro</CardTitle>
                  <CardDescription>Complete el formulario para agregar un joven al censo</CardDescription>
                </CardHeader>
                <CardContent>
                  <CensoJovenesForm
                    formData={formData}
                    onChangeFormData={setFormData}
                    onSubmit={(e) => { e.preventDefault(); handleSave() }}
                    onCancel={() => setFormData({ cedula: "", apellidos_nombres: "" })}
                    isSaving={isLoadingB}
                    submitLabel="Guardar Registro"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <CensoJovenesDetailView isOpen={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} record={currentRecord} />

        <AlertDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <AlertDialogContent className="w-[calc(100%-1rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Editar Registro</AlertDialogTitle>
              <AlertDialogDescription>Modifique los datos del joven</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <CensoJovenesForm
                formData={formData}
                onChangeFormData={setFormData}
                onSubmit={(e) => { e.preventDefault(); handleUpdate() }}
                onCancel={() => setIsEditDialogOpen(false)}
                isSaving={isLoadingB}
                submitLabel="Actualizar"
              />
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
              <AlertDialogDescription>Se eliminará permanentemente el registro de {currentRecord?.apellidos_nombres}.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isLoadingB} className="bg-red-600 hover:bg-red-700">{isLoadingB ? "Eliminando..." : "Eliminar"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isSavedModalOpen} onOpenChange={setIsSavedModalOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-green-700">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">✓</div>Guardado
              </AlertDialogTitle>
              <AlertDialogDescription>El registro se guardó correctamente.</AlertDialogDescription>
            </AlertDialogHeader>
            {savedRecord && (
              <div className="text-sm space-y-1 py-2">
                <p><strong>Cédula:</strong> {savedRecord.cedula}</p>
                <p><strong>Nombre:</strong> {savedRecord.apellidos_nombres}</p>
                {savedRecord.celular && <p><strong>Celular:</strong> {savedRecord.celular}</p>}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogAction className="bg-green-600 hover:bg-green-700">Aceptar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

export default function CensoJovenesPage() {
  return (
    <PermissionsGuard moduleName="censo-jovenes">
      {(canEdit) => <CensoJovenesContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
