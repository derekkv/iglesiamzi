"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { useToast } from "@/hooks/use-toast"
import { useSecurityCheck } from "@/contexts/security-context"
import { useAuth } from "@/contexts/auth-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { censoMdgService, type CensoRecord, type CatalogOption } from "@/lib/mod/censo-mdg-service"
import { validarCedulaEnCensos } from "@/lib/mod/censo-validacion-service"
import { censoMdgArchivosService, type CensoMdgArchivo } from "@/lib/mod/censo-mdg-archivos-service"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { Pencil, Trash2, Eye, Search, ArrowLeft, Paperclip, Upload, FileText, Image, Download, Loader2 } from "lucide-react"

import { CensoForm } from "@/app/dashboard/censo/components/CensoForm"
import { CensoDetailView } from "@/app/dashboard/censo/components/CensoDetailView"

function CensoMDGContent({ canEdit }: { canEdit: boolean }) {
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
  const [cedulaDuplicadaInfo, setCedulaDuplicadaInfo] = useState<{ open: boolean; tabla: string; nombre: string }>({ open: false, tabla: "", nombre: "" })

  const [currentRecord, setCurrentRecord] = useState<CensoRecord | null>(null)
  const [formData, setFormData] = useState<CensoRecord>({ cedula: "", apellidos_nombres: "" })
  const [savedRecord, setSavedRecord] = useState<CensoRecord | null>(null)

  const [allCatalogs, setAllCatalogs] = useState<Record<string, CatalogOption[]>>({})

  const { toast } = useToast()
  const { checkAndExecute } = useSecurityCheck()
  const { user } = useAuth()

  // Archivos
  const [archivoCounts, setArchivoCounts] = useState<Record<number, number>>({})
  const [viewArchivos, setViewArchivos] = useState<any[]>([])
  const [loadingArchivos, setLoadingArchivos] = useState(false)
  const [previewArchivo, setPreviewArchivo] = useState<any>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const pendingFileInputRef = useRef<HTMLInputElement>(null)
  
  // Vista de tabla
  const [vistaDetallada, setVistaDetallada] = useState(false)

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
          r.apellidos_nombres.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredRecords(filtered)
    }
  }, [searchQuery, records])

  const loadRecords = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const data = await censoMdgService.getAll()
      setRecords(data)
      setFilteredRecords(data)
      // Load file counts
      const ids = data.map(r => r.id!).filter(Boolean)
      if (ids.length > 0) {
        const counts = await censoMdgArchivosService.getCountsByCensoMdgIds(ids)
        setArchivoCounts(counts)
      }
    } catch (error) {
      console.error("Error loading records:", error)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  useRealtime({ table: "censo_mdg", onChange: () => loadRecords(true) })

  const loadAllCatalogs = async () => {
    try {
      const data = await censoMdgService.getAllCatalogOptions()
      const grouped = data.reduce((acc, option) => {
        if (!acc[option.tipo]) acc[option.tipo] = []
        acc[option.tipo].push(option)
        return acc
      }, {} as Record<string, CatalogOption[]>)
      setAllCatalogs(grouped)
    } catch (error) {
      console.error("Error loading catalogs:", error)
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
    setViewArchivos([])
    if (record.id) loadViewArchivos(record.id)
  }

  // === ARCHIVOS ===
  const loadViewArchivos = async (censoMdgId: number) => {
    setLoadingArchivos(true)
    try {
      const archivos = await censoMdgArchivosService.getByCensoMdgId(censoMdgId)
      setViewArchivos(archivos)
    } catch { setViewArchivos([]) }
    finally { setLoadingArchivos(false) }
  }

  const handleUploadFromTable = async (censoMdgId: number) => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.accept = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov"
    input.onchange = async (e: any) => {
      const files = e.target.files as FileList
      if (!files || files.length === 0) return
      const token = localStorage.getItem("authToken")
      if (!token) { toast({ title: "Error", description: "No autenticado", variant: "destructive" }); return }
      let uploaded = 0
      for (const file of Array.from(files)) {
        try {
          await censoMdgArchivosService.upload(censoMdgId, file, token)
          uploaded++
        } catch { toast({ title: "Error", description: `Error subiendo ${file.name}`, variant: "destructive" }) }
      }
      if (uploaded > 0) {
        toast({ title: "Archivos subidos", description: `${uploaded} archivo(s) subido(s)` })
        await loadRecords(true)
        if (currentRecord?.id === censoMdgId) await loadViewArchivos(censoMdgId)
      }
    }
    input.click()
  }

  const handleDeleteArchivo = async (archivoId: number, censoMdgId: number) => {
    try {
      await censoMdgArchivosService.delete(archivoId)
      toast({ title: "Eliminado", description: "Archivo eliminado" })
      await loadViewArchivos(censoMdgId)
      await loadRecords(true)
    } catch { toast({ title: "Error", description: "Error eliminando archivo", variant: "destructive" }) }
  }

  const forceDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); window.URL.revokeObjectURL(blobUrl)
    } catch { window.open(url, "_blank") }
  }

  const getFileIcon = (tipo: string | null) => {
    if (!tipo) return <FileText className="w-4 h-4 text-gray-400" />
    if (tipo.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />
    return <FileText className="w-4 h-4 text-orange-500" />
  }

  const handleDelete = (record: CensoRecord) => {
    if (!canEdit) return
    checkAndExecute(record.created_at || "", () => {
      setCurrentRecord(record)
      setIsDeleteDialogOpen(true)
    })
  }

  const handleSave = async () => {
    if (!canEdit || !formData.cedula || !formData.apellidos_nombres) {
      toast({ title: "Error", description: "Cédula y Nombres son obligatorios", variant: "destructive" })
      return
    }
    try {
      setIsLoadingB(true)
      // Validar cédula duplicada en todos los censos
      const validacion = await validarCedulaEnCensos(formData.cedula, "censo_mdg")
      if (validacion.existe) {
        setCedulaDuplicadaInfo({ open: true, tabla: validacion.tabla!, nombre: validacion.nombre! })
        setIsLoadingB(false)
        return
      }
      const created = await censoMdgService.create(formData, { user_id: user!.id, user_name: user!.username })
      // Subir archivos pendientes si hay
      if (pendingFiles.length > 0 && created.id) {
        const token = localStorage.getItem("authToken")
        if (token) {
          let uploaded = 0
          for (const file of pendingFiles) {
            try {
              await censoMdgArchivosService.upload(created.id, file, token)
              uploaded++
            } catch { /* silenciar errores individuales */ }
          }
          if (uploaded > 0) {
            toast({ title: "Archivos subidos", description: `${uploaded} archivo(s) subido(s) junto al registro` })
          }
        }
        setPendingFiles([])
      }
      setSavedRecord(formData)
      setIsSavedModalOpen(true)
      setFormData({ cedula: "", apellidos_nombres: "" })
      loadRecords()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo guardar", variant: "destructive" })
    } finally {
      setIsLoadingB(false)
    }
  }

  const handleUpdate = async () => {
    if (!canEdit || !currentRecord?.id || !formData.cedula || !formData.apellidos_nombres) {
      toast({ title: "Error", description: "Cédula y Nombres son obligatorios", variant: "destructive" })
      return
    }
    try {
      setIsLoadingB(true)
      // Validar cédula duplicada en todos los censos (excluyendo registro actual)
      const validacion = await validarCedulaEnCensos(formData.cedula, "censo_mdg", currentRecord.id)
      if (validacion.existe) {
        setCedulaDuplicadaInfo({ open: true, tabla: validacion.tabla!, nombre: validacion.nombre! })
        setIsLoadingB(false)
        return
      }
      await censoMdgService.update(currentRecord.id, formData, { user_id: user!.id, user_name: user!.username })
      setSavedRecord(formData)
      setIsSavedModalOpen(true)
      setIsEditDialogOpen(false)
      loadRecords()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo actualizar", variant: "destructive" })
    } finally {
      setIsLoadingB(false)
    }
  }

  const confirmDelete = async () => {
    if (!currentRecord?.id) return
    try {
      setIsLoadingB(true)
      await censoMdgService.delete(currentRecord.id, { user_id: user!.id, user_name: user!.username })
      toast({ title: "Eliminado", description: "Registro eliminado correctamente" })
      setIsDeleteDialogOpen(false)
      loadRecords()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo eliminar", variant: "destructive" })
    } finally {
      setIsLoadingB(false)
    }
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
                <h1 className="text-xl font-semibold text-gray-900">Censo - Mujeres de Gracia</h1>
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
                <CardTitle>Registros de Censo MDG</CardTitle>
                <CardDescription>Censo independiente de Mujeres de Gracia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por cédula o nombre..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-sm" />
                  </div>
                  <Button
                    variant={vistaDetallada ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVistaDetallada(!vistaDetallada)}
                    className="text-xs"
                  >
                    {vistaDetallada ? "Vista simple" : "Vista detallada"}
                  </Button>
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
                          <TableHead>Nuevo Creyente</TableHead>
                          <TableHead>Celular</TableHead>
                          <TableHead>Fecha Registro</TableHead>
                          <TableHead className="text-center">Archivos</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRecords.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8">No hay registros</TableCell>
                          </TableRow>
                        ) : (
                          filteredRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">{record.cedula}</TableCell>
                              <TableCell>{record.apellidos_nombres}</TableCell>
                              <TableCell>{record.edad || "-"}</TableCell>
                              <TableCell>{record.nuevo_creyente ? <span className="text-green-600 font-medium">Sí</span> : <span className="text-gray-400">No</span>}</TableCell>
                              <TableCell>{record.celular || "-"}</TableCell>
                              <TableCell>{record.created_at ? new Date(record.created_at).toLocaleDateString("es-EC") : "-"}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {archivoCounts[record.id!] > 0 && (
                                    <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">
                                      <Paperclip className="w-3 h-3 mr-0.5" />{archivoCounts[record.id!]}
                                    </Badge>
                                  )}
                                  {canEdit && (
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600" onClick={() => handleUploadFromTable(record.id!)} title="Subir archivo">
                                      <Upload className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
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
                  <CardDescription>Complete el formulario para agregar una nueva persona al censo MDG</CardDescription>
                </CardHeader>
                <CardContent>
                  <CensoForm
                    formData={formData}
                    onChangeFormData={setFormData}
                    allCatalogs={allCatalogs}
                    onManageCatalog={() => {}}
                    onSubmit={(e) => { e.preventDefault(); handleSave() }}
                    onCancel={() => { setFormData({ cedula: "", apellidos_nombres: "" }); setPendingFiles([]) }}
                    isSaving={isLoadingB}
                    submitLabel="Guardar Registro"
                    showNuevoCreyente={true}
                  />
                </CardContent>
              </Card>

              {/* Sección de Archivos Adjuntos */}
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    Archivos Adjuntos
                  </CardTitle>
                  <CardDescription>Adjunte archivos que se subirán junto al registro al momento de guardar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    ref={pendingFileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files
                      if (files && files.length > 0) {
                        setPendingFiles((prev) => [...prev, ...Array.from(files)])
                      }
                      e.target.value = ""
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => pendingFileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Seleccionar Archivos
                  </Button>

                  {pendingFiles.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <p className="text-xs text-gray-500">{pendingFiles.length} archivo(s) seleccionado(s) — se subirán al guardar el registro</p>
                      <div className="space-y-1.5">
                        {pendingFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white rounded-md border px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {file.type.startsWith("image/") ? <Image className="w-4 h-4 text-blue-500 flex-shrink-0" /> : <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                              <span className="text-sm truncate">{file.name}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
                              onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <CensoDetailView 
          isOpen={isViewDialogOpen} 
          onOpenChange={setIsViewDialogOpen} 
          record={currentRecord} 
          auditModule="censo-mdg"
          archivos={viewArchivos}
          loadingArchivos={loadingArchivos}
          canEdit={canEdit}
          onUpload={() => currentRecord?.id && handleUploadFromTable(currentRecord.id)}
          onDeleteArchivo={(id) => currentRecord?.id && handleDeleteArchivo(id, currentRecord.id)}
          onPreview={setPreviewArchivo}
          onDownload={forceDownload}
          getFileIcon={getFileIcon}
        />

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
                onManageCatalog={() => {}}
                onSubmit={(e) => { e.preventDefault(); handleUpdate() }}
                onCancel={() => setIsEditDialogOpen(false)}
                isSaving={isLoadingB}
                submitLabel="Actualizar"
                showNuevoCreyente={true}
              />
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará permanentemente el registro de {currentRecord?.apellidos_nombres}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isLoadingB} className="bg-red-600 hover:bg-red-700">
                {isLoadingB ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal guardado */}
        <AlertDialog open={isSavedModalOpen} onOpenChange={setIsSavedModalOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-green-700">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">✓</div>
                Guardado
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

        {/* Modal de Cédula Duplicada */}
        <AlertDialog open={cedulaDuplicadaInfo.open} onOpenChange={(open) => setCedulaDuplicadaInfo(prev => ({ ...prev, open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cédula ya registrada</AlertDialogTitle>
              <AlertDialogDescription>
                Esta cédula ya se encuentra registrada en <strong>{cedulaDuplicadaInfo.tabla}</strong> a nombre de <strong>{cedulaDuplicadaInfo.nombre}</strong>. No se puede duplicar en otro censo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setCedulaDuplicadaInfo({ open: false, tabla: "", nombre: "" })}>Entendido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Modal: Previsualizar Archivo */}
        <Dialog open={!!previewArchivo} onOpenChange={() => setPreviewArchivo(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                {previewArchivo && getFileIcon(previewArchivo.tipo)}
                <span className="truncate">{previewArchivo?.nombre_archivo}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto min-h-0">
              {previewArchivo && (() => {
                const tipo = previewArchivo.tipo || ""
                const url = previewArchivo.url
                if (tipo.startsWith("image/")) return <div className="flex items-center justify-center p-2"><img src={url} alt={previewArchivo.nombre_archivo} className="max-w-full max-h-[70vh] object-contain rounded-lg" /></div>
                if (tipo === "application/pdf" || previewArchivo.nombre_archivo.endsWith(".pdf")) return <iframe src={url} className="w-full h-[70vh] rounded-lg border" title={previewArchivo.nombre_archivo} />
                if (tipo.startsWith("video/")) return <div className="flex items-center justify-center p-2"><video controls className="max-w-full max-h-[70vh] rounded-lg"><source src={url} type={tipo} /></video></div>
                return <div className="flex flex-col items-center justify-center py-12 space-y-4"><FileText className="w-16 h-16 text-gray-300" /><p className="text-sm text-gray-500">No se puede previsualizar este archivo.</p><Button variant="outline" size="sm" onClick={() => forceDownload(url, previewArchivo.nombre_archivo)}><Download className="w-4 h-4 mr-2" /> Descargar</Button></div>
              })()}
            </div>
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => previewArchivo && forceDownload(previewArchivo.url, previewArchivo.nombre_archivo)}><Download className="w-4 h-4 mr-1" /> Descargar</Button>
              <Button variant="outline" onClick={() => setPreviewArchivo(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

export default function CensoMDGPage() {
  return (
    <PermissionsGuard moduleName="censo-mdg">
      {(canEdit) => <CensoMDGContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
