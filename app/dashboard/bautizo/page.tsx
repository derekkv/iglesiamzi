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
  CheckCircle2, Files,
} from "lucide-react"
import { supabase } from "@/lib/secure-db"
import { toast } from "sonner"
import { generateBautizoPDF } from "@/lib/generate-bautizo-pdf"
import { PDFDocument } from "pdf-lib"



interface BautizoCenso {
  id: number
  cedula: string
  apellidos_nombres: string
  fecha_bautizo: string | null
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
  { key: "fecha_bautizo", label: "Fecha del Bautizo" },
]



function BautizoContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()

  const [records, setRecords] = useState<BautizoCenso[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Modal de edición para campos faltantes
  const [editingRecord, setEditingRecord] = useState<BautizoCenso | null>(null)
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
    loadBautizos()
    loadPdfGenerados()
  }, [])

  const loadBautizos = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase
          .from("censo")
          .select("id, cedula, apellidos_nombres, fecha_bautizo, celular, created_at")
          .eq("bautizo_irdd", true)
          .order("fecha_bautizo", { ascending: false }),
        supabase
          .from("censo_mdg")
          .select("id, cedula, apellidos_nombres, fecha_bautizo, celular, created_at")
          .eq("bautizo_irdd", true)
          .order("fecha_bautizo", { ascending: false }),
      ])

      const all: BautizoCenso[] = [
        ...(protocolo || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
        ...(mdg || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
      ]

      const seen = new Set<string>()
      const filtered = all.filter((r) => {
        if (seen.has(r.cedula)) return false
        seen.add(r.cedula)
        return true
      })

      filtered.sort((a, b) => {
        if (!a.fecha_bautizo) return 1
        if (!b.fecha_bautizo) return -1
        return b.fecha_bautizo.localeCompare(a.fecha_bautizo)
      })

      setRecords(filtered)
    } catch (error) {
      console.error("Error cargando bautizos:", error)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  const loadPdfGenerados = async () => {
    try {
      const { data } = await supabase
        .from("bautizos_pdf_generados")
        .select("*")
        .order("generado_at", { ascending: false })
      setPdfGenerados(data || [])
    } catch {}
  }

  const registrarPdfGenerado = async (record: BautizoCenso) => {
    try {
      await supabase.from("bautizos_pdf_generados").upsert({
        censo_id: record.id,
        fuente: record.fuente,
        nombre: record.apellidos_nombres,
        generado_at: new Date().toISOString(),
      }, { onConflict: "censo_id,fuente" })
      await loadPdfGenerados()
    } catch {}
  }

  useRealtimeMultiple(["censo", "censo_mdg"], () => loadBautizos(true))


  const handleSearch = async () => {
    if (!searchQuery.trim()) { loadBautizos(); return }
    try {
      setIsLoading(true)
      const q = searchQuery.trim()
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase.from("censo")
          .select("id, cedula, apellidos_nombres, fecha_bautizo, celular, created_at")
          .eq("bautizo_irdd", true)
          .or(`apellidos_nombres.ilike.%${q}%,cedula.ilike.%${q}%`),
        supabase.from("censo_mdg")
          .select("id, cedula, apellidos_nombres, fecha_bautizo, celular, created_at")
          .eq("bautizo_irdd", true)
          .or(`apellidos_nombres.ilike.%${q}%,cedula.ilike.%${q}%`),
      ])
      const all: BautizoCenso[] = [
        ...(protocolo || []).map((r: any) => ({ ...r, fuente: "protocolo" as const })),
        ...(mdg || []).map((r: any) => ({ ...r, fuente: "mdg" as const })),
      ]
      const seen = new Set<string>()
      const filtered = all.filter((r) => { if (seen.has(r.cedula)) return false; seen.add(r.cedula); return true })
      filtered.sort((a, b) => { if (!a.fecha_bautizo) return 1; if (!b.fecha_bautizo) return -1; return b.fecha_bautizo.localeCompare(a.fecha_bautizo) })
      setRecords(filtered)
    } catch (error) { console.error("Error buscando:", error) }
    finally { setIsLoading(false) }
  }

  function formatDateForTable(dateString: string | null) {
    if (!dateString) return "-"
    const date = new Date(dateString)
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`
  }

  function getMissingFields(record: BautizoCenso): string[] {
    return REQUIRED_FIELDS.filter((f) => !record[f.key as keyof BautizoCenso]).map((f) => f.key)
  }

  function isGenerado(record: BautizoCenso): boolean {
    return pdfGenerados.some((p) => p.censo_id === record.id && p.fuente === record.fuente)
  }

  function handlePdfClick(record: BautizoCenso) {
    const missing = getMissingFields(record)
    if (missing.length > 0) {
      setEditingRecord(record)
      setMissingFields(missing)
      const form: Record<string, string> = {}
      for (const f of REQUIRED_FIELDS) { form[f.key] = (record[f.key as keyof BautizoCenso] as string) || "" }
      setEditForm(form)
    } else {
      downloadPDF(record)
    }
  }

  async function downloadPDF(record: BautizoCenso) {
    try {
      const pdfBytes = await generateBautizoPDF({
        nombre: record.apellidos_nombres,
        cedula: record.cedula,
        fecha_bautizo: record.fecha_bautizo || "",
      })
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Bautizo - ${record.apellidos_nombres}.pdf`
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
        await loadBautizos(true)
        const updatedRecord = { ...editingRecord, ...updateData }
        const stillMissing = getMissingFields(updatedRecord as BautizoCenso)
        if (stillMissing.length === 0) downloadPDF(updatedRecord as BautizoCenso)
      } catch (error) { console.error("Error guardando:", error); toast.error("Error al guardar") }
      finally { setSaving(false) }
    }
    checkAndExecute(editingRecord.created_at, doSave)
  }

  // === GENERACIÓN MASIVA ===
  function openBulkModal() {
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
    if (bulkSelected.size === 0) { toast.error("Seleccione al menos un bautizo"); return }
    setGeneratingBulk(true)
    try {
      const selectedRecords = records.filter((r) => bulkSelected.has(`${r.fuente}-${r.id}`))
      const mergedDoc = await PDFDocument.create()
      for (const record of selectedRecords) {
        const pdfBytes = await generateBautizoPDF({
          nombre: record.apellidos_nombres,
          cedula: record.cedula,
          fecha_bautizo: record.fecha_bautizo || "",
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
      link.download = `Bautizos_${new Date().toISOString().split("T")[0]}.pdf`
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
          <p className="text-gray-600">Cargando bautizos...</p>
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
              <h1 className="text-xl font-semibold text-gray-900">Registro de Bautizos</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={openBulkModal}>
                <Files className="w-4 h-4 mr-1" />Generar PDFs
              </Button>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                {records.length} bautizados
              </Badge>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Censo Protocolo + MDG
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Búsqueda */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input placeholder="Buscar por nombre o cédula..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="flex-1" />
              <Button onClick={handleSearch}><Search className="w-4 h-4 mr-2" />Buscar</Button>
              <Button variant="outline" onClick={() => { setSearchQuery(""); loadBautizos() }}>Limpiar</Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle>Bautizos Registrados</CardTitle>
            <CardDescription>Personas bautizadas en la Iglesia IRDD (censo Protocolo y MDG)</CardDescription>
          </CardHeader>
          <CardContent>
            {records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-10">#</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Cédula</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Nombre</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold w-28">Fecha Bautizo</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Celular</th>
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
                          <td className="border border-gray-300 px-3 py-2">{record.cedula}</td>
                          <td className="border border-gray-300 px-3 py-2 font-medium">{record.apellidos_nombres}</td>
                          <td className="border border-gray-300 px-3 py-2">{formatDateForTable(record.fecha_bautizo)}</td>
                          <td className="border border-gray-300 px-3 py-2">{record.celular || "-"}</td>
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
                <p>No hay bautizos registrados.</p>
                <p className="text-sm mt-1">Se registran desde el Censo marcando "Se bautizó en la IRDD".</p>
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
                    type="date"
                    value={editForm[field.key] || ""}
                    onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
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
              Generar PDFs de Bautizo
            </DialogTitle>
            <DialogDescription>
              Seleccione los bautizos para generar un PDF combinado.
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
                  {incompleteCount} bautizo{incompleteCount !== 1 ? "s" : ""} sin fecha registrada
                </p>
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
                      onCheckedChange={() => hasData && toggleBulkItem(key)}
                      disabled={!hasData}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{record.apellidos_nombres}</p>
                      <p className="text-xs text-gray-500">{formatDateForTable(record.fecha_bautizo)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {generado && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      {!hasData && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      <Badge variant="outline" className="text-[10px]">{record.fuente === "protocolo" ? "P" : "M"}</Badge>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>Cancelar</Button>
            <Button onClick={handleBulkGenerate} disabled={generatingBulk || bulkSelected.size === 0}>
              {generatingBulk ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</> : <><Files className="w-4 h-4 mr-2" />Generar {bulkSelected.size} PDFs</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function BautizoPage() {
  return (
    <PermissionsGuard moduleName="bautizo">
      {(canEdit) => <BautizoContent canEdit={!!canEdit} />}
    </PermissionsGuard>
  )
}
