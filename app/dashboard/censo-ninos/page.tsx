"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft, Search, Plus, Pencil, Trash2, Lock, Loader2, Eye, Paperclip, Upload, FileText, Image, X, Download,
} from "lucide-react"
import { toast } from "sonner"
import {
  censoNinosService,
  calcularEdadDesdeNacimiento,
  determinarGrupoHerederos,
  type CensoNinoRecord,
  type CensoNinoInput,
} from "@/lib/mod/censo-ninos-service"
import { censoNinosArchivosService, type CensoNinoArchivo } from "@/lib/mod/censo-ninos-archivos-service"

// Tipo interno del formulario con display field para fecha
interface FormDataWithDisplay extends CensoNinoInput {
  fecha_nacimiento_display?: string
}

function CensoNinosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()

  const [records, setRecords] = useState<CensoNinoRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Modal crear/editar
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<CensoNinoRecord | null>(null)
  const [formData, setFormData] = useState<FormDataWithDisplay>(getEmptyForm())
  const [saving, setSaving] = useState(false)

  // Modal ver detalle
  const [viewRecord, setViewRecord] = useState<CensoNinoRecord | null>(null)

  // Modal eliminar
  const [deletingRecord, setDeletingRecord] = useState<CensoNinoRecord | null>(null)

  // Archivos
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [archivoCounts, setArchivoCounts] = useState<Record<number, number>>({})
  const [viewArchivos, setViewArchivos] = useState<CensoNinoArchivo[]>([])
  const [loadingArchivos, setLoadingArchivos] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview modal
  const [previewArchivo, setPreviewArchivo] = useState<CensoNinoArchivo | null>(null)

  function getEmptyForm(): FormDataWithDisplay {
    return {
      nombre: "",
      fecha_nacimiento: "",
      edad: null,
      grupo: "",
      nombre_madre: "",
      telefono_madre: "",
      nombre_padre: "",
      telefono_padre: "",
      alergias: "",
      observaciones: "",
      fecha_nacimiento_display: "",
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const data = await censoNinosService.getAll()
      setRecords(data)
      // Load file counts
      const ids = data.map(r => r.id!).filter(Boolean)
      if (ids.length > 0) {
        const counts = await censoNinosArchivosService.getCountsByNinoIds(ids)
        setArchivoCounts(counts)
      }
    } catch (error) {
      console.error("Error cargando censo niños:", error)
      toast.error("Error al cargar registros")
    } finally {
      setIsLoading(false)
    }
  }

  useRealtime({ table: "censo_ninos", onChange: () => loadRecords(true) })

  // === Filtro de búsqueda ===
  const filtered = records.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      r.nombre.toLowerCase().includes(q) ||
      (r.grupo || "").toLowerCase().includes(q) ||
      (r.nombre_madre || "").toLowerCase().includes(q) ||
      (r.nombre_padre || "").toLowerCase().includes(q)
    )
  })

  // === Formatear fecha para tabla ===
  const formatDate = (fecha: string | null | undefined) => {
    if (!fecha) return "-"
    const [y, m, d] = fecha.split("-")
    return `${d}/${m}/${y}`
  }

  // === Manejo de fecha de nacimiento (mismo patrón que censo protocolo) ===
  const handleFechaNacimientoChange = (raw: string) => {
    const updated: FormDataWithDisplay = { ...formData, fecha_nacimiento_display: raw }

    // Intentar parsear: dd/mm/yyyy, dd-mm-yyyy, dd mm yyyy, dd,mm,yyyy
    const cleaned = raw.replace(/[/,\-]/g, " ").replace(/\s+/g, " ").trim()
    const parts = cleaned.split(" ")
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const year = parseInt(parts[2], 10)
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        updated.fecha_nacimiento = dateStr
        updated.edad = calcularEdadDesdeNacimiento(dateStr)
        // Auto-asignar grupo según edad
        const grupo = determinarGrupoHerederos(updated.edad)
        if (grupo) updated.grupo = grupo
      }
    } else {
      // Si no se puede parsear, limpiar fecha y edad
      if (!raw.trim()) {
        updated.fecha_nacimiento = null
        updated.edad = null
      }
    }

    setFormData(updated)
  }

  // === CREAR / EDITAR ===
  const openCreateModal = () => {
    setEditingRecord(null)
    setFormData(getEmptyForm())
    setPendingFiles([])
    setShowFormModal(true)
  }

  const openEditModal = (record: CensoNinoRecord) => {
    if (!canEdit) {
      toast.error("No tiene permiso de edición en este módulo")
      return
    }
    checkAndExecute(record.created_at || "", () => {
      setEditingRecord(record)
      setPendingFiles([])
      // Preparar display de fecha
      let fechaDisplay = ""
      if (record.fecha_nacimiento) {
        const parts = record.fecha_nacimiento.split("-")
        if (parts.length === 3) {
          fechaDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`
        }
      }
      setFormData({
        nombre: record.nombre || "",
        fecha_nacimiento: record.fecha_nacimiento || "",
        edad: record.edad ?? null,
        grupo: record.grupo || "",
        nombre_madre: record.nombre_madre || "",
        telefono_madre: record.telefono_madre || "",
        nombre_padre: record.nombre_padre || "",
        telefono_padre: record.telefono_padre || "",
        alergias: record.alergias || "",
        observaciones: record.observaciones || "",
        fecha_nacimiento_display: fechaDisplay,
      })
      setShowFormModal(true)
    })
  }

  const handleSave = async () => {
    if (!canEdit) {
      toast.error("No tiene permiso de edición en este módulo")
      return
    }
    if (!formData.nombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    if (!formData.nombre_madre?.trim()) {
      toast.error("El nombre de la madre es obligatorio")
      return
    }
    if (!user) return

    setSaving(true)
    try {
      const audit = { userId: user.id, userName: user.username }
      const input: CensoNinoInput = {
        nombre: formData.nombre.trim(),
        fecha_nacimiento: formData.fecha_nacimiento || null,
        edad: formData.edad ?? null,
        grupo: formData.grupo?.trim() || null,
        nombre_madre: formData.nombre_madre?.trim() || null,
        telefono_madre: formData.telefono_madre?.trim() || null,
        nombre_padre: formData.nombre_padre?.trim() || null,
        telefono_padre: formData.telefono_padre?.trim() || null,
        alergias: formData.alergias?.trim() || null,
        observaciones: formData.observaciones?.trim() || null,
      }

      let savedId: number
      if (editingRecord) {
        await censoNinosService.update(editingRecord.id!, input, audit)
        savedId = editingRecord.id!
        toast.success("Registro actualizado")
      } else {
        const created = await censoNinosService.create(input, audit)
        savedId = created.id!
        toast.success("Niño(a) registrado(a)")
      }

      // Upload pending files
      if (pendingFiles.length > 0) {
        setUploadingFiles(true)
        const token = localStorage.getItem("authToken")
        if (token) {
          let uploaded = 0
          for (const file of pendingFiles) {
            try {
              await censoNinosArchivosService.upload(savedId, file, token)
              uploaded++
            } catch (err: any) {
              console.error("Error subiendo archivo:", err)
              toast.error(`Error subiendo ${file.name}`)
            }
          }
          if (uploaded > 0) toast.success(`${uploaded} archivo(s) subido(s)`)
        }
        setUploadingFiles(false)
      }

      setPendingFiles([])
      setShowFormModal(false)
      await loadRecords(true)
    } catch (error: any) {
      console.error("Error guardando:", error)
      toast.error(error.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  // === ARCHIVOS ===
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setPendingFiles(prev => [...prev, ...Array.from(files)])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const loadViewArchivos = async (ninoId: number) => {
    setLoadingArchivos(true)
    try {
      const archivos = await censoNinosArchivosService.getByNinoId(ninoId)
      setViewArchivos(archivos)
    } catch (err) {
      console.error("Error cargando archivos:", err)
      setViewArchivos([])
    } finally {
      setLoadingArchivos(false)
    }
  }

  const handleDeleteArchivo = async (archivoId: number, ninoId: number) => {
    try {
      await censoNinosArchivosService.delete(archivoId)
      toast.success("Archivo eliminado")
      await loadViewArchivos(ninoId)
      await loadRecords(true)
    } catch (err: any) {
      toast.error("Error eliminando archivo")
    }
  }

  const handleUploadFromTable = async (ninoId: number) => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.accept = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov"
    input.onchange = async (e: any) => {
      const files = e.target.files as FileList
      if (!files || files.length === 0) return
      const token = localStorage.getItem("authToken")
      if (!token) { toast.error("No autenticado"); return }
      let uploaded = 0
      for (const file of Array.from(files)) {
        try {
          await censoNinosArchivosService.upload(ninoId, file, token)
          uploaded++
        } catch (err: any) {
          toast.error(`Error subiendo ${file.name}`)
        }
      }
      if (uploaded > 0) {
        toast.success(`${uploaded} archivo(s) subido(s)`)
        await loadRecords(true)
      }
    }
    input.click()
  }

  const openViewModal = (record: CensoNinoRecord) => {
    setViewRecord(record)
    setViewArchivos([])
    if (record.id) loadViewArchivos(record.id)
  }

  const getFileIcon = (tipo: string | null) => {
    if (!tipo) return <FileText className="w-4 h-4 text-gray-400" />
    if (tipo.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />
    return <FileText className="w-4 h-4 text-orange-500" />
  }

  const forceDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      // Fallback: abrir en nueva pestaña si falla
      window.open(url, "_blank")
    }
  }

  // === ELIMINAR ===
  const handleDeleteClick = (record: CensoNinoRecord) => {
    if (!canEdit) {
      toast.error("No tiene permiso de edición en este módulo")
      return
    }
    checkAndExecute(record.created_at || "", () => {
      setDeletingRecord(record)
    })
  }

  const handleConfirmDelete = async () => {
    if (!deletingRecord || !user) return
    try {
      await censoNinosService.delete(deletingRecord.id!, { userId: user.id, userName: user.username })
      toast.success("Registro eliminado")
      setDeletingRecord(null)
      await loadRecords(true)
    } catch (error: any) {
      console.error("Error eliminando:", error)
      toast.error(error.message || "Error al eliminar")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Censo Niños</h1>
                <p className="text-xs text-gray-500">{records.length} registro(s) · Herederos del Reino</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base">Registros de Niños</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar nombre, grupo, padre, madre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 w-56"
                  />
                </div>
                {canEdit && (
                  <Button size="sm" onClick={openCreateModal}>
                    <Plus className="w-4 h-4 mr-1" /> Nuevo
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                {searchQuery ? "No se encontraron resultados" : "No hay niños registrados"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-10">#</TableHead>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs w-14">Edad</TableHead>
                      <TableHead className="text-xs">Alergias</TableHead>
                      <TableHead className="text-xs">Observaciones</TableHead>
                      <TableHead className="text-xs">Grupo</TableHead>
                      <TableHead className="text-xs">Madre</TableHead>
                      <TableHead className="text-xs">Tlf. Madre</TableHead>
                      <TableHead className="text-xs">Padre</TableHead>
                      <TableHead className="text-xs">Tlf. Padre</TableHead>
                      <TableHead className="text-xs text-center w-16">Archivos</TableHead>
                      <TableHead className="text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((record, idx) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs text-gray-500">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-medium whitespace-normal break-words">{record.nombre}</TableCell>
                        <TableCell className="text-xs text-center">{record.edad ?? "-"}</TableCell>
                        <TableCell className="text-xs whitespace-normal break-words">{record.alergias || "-"}</TableCell>
                        <TableCell className="text-xs whitespace-normal break-words">{record.observaciones || "-"}</TableCell>
                        <TableCell className="text-xs whitespace-normal break-words">{record.grupo || "-"}</TableCell>
                        <TableCell className="text-xs whitespace-normal break-words">{record.nombre_madre || "-"}</TableCell>
                        <TableCell className="text-xs">{record.telefono_madre || "-"}</TableCell>
                        <TableCell className="text-xs whitespace-normal break-words">{record.nombre_padre || "-"}</TableCell>
                        <TableCell className="text-xs">{record.telefono_padre || "-"}</TableCell>
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
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-600" onClick={() => openViewModal(record)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {canEdit && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => openEditModal(record)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => handleDeleteClick(record)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modal: Crear/Editar */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Editar Niño(a)" : "Registrar Niño(a)"}</DialogTitle>
            <DialogDescription>
              {editingRecord ? "Modifique los datos del registro" : "Complete los datos para registrar un niño(a)"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Nombre */}
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre completo del niño(a)"
              />
            </div>

            {/* Fecha Nacimiento + Edad */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Fecha de Nacimiento</Label>
                <Input
                  value={formData.fecha_nacimiento_display || ""}
                  onChange={(e) => handleFechaNacimientoChange(e.target.value)}
                  placeholder="dd / mm / aaaa"
                />
                <p className="text-[10px] text-gray-400">Formato: 15/03/2018</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Edad</Label>
                <Input
                  type="number"
                  value={formData.edad !== null && formData.edad !== undefined ? formData.edad : ""}
                  readOnly
                  className="bg-gray-50"
                  placeholder="Auto"
                />
                <p className="text-[10px] text-gray-400">Se calcula automáticamente</p>
              </div>
            </div>

            {/* Grupo */}
            <div className="space-y-1.5">
              <Label className="text-sm">Grupo</Label>
              <Input
                value={formData.grupo || ""}
                onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                placeholder="Ej: Corderitos, Soldaditos, etc."
              />
            </div>

            {/* Madre */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Madre *</Label>
                <Input
                  value={formData.nombre_madre || ""}
                  onChange={(e) => setFormData({ ...formData, nombre_madre: e.target.value })}
                  placeholder="Nombre de la madre"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Tlf. Madre</Label>
                <Input
                  value={formData.telefono_madre || ""}
                  onChange={(e) => setFormData({ ...formData, telefono_madre: e.target.value })}
                  placeholder="0999999999"
                />
              </div>
            </div>

            {/* Padre */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Padre</Label>
                <Input
                  value={formData.nombre_padre || ""}
                  onChange={(e) => setFormData({ ...formData, nombre_padre: e.target.value })}
                  placeholder="Nombre del padre"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Tlf. Padre</Label>
                <Input
                  value={formData.telefono_padre || ""}
                  onChange={(e) => setFormData({ ...formData, telefono_padre: e.target.value })}
                  placeholder="0999999999"
                />
              </div>
            </div>

            {/* Alergias */}
            <div className="space-y-1.5">
              <Label className="text-sm">Alergias</Label>
              <Input
                value={formData.alergias || ""}
                onChange={(e) => setFormData({ ...formData, alergias: e.target.value })}
                placeholder="Ninguna o detallar"
              />
            </div>

            {/* Observaciones */}
            <div className="space-y-1.5">
              <Label className="text-sm">Observaciones</Label>
              <Textarea
                value={formData.observaciones || ""}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Observaciones adicionales"
                rows={3}
              />
            </div>

            {/* Archivos */}
            <div className="space-y-1.5">
              <Label className="text-sm">Archivos</Label>
              <div className="border border-dashed border-gray-300 rounded-lg p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" /> Seleccionar archivos
                </Button>
                <p className="text-[10px] text-gray-400 mt-1 text-center">Imágenes, PDF, documentos, videos (max 50MB c/u)</p>

                {/* Lista de archivos pendientes */}
                {pendingFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {pendingFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {file.type.startsWith("image/") ? <Image className="w-3.5 h-3.5 text-blue-500 shrink-0" /> : <FileText className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                          <span className="text-xs text-gray-700 truncate">{file.name}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <button type="button" onClick={() => removePendingFile(idx)} className="text-red-500 hover:text-red-700 p-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormModal(false)} disabled={saving || uploadingFiles}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || uploadingFiles}>
              {saving || uploadingFiles ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {uploadingFiles ? "Subiendo archivos..." : "Guardando..."}</> : editingRecord ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Ver Detalle */}
      <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Niño(a)</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-3 py-2">
              <DetailRow label="Nombre" value={viewRecord.nombre} />
              <DetailRow label="Fecha de Nacimiento" value={formatDate(viewRecord.fecha_nacimiento)} />
              <DetailRow label="Edad" value={viewRecord.edad != null ? `${viewRecord.edad} años` : "-"} />
              <DetailRow label="Grupo" value={viewRecord.grupo || "-"} />
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">Datos de los Padres</p>
                <DetailRow label="Madre" value={viewRecord.nombre_madre || "-"} />
                <DetailRow label="Tlf. Madre" value={viewRecord.telefono_madre || "-"} />
                <DetailRow label="Padre" value={viewRecord.nombre_padre || "-"} />
                <DetailRow label="Tlf. Padre" value={viewRecord.telefono_padre || "-"} />
              </div>
              <div className="border-t pt-3">
                <DetailRow label="Alergias" value={viewRecord.alergias || "Ninguna"} />
                <DetailRow label="Observaciones" value={viewRecord.observaciones || "-"} />
              </div>
              {/* Archivos */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" /> Archivos
                  </p>
                  {canEdit && (
                    <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => handleUploadFromTable(viewRecord.id!)}>
                      <Upload className="w-3 h-3 mr-1" /> Subir
                    </Button>
                  )}
                </div>
                {loadingArchivos ? (
                  <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                ) : viewArchivos.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Sin archivos</p>
                ) : (
                  <div className="space-y-1.5">
                    {viewArchivos.map(archivo => (
                      <div key={archivo.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(archivo.tipo)}
                          <div className="min-w-0">
                            <p className="text-xs text-gray-800 truncate">{archivo.nombre_archivo}</p>
                            <p className="text-[10px] text-gray-400">
                              {archivo.tamano ? `${(archivo.tamano / 1024).toFixed(0)} KB` : ""} · {new Date(archivo.created_at).toLocaleDateString("es-EC")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setPreviewArchivo(archivo)} className="text-indigo-600 hover:text-indigo-800 p-1" title="Ver">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => forceDownload(archivo.url, archivo.nombre_archivo)} className="text-blue-600 hover:text-blue-800 p-1" title="Descargar">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button onClick={() => handleDeleteArchivo(archivo.id, viewRecord.id!)} className="text-red-500 hover:text-red-700 p-1" title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRecord(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar eliminación */}
      <Dialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar el registro de <strong>{deletingRecord?.nombre}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRecord(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

              // Imagen
              if (tipo.startsWith("image/")) {
                return (
                  <div className="flex items-center justify-center p-2">
                    <img src={url} alt={previewArchivo.nombre_archivo} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                  </div>
                )
              }

              // PDF
              if (tipo === "application/pdf" || previewArchivo.nombre_archivo.endsWith(".pdf")) {
                return (
                  <iframe
                    src={url}
                    className="w-full h-[70vh] rounded-lg border"
                    title={previewArchivo.nombre_archivo}
                  />
                )
              }

              // Video
              if (tipo.startsWith("video/")) {
                return (
                  <div className="flex items-center justify-center p-2">
                    <video controls className="max-w-full max-h-[70vh] rounded-lg">
                      <source src={url} type={tipo} />
                      Tu navegador no soporta la reproducción de video.
                    </video>
                  </div>
                )
              }

              // Otros archivos - no se puede previsualizar inline
              return (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <FileText className="w-16 h-16 text-gray-300" />
                  <p className="text-sm text-gray-500">Este tipo de archivo no se puede previsualizar directamente.</p>
                  <Button variant="outline" size="sm" onClick={() => forceDownload(url, previewArchivo.nombre_archivo)}>
                    <Download className="w-4 h-4 mr-2" /> Descargar archivo
                  </Button>
                </div>
              )
            })()}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => previewArchivo && forceDownload(previewArchivo.url, previewArchivo.nombre_archivo)}>
              <Download className="w-4 h-4 mr-1" /> Descargar
            </Button>
            <Button variant="outline" onClick={() => setPreviewArchivo(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-1">
      <span className="text-xs text-gray-500 w-1/3">{label}</span>
      <span className="text-xs text-gray-900 font-medium w-2/3 text-right">{value}</span>
    </div>
  )
}

export default function CensoNinosPage() {
  return (
    <PermissionsGuard moduleName="censo-ninos">
      {(canEdit) => <CensoNinosContent canEdit={!!canEdit} />}
    </PermissionsGuard>
  )
}
