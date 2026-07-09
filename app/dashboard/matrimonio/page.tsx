"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft, Search, FileText, XCircle, AlertTriangle, Save, Loader2,
  Download, CheckCircle2, Files,
} from "lucide-react"
import { supabase } from "@/lib/secure-db"
import { toast } from "sonner"
import { generateMatrimonioPDF } from "@/lib/generate-matrimonio-pdf"
import { PDFDocument } from "pdf-lib"


interface MatrimonioCenso {
  id: number
  cedula: string
  apellidos_nombres: string
  conyuge: string | null
  cedula_conyugue: string | null
  fecha_matrimonio: string | null
  hora_matrimonio: string | null
  oficio_matrimonio: string | null
  padrino1_matrimonio: string | null
  padrino2_matrimonio: string | null
  celular: string | null
  created_at: string
  fuente: "protocolo" | "mdg"
}

interface PdfGenerado {
  id: number
  censo_id: number
  fuente: string
  nombre: string
  generado_at: string
}

const REQUIRED_FIELDS = [
  { key: "fecha_matrimonio", label: "Fecha del Matrimonio" },
  { key: "hora_matrimonio", label: "Hora de la Ceremonia" },
  { key: "oficio_matrimonio", label: "Oficio de la Ceremonia" },
  { key: "conyuge", label: "Nombre del Cónyuge" },
  { key: "padrino1_matrimonio", label: "Padrino 1" },
  { key: "padrino2_matrimonio", label: "Padrino 2" },
]


function MatrimonioContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()

  const [records, setRecords] = useState<MatrimonioCenso[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Modal de edición para campos faltantes
  const [editingRecord, setEditingRecord] = useState<MatrimonioCenso | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [missingFields, setMissingFields] = useState<string[]>([])

  // Modal de generación masiva
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [excludeGenerated, setExcludeGenerated] = useState(true)
  const [generatingBulk, setGeneratingBulk] = useState(false)

  // Historial de PDFs generados
  const [pdfGenerados, setPdfGenerados] = useState<PdfGenerado[]>([])

  useEffect(() => {
    loadMatrimonios()
    loadPdfGenerados()
  }, [])

  const loadMatrimonios = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase
          .from("censo")
          .select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio, celular, created_at")
          .eq("matrimonio_irdd", true)
          .order("fecha_matrimonio", { ascending: false }),
        supabase
          .from("censo_mdg")
          .select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio, celular, created_at")
          .eq("matrimonio_irdd", true)
          .order("fecha_matrimonio", { ascending: false }),
      ])

      const all: MatrimonioCenso[] = [
        ...(protocolo || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
        ...(mdg || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
      ]

      const seen = new Set<string>()
      const filtered = all.filter((record) => {
        if (seen.has(record.cedula)) return false
        if (record.cedula_conyugue) seen.add(record.cedula_conyugue)
        seen.add(record.cedula)
        return true
      })

      filtered.sort((a, b) => {
        if (!a.fecha_matrimonio) return 1
        if (!b.fecha_matrimonio) return -1
        return b.fecha_matrimonio.localeCompare(a.fecha_matrimonio)
      })

      setRecords(filtered)
    } catch (error) {
      console.error("Error cargando matrimonios:", error)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  const loadPdfGenerados = async () => {
    try {
      const { data } = await supabase
        .from("matrimonios_pdf_generados")
        .select("*")
        .order("generado_at", { ascending: false })
      setPdfGenerados(data || [])
    } catch {}
  }

  const registrarPdfGenerado = async (record: MatrimonioCenso) => {
    try {
      await supabase.from("matrimonios_pdf_generados").upsert({
        censo_id: record.id,
        fuente: record.fuente,
        nombre: record.apellidos_nombres,
        generado_at: new Date().toISOString(),
      }, { onConflict: "censo_id,fuente" })
      await loadPdfGenerados()
    } catch {}
  }

  useRealtimeMultiple(["censo", "censo_mdg"], () => loadMatrimonios(true))


  const handleSearch = async () => {
    if (!searchQuery.trim()) { loadMatrimonios(); return }
    try {
      setIsLoading(true)
      const q = searchQuery.trim()
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase.from("censo")
          .select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio, celular, created_at")
          .eq("matrimonio_irdd", true)
          .or(`apellidos_nombres.ilike.%${q}%,conyuge.ilike.%${q}%,cedula.ilike.%${q}%`),
        supabase.from("censo_mdg")
          .select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio, celular, created_at")
          .eq("matrimonio_irdd", true)
          .or(`apellidos_nombres.ilike.%${q}%,conyuge.ilike.%${q}%,cedula.ilike.%${q}%`),
      ])
      const all: MatrimonioCenso[] = [
        ...(protocolo || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
        ...(mdg || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
      ]
      const seen = new Set<string>()
      const filtered = all.filter((r) => { if (seen.has(r.cedula)) return false; if (r.cedula_conyugue) seen.add(r.cedula_conyugue); seen.add(r.cedula); return true })
      filtered.sort((a, b) => { if (!a.fecha_matrimonio) return 1; if (!b.fecha_matrimonio) return -1; return b.fecha_matrimonio.localeCompare(a.fecha_matrimonio) })
      setRecords(filtered)
    } catch (error) { console.error("Error buscando:", error) }
    finally { setIsLoading(false) }
  }

  function formatDateForTable(dateString: string | null) {
    if (!dateString) return "-"
    const date = new Date(dateString)
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`
  }

  function getMissingFields(record: MatrimonioCenso): string[] {
    return REQUIRED_FIELDS.filter((f) => !record[f.key as keyof MatrimonioCenso]).map((f) => f.key)
  }

  function isGenerado(record: MatrimonioCenso): boolean {
    return pdfGenerados.some((p) => p.censo_id === record.id && p.fuente === record.fuente)
  }

  function handlePdfClick(record: MatrimonioCenso) {
    const missing = getMissingFields(record)
    if (missing.length > 0) {
      setEditingRecord(record)
      setMissingFields(missing)
      const form: Record<string, string> = {}
      for (const f of REQUIRED_FIELDS) { form[f.key] = (record[f.key as keyof MatrimonioCenso] as string) || "" }
      setEditForm(form)
    } else {
      downloadPDF(record)
    }
  }

  async function downloadPDF(record: MatrimonioCenso) {
    try {
      const pdfBytes = await generateMatrimonioPDF({
        nombre: record.apellidos_nombres, cedula: record.cedula,
        conyuge: record.conyuge || "", cedula_conyugue: record.cedula_conyugue || "",
        fecha: record.fecha_matrimonio || "", hora: record.hora_matrimonio || "",
        oficio: record.oficio_matrimonio || "", padrino1: record.padrino1_matrimonio || "",
        padrino2: record.padrino2_matrimonio || "",
      })
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Matrimonio - ${record.apellidos_nombres}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      await registrarPdfGenerado(record)
      toast.success("PDF generado")
    } catch (error) {
      console.error("Error generando PDF:", error)
      toast.error("Error al generar el PDF")
    }
  }


  async function handleSaveEdit() {
    if (!editingRecord || !canEdit) return
    if (editForm.hora_matrimonio && !/^\d{1,2}:\d{2}$/.test(editForm.hora_matrimonio)) {
      toast.error("Formato de hora inválido. Use HH:MM (ej: 10:30)"); return
    }
    if (editForm.hora_matrimonio) {
      const [h, m] = editForm.hora_matrimonio.split(":").map(Number)
      if (h < 0 || h > 23 || m < 0 || m > 59) { toast.error("Hora inválida"); return }
      editForm.hora_matrimonio = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    }
    const doSave = async () => {
      setSaving(true)
      try {
        const tabla = editingRecord.fuente === "protocolo" ? "censo" : "censo_mdg"
        const updateData: Record<string, any> = {}
        for (const f of REQUIRED_FIELDS) { if (editForm[f.key]?.trim()) updateData[f.key] = editForm[f.key].trim() }
        updateData.updated_at = new Date().toISOString()
        const { error } = await supabase.from(tabla).update(updateData).eq("id", editingRecord.id)
        if (error) throw error
        toast.success("Datos actualizados")
        setEditingRecord(null)
        await loadMatrimonios(true)
        const updatedRecord = { ...editingRecord, ...updateData }
        const stillMissing = getMissingFields(updatedRecord as MatrimonioCenso)
        if (stillMissing.length === 0) downloadPDF(updatedRecord as MatrimonioCenso)
      } catch (error) { console.error("Error guardando:", error); toast.error("Error al guardar") }
      finally { setSaving(false) }
    }
    checkAndExecute(editingRecord.created_at, doSave)
  }

  // === GENERACIÓN MASIVA ===
  function openBulkModal() {
    // Incluir todos, seleccionar por defecto solo los que tienen datos completos
    const initial = new Set<string>()
    for (const r of records) {
      const missing = getMissingFields(r)
      if (missing.length > 0) continue
      if (excludeGenerated && isGenerado(r)) continue
      initial.add(`${r.fuente}-${r.id}`)
    }
    setBulkSelected(initial)
    setShowBulkModal(true)
  }

  function toggleBulkItem(key: string) {
    setBulkSelected((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }

  function selectAllBulk() {
    const selectable = records.filter((r) => {
      if (getMissingFields(r).length > 0) return false
      if (excludeGenerated && isGenerado(r)) return false
      return true
    })
    setBulkSelected(new Set(selectable.map((r) => `${r.fuente}-${r.id}`)))
  }

  function deselectAllBulk() { setBulkSelected(new Set()) }

  function toggleExcludeGenerated() {
    const newVal = !excludeGenerated
    setExcludeGenerated(newVal)
    const selectable = records.filter((r) => {
      if (getMissingFields(r).length > 0) return false
      if (newVal && isGenerado(r)) return false
      return true
    })
    setBulkSelected(new Set(selectable.map((r) => `${r.fuente}-${r.id}`)))
  }

  async function handleBulkGenerate() {
    if (bulkSelected.size === 0) { toast.error("Seleccione al menos un matrimonio"); return }
    setGeneratingBulk(true)
    try {
      const selectedRecords = records.filter((r) => bulkSelected.has(`${r.fuente}-${r.id}`))
      // Crear PDF combinado
      const mergedDoc = await PDFDocument.create()
      for (const record of selectedRecords) {
        const pdfBytes = await generateMatrimonioPDF({
          nombre: record.apellidos_nombres, cedula: record.cedula,
          conyuge: record.conyuge || "", cedula_conyugue: record.cedula_conyugue || "",
          fecha: record.fecha_matrimonio || "", hora: record.hora_matrimonio || "",
          oficio: record.oficio_matrimonio || "", padrino1: record.padrino1_matrimonio || "",
          padrino2: record.padrino2_matrimonio || "",
        })
        const singleDoc = await PDFDocument.load(pdfBytes)
        const [page] = await mergedDoc.copyPages(singleDoc, [0])
        mergedDoc.addPage(page)
        await registrarPdfGenerado(record)
      }
      const mergedBytes = await mergedDoc.save()
      const blob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Matrimonios_${new Date().toISOString().split("T")[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(`PDF generado con ${selectedRecords.length} certificados`)
      setShowBulkModal(false)
    } catch (error) { console.error("Error generando PDFs:", error); toast.error("Error al generar") }
    finally { setGeneratingBulk(false) }
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

  const incompleteCount = records.filter((r) => getMissingFields(r).length > 0).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Registro de Matrimonios</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={openBulkModal}>
                <Files className="w-4 h-4 mr-1" />Generar PDFs
              </Button>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                {records.length} matrimonios
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Búsqueda */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input placeholder="Buscar por nombre, cónyuge o cédula..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="flex-1" />
              <Button onClick={handleSearch}><Search className="w-4 h-4 mr-2" />Buscar</Button>
              <Button variant="outline" onClick={() => { setSearchQuery(""); loadMatrimonios() }}>Limpiar</Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla principal */}
        <Card>
          <CardHeader>
            <CardTitle>Matrimonios Registrados</CardTitle>
            <CardDescription>Parejas casadas en la Iglesia IRDD (censo Protocolo y MDG)</CardDescription>
          </CardHeader>
          <CardContent>
            {records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-10">#</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Nombre</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Cónyuge</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-28">Fecha</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-16">Hora</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-20">Fuente</th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-14">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => {
                      const missing = getMissingFields(record)
                      const hasAllData = missing.length === 0
                      const generado = isGenerado(record)
                      return (
                        <tr key={`${record.fuente}-${record.id}`} className={`hover:bg-gray-50 ${generado ? "bg-green-50/50" : ""}`}>
                          <td className="border border-gray-300 px-3 py-2 text-gray-500">{index + 1}</td>
                          <td className="border border-gray-300 px-3 py-2 font-medium">{record.apellidos_nombres}</td>
                          <td className="border border-gray-300 px-3 py-2">{record.conyuge || "-"}</td>
                          <td className="border border-gray-300 px-3 py-2">{formatDateForTable(record.fecha_matrimonio)}</td>
                          <td className="border border-gray-300 px-3 py-2">{record.hora_matrimonio || "-"}</td>
                          <td className="border border-gray-300 px-3 py-2">
                            <Badge variant="outline" className="text-xs">{record.fuente === "protocolo" ? "Protocolo" : "MDG"}</Badge>
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handlePdfClick(record)}
                                className={hasAllData ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-red-500 hover:text-red-600 hover:bg-red-50"}>
                                {hasAllData ? <FileText className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                              </Button>
                              {generado && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No hay matrimonios registrados.</p>
                <p className="text-sm mt-1">Se registran desde el Censo marcando "Matrimonio en la Iglesia IRDD".</p>
              </div>
            )}
          </CardContent>
        </Card>


      </main>

      {/* Modal de edición de campos faltantes */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => { if (!open) setEditingRecord(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Datos incompletos para PDF
            </DialogTitle>
            <DialogDescription>
              {editingRecord && (<>Faltan datos de <strong>{editingRecord.apellidos_nombres}</strong> para generar el certificado.</>)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {REQUIRED_FIELDS.map((field) => {
              const isMissing = missingFields.includes(field.key)
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label className={`text-sm ${isMissing ? "text-red-600 font-medium" : "text-gray-700"}`}>
                    {field.label} {isMissing && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    value={editForm[field.key] || ""}
                    onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
                    placeholder={field.key === "hora_matrimonio" ? "HH:MM (ej: 10:30)" : `Ingrese ${field.label.toLowerCase()}`}
                    className={isMissing ? "border-red-300 focus:border-red-500" : ""}
                    disabled={!canEdit}
                  />
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>Cancelar</Button>
            {canEdit && (
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><Save className="w-4 h-4 mr-2" />Guardar y Generar PDF</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Modal de generación masiva */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Files className="w-5 h-5 text-blue-500" />
              Generar PDFs de Matrimonio
            </DialogTitle>
            <DialogDescription>
              Seleccione los matrimonios para generar un PDF combinado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {/* Opciones */}
            <div className="flex items-center justify-between border-b pb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={excludeGenerated} onCheckedChange={toggleExcludeGenerated} />
                <span className="text-sm">Excluir ya generados</span>
              </label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllBulk}>Todos</Button>
                <Button variant="outline" size="sm" onClick={deselectAllBulk}>Ninguno</Button>
              </div>
            </div>

            {/* Advertencia de incompletos */}
            {incompleteCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {incompleteCount} matrimonio{incompleteCount !== 1 ? "s" : ""} con datos incompletos:
                </p>
                <ul className="mt-1 text-xs text-amber-700 list-disc pl-5 max-h-20 overflow-y-auto">
                  {records.filter((r) => getMissingFields(r).length > 0).map((r) => (
                    <li key={`${r.fuente}-${r.id}`}>
                      <strong>{r.apellidos_nombres}</strong> — Falta: {getMissingFields(r).map((k) => REQUIRED_FIELDS.find((f) => f.key === k)?.label).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-gray-500">
              {bulkSelected.size} seleccionados
            </div>

            {/* Lista con checkboxes */}
            <div className="flex-1 overflow-y-auto border rounded-lg divide-y max-h-[40vh]">
              {records.map((record) => {
                const key = `${record.fuente}-${record.id}`
                const generado = isGenerado(record)
                const missing = getMissingFields(record)
                const hasData = missing.length === 0
                if (excludeGenerated && generado) return null
                return (
                  <label key={key} className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${!hasData ? "opacity-50" : "cursor-pointer"}`}>
                    <Checkbox
                      checked={bulkSelected.has(key)}
                      onCheckedChange={() => { if (hasData) toggleBulkItem(key) }}
                      disabled={!hasData}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{record.apellidos_nombres}</span>
                      <span className="text-xs text-gray-500">
                        {hasData
                          ? `${record.conyuge || "Sin cónyuge"} — ${formatDateForTable(record.fecha_matrimonio)}`
                          : `Faltan: ${missing.map((k) => REQUIRED_FIELDS.find((f) => f.key === k)?.label).join(", ")}`
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="text-xs">{record.fuente === "protocolo" ? "P" : "M"}</Badge>
                      {generado && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      {!hasData && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>Cancelar</Button>
            <Button onClick={handleBulkGenerate} disabled={generatingBulk || bulkSelected.size === 0}>
              {generatingBulk ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" />Generar {bulkSelected.size} PDF{bulkSelected.size !== 1 ? "s" : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function MatrimonioPage() {
  return (
    <PermissionsGuard moduleName="matrimonio">
      {(canEdit) => <MatrimonioContent canEdit={!!canEdit} />}
    </PermissionsGuard>
  )
}
