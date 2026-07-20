"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft, Plus, Search, Lock, Loader2, Eye, Trash2, Send, CheckCircle, XCircle,
  Package, History, ClipboardList, Upload, X, FileText, Film, ImageIcon,
} from "lucide-react"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useRealtime } from "@/hooks/use-realtime"
import { toast } from "sonner"
import {
  redilService, enviarNotificacionRedil,
  ESTADOS_LABELS, ESTADOS_COLORS, TIPOS_AYUDA, parseArchivos,
  type CasoRedil, type CasoCompleto, type SolicitudInput, type VisitaTecnicaInput, type EntregaInput, type EstadoCaso, type ArchivoSubido,
} from "@/lib/mod/redil-ayuda-social-service"


// ============================================================
// HELPER: Upload de archivos a Supabase Storage
// ============================================================
async function uploadFile(file: File, casoId: number): Promise<ArchivoSubido | null> {
  const token = localStorage.getItem("authToken")
  if (!token) return null

  const formData = new FormData()
  formData.append("file", file)
  formData.append("folder", `caso-${casoId}`)

  try {
    const res = await fetch("/api/upload-file", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return { url: json.url, name: json.name, size: json.size, type: json.type }
  } catch (err: any) {
    toast.error(`Error subiendo ${file.name}: ${err.message}`)
    return null
  }
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />
  if (type.startsWith("video/")) return <Film className="w-5 h-5 text-purple-500" />
  return <FileText className="w-5 h-5 text-orange-500" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / 1048576).toFixed(1) + " MB"
}


// ============================================================
// COMPONENTE: Formulario Nueva Solicitud (UI mejorada)
// ============================================================
function NuevaSolicitudForm({ onClose, onCreated, userId, userName }: {
  onClose: () => void
  onCreated: () => void
  userId: string
  userName: string
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SolicitudInput>({
    nombre_completo: "",
    edad: null,
    cedula: "",
    telefono: "",
    direccion: "",
    barrio_sector: "",
    estado_civil: "",
    numero_hijos: 0,
    edad_hijos: "",
    tiempo_asistiendo: "",
    trabaja_actualmente: false,
    lugar_trabajo: "",
    ingreso_mensual: "",
    motivo: "",
    tipo_ayuda: [],
    tipo_ayuda_otro: "",
    referencia_nombre: "",
    referencia_telefono: "",
  })

  const toggleTipoAyuda = (value: string) => {
    setForm((prev) => ({
      ...prev,
      tipo_ayuda: prev.tipo_ayuda.includes(value)
        ? prev.tipo_ayuda.filter((t) => t !== value)
        : [...prev.tipo_ayuda, value],
    }))
  }

  const handleSubmit = async () => {
    if (!form.nombre_completo.trim()) { toast.error("El nombre completo es requerido"); return }
    if (form.tipo_ayuda.length === 0) { toast.error("Seleccione al menos un tipo de ayuda"); return }

    setSaving(true)
    try {
      await redilService.crearSolicitud(form, { id: userId, nombre: userName })
      toast.success("Solicitud enviada correctamente")
      await enviarNotificacionRedil({
        tipo: "nueva_solicitud",
        destinatario: { email: "trabajosocial@iglesiaregalodedios.com", telefono: "", nombre: "Gema" },
        solicitante: form.nombre_completo,
        tipoAyuda: form.tipo_ayuda,
      })
      onCreated()
      onClose()
    } catch (error: any) {
      toast.error("Error al enviar solicitud: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header visual */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white">
        <h2 className="text-lg font-bold flex items-center gap-2">🤝 Nueva Solicitud de Ayuda Social</h2>
        <p className="text-blue-100 text-sm mt-0.5">Complete la información del solicitante</p>
      </div>

      {/* Datos Personales */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center"><span className="text-blue-600 font-bold text-xs">1</span></div>
          <h3 className="font-semibold text-gray-900 text-sm">Datos Personales</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label htmlFor="nombre_completo" className="text-xs font-medium">Nombre completo *</Label>
            <Input id="nombre_completo" value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} placeholder="Nombre completo" className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="edad" className="text-xs font-medium">Edad</Label>
            <Input id="edad" type="number" value={form.edad || ""} onChange={(e) => setForm({ ...form, edad: e.target.value ? parseInt(e.target.value) : null })} placeholder="Edad" className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="cedula" className="text-xs font-medium">Cédula</Label>
            <Input id="cedula" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="Cédula" className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="telefono" className="text-xs font-medium">Teléfono</Label>
            <Input id="telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Teléfono" className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="direccion" className="text-xs font-medium">Dirección</Label>
            <Input id="direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección" className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="barrio_sector" className="text-xs font-medium">Barrio / Sector</Label>
            <Input id="barrio_sector" value={form.barrio_sector} onChange={(e) => setForm({ ...form, barrio_sector: e.target.value })} placeholder="Barrio o sector" className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="estado_civil" className="text-xs font-medium">Estado civil</Label>
            <Select value={form.estado_civil} onValueChange={(v) => setForm({ ...form, estado_civil: v })}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleccione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="soltero">Soltero/a</SelectItem>
                <SelectItem value="casado">Casado/a</SelectItem>
                <SelectItem value="divorciado">Divorciado/a</SelectItem>
                <SelectItem value="viudo">Viudo/a</SelectItem>
                <SelectItem value="union_libre">Unión libre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="numero_hijos" className="text-xs font-medium">Número de hijos</Label>
            <Input id="numero_hijos" type="number" value={form.numero_hijos || ""} onChange={(e) => setForm({ ...form, numero_hijos: parseInt(e.target.value) || 0 })} placeholder="0" className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="edad_hijos" className="text-xs font-medium">Edad de los hijos</Label>
            <Input id="edad_hijos" value={form.edad_hijos} onChange={(e) => setForm({ ...form, edad_hijos: e.target.value })} placeholder="Ej: 5, 8, 12 años" className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="tiempo_asistiendo" className="text-xs font-medium">Tiempo en la iglesia</Label>
            <Input id="tiempo_asistiendo" value={form.tiempo_asistiendo} onChange={(e) => setForm({ ...form, tiempo_asistiendo: e.target.value })} placeholder="Ej: 2 años" className="mt-1 h-9" />
          </div>
        </div>
      </div>


      {/* Situación Laboral */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center"><span className="text-green-600 font-bold text-xs">2</span></div>
          <h3 className="font-semibold text-gray-900 text-sm">Situación Laboral</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2 flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
            <Checkbox id="trabaja" checked={form.trabaja_actualmente} onCheckedChange={(checked) => setForm({ ...form, trabaja_actualmente: !!checked })} />
            <Label htmlFor="trabaja" className="cursor-pointer text-sm font-medium">¿Trabaja actualmente?</Label>
          </div>
          {form.trabaja_actualmente && (
            <>
              <div>
                <Label htmlFor="lugar_trabajo" className="text-xs font-medium">Lugar de trabajo</Label>
                <Input id="lugar_trabajo" value={form.lugar_trabajo} onChange={(e) => setForm({ ...form, lugar_trabajo: e.target.value })} placeholder="Lugar de trabajo" className="mt-1 h-9" />
              </div>
              <div>
                <Label htmlFor="ingreso_mensual" className="text-xs font-medium">Ingreso mensual</Label>
                <Input id="ingreso_mensual" value={form.ingreso_mensual} onChange={(e) => setForm({ ...form, ingreso_mensual: e.target.value })} placeholder="Ej: $400" className="mt-1 h-9" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Motivo */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center"><span className="text-amber-600 font-bold text-xs">3</span></div>
          <h3 className="font-semibold text-gray-900 text-sm">Motivo de la Solicitud</h3>
        </div>
        <Textarea id="motivo" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Explique brevemente la situación..." rows={4} className="resize-none" />
      </div>

      {/* Tipo de Ayuda */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center"><span className="text-purple-600 font-bold text-xs">4</span></div>
          <h3 className="font-semibold text-gray-900 text-sm">Tipo de Ayuda *</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {TIPOS_AYUDA.map((tipo) => (
            <div key={tipo.value} onClick={() => toggleTipoAyuda(tipo.value)} className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${form.tipo_ayuda.includes(tipo.value) ? "border-purple-500 bg-purple-50 shadow-sm scale-[1.02]" : "border-gray-200 hover:border-purple-200 hover:bg-purple-50/50"}`}>
              <span className="text-xl">{tipo.icon}</span>
              <span className="font-medium text-xs">{tipo.label}</span>
              {form.tipo_ayuda.includes(tipo.value) && <CheckCircle className="w-4 h-4 text-purple-600 ml-auto" />}
            </div>
          ))}
        </div>
        {form.tipo_ayuda.includes("otro") && (
          <div className="mt-2">
            <Label htmlFor="tipo_ayuda_otro" className="text-xs font-medium">Especifique</Label>
            <Input id="tipo_ayuda_otro" value={form.tipo_ayuda_otro} onChange={(e) => setForm({ ...form, tipo_ayuda_otro: e.target.value })} placeholder="Tipo de ayuda" className="mt-1 h-9" />
          </div>
        )}
      </div>


      {/* Referencia */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center"><span className="text-rose-600 font-bold text-xs">5</span></div>
          <h3 className="font-semibold text-gray-900 text-sm">Referencia (Quien lo recomienda)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="referencia_nombre" className="text-xs font-medium">Nombre</Label>
            <Input id="referencia_nombre" value={form.referencia_nombre} onChange={(e) => setForm({ ...form, referencia_nombre: e.target.value })} placeholder="Nombre" className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="referencia_telefono" className="text-xs font-medium">Teléfono</Label>
            <Input id="referencia_telefono" value={form.referencia_telefono} onChange={(e) => setForm({ ...form, referencia_telefono: e.target.value })} placeholder="Teléfono" className="mt-1 h-9" />
          </div>
        </div>
      </div>

      {/* Botón Enviar */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : <><Send className="w-4 h-4 mr-2" />Enviar Solicitud</>}
        </Button>
      </div>
    </div>
  )
}


// ============================================================
// COMPONENTE: Vista de Detalle del Caso
// ============================================================
function CasoDetalle({ casoId, onBack, canEdit, userId, userName }: {
  casoId: number
  onBack: () => void
  canEdit: boolean
  userId: string
  userName: string
}) {
  const [casoCompleto, setCasoCompleto] = useState<CasoCompleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("solicitud")

  // Visita técnica form
  const [visitaForm, setVisitaForm] = useState<VisitaTecnicaInput>({
    resultado: "aprobado",
    observaciones: "",
    motivo_rechazo: "",
    tipo_ayuda_aprobada: [],
    ficha_num_personas_hogar: null,
    ficha_num_hijos_menores: null,
    ficha_personas_dependientes: null,
    ficha_trabaja_actualmente: null,
    ficha_ocupacion: "",
    ficha_tiene_negocio: null,
    ficha_ingreso_mensual: "",
    ficha_tipo_vivienda: "",
    ficha_material_vivienda: "",
    ficha_servicios_basicos: [],
    ficha_desea_emprender: null,
    ficha_idea_negocio: "",
    ficha_espacio_emprendimiento: null,
    ficha_espacio_descripcion: "",
    ficha_motivacion: "",
    ficha_apoyo_familiar: "",
    ficha_cuidado_hijos: "",
    ficha_observaciones_ts: "",
    ficha_recomendacion: "",
  })
  const [savingVisita, setSavingVisita] = useState(false)

  // Entrega form
  const [entregaForm, setEntregaForm] = useState<EntregaInput>({
    fecha_entrega: new Date().toISOString().split("T")[0],
    archivos: [],
    observaciones: "",
  })
  const [savingEntrega, setSavingEntrega] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const loadCaso = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await redilService.getCasoCompleto(casoId)
      setCasoCompleto(data)
      if (data?.solicitud && visitaForm.tipo_ayuda_aprobada.length === 0) {
        setVisitaForm((prev) => ({ ...prev, tipo_ayuda_aprobada: data.solicitud!.tipo_ayuda }))
      }
    } catch (error: any) {
      toast.error("Error cargando caso: " + error.message)
    } finally {
      setLoading(false)
    }
  }, [casoId])

  useEffect(() => { loadCaso() }, [loadCaso])
  useRealtime({ table: "casos_redil", filter: `id=eq.${casoId}`, onChange: () => loadCaso(true) })
  useRealtime({ table: "visitas_tecnicas", filter: `caso_id=eq.${casoId}`, onChange: () => loadCaso(true) })
  useRealtime({ table: "entregas_redil", filter: `caso_id=eq.${casoId}`, onChange: () => loadCaso(true) })

  const handleGuardarVisita = async () => {
    if (!visitaForm.ficha_recomendacion) { toast.error("Seleccione una recomendación técnica"); return }
    // Derivar resultado de la recomendación
    const resultado = visitaForm.ficha_recomendacion === "no_recomendado" ? "no_aprobado" : "aprobado"
    const formToSave = { ...visitaForm, resultado: resultado as "aprobado" | "no_aprobado" }

    setSavingVisita(true)
    try {
      await redilService.registrarVisitaTecnica(casoId, formToSave, { id: userId, nombre: userName })
      toast.success("Ficha socioeconómica guardada")
      if (casoCompleto?.caso) {
        await enviarNotificacionRedil({
          tipo: resultado === "aprobado" ? "aprobada" : "rechazada",
          destinatario: { email: "", telefono: "", nombre: casoCompleto.caso.usuario_creador_nombre },
          solicitante: casoCompleto.solicitud?.nombre_completo || "",
          tipoAyuda: [],
        })
      }
      await loadCaso(true)
    } catch (error: any) {
      toast.error("Error guardando ficha: " + error.message)
    } finally {
      setSavingVisita(false)
    }
  }

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const newFiles = Array.from(fileList)
    const maxSize = 50 * 1024 * 1024
    const invalid = newFiles.filter((f) => f.size > maxSize)
    if (invalid.length > 0) {
      toast.error(`${invalid.length} archivo(s) exceden 50MB y fueron descartados`)
    }
    setPendingFiles((prev) => [...prev, ...newFiles.filter((f) => f.size <= maxSize)])
  }

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGuardarEntrega = async () => {
    if (!entregaForm.fecha_entrega) { toast.error("La fecha de entrega es requerida"); return }

    setSavingEntrega(true)
    setUploadingFiles(true)
    try {
      // Subir archivos pendientes
      const archivosSubidos: ArchivoSubido[] = []
      for (const file of pendingFiles) {
        const result = await uploadFile(file, casoId)
        if (result) archivosSubidos.push(result)
      }
      setUploadingFiles(false)

      // Guardar entrega con URLs de archivos
      await redilService.registrarEntrega(casoId, {
        ...entregaForm,
        archivos: archivosSubidos,
      }, { id: userId, nombre: userName })

      toast.success("Entrega registrada. Caso cerrado.")
      await loadCaso(true)
    } catch (error: any) {
      toast.error("Error registrando entrega: " + error.message)
    } finally {
      setSavingEntrega(false)
      setUploadingFiles(false)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Cargando caso...</p>
        </div>
      </div>
    )
  }

  if (!casoCompleto) {
    return <div className="text-center py-12 text-gray-500">Caso no encontrado</div>
  }

  const { caso, solicitud, visita, entrega } = casoCompleto
  const estadoColor = ESTADOS_COLORS[caso.estado]

  return (
    <div className="space-y-6">
      {/* Header del caso con gradiente */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack} className="text-white hover:bg-white/10 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-1" />Volver
              </Button>
            </div>
            <h2 className="text-2xl font-bold mt-2">Caso #{String(caso.id).padStart(5, "0")}</h2>
            <p className="text-slate-300 text-sm mt-1">
              {solicitud?.nombre_completo || "Sin nombre"} — Creado {new Date(caso.fecha_creacion).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Badge className={`${estadoColor.bg} ${estadoColor.text} px-4 py-2 text-sm font-semibold`}>
            {ESTADOS_LABELS[caso.estado]}
          </Badge>
        </div>
      </div>

      {/* Tabs del caso */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="solicitud" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            <ClipboardList className="w-4 h-4" /><span className="hidden sm:inline">Solicitud</span>
          </TabsTrigger>
          <TabsTrigger value="visita" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">
            <Eye className="w-4 h-4" /><span className="hidden sm:inline">Visita Técnica</span>
          </TabsTrigger>
          <TabsTrigger value="entrega" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
            <Package className="w-4 h-4" /><span className="hidden sm:inline">Entrega</span>
          </TabsTrigger>
        </TabsList>


        {/* TAB: Solicitud */}
        <TabsContent value="solicitud" className="space-y-4 mt-4">
          {solicitud ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-blue-100 shadow-sm">
                <CardHeader className="pb-3 bg-blue-50/50 rounded-t-lg"><CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">👤 Datos Personales</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm pt-4">
                  <p><span className="font-medium text-gray-500">Nombre:</span> <span className="font-semibold">{solicitud.nombre_completo}</span></p>
                  <p><span className="font-medium text-gray-500">Edad:</span> {solicitud.edad || "—"}</p>
                  <p><span className="font-medium text-gray-500">Cédula:</span> {solicitud.cedula || "—"}</p>
                  <p><span className="font-medium text-gray-500">Teléfono:</span> {solicitud.telefono || "—"}</p>
                  <p><span className="font-medium text-gray-500">Dirección:</span> {solicitud.direccion || "—"}</p>
                  <p><span className="font-medium text-gray-500">Barrio:</span> {solicitud.barrio_sector || "—"}</p>
                  <p><span className="font-medium text-gray-500">Estado civil:</span> {solicitud.estado_civil || "—"}</p>
                  <p><span className="font-medium text-gray-500">Hijos:</span> {solicitud.numero_hijos} {solicitud.edad_hijos ? `(${solicitud.edad_hijos})` : ""}</p>
                  <p><span className="font-medium text-gray-500">Tiempo en iglesia:</span> {solicitud.tiempo_asistiendo || "—"}</p>
                </CardContent>
              </Card>
              <Card className="border-green-100 shadow-sm">
                <CardHeader className="pb-3 bg-green-50/50 rounded-t-lg"><CardTitle className="text-sm font-semibold text-green-800 flex items-center gap-2">💼 Situación Laboral</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm pt-4">
                  <p><span className="font-medium text-gray-500">Trabaja:</span> <Badge variant={solicitud.trabaja_actualmente ? "default" : "secondary"} className={solicitud.trabaja_actualmente ? "bg-green-100 text-green-800" : ""}>{solicitud.trabaja_actualmente ? "Sí" : "No"}</Badge></p>
                  {solicitud.trabaja_actualmente && (
                    <>
                      <p><span className="font-medium text-gray-500">Lugar:</span> {solicitud.lugar_trabajo || "—"}</p>
                      <p><span className="font-medium text-gray-500">Ingreso:</span> {solicitud.ingreso_mensual || "—"}</p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card className="md:col-span-2 border-amber-100 shadow-sm">
                <CardHeader className="pb-3 bg-amber-50/50 rounded-t-lg"><CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">📝 Motivo</CardTitle></CardHeader>
                <CardContent className="pt-4"><p className="text-sm whitespace-pre-wrap leading-relaxed">{solicitud.motivo || "Sin motivo especificado"}</p></CardContent>
              </Card>
              <Card className="border-purple-100 shadow-sm">
                <CardHeader className="pb-3 bg-purple-50/50 rounded-t-lg"><CardTitle className="text-sm font-semibold text-purple-800 flex items-center gap-2">🎁 Tipo de Ayuda</CardTitle></CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {solicitud.tipo_ayuda.map((t) => {
                      const tipo = TIPOS_AYUDA.find((ta) => ta.value === t)
                      return <Badge key={t} className="bg-purple-100 text-purple-800 border-purple-200 px-3 py-1">{tipo?.icon} {tipo?.label || t}</Badge>
                    })}
                    {solicitud.tipo_ayuda_otro && <Badge className="bg-purple-100 text-purple-800 border-purple-200 px-3 py-1">📦 {solicitud.tipo_ayuda_otro}</Badge>}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-rose-100 shadow-sm">
                <CardHeader className="pb-3 bg-rose-50/50 rounded-t-lg"><CardTitle className="text-sm font-semibold text-rose-800 flex items-center gap-2">📞 Referencia</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm pt-4">
                  <p><span className="font-medium text-gray-500">Nombre:</span> {solicitud.referencia_nombre || "—"}</p>
                  <p><span className="font-medium text-gray-500">Teléfono:</span> {solicitud.referencia_telefono || "—"}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay datos de solicitud</p>
          )}
        </TabsContent>


        {/* TAB: Visita Técnica */}
        <TabsContent value="visita" className="space-y-4 mt-4">
          {visita ? (
            <div className="space-y-4">
              {/* Resultado principal */}
              <Card className="shadow-sm border-amber-200">
                <CardHeader className="pb-2 bg-amber-50 rounded-t-lg">
                  <CardTitle className="text-base">Ficha Socioeconómica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm pt-4">
                  {/* Recomendación técnica prominente */}
                  {visita.ficha_recomendacion && (
                    <div className={`rounded-xl p-5 text-center ${{apto:"bg-green-50 border-2 border-green-300",apto_acompanamiento:"bg-blue-50 border-2 border-blue-300",seguimiento_adicional:"bg-yellow-50 border-2 border-yellow-300",no_recomendado:"bg-red-50 border-2 border-red-300"}[visita.ficha_recomendacion] || "bg-gray-50 border-2 border-gray-300"}`}>
                      <p className="text-xs text-gray-500 mb-1">Recomendación Técnica</p>
                      <p className={`text-xl font-bold ${{apto:"text-green-700",apto_acompanamiento:"text-blue-700",seguimiento_adicional:"text-yellow-700",no_recomendado:"text-red-700"}[visita.ficha_recomendacion] || "text-gray-700"}`}>
                        {{"apto":"✅ Apto para participar","apto_acompanamiento":"🤝 Apto con acompañamiento","seguimiento_adicional":"👁️ Requiere seguimiento adicional","no_recomendado":"⛔ No recomendado por el momento"}[visita.ficha_recomendacion] || visita.ficha_recomendacion}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <p><span className="font-medium text-gray-500">Fecha:</span> {new Date(visita.fecha_visita).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}</p>
                    <p><span className="font-medium text-gray-500">Realizada por:</span> {visita.realizada_por_nombre}</p>
                  </div>
                  {visita.observaciones && (
                    <div className="bg-gray-50 rounded-lg p-3"><p className="font-medium text-gray-700 text-xs mb-1">Observaciones:</p><p className="whitespace-pre-wrap text-gray-600">{visita.observaciones}</p></div>
                  )}
                  {visita.ficha_observaciones_ts && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="font-medium text-amber-700 text-xs mb-1">Observaciones de Trabajo Social:</p><p className="whitespace-pre-wrap text-amber-800">{visita.ficha_observaciones_ts}</p></div>
                  )}
                </CardContent>
              </Card>

              {/* FICHA SOCIOECONÓMICA - Vista de detalle */}
              {(visita.ficha_num_personas_hogar != null || visita.ficha_trabaja_actualmente != null || visita.ficha_tipo_vivienda) && (
                <Card className="shadow-sm">
                  <CardContent className="space-y-4 text-sm pt-5">
                    {/* Composición Familiar */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Composición Familiar</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded p-2 text-center"><p className="text-[10px] text-gray-500">Personas en hogar</p><p className="font-bold text-gray-800">{visita.ficha_num_personas_hogar ?? "-"}</p></div>
                        <div className="bg-gray-50 rounded p-2 text-center"><p className="text-[10px] text-gray-500">Hijos menores</p><p className="font-bold text-gray-800">{visita.ficha_num_hijos_menores ?? "-"}</p></div>
                        <div className="bg-gray-50 rounded p-2 text-center"><p className="text-[10px] text-gray-500">Dependientes económicos</p><p className="font-bold text-gray-800">{visita.ficha_personas_dependientes ?? "-"}</p></div>
                      </div>
                    </div>
                    {/* Situación Laboral */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Situación Laboral y Económica</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">¿Trabaja?</p><p className="font-medium">{visita.ficha_trabaja_actualmente === true ? `Sí — ${visita.ficha_ocupacion || ""}` : visita.ficha_trabaja_actualmente === false ? "No" : "-"}</p></div>
                        <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">¿Negocio propio?</p><p className="font-medium">{visita.ficha_tiene_negocio === true ? "Sí" : visita.ficha_tiene_negocio === false ? "No" : "-"}</p></div>
                        <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">Ingreso mensual</p><p className="font-medium">{visita.ficha_ingreso_mensual || "-"}</p></div>
                      </div>
                    </div>
                    {/* Vivienda */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Condiciones de Vivienda</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">Tipo</p><p className="font-medium">{visita.ficha_tipo_vivienda || "-"}</p></div>
                        <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">Material</p><p className="font-medium">{visita.ficha_material_vivienda || "-"}</p></div>
                        <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">Servicios</p><p className="font-medium">{(visita.ficha_servicios_basicos || []).join(", ") || "-"}</p></div>
                      </div>
                    </div>
                    {/* Emprendimiento */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Emprendimiento</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">¿Desea emprender?</p><p className="font-medium">{visita.ficha_desea_emprender === true ? `Sí — ${visita.ficha_idea_negocio || ""}` : visita.ficha_desea_emprender === false ? "No" : "-"}</p></div>
                        <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">¿Espacio en casa?</p><p className="font-medium">{visita.ficha_espacio_emprendimiento === true ? `Sí${(visita as any).ficha_espacio_descripcion ? ` — ${(visita as any).ficha_espacio_descripcion}` : ""}` : visita.ficha_espacio_emprendimiento === false ? "No" : "-"}</p></div>
                      </div>
                    </div>
                    {/* Motivación */}
                    {(visita.ficha_motivacion || visita.ficha_apoyo_familiar || visita.ficha_cuidado_hijos) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Motivación y Apoyo</p>
                        <div className="space-y-2">
                          {visita.ficha_motivacion && <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">¿Por qué desea participar?</p><p className="text-gray-700">{visita.ficha_motivacion}</p></div>}
                          {visita.ficha_apoyo_familiar && <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">¿Quiénes le apoyan?</p><p className="text-gray-700">{visita.ficha_apoyo_familiar}</p></div>}
                          {visita.ficha_cuidado_hijos && <div className="bg-gray-50 rounded p-2"><p className="text-[10px] text-gray-500">¿Quién cuida a los hijos?</p><p className="text-gray-700">{visita.ficha_cuidado_hijos}</p></div>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            canEdit && (caso.estado === "pendiente_visita" || caso.estado === "en_visita_tecnica") ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-5 text-white">
                  <h3 className="font-bold text-lg">Ficha Socioeconómica — Visita Técnica</h3>
                  <p className="text-amber-100 text-sm mt-1">Complete la evaluación socioeconómica del solicitante</p>
                </div>

                {/* SECCIÓN 2: COMPOSICIÓN FAMILIAR */}
                <Card className="shadow-sm">
                  <CardContent className="space-y-4 pt-5">
                    <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">2. Composición Familiar</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div><Label className="text-xs">N° personas en el hogar</Label><Input type="number" min={0} value={visitaForm.ficha_num_personas_hogar ?? ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_num_personas_hogar: e.target.value ? parseInt(e.target.value) : null })} /></div>
                      <div><Label className="text-xs">N° hijos menores de edad</Label><Input type="number" min={0} value={visitaForm.ficha_num_hijos_menores ?? ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_num_hijos_menores: e.target.value ? parseInt(e.target.value) : null })} /></div>
                      <div><Label className="text-xs">Personas dependientes económicamente</Label><Input type="number" min={0} value={visitaForm.ficha_personas_dependientes ?? ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_personas_dependientes: e.target.value ? parseInt(e.target.value) : null })} /></div>
                    </div>
                  </CardContent>
                </Card>

                {/* SECCIÓN 3: SITUACIÓN LABORAL Y ECONÓMICA */}
                <Card className="shadow-sm">
                  <CardContent className="space-y-4 pt-5">
                    <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">3. Situación Laboral y Económica</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">¿Actualmente trabaja?</Label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="trabaja" checked={visitaForm.ficha_trabaja_actualmente === true} onChange={() => setVisitaForm({ ...visitaForm, ficha_trabaja_actualmente: true })} className="accent-blue-600" /><span className="text-sm">Sí</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="trabaja" checked={visitaForm.ficha_trabaja_actualmente === false} onChange={() => setVisitaForm({ ...visitaForm, ficha_trabaja_actualmente: false })} className="accent-blue-600" /><span className="text-sm">No</span></label>
                        </div>
                        {visitaForm.ficha_trabaja_actualmente && (
                          <div><Label className="text-xs">Ocupación</Label><Input value={visitaForm.ficha_ocupacion || ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_ocupacion: e.target.value })} placeholder="Ej: Vendedora ambulante" /></div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">¿Tiene negocio propio?</Label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="negocio" checked={visitaForm.ficha_tiene_negocio === true} onChange={() => setVisitaForm({ ...visitaForm, ficha_tiene_negocio: true })} className="accent-blue-600" /><span className="text-sm">Sí</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="negocio" checked={visitaForm.ficha_tiene_negocio === false} onChange={() => setVisitaForm({ ...visitaForm, ficha_tiene_negocio: false })} className="accent-blue-600" /><span className="text-sm">No</span></label>
                        </div>
                      </div>
                      <div><Label className="text-xs">Ingreso mensual aprox. del hogar</Label><Input value={visitaForm.ficha_ingreso_mensual || ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_ingreso_mensual: e.target.value })} placeholder="$" /></div>
                    </div>
                  </CardContent>
                </Card>

                {/* SECCIÓN 4: CONDICIONES DE VIVIENDA */}
                <Card className="shadow-sm">
                  <CardContent className="space-y-4 pt-5">
                    <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">4. Condiciones de Vivienda</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Tipo de vivienda</Label>
                        <div className="space-y-1">
                          {["Propia", "Arrendada", "Prestada", "Familiar"].map((t) => (
                            <label key={t} className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="vivienda" checked={visitaForm.ficha_tipo_vivienda === t} onChange={() => setVisitaForm({ ...visitaForm, ficha_tipo_vivienda: t })} className="accent-blue-600" /><span className="text-sm">{t}</span></label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Material predominante</Label>
                        <div className="space-y-1">
                          {["Hormigón", "Mixta", "Madera", "Caña"].map((m) => (
                            <label key={m} className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="material" checked={visitaForm.ficha_material_vivienda === m} onChange={() => setVisitaForm({ ...visitaForm, ficha_material_vivienda: m })} className="accent-blue-600" /><span className="text-sm">{m}</span></label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Servicios básicos</Label>
                        <div className="space-y-1">
                          {["Agua potable", "Energía eléctrica", "Alcantarillado", "Internet"].map((s) => (
                            <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={(visitaForm.ficha_servicios_basicos || []).includes(s)} onChange={(e) => { const current = visitaForm.ficha_servicios_basicos || []; setVisitaForm({ ...visitaForm, ficha_servicios_basicos: e.target.checked ? [...current, s] : current.filter((x) => x !== s) }) }} className="accent-blue-600" />
                              <span className="text-sm">{s}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* SECCIÓN 5: EMPRENDIMIENTO */}
                <Card className="shadow-sm">
                  <CardContent className="space-y-4 pt-5">
                    <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">5. Emprendimiento</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">¿Desea emprender?</Label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="emprender" checked={visitaForm.ficha_desea_emprender === true} onChange={() => setVisitaForm({ ...visitaForm, ficha_desea_emprender: true })} className="accent-blue-600" /><span className="text-sm">Sí</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="emprender" checked={visitaForm.ficha_desea_emprender === false} onChange={() => setVisitaForm({ ...visitaForm, ficha_desea_emprender: false })} className="accent-blue-600" /><span className="text-sm">No</span></label>
                        </div>
                        {visitaForm.ficha_desea_emprender && (
                          <div><Label className="text-xs">Idea de negocio</Label><Input value={visitaForm.ficha_idea_negocio || ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_idea_negocio: e.target.value })} placeholder="Describa brevemente" /></div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">¿Tiene espacio para emprendimiento en casa?</Label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="espacio" checked={visitaForm.ficha_espacio_emprendimiento === true} onChange={() => setVisitaForm({ ...visitaForm, ficha_espacio_emprendimiento: true })} className="accent-blue-600" /><span className="text-sm">Sí</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="espacio" checked={visitaForm.ficha_espacio_emprendimiento === false} onChange={() => setVisitaForm({ ...visitaForm, ficha_espacio_emprendimiento: false })} className="accent-blue-600" /><span className="text-sm">No</span></label>
                        </div>
                        {visitaForm.ficha_espacio_emprendimiento && (
                          <div><Label className="text-xs">Describa el espacio</Label><Input value={visitaForm.ficha_espacio_descripcion || ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_espacio_descripcion: e.target.value })} placeholder="Ej: Garaje, cuarto extra..." /></div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* SECCIÓN 6: MOTIVACIÓN Y APOYO */}
                <Card className="shadow-sm">
                  <CardContent className="space-y-4 pt-5">
                    <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">6. Motivación y Apoyo Familiar</h4>
                    <div><Label className="text-xs">¿Por qué desea participar en el proyecto?</Label><Textarea value={visitaForm.ficha_motivacion || ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_motivacion: e.target.value })} rows={3} placeholder="Motivación del participante..." /></div>
                    <div><Label className="text-xs">¿Quiénes le apoyan? (Estudios, emprender, trabajar, etc)</Label><Textarea value={visitaForm.ficha_apoyo_familiar || ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_apoyo_familiar: e.target.value })} rows={2} placeholder="Red de apoyo familiar..." /></div>
                    <div><Label className="text-xs">Si tiene hijos, ¿quién le ayudaría a cuidarlos en clases?</Label><Input value={visitaForm.ficha_cuidado_hijos || ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_cuidado_hijos: e.target.value })} placeholder="Persona encargada del cuidado" /></div>
                  </CardContent>
                </Card>

                {/* OBSERVACIONES DE TRABAJO SOCIAL */}
                <Card className="shadow-sm">
                  <CardContent className="space-y-4 pt-5">
                    <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">Observaciones de Trabajo Social</h4>
                    <Textarea value={visitaForm.ficha_observaciones_ts || ""} onChange={(e) => setVisitaForm({ ...visitaForm, ficha_observaciones_ts: e.target.value })} rows={4} placeholder="Observaciones del profesional de trabajo social..." />
                  </CardContent>
                </Card>

                {/* RECOMENDACIÓN TÉCNICA */}
                <Card className="shadow-sm border-2 border-amber-200">
                  <CardContent className="space-y-4 pt-5">
                    <h4 className="font-semibold text-sm text-gray-700 border-b pb-2">Recomendación Técnica</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { value: "apto", label: "Apto para participar", icon: "✅", color: "border-green-500 bg-green-50" },
                        { value: "apto_acompanamiento", label: "Apto con acompañamiento", icon: "🤝", color: "border-blue-500 bg-blue-50" },
                        { value: "seguimiento_adicional", label: "Requiere seguimiento adicional", icon: "👁️", color: "border-yellow-500 bg-yellow-50" },
                        { value: "no_recomendado", label: "No recomendado por el momento", icon: "⛔", color: "border-red-500 bg-red-50" },
                      ].map((opt) => (
                        <label key={opt.value} onClick={() => setVisitaForm({ ...visitaForm, ficha_recomendacion: opt.value })} className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${visitaForm.ficha_recomendacion === opt.value ? opt.color + " shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
                          <input type="radio" name="recomendacion" checked={visitaForm.ficha_recomendacion === opt.value} onChange={() => {}} className="accent-blue-600" />
                          <span className="text-sm">{opt.icon} {opt.label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="flex justify-end pt-3 border-t">
                      <Button onClick={handleGuardarVisita} disabled={savingVisita} size="lg" className="bg-amber-600 hover:bg-amber-700">
                        {savingVisita ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando...</> : "Guardar Ficha"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12">
                <Eye className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">{canEdit ? "El caso no está en estado válido para visita técnica." : "Solo el personal autorizado puede realizar la visita técnica."}</p>
              </div>
            )
          )}
        </TabsContent>


        {/* TAB: Entrega */}
        <TabsContent value="entrega" className="space-y-4 mt-4">
          {entrega ? (
            <Card className="border-emerald-200 shadow-sm">
              <CardHeader className="pb-3 bg-emerald-50 rounded-t-lg">
                <CardTitle className="text-base flex items-center gap-3">
                  Entrega Realizada <Badge className="bg-emerald-600 text-white px-3 py-1">✅ Entregado</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <p><span className="font-medium text-gray-500">Fecha:</span> {new Date(entrega.fecha_entrega).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}</p>
                  <p><span className="font-medium text-gray-500">Entregado por:</span> {entrega.entregado_por_nombre}</p>
                </div>
                {entrega.observaciones && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="font-medium text-gray-700 mb-1">Observaciones:</p>
                    <p className="whitespace-pre-wrap text-gray-600">{entrega.observaciones}</p>
                  </div>
                )}
                {(() => { const archivos = parseArchivos(entrega); return archivos.length > 0 ? (
                  <div>
                    <p className="font-medium text-gray-700 mb-3">Archivos adjuntos ({archivos.length}):</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {archivos.map((archivo, idx) => (
                        <a key={idx} href={archivo.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                          {getFileIcon(archivo.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{archivo.name}</p>
                            <p className="text-xs text-gray-400">{formatFileSize(archivo.size)}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                    {/* Preview de imágenes */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                      {archivos.filter((a) => a.type.startsWith("image/")).map((img, idx) => (
                        <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer">
                          <img src={img.url} alt={img.name} className="rounded-lg border shadow-sm max-h-48 object-cover w-full hover:opacity-90 transition-opacity" />
                        </a>
                      ))}
                    </div>
                    {/* Preview de videos */}
                    {archivos.filter((a) => a.type.startsWith("video/")).map((vid, idx) => (
                      <video key={idx} controls className="rounded-lg border shadow-sm max-h-64 w-full mt-3">
                        <source src={vid.url} type={vid.type} />
                      </video>
                    ))}
                  </div>
                ) : null })()}
              </CardContent>
            </Card>
          ) : (
            caso.estado === "pendiente_entrega" && canEdit ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-5 text-white">
                  <h3 className="font-bold text-lg">Registrar Entrega</h3>
                  <p className="text-emerald-100 text-sm mt-1">Registre la entrega de la ayuda social y adjunte evidencia</p>
                </div>

                {/* Info del caso aprobado */}
                {visita && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-2">
                    <p className="font-semibold text-blue-800">Información del caso:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <p><span className="text-blue-600">Beneficiario:</span> {solicitud?.nombre_completo}</p>
                      <p><span className="text-blue-600">Aprobado:</span> {new Date(caso.fecha_aprobacion || "").toLocaleDateString("es-EC")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {visita.tipo_ayuda_aprobada.map((t) => {
                        const tipo = TIPOS_AYUDA.find((ta) => ta.value === t)
                        return <Badge key={t} className="bg-blue-100 text-blue-800">{tipo?.icon} {tipo?.label || t}</Badge>
                      })}
                    </div>
                  </div>
                )}

                <Card className="shadow-sm">
                  <CardContent className="space-y-5 pt-6">
                    {/* Fecha */}
                    <div>
                      <Label htmlFor="fecha_entrega" className="font-semibold">Fecha de entrega *</Label>
                      <Input id="fecha_entrega" type="date" value={entregaForm.fecha_entrega} onChange={(e) => setEntregaForm({ ...entregaForm, fecha_entrega: e.target.value })} className="mt-1 max-w-xs" />
                    </div>


                    {/* Upload de archivos múltiples */}
                    <div className="space-y-3">
                      <Label className="font-semibold">Archivos de evidencia (fotos, videos, documentos)</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors">
                        <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-600 font-medium">Arrastra archivos aquí o haz clic para seleccionar</p>
                        <p className="text-xs text-gray-400 mt-1">Fotos, videos, PDFs, documentos — Máx 50MB por archivo</p>
                        <Input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleAddFiles(e.target.files)} className="mt-4 max-w-xs mx-auto" />
                      </div>

                      {/* Lista de archivos pendientes */}
                      {pendingFiles.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">{pendingFiles.length} archivo(s) seleccionado(s):</p>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {pendingFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                                {getFileIcon(file.type)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{file.name}</p>
                                  <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => removePendingFile(idx)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Observaciones */}
                    <div>
                      <Label htmlFor="obs_entrega" className="font-semibold">Observaciones</Label>
                      <Textarea id="obs_entrega" value={entregaForm.observaciones} onChange={(e) => setEntregaForm({ ...entregaForm, observaciones: e.target.value })} placeholder="Observaciones adicionales..." rows={3} className="mt-1" />
                    </div>

                    {/* Botón finalizar */}
                    <div className="flex justify-end pt-4 border-t">
                      <Button onClick={handleGuardarEntrega} disabled={savingEntrega} size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg">
                        {savingEntrega ? (
                          <>{uploadingFiles ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Subiendo archivos...</> : <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando...</>}</>
                        ) : (
                          <><CheckCircle className="w-5 h-5 mr-2" />Finalizar Caso</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">{caso.estado === "pendiente_entrega" ? "No tiene permiso para registrar la entrega." : "Este caso no está pendiente de entrega."}</p>
              </div>
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}


// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
function RedilAyudaSocialContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const [view, setView] = useState<"menu" | "nueva_solicitud" | "detalle">("menu")
  const [activeTab, setActiveTab] = useState<"activos" | "historial">("activos")
  const [casosActivos, setCasosActivos] = useState<CasoRedil[]>([])
  const [historial, setHistorial] = useState<CasoRedil[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCasoId, setSelectedCasoId] = useState<number | null>(null)
  const [solicitudesMap, setSolicitudesMap] = useState<Record<number, { nombre: string; tipo_ayuda: string[] }>>({})

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const [activos, hist] = await Promise.all([
        redilService.getCasosActivos(),
        redilService.getHistorial(),
      ])
      setCasosActivos(activos)
      setHistorial(hist)

      const allCasoIds = [...activos, ...hist].map((c) => c.id)
      if (allCasoIds.length > 0) {
        const { db } = await import("@/lib/secure-db")
        const { data: solicitudes } = await db.from("solicitudes_redil").select("caso_id,nombre_completo,tipo_ayuda").in("caso_id", allCasoIds)
        if (solicitudes) {
          const map: Record<number, { nombre: string; tipo_ayuda: string[] }> = {}
          for (const s of solicitudes) { map[s.caso_id] = { nombre: s.nombre_completo, tipo_ayuda: s.tipo_ayuda || [] } }
          setSolicitudesMap(map)
        }
      }
    } catch (error: any) {
      toast.error("Error cargando datos: " + error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useRealtime({ table: "casos_redil", onChange: () => loadData(true) })
  useRealtime({ table: "solicitudes_redil", onChange: () => loadData(true) })

  const handleDeleteCaso = async (casoId: number) => {
    try {
      await redilService.eliminarCaso(casoId, user ? { id: user.id, nombre: user.username } : undefined)
      toast.success("Caso eliminado")
      await loadData(true)
    } catch (error: any) {
      toast.error("Error eliminando caso: " + error.message)
    }
  }

  const filterCasos = (casos: CasoRedil[]) => {
    if (!searchQuery.trim()) return casos
    const q = searchQuery.toLowerCase()
    return casos.filter((c) => {
      const sol = solicitudesMap[c.id]
      return sol?.nombre?.toLowerCase().includes(q) || c.usuario_creador_nombre.toLowerCase().includes(q) || String(c.id).includes(q)
    })
  }

  const filteredActivos = filterCasos(casosActivos)
  const filteredHistorial = filterCasos(historial)
  if (!user) return null

  // Vista de detalle
  if (view === "detalle" && selectedCasoId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}><ArrowLeft className="w-4 h-4 mr-1" />Dashboard</Button>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">🤝 REDIL — Ayuda Social</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <CasoDetalle casoId={selectedCasoId} onBack={() => { setView("menu"); setSelectedCasoId(null); loadData(true) }} canEdit={canEdit} userId={user.id} userName={user.displayName} />
        </main>
      </div>
    )
  }

  // Vista nueva solicitud
  if (view === "nueva_solicitud") {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Button variant="ghost" size="sm" onClick={() => setView("menu")}><ArrowLeft className="w-4 h-4 mr-1" />Volver</Button>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <NuevaSolicitudForm onClose={() => setView("menu")} onCreated={() => loadData(true)} userId={user.id} userName={user.displayName} />
        </main>
      </div>
    )
  }


  // Vista principal
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}><ArrowLeft className="w-4 h-4 mr-1" />Volver</Button>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">🤝 REDIL — Ayuda Social</h1>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && <Badge variant="outline" className="text-yellow-600 border-yellow-300"><Lock className="w-3 h-3 mr-1" />Solo lectura</Badge>}
              {canEdit && (
                <Button onClick={() => setView("nueva_solicitud")} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
                  <Plus className="w-4 h-4 mr-2" />Nueva Solicitud
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
              <p className="mt-3 text-gray-500 text-sm">Cargando casos...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <p className="text-2xl font-bold text-blue-600">{casosActivos.length}</p>
                <p className="text-xs text-gray-500 mt-1">Casos Activos</p>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <p className="text-2xl font-bold text-yellow-600">{casosActivos.filter((c) => c.estado === "pendiente_visita").length}</p>
                <p className="text-xs text-gray-500 mt-1">Pend. Visita</p>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <p className="text-2xl font-bold text-orange-600">{casosActivos.filter((c) => c.estado === "pendiente_entrega").length}</p>
                <p className="text-xs text-gray-500 mt-1">Pend. Entrega</p>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <p className="text-2xl font-bold text-gray-600">{historial.length}</p>
                <p className="text-xs text-gray-500 mt-1">Historial</p>
              </div>
            </div>

            {/* Búsqueda */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Buscar por nombre, caso o responsable..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "activos" | "historial")}>
              <TabsList className="grid w-full grid-cols-2 max-w-md h-11">
                <TabsTrigger value="activos" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                  <ClipboardList className="w-4 h-4" />Activos
                  {casosActivos.length > 0 && <Badge className="bg-blue-600 text-white text-xs ml-1">{casosActivos.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="historial" className="gap-2 data-[state=active]:bg-gray-100">
                  <History className="w-4 h-4" />Historial
                  {historial.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{historial.length}</Badge>}
                </TabsTrigger>
              </TabsList>


              {/* Casos Activos */}
              <TabsContent value="activos" className="mt-4">
                {filteredActivos.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><ClipboardList className="w-10 h-10 text-blue-400" /></div>
                    <p className="text-gray-600 font-medium">No hay casos activos</p>
                    {canEdit && <p className="text-sm text-gray-400 mt-1">Cree una nueva solicitud para comenzar</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredActivos.map((caso) => {
                      const sol = solicitudesMap[caso.id]
                      const estadoColor = ESTADOS_COLORS[caso.estado]
                      return (
                        <Card key={caso.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4" style={{ borderLeftColor: `var(--${estadoColor.dot.replace("bg-", "")})` }} onClick={() => { setSelectedCasoId(caso.id); setView("detalle") }}>
                          <CardContent className="py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${estadoColor.bg} shrink-0`}>
                                  <span className="text-lg">🤝</span>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{sol?.nombre || "Sin nombre"}</p>
                                  <p className="text-sm text-gray-500">Caso #{String(caso.id).padStart(5, "0")} — {new Date(caso.fecha_creacion).toLocaleDateString("es-EC")}</p>
                                  {sol?.tipo_ayuda && sol.tipo_ayuda.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {sol.tipo_ayuda.map((t) => {
                                        const tipo = TIPOS_AYUDA.find((ta) => ta.value === t)
                                        return <span key={t} className="text-sm bg-gray-100 rounded px-1.5 py-0.5">{tipo?.icon} <span className="text-xs text-gray-600">{tipo?.label}</span></span>
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`${estadoColor.bg} ${estadoColor.text} text-xs font-semibold px-3 py-1`}>{ESTADOS_LABELS[caso.estado]}</Badge>
                                {canEdit && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={(e) => e.stopPropagation()}><Trash2 className="w-4 h-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>¿Eliminar este caso?</AlertDialogTitle><AlertDialogDescription>Se eliminará permanentemente con toda su información.</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteCaso(caso.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>


              {/* Historial */}
              <TabsContent value="historial" className="mt-4">
                {filteredHistorial.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><History className="w-10 h-10 text-gray-400" /></div>
                    <p className="text-gray-600 font-medium">No hay casos en el historial</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Persona</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipo</th>
                            <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Responsable</th>
                            <th className="px-4 py-3 text-center font-semibold text-gray-600">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredHistorial.map((caso) => {
                            const sol = solicitudesMap[caso.id]
                            const estadoColor = ESTADOS_COLORS[caso.estado]
                            return (
                              <tr key={caso.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">{new Date(caso.fecha_creacion).toLocaleDateString("es-EC")}</td>
                                <td className="px-4 py-3 font-medium">{sol?.nombre || "—"}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    {sol?.tipo_ayuda?.map((t) => { const tipo = TIPOS_AYUDA.find((ta) => ta.value === t); return <span key={t} title={tipo?.label}>{tipo?.icon}</span> })}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center"><Badge className={`${estadoColor.bg} ${estadoColor.text} text-xs`}>{ESTADOS_LABELS[caso.estado]}</Badge></td>
                                <td className="px-4 py-3 text-gray-600">{caso.usuario_creador_nombre}</td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => { setSelectedCasoId(caso.id); setView("detalle") }}><Eye className="w-4 h-4" /></Button>
                                    {canEdit && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar?</AlertDialogTitle><AlertDialogDescription>Se eliminará permanentemente.</AlertDialogDescription></AlertDialogHeader>
                                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteCaso(caso.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  )
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================
export default function RedilAyudaSocialPage() {
  return (
    <PermissionsGuard moduleName="redil_ayuda_social">
      {(canEdit) => <RedilAyudaSocialContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
