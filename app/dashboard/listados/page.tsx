"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Download, FileText, FileSpreadsheet, ArrowLeft, Filter } from "lucide-react"
import { supabase } from "@/lib/secure-db"
import { toast } from "sonner"
import { generateBautizoPDF } from "@/lib/generate-bautizo-pdf"
import { generateMatrimonioPDF } from "@/lib/generate-matrimonio-pdf"
import { generateMatrimonioPDFv2 } from "@/lib/generate-matrimonio-pdf-v2"
import { generateCertificadosPDF } from "@/lib/generate-certificados"
import { PDFDocument } from "pdf-lib"
import { PermissionsGuard } from "@/lib/permissions-guard"
import type { CicloTipo } from "@/lib/mod/discipulado-ciclos-service"

function ListadosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Column filter for Excel export
  const [showColumnFilter, setShowColumnFilter] = useState(false)
  const [columnFilterTarget, setColumnFilterTarget] = useState<"protocolo" | "mdg" | "combinado">("protocolo")
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())

  // ========== BAUTIZOS ==========
  async function handleGenerateBautizos() {
    setGenerating(true)
    try {
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase.from("censo").select("id, cedula, apellidos_nombres, fecha_bautizo").eq("bautizo_irdd", true).order("fecha_bautizo", { ascending: false }),
        supabase.from("censo_mdg").select("id, cedula, apellidos_nombres, fecha_bautizo").eq("bautizo_irdd", true).order("fecha_bautizo", { ascending: false }),
      ])

      const all = [
        ...(protocolo || []).filter((r: any) => r.fecha_bautizo),
        ...(mdg || []).filter((r: any) => r.fecha_bautizo),
      ]

      if (all.length === 0) { toast.error("No hay bautizos con fecha registrada"); return }

      const mergedDoc = await PDFDocument.create()
      for (const record of all) {
        const pdfBytes = await generateBautizoPDF({
          nombre: record.apellidos_nombres,
          cedula: record.cedula,
          fecha_bautizo: record.fecha_bautizo,
        })
        const singleDoc = await PDFDocument.load(pdfBytes)
        const [page] = await mergedDoc.copyPages(singleDoc, [0])
        mergedDoc.addPage(page)
      }

      const mergedBytes = await mergedDoc.save()
      downloadBlob(mergedBytes, `Bautizos_${todayStr()}.pdf`)
      toast.success(`PDF generado con ${all.length} certificados de bautizo`)
    } catch (error) {
      console.error("Error generando bautizos:", error)
      toast.error("Error al generar PDFs de bautizo")
    } finally {
      setGenerating(false)
    }
  }

  // ========== MATRIMONIOS ==========
  async function handleGenerateMatrimonios(version: "v1" | "v2") {
    setGenerating(true)
    try {
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase.from("censo").select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio").eq("matrimonio_irdd", true).order("fecha_matrimonio", { ascending: false }),
        supabase.from("censo_mdg").select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio").eq("matrimonio_irdd", true).order("fecha_matrimonio", { ascending: false }),
      ])

      const all = [
        ...(protocolo || []).filter((r: any) => r.fecha_matrimonio && r.conyuge),
        ...(mdg || []).filter((r: any) => r.fecha_matrimonio && r.conyuge),
      ]

      if (all.length === 0) { toast.error("No hay matrimonios con datos completos"); return }

      const mergedDoc = await PDFDocument.create()
      for (const record of all) {
        let pdfBytes: Uint8Array
        if (version === "v2") {
          pdfBytes = await generateMatrimonioPDFv2({
            nombre: record.apellidos_nombres,
            conyuge: record.conyuge || "",
            oficio: record.oficio_matrimonio || "",
            fecha: record.fecha_matrimonio || "",
          })
        } else {
          pdfBytes = await generateMatrimonioPDF({
            nombre: record.apellidos_nombres,
            cedula: record.cedula,
            conyuge: record.conyuge || "",
            cedula_conyugue: record.cedula_conyugue || "",
            fecha: record.fecha_matrimonio || "",
            hora: record.hora_matrimonio || "",
            oficio: record.oficio_matrimonio || "",
            padrino1: record.padrino1_matrimonio || "",
            padrino2: record.padrino2_matrimonio || "",
          })
        }
        const singleDoc = await PDFDocument.load(pdfBytes)
        const [page] = await mergedDoc.copyPages(singleDoc, [0])
        mergedDoc.addPage(page)
      }

      const mergedBytes = await mergedDoc.save()
      downloadBlob(mergedBytes, `Matrimonios_${version === "v2" ? "Simple" : "Completo"}_${todayStr()}.pdf`)
      toast.success(`PDF generado con ${all.length} certificados de matrimonio`)
    } catch (error) {
      console.error("Error generando matrimonios:", error)
      toast.error("Error al generar PDFs de matrimonio")
    } finally {
      setGenerating(false)
    }
  }

  // ========== DISCIPULADO ==========
  async function handleGenerateDiscipulado(tipo: CicloTipo) {
    setGenerating(true)
    try {
      const { data: ciclos } = await supabase
        .from("discipulado_ciclos")
        .select("id, nombre")
        .eq("tipo", tipo)
        .eq("estado", "completado")

      if (!ciclos || ciclos.length === 0) {
        toast.error("No hay ciclos completados de este tipo")
        setGenerating(false)
        return
      }

      const cicloIds = ciclos.map((c: any) => c.id)
      const { data: participantes } = await supabase
        .from("discipulado_participantes")
        .select("nombre_completo, estado")
        .in("ciclo_id", cicloIds)
        .eq("estado", "aprobado")

      if (!participantes || participantes.length === 0) {
        toast.error("No hay participantes aprobados")
        setGenerating(false)
        return
      }

      const nombres = participantes.map((p: any) => p.nombre_completo)
      const pdfBytes = await generateCertificadosPDF(nombres, tipo)
      downloadBlob(pdfBytes, `Certificados_${tipo}_${todayStr()}.pdf`)
      toast.success(`PDF generado con ${nombres.length} certificados de discipulado`)
    } catch (error) {
      console.error("Error generando discipulado:", error)
      toast.error("Error al generar certificados de discipulado")
    } finally {
      setGenerating(false)
    }
  }

  // ========== EXPORTAR CENSO A EXCEL ==========
  async function openColumnFilter(target: "protocolo" | "mdg" | "combinado") {
    setColumnFilterTarget(target)
    try {
      let sampleData: any[] = []
      if (target === "protocolo") {
        const { data } = await supabase.from("censo").select("*").limit(1)
        sampleData = data || []
      } else if (target === "mdg") {
        const { data } = await supabase.from("censo_mdg").select("*").limit(1)
        sampleData = data || []
      } else {
        const [{ data: p }, { data: m }] = await Promise.all([
          supabase.from("censo").select("*").limit(1),
          supabase.from("censo_mdg").select("*").limit(1),
        ])
        const allKeys = new Set<string>()
        for (const row of [...(p || []), ...(m || [])]) { Object.keys(row).forEach(k => allKeys.add(k)) }
        allKeys.add("fuente")
        sampleData = [Object.fromEntries([...allKeys].map(k => [k, ""]))]
      }
      if (sampleData.length > 0) {
        const cols = Object.keys(sampleData[0])
        setAvailableColumns(cols)
        setSelectedColumns(new Set(cols)) // todas seleccionadas por defecto
      }
    } catch (error) {
      console.error("Error cargando columnas:", error)
    }
    setShowColumnFilter(true)
  }

  async function handleExportWithColumns() {
    setShowColumnFilter(false)
    if (columnFilterTarget === "protocolo") await handleExportCenso()
    else if (columnFilterTarget === "mdg") await handleExportCensoMdg()
    else await handleExportCensoCombinado()
  }

  async function handleExportCenso() {
    setExporting(true)
    try {
      const { data, error } = await supabase
        .from("censo")
        .select("*")
        .order("apellidos_nombres", { ascending: true })

      if (error) throw error
      if (!data || data.length === 0) { toast.error("No hay datos en el censo"); return }

      const filtered = filterColumns(data)
      const blob = generateExcel(filtered, "Censo Protocolo")
      downloadExcel(blob, `Censo_Protocolo_${todayStr()}.xlsx`)
      toast.success(`Censo exportado: ${data.length} registros`)
    } catch (error) {
      console.error("Error exportando censo:", error)
      toast.error("Error al exportar el censo")
    } finally {
      setExporting(false)
    }
  }

  async function handleExportCensoMdg() {
    setExporting(true)
    try {
      const { data, error } = await supabase
        .from("censo_mdg")
        .select("*")
        .order("apellidos_nombres", { ascending: true })

      if (error) throw error
      if (!data || data.length === 0) { toast.error("No hay datos en el censo MDG"); return }

      const filtered = filterColumns(data)
      const blob = generateExcel(filtered, "Censo MDG")
      downloadExcel(blob, `Censo_MDG_${todayStr()}.xlsx`)
      toast.success(`Censo MDG exportado: ${data.length} registros`)
    } catch (error) {
      console.error("Error exportando censo MDG:", error)
      toast.error("Error al exportar el censo MDG")
    } finally {
      setExporting(false)
    }
  }

  async function handleExportCensoCombinado() {
    setExporting(true)
    try {
      const [{ data: protocolo, error: err1 }, { data: mdg, error: err2 }] = await Promise.all([
        supabase.from("censo").select("*").order("apellidos_nombres", { ascending: true }),
        supabase.from("censo_mdg").select("*").order("apellidos_nombres", { ascending: true }),
      ])

      if (err1) throw err1
      if (err2) throw err2

      const allProtocolo = (protocolo || []).map((r: any) => ({ ...r, fuente: "Protocolo" }))
      const allMdg = (mdg || []).map((r: any) => ({ ...r, fuente: "MDG" }))
      const combined = [...allProtocolo, ...allMdg]

      if (combined.length === 0) { toast.error("No hay datos en ningún censo"); return }

      // Unificar columnas
      const allKeys = new Set<string>()
      for (const row of combined) { Object.keys(row).forEach(k => allKeys.add(k)) }
      allKeys.delete("fuente")
      const headers = [...Array.from(allKeys), "fuente"]

      const normalized = combined.map((row: any) => {
        const obj: any = {}
        for (const h of headers) { obj[h] = row[h] !== undefined ? row[h] : null }
        return obj
      })

      const filtered = filterColumns(normalized)
      const blob = generateExcel(filtered, "Censo Combinado")
      downloadExcel(blob, `Censo_Combinado_${todayStr()}.xlsx`)
      toast.success(`Censo combinado exportado: ${combined.length} registros (${allProtocolo.length} protocolo + ${allMdg.length} MDG)`)
    } catch (error) {
      console.error("Error exportando censo combinado:", error)
      toast.error("Error al exportar el censo combinado")
    } finally {
      setExporting(false)
    }
  }

  function filterColumns(data: any[]): any[] {
    if (selectedColumns.size === 0 || selectedColumns.size === availableColumns.length) return data
    return data.map((row: any) => {
      const filtered: any = {}
      for (const key of selectedColumns) {
        filtered[key] = row[key]
      }
      return filtered
    })
  }

  // ========== UTILS ==========
  function todayStr() {
    return new Date().toISOString().split("T")[0]
  }

  // Nombres legibles para headers de columnas del censo
  const HEADER_LABELS: Record<string, string> = {
    id: "ID",
    cedula: "Cédula",
    apellidos_nombres: "Nombres y Apellidos",
    fecha_nacimiento: "Fecha de Nacimiento",
    edad: "Edad",
    sexo: "Sexo",
    estado_civil: "Estado Civil",
    direccion: "Dirección",
    celular: "Celular",
    convencional: "Teléfono Fijo",
    correo: "Correo Electrónico",
    conyuge: "Cónyuge",
    cedula_conyugue: "Cédula del Cónyuge",
    hijos: "Hijos",
    celula_asiste: "Asiste a Célula",
    celula_nombre: "Nombre de Célula",
    bautizo_irdd: "Bautizado en IRDD",
    fecha_bautizo: "Fecha de Bautizo",
    matrimonio_irdd: "Matrimonio en IRDD",
    fecha_matrimonio: "Fecha de Matrimonio",
    hora_matrimonio: "Hora de Matrimonio",
    oficio_matrimonio: "Quién ofició la ceremonia",
    padrino1_matrimonio: "Padrino 1",
    padrino2_matrimonio: "Padrino 2",
    created_at: "Fecha de Registro",
    updated_at: "Última Actualización",
    is_active: "Activo",
    ministerio: "Ministerio",
    cargo: "Cargo",
    profesion: "Profesión",
    tipo_sangre: "Tipo de Sangre",
    alergias: "Alergias",
    discapacidad: "Discapacidad",
    observaciones: "Observaciones",
    nuevo_creyente: "Nuevo Creyente",
    fecha_conversion: "Fecha de Conversión",
    quien_lo_trajo: "Quién lo trajo",
    fuente: "Fuente",
  }

  function getHeaderLabel(key: string): string {
    return HEADER_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function generateExcel(data: any[], sheetName: string): Blob {
    const XLSX = require("xlsx")

    // Crear headers legibles
    const rawHeaders = Object.keys(data[0])
    const headers = rawHeaders.map(getHeaderLabel)

    // Crear filas con datos
    const rows = data.map((row) =>
      rawHeaders.map((h) => {
        const val = (row as any)[h]
        if (val === null || val === undefined) return ""
        if (val === true) return "Sí"
        if (val === false) return "No"
        // Manejar arrays y objetos (como 'hijos' que es JSON)
        if (Array.isArray(val)) {
          return val.map((item: any) => {
            if (typeof item === "object" && item !== null) {
              // hijos: [{nombre, edad}] → "Juan (5), María (8)"
              if (item.nombre) return item.edad ? `${item.nombre} (${item.edad})` : item.nombre
              return Object.values(item).join(", ")
            }
            return String(item)
          }).join(", ")
        }
        if (typeof val === "object") {
          return JSON.stringify(val)
        }
        return val
      })
    )

    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

    // Auto-ajustar anchos de columna
    const colWidths = rawHeaders.map((h, i) => {
      const headerLen = headers[i].length
      let maxLen = headerLen
      for (const row of rows) {
        const cellLen = String(row[i] || "").length
        if (cellLen > maxLen) maxLen = cellLen
      }
      // Mínimo 12, máximo 50, +2 de padding
      return { wch: Math.min(Math.max(maxLen + 2, 12), 50) }
    })
    ws["!cols"] = colWidths

    // Agregar autofilter en la fila de headers
    const lastCol = XLSX.utils.encode_col(headers.length - 1)
    ws["!autofilter"] = { ref: `A1:${lastCol}1` }

    // Crear workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    // Generar blob
    const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    return new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  }

  function downloadExcel(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function downloadBlob(bytes: Uint8Array, filename: string) {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
              <h1 className="text-xl font-semibold text-gray-900">Listados</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Generación de Certificados y Exportaciones</CardTitle>
            <CardDescription>Genere certificados PDF masivos y exporte datos del censo</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="bautizos" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="bautizos">Bautizos</TabsTrigger>
                <TabsTrigger value="matrimonios">Matrimonios</TabsTrigger>
                <TabsTrigger value="discipulado">Discipulado</TabsTrigger>
                <TabsTrigger value="censo">Censo Excel</TabsTrigger>
              </TabsList>

              {/* === BAUTIZOS === */}
              <TabsContent value="bautizos" className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Certificados de Bautizo
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Genera un PDF con todos los certificados de bautizo de protocolo y MDG que tengan fecha registrada.
                  </p>
                  <Button className="mt-3" onClick={handleGenerateBautizos} disabled={generating}>
                    {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</> : <><Download className="w-4 h-4 mr-2" />Generar todos los certificados</>}
                  </Button>
                </div>
              </TabsContent>

              {/* === MATRIMONIOS === */}
              <TabsContent value="matrimonios" className="space-y-4">
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <h3 className="font-semibold text-pink-900 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Certificados de Matrimonio
                  </h3>
                  <p className="text-sm text-pink-700 mt-1">
                    Genera un PDF con todos los certificados de matrimonio. Seleccione la versión de plantilla.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Button onClick={() => handleGenerateMatrimonios("v1")} disabled={generating}>
                      {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</> : <><Download className="w-4 h-4 mr-2" />Completo (todos los datos)</>}
                    </Button>
                    <Button variant="outline" onClick={() => handleGenerateMatrimonios("v2")} disabled={generating}>
                      {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</> : <><Download className="w-4 h-4 mr-2" />Simple (nombres, ofició, fecha)</>}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* === DISCIPULADO === */}
              <TabsContent value="discipulado" className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Certificados de Discipulado
                  </h3>
                  <p className="text-sm text-purple-700 mt-1">
                    Genera certificados de los participantes aprobados en ciclos completados de cada módulo.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Button onClick={() => handleGenerateDiscipulado("primeros_pasos")} disabled={generating}>
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      Primeros Pasos
                    </Button>
                    <Button variant="outline" onClick={() => handleGenerateDiscipulado("seguimos_avanzando")} disabled={generating}>
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      Seguimos Avanzando
                    </Button>
                    <Button variant="outline" onClick={() => handleGenerateDiscipulado("siendo_iglesia")} disabled={generating}>
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      Siendo Iglesia
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* === CENSO EXCEL === */}
              <TabsContent value="censo" className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" /> Exportar Censo a Excel
                  </h3>
                  <p className="text-sm text-green-700 mt-1">
                    Exporta toda la tabla de censo como archivo Excel (.xlsx) con columnas ajustadas y headers legibles.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => openColumnFilter("protocolo")} disabled={exporting}>
                      {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Censo Protocolo</>}
                    </Button>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-100" onClick={() => openColumnFilter("mdg")} disabled={exporting}>
                      {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Censo MDG</>}
                    </Button>
                    <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100" onClick={() => openColumnFilter("combinado")} disabled={exporting}>
                      {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Combinado (Protocolo + MDG)</>}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Dialog: Filtro de Columnas */}
        <Dialog open={showColumnFilter} onOpenChange={setShowColumnFilter}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-green-600" />
                Seleccionar columnas para exportar
              </DialogTitle>
              <DialogDescription>
                Marque las columnas que desea incluir en el archivo Excel.
                {columnFilterTarget === "combinado" && " Incluirá una columna 'Fuente' indicando el origen."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm text-gray-500">{selectedColumns.size}/{availableColumns.length} columnas</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedColumns(new Set(availableColumns))}>Todas</Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedColumns(new Set())}>Ninguna</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[50vh] space-y-1 py-2">
              {availableColumns.map((col) => (
                <label key={col} className="flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                  <Checkbox
                    checked={selectedColumns.has(col)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedColumns)
                      if (checked) next.add(col)
                      else next.delete(col)
                      setSelectedColumns(next)
                    }}
                  />
                  <span className="text-sm font-medium">{getHeaderLabel(col)}</span>
                  <span className="text-xs text-gray-400 ml-auto">{col}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowColumnFilter(false)}>Cancelar</Button>
              <Button onClick={handleExportWithColumns} disabled={selectedColumns.size === 0 || exporting}>
                {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Exportar ({selectedColumns.size} columnas)</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

export default function ListadosPage() {
  return (
    <PermissionsGuard moduleName="listados">
      {(canEdit) => <ListadosContent canEdit={!!canEdit} />}
    </PermissionsGuard>
  )
}
