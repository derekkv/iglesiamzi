"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { generatePresentacionNinoPDF } from "@/lib/generate-presentacion-ninos-pdf"
import { PDFDocument } from "pdf-lib"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useMonth } from "@/contexts/month-context"
import { storage } from "@/lib/storage"
import { getAlfoliMes } from "@/lib/mod/alfoli-service"
import type { CicloTipo } from "@/lib/mod/discipulado-ciclos-service"


function ListadosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { currentMonth, monthHistory } = useMonth()
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Generic column filter dialog
  const [showColumnFilter, setShowColumnFilter] = useState(false)
  const [columnFilterTitle, setColumnFilterTitle] = useState("")
  const [availableColumns, setAvailableColumns] = useState<{ key: string; label: string }[]>([])
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [pendingExportFn, setPendingExportFn] = useState<(() => Promise<void>) | null>(null)

  // Censo specific
  const [columnFilterTarget, setColumnFilterTarget] = useState<"protocolo" | "mdg" | "combinado">("protocolo")

  // Ingresos/Egresos month selector
  const [selectedMonthId, setSelectedMonthId] = useState<string>("")

  // All months (active + history)
  const allMonths = [
    ...(currentMonth ? [currentMonth] : []),
    ...monthHistory,
  ]


  // ========== COLUMN FILTER HELPER ==========
  function openGenericColumnFilter(title: string, columns: { key: string; label: string }[], exportFn: () => Promise<void>) {
    setColumnFilterTitle(title)
    setAvailableColumns(columns)
    setSelectedColumns(new Set(columns.map(c => c.key)))
    setPendingExportFn(() => exportFn)
    setShowColumnFilter(true)
  }

  async function handleConfirmExport() {
    setShowColumnFilter(false)
    if (pendingExportFn) await pendingExportFn()
    setPendingExportFn(null)
  }

  function formatDateValue(val: string): string {
    if (!val) return ""
    // Detectar formato ISO con T (ej: 2026-07-01T00:00:00+00:00 o 2026-07-01T12:00:00)
    if (val.includes("T")) {
      const d = new Date(val)
      if (!isNaN(d.getTime())) {
        return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`
      }
    }
    // Detectar formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split("-")
      return `${d}/${m}/${y}`
    }
    return val
  }

  function filterDataBySelectedColumns(data: any[], allCols: { key: string; label: string }[]): { headers: string[]; rows: any[][] } {
    const selected = allCols.filter(c => selectedColumns.has(c.key))
    const headers = selected.map(c => c.label)
    const dateKeys = new Set(["fecha", "fecha_bautizo", "fecha_matrimonio", "fecha_nacimiento", "fecha_conversion", "created_at", "updated_at"])
    const rows = data.map(row => selected.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return ""
      if (val === true) return "Sí"
      if (val === false) return "No"
      if (dateKeys.has(c.key) && typeof val === "string") return formatDateValue(val)
      if (Array.isArray(val)) {
        return val.map((item: any) => {
          if (typeof item === "object" && item !== null) {
            if (item.nombre) return item.edad ? `${item.nombre} (${item.edad})` : item.nombre
            return Object.values(item).join(", ")
          }
          return String(item)
        }).join(", ")
      }
      if (typeof val === "object") return JSON.stringify(val)
      return val
    }))
    return { headers, rows }
  }


  // ========== BAUTIZOS ==========
  async function handleGenerateBautizos() {
    setGenerating(true)
    try {
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase.from("censo").select("id, cedula, apellidos_nombres, fecha_bautizo").eq("bautizo_irdd", true).order("fecha_bautizo", { ascending: false }),
        supabase.from("censo_mdg").select("id, cedula, apellidos_nombres, fecha_bautizo").eq("bautizo_irdd", true).order("fecha_bautizo", { ascending: false }),
      ])
      const all = [...(protocolo || []).filter((r: any) => r.fecha_bautizo), ...(mdg || []).filter((r: any) => r.fecha_bautizo)]
      if (all.length === 0) { toast.error("No hay bautizos con fecha registrada"); return }
      const mergedDoc = await PDFDocument.create()
      for (const record of all) {
        const pdfBytes = await generateBautizoPDF({ nombre: record.apellidos_nombres, cedula: record.cedula, fecha_bautizo: record.fecha_bautizo })
        const singleDoc = await PDFDocument.load(pdfBytes)
        const [page] = await mergedDoc.copyPages(singleDoc, [0])
        mergedDoc.addPage(page)
      }
      const mergedBytes = await mergedDoc.save()
      downloadBlob(mergedBytes, `Bautizos_${todayStr()}.pdf`)
      toast.success(`PDF generado con ${all.length} certificados de bautizo`)
    } catch (error) { console.error(error); toast.error("Error al generar PDFs de bautizo") }
    finally { setGenerating(false) }
  }

  function handleExportBautizosExcel() {
    const cols = [
      { key: "apellidos_nombres", label: "Nombres y Apellidos" },
      { key: "cedula", label: "Cédula" },
      { key: "fecha_bautizo", label: "Fecha de Bautizo" },
      { key: "fuente", label: "Fuente" },
    ]
    openGenericColumnFilter("Bautizos", cols, async () => {
      setExporting(true)
      try {
        const [{ data: protocolo }, { data: mdg }] = await Promise.all([
          supabase.from("censo").select("cedula, apellidos_nombres, fecha_bautizo").eq("bautizo_irdd", true).order("fecha_bautizo", { ascending: false }),
          supabase.from("censo_mdg").select("cedula, apellidos_nombres, fecha_bautizo").eq("bautizo_irdd", true).order("fecha_bautizo", { ascending: false }),
        ])
        const all = [
          ...(protocolo || []).filter((r: any) => r.fecha_bautizo).map((r: any) => ({ ...r, fuente: "Protocolo" })),
          ...(mdg || []).filter((r: any) => r.fecha_bautizo).map((r: any) => ({ ...r, fuente: "MDG" })),
        ]
        if (all.length === 0) { toast.error("No hay bautizos"); return }
        const { headers, rows } = filterDataBySelectedColumns(all, [
          { key: "apellidos_nombres", label: "Nombres y Apellidos" },
          { key: "cedula", label: "Cédula" },
          { key: "fecha_bautizo", label: "Fecha de Bautizo" },
          { key: "fuente", label: "Fuente" },
        ])
        const blob = buildExcel(headers, rows, "Bautizos")
        downloadExcel(blob, `Bautizos_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${all.length} registros`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }


  // ========== MATRIMONIOS ==========
  async function handleGenerateMatrimonios(version: "v1" | "v2") {
    setGenerating(true)
    try {
      const [{ data: protocolo }, { data: mdg }] = await Promise.all([
        supabase.from("censo").select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio").eq("matrimonio_irdd", true).order("fecha_matrimonio", { ascending: false }),
        supabase.from("censo_mdg").select("id, cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio").eq("matrimonio_irdd", true).order("fecha_matrimonio", { ascending: false }),
      ])
      const all = [...(protocolo || []).filter((r: any) => r.fecha_matrimonio && r.conyuge), ...(mdg || []).filter((r: any) => r.fecha_matrimonio && r.conyuge)]
      if (all.length === 0) { toast.error("No hay matrimonios con datos completos"); return }
      const mergedDoc = await PDFDocument.create()
      for (const record of all) {
        let pdfBytes: Uint8Array
        if (version === "v2") {
          pdfBytes = await generateMatrimonioPDFv2({ nombre: record.apellidos_nombres, conyuge: record.conyuge || "", oficio: record.oficio_matrimonio || "", fecha: record.fecha_matrimonio || "" })
        } else {
          pdfBytes = await generateMatrimonioPDF({ nombre: record.apellidos_nombres, cedula: record.cedula, conyuge: record.conyuge || "", cedula_conyugue: record.cedula_conyugue || "", fecha: record.fecha_matrimonio || "", hora: record.hora_matrimonio || "", oficio: record.oficio_matrimonio || "", padrino1: record.padrino1_matrimonio || "", padrino2: record.padrino2_matrimonio || "" })
        }
        const singleDoc = await PDFDocument.load(pdfBytes)
        const [page] = await mergedDoc.copyPages(singleDoc, [0])
        mergedDoc.addPage(page)
      }
      const mergedBytes = await mergedDoc.save()
      downloadBlob(mergedBytes, `Matrimonios_${version === "v2" ? "Simple" : "Completo"}_${todayStr()}.pdf`)
      toast.success(`PDF generado con ${all.length} certificados`)
    } catch (error) { console.error(error); toast.error("Error al generar PDFs") }
    finally { setGenerating(false) }
  }

  function handleExportMatrimoniosExcel() {
    const cols = [
      { key: "apellidos_nombres", label: "Esposo/a" },
      { key: "cedula", label: "Cédula" },
      { key: "conyuge", label: "Cónyuge" },
      { key: "cedula_conyugue", label: "Cédula Cónyuge" },
      { key: "fecha_matrimonio", label: "Fecha" },
      { key: "hora_matrimonio", label: "Hora" },
      { key: "oficio_matrimonio", label: "Ofició" },
      { key: "padrino1_matrimonio", label: "Padrino 1" },
      { key: "padrino2_matrimonio", label: "Padrino 2" },
      { key: "fuente", label: "Fuente" },
    ]
    openGenericColumnFilter("Matrimonios", cols, async () => {
      setExporting(true)
      try {
        const [{ data: protocolo }, { data: mdg }] = await Promise.all([
          supabase.from("censo").select("cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio").eq("matrimonio_irdd", true).order("fecha_matrimonio", { ascending: false }),
          supabase.from("censo_mdg").select("cedula, apellidos_nombres, conyuge, cedula_conyugue, fecha_matrimonio, hora_matrimonio, oficio_matrimonio, padrino1_matrimonio, padrino2_matrimonio").eq("matrimonio_irdd", true).order("fecha_matrimonio", { ascending: false }),
        ])
        const all = [
          ...(protocolo || []).filter((r: any) => r.fecha_matrimonio && r.conyuge).map((r: any) => ({ ...r, fuente: "Protocolo" })),
          ...(mdg || []).filter((r: any) => r.fecha_matrimonio && r.conyuge).map((r: any) => ({ ...r, fuente: "MDG" })),
        ]
        if (all.length === 0) { toast.error("No hay matrimonios"); return }
        const { headers, rows } = filterDataBySelectedColumns(all, cols)
        const blob = buildExcel(headers, rows, "Matrimonios")
        downloadExcel(blob, `Matrimonios_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${all.length} registros`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }


  // ========== PRESENTACIÓN DE NIÑOS ==========
  async function handleGeneratePresentacion() {
    setGenerating(true)
    try {
      const { data, error } = await supabase.from("presentacion_ninos").select("*").order("fecha", { ascending: false })
      if (error) throw error
      if (!data || data.length === 0) { toast.error("No hay presentaciones registradas"); setGenerating(false); return }
      const mergedDoc = await PDFDocument.create()
      for (const record of data) {
        const pdfBytes = await generatePresentacionNinoPDF({ nombre_presentado: record.nombre_presentado, nombre_padre: record.nombre_padre, nombre_madre: record.nombre_madre, fecha: record.fecha, nombre_pastor: record.nombre_pastor || "", testigo1: record.testigo1 || "", testigo2: record.testigo2 || "" })
        const singleDoc = await PDFDocument.load(pdfBytes)
        const [page] = await mergedDoc.copyPages(singleDoc, [0])
        mergedDoc.addPage(page)
      }
      const mergedBytes = await mergedDoc.save()
      downloadBlob(mergedBytes, `Presentacion_Ninos_${todayStr()}.pdf`)
      toast.success(`PDF generado con ${data.length} certificados`)
    } catch (error) { console.error(error); toast.error("Error al generar PDFs") }
    finally { setGenerating(false) }
  }

  function handleExportPresentacionExcel() {
    const cols = [
      { key: "nombre_presentado", label: "Nombre del Niño/a" },
      { key: "nombre_padre", label: "Nombre del Padre" },
      { key: "nombre_madre", label: "Nombre de la Madre" },
      { key: "fecha", label: "Fecha" },
      { key: "nombre_pastor", label: "Pastor" },
      { key: "testigo1", label: "Testigo 1" },
      { key: "testigo2", label: "Testigo 2" },
    ]
    openGenericColumnFilter("Presentación de Niños", cols, async () => {
      setExporting(true)
      try {
        const { data, error } = await supabase.from("presentacion_ninos").select("*").order("fecha", { ascending: false })
        if (error) throw error
        if (!data || data.length === 0) { toast.error("No hay presentaciones"); return }
        const { headers, rows } = filterDataBySelectedColumns(data, cols)
        const blob = buildExcel(headers, rows, "Presentación Niños")
        downloadExcel(blob, `Presentacion_Ninos_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${data.length} registros`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }


  // ========== DISCIPULADO ==========
  async function handleGenerateDiscipulado(tipo: CicloTipo) {
    setGenerating(true)
    try {
      const { data: ciclos } = await supabase.from("discipulado_ciclos").select("id").eq("tipo", tipo).eq("activo", false)
      if (!ciclos || ciclos.length === 0) { toast.error("No hay ciclos completados"); setGenerating(false); return }
      const { data: participantes } = await supabase.from("discipulado_ciclo_participantes").select("nombre, estatus").in("ciclo_id", ciclos.map((c: any) => c.id)).eq("estatus", "aprobado")
      if (!participantes || participantes.length === 0) { toast.error("No hay participantes aprobados"); setGenerating(false); return }
      const pdfBytes = await generateCertificadosPDF(participantes.map((p: any) => p.nombre), tipo)
      downloadBlob(pdfBytes, `Certificados_${tipo}_${todayStr()}.pdf`)
      toast.success(`PDF generado con ${participantes.length} certificados`)
    } catch (error) { console.error(error); toast.error("Error al generar certificados") }
    finally { setGenerating(false) }
  }

  function handleExportDiscipuladoExcel() {
    const cols = [
      { key: "nombre", label: "Nombre" },
      { key: "tipo", label: "Módulo" },
      { key: "fecha_inicio", label: "Fecha Inicio Ciclo" },
      { key: "estatus", label: "Estado Participante" },
    ]
    openGenericColumnFilter("Discipulado", cols, async () => {
      setExporting(true)
      try {
        const { data: ciclos } = await supabase.from("discipulado_ciclos").select("id, tipo, fecha_inicio, activo")
        if (!ciclos || ciclos.length === 0) { toast.error("No hay ciclos"); return }
        const { data: participantes } = await supabase.from("discipulado_ciclo_participantes").select("nombre, estatus, ciclo_id").in("ciclo_id", ciclos.map((c: any) => c.id))
        if (!participantes || participantes.length === 0) { toast.error("No hay participantes"); return }
        const cicloMap = Object.fromEntries(ciclos.map((c: any) => [c.id, c]))
        const data = participantes.map((p: any) => {
          const ciclo = cicloMap[p.ciclo_id]
          return { nombre: p.nombre, tipo: ciclo?.tipo || "", fecha_inicio: ciclo?.fecha_inicio || "", estatus: p.estatus === "aprobado" ? "Aprobado" : p.estatus === "reprobado" ? "Reprobado" : "En curso" }
        })
        const { headers, rows } = filterDataBySelectedColumns(data, cols)
        const blob = buildExcel(headers, rows, "Discipulado")
        downloadExcel(blob, `Discipulado_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${data.length} participantes`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }


  // ========== INGRESOS Y EGRESOS ==========
  function handleExportIngresosEgresosExcel() {
    const cols = [
      { key: "fecha", label: "Fecha" },
      { key: "tipo", label: "Tipo" },
      { key: "ministerio", label: "Ministerio" },
      { key: "categoria_principal", label: "Categoría" },
      { key: "detalle", label: "Detalle" },
      { key: "monto", label: "Monto" },
      { key: "metodo_pago", label: "Método de Pago" },
      { key: "estado", label: "Estado" },
      { key: "observacion", label: "Centro de Gasto" },
    ]
    openGenericColumnFilter("Ingresos y Egresos", cols, async () => {
      setExporting(true)
      try {
        const monthId = selectedMonthId || currentMonth?.id
        if (!monthId) { toast.error("Seleccione un mes"); return }
        const selectedM = allMonths.find(m => m.id === monthId)
        const monthName = selectedM?.name || "Mes"
        const monthNum = selectedM?.month || 0
        const yearNum = selectedM?.year || 0

        const ingresos = await storage.getIngresosByMonth(monthId)
        const egresos = await storage.getEgresosByMonth(monthId)

        // Totales consolidados
        const alfoliRecords = await getAlfoliMes(monthNum, yearNum)
        const totalAlfoli = alfoliRecords.reduce((sum, r) => sum + Number(r.valor), 0)
        const { data: celulasData } = await supabase.from("ofrendas_celulas").select("valor").eq("mes", monthNum).eq("anio", yearNum).eq("recibido", true)
        const totalCelulas = (celulasData || []).reduce((sum: number, r: any) => sum + Number(r.valor), 0)
        const { data: diezmosData } = await supabase.from("diezmos").select("valor, tipo_ofrenda").eq("mes_id", monthId).eq("transaccion", "transferencia")
        const totalDiezmos = (diezmosData || []).filter((r: any) => !r.tipo_ofrenda || r.tipo_ofrenda === "diezmo").reduce((sum: number, r: any) => sum + Number(r.valor), 0)
        const totalPrimicias = (diezmosData || []).filter((r: any) => r.tipo_ofrenda === "primicia").reduce((sum: number, r: any) => sum + Number(r.valor), 0)
        const totalEspecial = (diezmosData || []).filter((r: any) => r.tipo_ofrenda === "diezmo_especial").reduce((sum: number, r: any) => sum + Number(r.valor), 0)
        const totalIngresosModulo = (ingresos || []).reduce((sum: number, r: any) => sum + Number(r.monto), 0)
        const totalEgresosModulo = (egresos || []).reduce((sum: number, r: any) => sum + Number(r.monto), 0)
        const totalIngresos = totalIngresosModulo + totalCelulas + totalAlfoli

        // Combinar ingresos y egresos en una sola lista
        const combined = [
          ...(ingresos || []).map((r: any) => ({ ...r, tipo: "Ingreso" })),
          ...(egresos || []).map((r: any) => ({ ...r, tipo: "Egreso" })),
        ].sort((a: any, b: any) => (a.fecha || "").localeCompare(b.fecha || ""))

        const XLSX = require("xlsx")
        const wb = XLSX.utils.book_new()

        // Hoja 1: Resumen
        const resumenData = [
          ["RESUMEN"], [],
          ["Mes", monthName], [],
          ["Concepto", "Monto ($)"],
          ["Ingreso Células", totalCelulas],
          ["Ingreso Alfolí", totalAlfoli],
          ["Diezmos (Transferencia)", totalDiezmos],
          ["Primicias (Transferencia)", totalPrimicias],
          ["Ofrenda Especial (Transferencia)", totalEspecial],
          ["Ingreso Módulo", totalIngresosModulo],
          [], ["TOTAL INGRESOS", totalIngresos],
          ["TOTAL EGRESOS", totalEgresosModulo],
        ]
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData)
        wsResumen["!cols"] = [{ wch: 35 }, { wch: 18 }]
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen")

        // Hoja 2: Ingresos y Egresos combinados (con filtro de columnas)
        if (combined.length > 0) {
          const { headers, rows } = filterDataBySelectedColumns(combined, cols)
          if (headers.length > 0) {
            const wsData = XLSX.utils.aoa_to_sheet([headers, ...rows])
            wsData["!cols"] = headers.map((h: string) => ({ wch: Math.min(Math.max(h.length + 4, 14), 40) }))
            wsData["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1` }
            XLSX.utils.book_append_sheet(wb, wsData, "Ingresos y Egresos")
          }
        }

        const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" })
        const blob = new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        downloadExcel(blob, `Ingresos_Egresos_${monthName.replace(/\s/g, "_")}_${todayStr()}.xlsx`)
        toast.success(`Excel generado para ${monthName}`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }


  // ========== CENSO EXCEL ==========
  async function openCensoColumnFilter(target: "protocolo" | "mdg" | "combinado") {
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
        const cols = Object.keys(sampleData[0]).map(k => ({ key: k, label: getHeaderLabel(k) }))
        setAvailableColumns(cols)
        setSelectedColumns(new Set(cols.map(c => c.key)))
      }
    } catch (error) { console.error(error) }
    setColumnFilterTitle(`Censo ${target === "protocolo" ? "Protocolo" : target === "mdg" ? "MDG" : "Combinado"}`)
    setPendingExportFn(() => async () => {
      if (target === "protocolo") await doExportCenso()
      else if (target === "mdg") await doExportCensoMdg()
      else await doExportCensoCombinado()
    })
    setShowColumnFilter(true)
  }

  async function doExportCenso() {
    setExporting(true)
    try {
      const { data, error } = await supabase.from("censo").select("*").order("apellidos_nombres", { ascending: true })
      if (error) throw error
      if (!data || data.length === 0) { toast.error("No hay datos"); return }
      const cols = availableColumns.filter(c => selectedColumns.has(c.key))
      const { headers, rows } = filterDataBySelectedColumns(data, cols)
      const blob = buildExcel(headers, rows, "Censo Protocolo")
      downloadExcel(blob, `Censo_Protocolo_${todayStr()}.xlsx`)
      toast.success(`Exportado: ${data.length} registros`)
    } catch (error) { console.error(error); toast.error("Error al exportar") }
    finally { setExporting(false) }
  }

  async function doExportCensoMdg() {
    setExporting(true)
    try {
      const { data, error } = await supabase.from("censo_mdg").select("*").order("apellidos_nombres", { ascending: true })
      if (error) throw error
      if (!data || data.length === 0) { toast.error("No hay datos"); return }
      const cols = availableColumns.filter(c => selectedColumns.has(c.key))
      const { headers, rows } = filterDataBySelectedColumns(data, cols)
      const blob = buildExcel(headers, rows, "Censo MDG")
      downloadExcel(blob, `Censo_MDG_${todayStr()}.xlsx`)
      toast.success(`Exportado: ${data.length} registros`)
    } catch (error) { console.error(error); toast.error("Error al exportar") }
    finally { setExporting(false) }
  }

  async function doExportCensoCombinado() {
    setExporting(true)
    try {
      const [{ data: protocolo, error: e1 }, { data: mdg, error: e2 }] = await Promise.all([
        supabase.from("censo").select("*").order("apellidos_nombres", { ascending: true }),
        supabase.from("censo_mdg").select("*").order("apellidos_nombres", { ascending: true }),
      ])
      if (e1) throw e1; if (e2) throw e2
      const combined = [...(protocolo || []).map((r: any) => ({ ...r, fuente: "Protocolo" })), ...(mdg || []).map((r: any) => ({ ...r, fuente: "MDG" }))]
      if (combined.length === 0) { toast.error("No hay datos"); return }
      const cols = availableColumns.filter(c => selectedColumns.has(c.key))
      const { headers, rows } = filterDataBySelectedColumns(combined, cols)
      const blob = buildExcel(headers, rows, "Censo Combinado")
      downloadExcel(blob, `Censo_Combinado_${todayStr()}.xlsx`)
      toast.success(`Exportado: ${combined.length} registros`)
    } catch (error) { console.error(error); toast.error("Error al exportar") }
    finally { setExporting(false) }
  }


  // ========== UTILS ==========
  function todayStr() { return new Date().toISOString().split("T")[0] }

  const HEADER_LABELS: Record<string, string> = {
    id: "ID", cedula: "Cédula", apellidos_nombres: "Nombres y Apellidos",
    fecha_nacimiento: "Fecha Nacimiento", edad: "Edad", sexo: "Sexo",
    estado_civil: "Estado Civil", direccion: "Dirección", celular: "Celular",
    convencional: "Teléfono Fijo", correo: "Correo", conyuge: "Cónyuge",
    cedula_conyugue: "Cédula Cónyuge", hijos: "Hijos",
    celula_asiste: "Asiste a Célula", celula_nombre: "Nombre Célula",
    bautizo_irdd: "Bautizado IRDD", fecha_bautizo: "Fecha Bautizo",
    matrimonio_irdd: "Matrimonio IRDD", fecha_matrimonio: "Fecha Matrimonio",
    hora_matrimonio: "Hora Matrimonio", oficio_matrimonio: "Ofició ceremonia",
    padrino1_matrimonio: "Padrino 1", padrino2_matrimonio: "Padrino 2",
    created_at: "Fecha Registro", updated_at: "Última Actualización",
    is_active: "Activo", ministerio: "Ministerio", cargo: "Cargo",
    profesion: "Profesión", tipo_sangre: "Tipo Sangre", alergias: "Alergias",
    discapacidad: "Discapacidad", observaciones: "Observaciones",
    nuevo_creyente: "Nuevo Creyente", fecha_conversion: "Fecha Conversión",
    quien_lo_trajo: "Quién lo trajo", fuente: "Fuente",
  }

  function getHeaderLabel(key: string): string {
    return HEADER_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function buildExcel(headers: string[], rows: any[][], sheetName: string): Blob {
    const XLSX = require("xlsx")
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws["!cols"] = headers.map((h) => ({ wch: Math.min(Math.max(String(h).length + 4, 14), 45) }))
    if (headers.length > 0) {
      ws["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1` }
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    return new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  }

  function downloadExcel(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url; link.download = filename
    document.body.appendChild(link); link.click()
    document.body.removeChild(link); URL.revokeObjectURL(url)
  }

  function downloadBlob(bytes: Uint8Array, filename: string) {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url; link.download = filename
    document.body.appendChild(link); link.click()
    document.body.removeChild(link); URL.revokeObjectURL(url)
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
            <CardDescription>Genere certificados PDF masivos y exporte datos a Excel con filtros</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="bautizos" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="bautizos">Bautizos</TabsTrigger>
                <TabsTrigger value="matrimonios">Matrimonios</TabsTrigger>
                <TabsTrigger value="presentacion">Presentación</TabsTrigger>
                <TabsTrigger value="discipulado">Discipulado</TabsTrigger>
                <TabsTrigger value="censo">Censo Excel</TabsTrigger>
                <TabsTrigger value="finanzas">Ingresos y Egresos</TabsTrigger>
              </TabsList>


              {/* BAUTIZOS */}
              <TabsContent value="bautizos" className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 flex items-center gap-2"><FileText className="w-5 h-5" /> Certificados de Bautizo</h3>
                  <p className="text-sm text-blue-700 mt-1">Genera PDFs y Excel de todos los bautizos registrados (protocolo + MDG).</p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleGenerateBautizos} disabled={generating}>
                      {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</> : <><Download className="w-4 h-4 mr-2" />Generar PDF</>}
                    </Button>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={handleExportBautizosExcel} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* MATRIMONIOS */}
              <TabsContent value="matrimonios" className="space-y-4">
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <h3 className="font-semibold text-pink-900 flex items-center gap-2"><FileText className="w-5 h-5" /> Certificados de Matrimonio</h3>
                  <p className="text-sm text-pink-700 mt-1">Genera PDFs con certificados y exporta datos a Excel.</p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Button onClick={() => handleGenerateMatrimonios("v1")} disabled={generating}>
                      {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />...</> : <><Download className="w-4 h-4 mr-2" />PDF Completo</>}
                    </Button>
                    <Button variant="outline" onClick={() => handleGenerateMatrimonios("v2")} disabled={generating}>
                      <Download className="w-4 h-4 mr-2" />PDF Simple
                    </Button>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={handleExportMatrimoniosExcel} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* PRESENTACIÓN */}
              <TabsContent value="presentacion" className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-900 flex items-center gap-2"><FileText className="w-5 h-5" /> Certificados de Dedicación de Niños</h3>
                  <p className="text-sm text-amber-700 mt-1">Genera PDFs y exporta a Excel las presentaciones registradas.</p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleGeneratePresentacion} disabled={generating}>
                      {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />...</> : <><Download className="w-4 h-4 mr-2" />Generar PDF</>}
                    </Button>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={handleExportPresentacionExcel} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
                    </Button>
                  </div>
                </div>
              </TabsContent>


              {/* DISCIPULADO */}
              <TabsContent value="discipulado" className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 flex items-center gap-2"><FileText className="w-5 h-5" /> Certificados de Discipulado</h3>
                  <p className="text-sm text-purple-700 mt-1">Genera certificados de participantes aprobados en ciclos completados.</p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Button onClick={() => handleGenerateDiscipulado("primeros_pasos")} disabled={generating}>
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Primeros Pasos
                    </Button>
                    <Button variant="outline" onClick={() => handleGenerateDiscipulado("seguimos_avanzando")} disabled={generating}>
                      <Download className="w-4 h-4 mr-2" />Seguimos Avanzando
                    </Button>
                    <Button variant="outline" onClick={() => handleGenerateDiscipulado("siendo_iglesia")} disabled={generating}>
                      <Download className="w-4 h-4 mr-2" />Siendo Iglesia
                    </Button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={handleExportDiscipuladoExcel} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar todos a Excel
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* CENSO */}
              <TabsContent value="censo" className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Exportar Censo a Excel</h3>
                  <p className="text-sm text-green-700 mt-1">Exporta la tabla de censo como Excel (.xlsx) con filtros de columnas.</p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => openCensoColumnFilter("protocolo")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Censo Protocolo
                    </Button>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-100" onClick={() => openCensoColumnFilter("mdg")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Censo MDG
                    </Button>
                    <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100" onClick={() => openCensoColumnFilter("combinado")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Combinado
                    </Button>
                  </div>
                </div>
              </TabsContent>


              {/* INGRESOS Y EGRESOS */}
              <TabsContent value="finanzas" className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                  <h3 className="font-semibold text-emerald-900 flex items-center gap-2 text-lg">
                    <FileSpreadsheet className="w-5 h-5" /> Exportar Ingresos y Egresos
                  </h3>
                  <p className="text-sm text-emerald-700 mt-1">
                    Excel con hoja de resumen financiero + hoja de ingresos y egresos combinados con filtros.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Seleccionar mes</Label>
                      <Select value={selectedMonthId || currentMonth?.id || ""} onValueChange={setSelectedMonthId}>
                        <SelectTrigger className="w-full max-w-xs mt-1">
                          <SelectValue placeholder="Seleccione un mes" />
                        </SelectTrigger>
                        <SelectContent>
                          {allMonths.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} {m.status === "active" ? "(Activo)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleExportIngresosEgresosExcel} disabled={exporting || allMonths.length === 0}>
                      {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Descargar Excel</>}
                    </Button>

                    {allMonths.length === 0 && (
                      <p className="text-sm text-yellow-700 mt-2">No hay meses disponibles. Vaya a Control Mensual para crear uno.</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>


        {/* Dialog genérico: Filtro de Columnas */}
        <Dialog open={showColumnFilter} onOpenChange={setShowColumnFilter}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-green-600" />
                Columnas a exportar — {columnFilterTitle}
              </DialogTitle>
              <DialogDescription>
                Seleccione qué columnas incluir en el archivo Excel.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm text-gray-500">{selectedColumns.size}/{availableColumns.length} seleccionadas</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedColumns(new Set(availableColumns.map(c => c.key)))}>Todas</Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedColumns(new Set())}>Ninguna</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[50vh] space-y-1 py-2">
              {availableColumns.map((col) => (
                <label key={col.key} className="flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                  <Checkbox
                    checked={selectedColumns.has(col.key)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedColumns)
                      if (checked) next.add(col.key)
                      else next.delete(col.key)
                      setSelectedColumns(next)
                    }}
                  />
                  <span className="text-sm font-medium">{col.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{col.key}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowColumnFilter(false)}>Cancelar</Button>
              <Button onClick={handleConfirmExport} disabled={selectedColumns.size === 0 || exporting}>
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
