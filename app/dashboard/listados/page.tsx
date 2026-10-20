"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { ExportEventosDialog } from "@/app/dashboard/eventos/ExportEventosDialog"
import { eventosTabsService, type EventoTab } from "@/lib/mod/eventos-service"

// ─── Secciones disponibles ────────────────────────────────────────────────────

const SECTIONS = [
  { value: "bautizos",          label: "🙏 Bautizos",                    color: "blue" },
  { value: "matrimonios",       label: "💍 Matrimonios",                 color: "pink" },
  { value: "presentacion",      label: "👶 Presentación de Niños",       color: "amber" },
  { value: "discipulado",       label: "📖 Discipulado",                 color: "purple" },
  { value: "proyecto_mario",    label: "✂️ Proyecto Mario",              color: "orange" },
  { value: "censo",             label: "📋 Censo",                       color: "green" },
  { value: "eventos",           label: "🎯 Eventos / Encuentros",        color: "indigo" },
  { value: "incidencias_herederos", label: "🛡️ Incidencias Herederos",  color: "rose" },
  { value: "redil_casos",       label: "🤝 REDIL — Casos de Ayuda",     color: "teal" },
  { value: "redil_existencia",  label: "📦 REDIL — Existencia / Inventario", color: "cyan" },
  { value: "finanzas",          label: "💰 Ingresos y Egresos",          color: "emerald" },
]

// ─── Colores por sección ──────────────────────────────────────────────────────

const SECTION_COLORS: Record<string, { bg: string; border: string; title: string; text: string; btn: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    title: "text-blue-900",    text: "text-blue-700",    btn: "bg-blue-600 hover:bg-blue-700" },
  pink:    { bg: "bg-pink-50",    border: "border-pink-200",    title: "text-pink-900",    text: "text-pink-700",    btn: "bg-pink-600 hover:bg-pink-700" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   title: "text-amber-900",   text: "text-amber-700",   btn: "bg-amber-600 hover:bg-amber-700" },
  purple:  { bg: "bg-purple-50",  border: "border-purple-200",  title: "text-purple-900",  text: "text-purple-700",  btn: "bg-purple-600 hover:bg-purple-700" },
  orange:  { bg: "bg-orange-50",  border: "border-orange-200",  title: "text-orange-900",  text: "text-orange-700",  btn: "bg-orange-600 hover:bg-orange-700" },
  green:   { bg: "bg-green-50",   border: "border-green-200",   title: "text-green-900",   text: "text-green-700",   btn: "bg-green-600 hover:bg-green-700" },
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  title: "text-indigo-900",  text: "text-indigo-700",  btn: "bg-indigo-600 hover:bg-indigo-700" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    title: "text-rose-900",    text: "text-rose-700",    btn: "bg-rose-600 hover:bg-rose-700" },
  teal:    { bg: "bg-teal-50",    border: "border-teal-200",    title: "text-teal-900",    text: "text-teal-700",    btn: "bg-teal-600 hover:bg-teal-700" },
  cyan:    { bg: "bg-cyan-50",    border: "border-cyan-200",    title: "text-cyan-900",    text: "text-cyan-700",    btn: "bg-cyan-600 hover:bg-cyan-700" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", title: "text-emerald-900", text: "text-emerald-700", btn: "bg-emerald-600 hover:bg-emerald-700" },
}

// ─── Componente principal ─────────────────────────────────────────────────────

function ListadosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { currentMonth, monthHistory } = useMonth()
  const [activeSection, setActiveSection] = useState<string>("bautizos")
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Dialog genérico de columnas
  const [showColumnFilter, setShowColumnFilter] = useState(false)
  const [columnFilterTitle, setColumnFilterTitle] = useState("")
  const [availableColumns, setAvailableColumns] = useState<{ key: string; label: string }[]>([])
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [pendingExportFn, setPendingExportFn] = useState<(() => Promise<void>) | null>(null)
  const [columnFilterTarget, setColumnFilterTarget] = useState<"protocolo" | "mdg" | "combinado">("protocolo")

  // Ingresos/Egresos
  const [selectedMonthId, setSelectedMonthId] = useState<string>("")

  // Eventos dialog
  const [showEventosExport, setShowEventosExport] = useState(false)
  const [allEventosTabs, setAllEventosTabs] = useState<EventoTab[]>([])
  const [loadingEventos, setLoadingEventos] = useState(false)

  const allMonths = [
    ...(currentMonth ? [currentMonth] : []),
    ...monthHistory,
  ]

  // ── Helpers de columnas ──

  function openGenericColumnFilter(
    title: string,
    columns: { key: string; label: string }[],
    exportFn: () => Promise<void>,
  ) {
    setColumnFilterTitle(title)
    setAvailableColumns(columns)
    setSelectedColumns(new Set(columns.map((c) => c.key)))
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
    if (val.includes("T")) {
      const d = new Date(val)
      if (!isNaN(d.getTime()))
        return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split("-")
      return `${d}/${m}/${y}`
    }
    return val
  }

  function filterDataBySelectedColumns(
    data: any[],
    allCols: { key: string; label: string }[],
  ): { headers: string[]; rows: any[][] } {
    const selected = allCols.filter((c) => selectedColumns.has(c.key))
    const headers = selected.map((c) => c.label)
    const dateKeys = new Set([
      "fecha", "fecha_bautizo", "fecha_matrimonio", "fecha_nacimiento",
      "fecha_conversion", "created_at", "updated_at", "fecha_inicio", "fecha_fin",
    ])
    const rows = data.map((row) =>
      selected.map((c) => {
        const val = row[c.key]
        if (val === null || val === undefined) return ""
        if (val === true) return "Sí"
        if (val === false) return "No"
        if (dateKeys.has(c.key) && typeof val === "string") return formatDateValue(val)
        if (Array.isArray(val)) {
          return val
            .map((item: any) => {
              if (typeof item === "object" && item !== null) {
                if (item.nombre) return item.edad ? `${item.nombre} (${item.edad})` : item.nombre
                return Object.values(item).join(", ")
              }
              return String(item)
            })
            .join(", ")
        }
        if (typeof val === "object") return JSON.stringify(val)
        return val
      }),
    )
    return { headers, rows }
  }

  // ── Utils ──

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

  // ── BAUTIZOS ──

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
        const { headers, rows } = filterDataBySelectedColumns(all, cols)
        downloadExcel(buildExcel(headers, rows, "Bautizos"), `Bautizos_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${all.length} registros`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }

  // ── MATRIMONIOS ──

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
        downloadExcel(buildExcel(headers, rows, "Matrimonios"), `Matrimonios_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${all.length} registros`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }

  // ── PRESENTACIÓN ──

  async function handleGeneratePresentacion() {
    setGenerating(true)
    try {
      const { data, error } = await supabase.from("presentacion_ninos").select("*").order("fecha", { ascending: false })
      if (error) throw error
      if (!data || data.length === 0) { toast.error("No hay presentaciones registradas"); return }
      const mergedDoc = await PDFDocument.create()
      for (const record of data) {
        const pdfBytes = await generatePresentacionNinoPDF({ nombre_presentado: record.nombre_presentado, nombre_padre: record.nombre_padre, nombre_madre: record.nombre_madre, fecha: record.fecha, nombre_pastor: record.nombre_pastor || "", testigo1: record.testigo1 || "", testigo2: record.testigo2 || "" })
        const singleDoc = await PDFDocument.load(pdfBytes)
        const [page] = await mergedDoc.copyPages(singleDoc, [0])
        mergedDoc.addPage(page)
      }
      downloadBlob(await mergedDoc.save(), `Presentacion_Ninos_${todayStr()}.pdf`)
      toast.success(`PDF generado con ${data.length} certificados`)
    } catch (error) { console.error(error); toast.error("Error al generar PDFs") }
    finally { setGenerating(false) }
  }

  function handleExportPresentacionExcel() {
    const cols = [
      { key: "nombre_presentado", label: "Nombre del Niño/a" },
      { key: "nombre_padre",      label: "Nombre del Padre" },
      { key: "nombre_madre",      label: "Nombre de la Madre" },
      { key: "fecha",             label: "Fecha" },
      { key: "nombre_pastor",     label: "Pastor" },
      { key: "testigo1",          label: "Testigo 1" },
      { key: "testigo2",          label: "Testigo 2" },
    ]
    openGenericColumnFilter("Presentación de Niños", cols, async () => {
      setExporting(true)
      try {
        const { data, error } = await supabase.from("presentacion_ninos").select("*").order("fecha", { ascending: false })
        if (error) throw error
        if (!data || data.length === 0) { toast.error("No hay presentaciones"); return }
        const { headers, rows } = filterDataBySelectedColumns(data, cols)
        downloadExcel(buildExcel(headers, rows, "Presentación Niños"), `Presentacion_Ninos_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${data.length} registros`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }

  // ── DISCIPULADO ──

  async function handleGenerateDiscipulado(tipo: CicloTipo) {
    setGenerating(true)
    try {
      const { data: ciclos } = await supabase.from("discipulado_ciclos").select("id").eq("tipo", tipo).eq("activo", false)
      if (!ciclos || ciclos.length === 0) { toast.error("No hay ciclos completados"); return }
      const { data: participantes } = await supabase.from("discipulado_ciclo_participantes").select("nombre, estatus").in("ciclo_id", ciclos.map((c: any) => c.id)).eq("estatus", "aprobado")
      if (!participantes || participantes.length === 0) { toast.error("No hay participantes aprobados"); return }
      const pdfBytes = await generateCertificadosPDF(participantes.map((p: any) => p.nombre), tipo)
      downloadBlob(pdfBytes, `Certificados_${tipo}_${todayStr()}.pdf`)
      toast.success(`PDF generado con ${participantes.length} certificados`)
    } catch (error) { console.error(error); toast.error("Error al generar certificados") }
    finally { setGenerating(false) }
  }

  function handleExportDiscipuladoExcel() {
    const cols = [
      { key: "nombre",       label: "Nombre" },
      { key: "tipo",         label: "Módulo" },
      { key: "fecha_inicio", label: "Fecha Inicio Ciclo" },
      { key: "ciclo_activo", label: "¿Ciclo activo?" },
      { key: "estatus",      label: "Estado Participante" },
    ]
    openGenericColumnFilter("Discipulado — Todos los participantes", cols, async () => {
      setExporting(true)
      try {
        const { data: ciclos } = await supabase.from("discipulado_ciclos").select("id, tipo, fecha_inicio, activo")
        if (!ciclos || ciclos.length === 0) { toast.error("No hay ciclos"); return }
        const { data: participantes } = await supabase.from("discipulado_ciclo_participantes").select("nombre, estatus, ciclo_id").in("ciclo_id", ciclos.map((c: any) => c.id))
        if (!participantes || participantes.length === 0) { toast.error("No hay participantes"); return }
        const cicloMap = Object.fromEntries(ciclos.map((c: any) => [c.id, c]))
        const data = participantes.map((p: any) => {
          const ciclo = cicloMap[p.ciclo_id]
          const moduloLabel: Record<string, string> = {
            primeros_pasos: "Primeros Pasos",
            seguimos_avanzando: "Seguimos Avanzando",
            siendo_iglesia: "Siendo Iglesia",
          }
          return {
            nombre: p.nombre,
            tipo: moduloLabel[ciclo?.tipo] || ciclo?.tipo || "",
            fecha_inicio: ciclo?.fecha_inicio || "",
            ciclo_activo: ciclo?.activo ? "Sí" : "No",
            estatus: p.estatus === "aprobado" ? "Aprobado" : p.estatus === "reprobado" ? "Reprobado" : "En curso",
          }
        })
        const { headers, rows } = filterDataBySelectedColumns(data, cols)
        downloadExcel(buildExcel(headers, rows, "Discipulado"), `Discipulado_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${data.length} participantes`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }

  // ── PROYECTO MARIO ──

  function handleExportProyectoMarioExcel(tipo: string) {
    const cols = [
      { key: "nombre",       label: "Nombre" },
      { key: "tipo_ciclo",   label: "Tipo de Ciclo" },
      { key: "fecha_inicio", label: "Fecha Inicio" },
      { key: "ciclo_activo", label: "¿Ciclo activo?" },
      { key: "estatus",      label: "Estado" },
    ]
    const titulo = tipo === "todos"
      ? "Proyecto Mario — Todos"
      : tipo === "gastronomia"
        ? "Proyecto Mario — Gastronomía"
        : tipo === "manualidades"
          ? "Proyecto Mario — Manualidades"
          : `Proyecto Mario — ${tipo}`

    openGenericColumnFilter(titulo, cols, async () => {
      setExporting(true)
      try {
        let ciclosQuery = supabase.from("proyecto_mario_ciclos").select("id, tipo, fecha_inicio, activo")
        if (tipo !== "todos") ciclosQuery = ciclosQuery.eq("tipo", tipo)
        const { data: ciclos, error: e1 } = await ciclosQuery
        if (e1) throw e1
        if (!ciclos || ciclos.length === 0) { toast.error("No hay ciclos de Proyecto Mario"); return }

        const { data: participantes, error: e2 } = await supabase
          .from("proyecto_mario_ciclo_participantes")
          .select("nombre, estatus, ciclo_id")
          .in("ciclo_id", ciclos.map((c: any) => c.id))
        if (e2) throw e2
        if (!participantes || participantes.length === 0) { toast.error("No hay participantes"); return }

        const cicloMap = Object.fromEntries(ciclos.map((c: any) => [c.id, c]))
        const tipoLabel: Record<string, string> = {
          gastronomia: "Gastronomía",
          manualidades: "Manualidades",
          belleza_integral_sabados: "Belleza Integral (Sábados)",
          belleza_integral_viernes: "Belleza Integral (Viernes)",
          belleza_cejas: "Belleza — Cejas",
        }
        const data = participantes.map((p: any) => {
          const ciclo = cicloMap[p.ciclo_id]
          return {
            nombre: p.nombre,
            tipo_ciclo: tipoLabel[ciclo?.tipo] || ciclo?.tipo || "",
            fecha_inicio: ciclo?.fecha_inicio || "",
            ciclo_activo: ciclo?.activo ? "Sí" : "No",
            estatus: p.estatus === "aprobado" ? "Aprobado" : p.estatus === "reprobado" ? "Reprobado" : "En curso",
          }
        })
        const { headers, rows } = filterDataBySelectedColumns(data, cols)
        const sheetName = tipo === "todos" ? "Proyecto Mario" : tipoLabel[tipo] || tipo
        downloadExcel(buildExcel(headers, rows, sheetName.slice(0, 31)), `ProyectoMario_${tipo}_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${data.length} participantes`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }

  // ── CENSO ──

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
        for (const row of [...(p || []), ...(m || [])]) Object.keys(row).forEach((k) => allKeys.add(k))
        allKeys.add("fuente")
        sampleData = [Object.fromEntries([...allKeys].map((k) => [k, ""]))]
      }
      if (sampleData.length > 0) {
        const cols = Object.keys(sampleData[0]).map((k) => ({ key: k, label: getHeaderLabel(k) }))
        setAvailableColumns(cols)
        setSelectedColumns(new Set(cols.map((c) => c.key)))
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
      const cols = availableColumns.filter((c) => selectedColumns.has(c.key))
      const { headers, rows } = filterDataBySelectedColumns(data, cols)
      downloadExcel(buildExcel(headers, rows, "Censo Protocolo"), `Censo_Protocolo_${todayStr()}.xlsx`)
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
      const cols = availableColumns.filter((c) => selectedColumns.has(c.key))
      const { headers, rows } = filterDataBySelectedColumns(data, cols)
      downloadExcel(buildExcel(headers, rows, "Censo MDG"), `Censo_MDG_${todayStr()}.xlsx`)
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
      const combined = [
        ...(protocolo || []).map((r: any) => ({ ...r, fuente: "Protocolo" })),
        ...(mdg || []).map((r: any) => ({ ...r, fuente: "MDG" })),
      ]
      if (combined.length === 0) { toast.error("No hay datos"); return }
      const cols = availableColumns.filter((c) => selectedColumns.has(c.key))
      const { headers, rows } = filterDataBySelectedColumns(combined, cols)
      downloadExcel(buildExcel(headers, rows, "Censo Combinado"), `Censo_Combinado_${todayStr()}.xlsx`)
      toast.success(`Exportado: ${combined.length} registros`)
    } catch (error) { console.error(error); toast.error("Error al exportar") }
    finally { setExporting(false) }
  }

  // ── EVENTOS ──

  async function handleOpenEventosExport() {
    setLoadingEventos(true)
    try {
      const tabs = await eventosTabsService.getAll()
      setAllEventosTabs(tabs)
      setShowEventosExport(true)
    } catch (error) {
      console.error(error)
      toast.error("Error al cargar eventos")
    } finally {
      setLoadingEventos(false)
    }
  }

  // ── INCIDENCIAS HEREDEROS ──

  function handleExportIncidenciasExcel() {
    const cols = [
      { key: "fecha",               label: "Fecha" },
      { key: "hora",                label: "Hora" },
      { key: "nombre_nino",         label: "Nombre del Niño/a" },
      { key: "detalle_incidencia",  label: "Detalle de Incidencia" },
      { key: "maestro_presente",    label: "Maestro Presente" },
      { key: "created_at",          label: "Fecha Registro" },
    ]
    openGenericColumnFilter("Incidencias Herederos", cols, async () => {
      setExporting(true)
      try {
        const { data, error } = await supabase
          .from("reporte_incidencias_herederos")
          .select("*")
          .order("fecha", { ascending: false })
        if (error) throw error
        if (!data || data.length === 0) { toast.error("No hay incidencias registradas"); return }
        const { headers, rows } = filterDataBySelectedColumns(data, cols)
        downloadExcel(buildExcel(headers, rows, "Incidencias Herederos"), `Incidencias_Herederos_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${data.length} registros`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }

  // ── REDIL — CASOS ──

  function handleExportRedilCasosExcel() {
    const cols = [
      { key: "estado",          label: "Estado del Caso" },
      { key: "created_at",      label: "Fecha Apertura" },
      { key: "nombre_completo", label: "Nombre Solicitante" },
      { key: "cedula",          label: "Cédula" },
      { key: "telefono",        label: "Teléfono" },
      { key: "direccion",       label: "Dirección" },
      { key: "tipo_ayuda",      label: "Tipo de Ayuda" },
      { key: "motivo",          label: "Motivo" },
      { key: "referencia",      label: "Referencia" },
      { key: "num_hijos",       label: "N° Hijos" },
      { key: "situacion_laboral", label: "Situación Laboral" },
    ]
    openGenericColumnFilter("REDIL — Casos de Ayuda Social", cols, async () => {
      setExporting(true)
      try {
        // Join casos_redil con solicitudes_redil para obtener los datos del solicitante
        const { data: casos, error: e1 } = await supabase
          .from("casos_redil")
          .select("id, estado, created_at")
          .order("created_at", { ascending: false })
        if (e1) throw e1
        if (!casos || casos.length === 0) { toast.error("No hay casos registrados"); return }

        const { data: solicitudes, error: e2 } = await supabase
          .from("solicitudes_redil")
          .select("caso_id, nombre_completo, cedula, telefono, direccion, tipo_ayuda, motivo, referencia, num_hijos, situacion_laboral")
          .in("caso_id", casos.map((c: any) => c.id))
        if (e2) throw e2

        const solMap = Object.fromEntries((solicitudes || []).map((s: any) => [s.caso_id, s]))
        const estadoLabel: Record<string, string> = {
          pendiente_visita: "Pendiente Visita",
          en_visita_tecnica: "En Visita Técnica",
          aprobado: "Aprobado",
          rechazado: "Rechazado",
          pendiente_entrega: "Pendiente Entrega",
          entregado: "Entregado",
          cerrado: "Cerrado",
        }
        const tipoLabel: Record<string, string> = {
          canasta: "Canasta / Víveres",
          medicinas: "Medicinas",
          ropa: "Ropa",
          panales: "Pañales",
          utiles_escolares: "Útiles Escolares",
          ayuda_economica: "Ayuda Económica",
          otro: "Otro",
        }
        const data = casos.map((c: any) => {
          const sol = solMap[c.id] || {}
          return {
            estado: estadoLabel[c.estado] || c.estado,
            created_at: c.created_at,
            nombre_completo: sol.nombre_completo || "",
            cedula: sol.cedula || "",
            telefono: sol.telefono || "",
            direccion: sol.direccion || "",
            tipo_ayuda: (sol.tipo_ayuda || []).map((t: string) => tipoLabel[t] || t).join(", "),
            motivo: sol.motivo || "",
            referencia: sol.referencia || "",
            num_hijos: sol.num_hijos ?? "",
            situacion_laboral: sol.situacion_laboral || "",
          }
        })
        const { headers, rows } = filterDataBySelectedColumns(data, cols)
        downloadExcel(buildExcel(headers, rows, "Casos REDIL"), `REDIL_Casos_${todayStr()}.xlsx`)
        toast.success(`Excel generado con ${data.length} casos`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }

  // ── REDIL — EXISTENCIA / INVENTARIO ──

  function handleExportRedilExistenciaExcel() {
    const colsItems = [
      { key: "categoria",        label: "Categoría" },
      { key: "nombre",           label: "Producto" },
      { key: "unidad",           label: "Unidad" },
      { key: "cantidad_actual",  label: "Existencia Actual" },
      { key: "cantidad_minima",  label: "Mínimo" },
      { key: "descripcion",      label: "Descripción" },
    ]
    openGenericColumnFilter("REDIL — Existencia / Inventario", colsItems, async () => {
      setExporting(true)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require("xlsx")
        const wb = XLSX.utils.book_new()

        // Hoja 1: Existencia (ítems con categoría)
        const { data: categorias, error: e1 } = await supabase
          .from("existencia_ayuda_categorias")
          .select("id, nombre")
          .order("nombre", { ascending: true })
        if (e1) throw e1

        const { data: items, error: e2 } = await supabase
          .from("existencia_ayuda_items")
          .select("*")
          .order("nombre", { ascending: true })
        if (e2) throw e2

        const catMap = Object.fromEntries((categorias || []).map((c: any) => [c.id, c.nombre]))
        const itemsConCat = (items || []).map((item: any) => ({
          ...item,
          categoria: catMap[item.categoria_id] || "",
        }))

        if (itemsConCat.length > 0) {
          const cols = colsItems.filter((c) => selectedColumns.has(c.key))
          const headers = cols.map((c) => c.label)
          const rows = itemsConCat.map((item: any) => cols.map((c) => item[c.key] ?? ""))
          const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
          ws["!cols"] = headers.map((h: string) => ({ wch: Math.min(Math.max(h.length + 4, 14), 40) }))
          ws["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1` }
          XLSX.utils.book_append_sheet(wb, ws, "Existencia")
        }

        // Hoja 2: Movimientos recientes
        const { data: movimientos, error: e3 } = await supabase
          .from("existencia_ayuda_movimientos")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
        if (e3) throw e3

        if (movimientos && movimientos.length > 0) {
          const itemMap = Object.fromEntries((items || []).map((i: any) => [i.id, i.nombre]))
          const movData = movimientos.map((m: any) => ({
            fecha: m.created_at ? formatDateValue(m.created_at) : "",
            producto: itemMap[m.item_id] || m.item_id,
            tipo: m.tipo === "ingreso" ? "Ingreso" : "Egreso",
            cantidad: m.cantidad,
            motivo: m.motivo || "",
            responsable: m.responsable || "",
          }))
          const movHeaders = ["Fecha", "Producto", "Tipo", "Cantidad", "Motivo", "Responsable"]
          const movRows = movData.map((m: any) => [m.fecha, m.producto, m.tipo, m.cantidad, m.motivo, m.responsable])
          const wsMov = XLSX.utils.aoa_to_sheet([movHeaders, ...movRows])
          wsMov["!cols"] = movHeaders.map((h: string) => ({ wch: Math.min(Math.max(h.length + 4, 14), 40) }))
          wsMov["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(movHeaders.length - 1)}1` }
          XLSX.utils.book_append_sheet(wb, wsMov, "Movimientos")
        }

        const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" })
        const blob = new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        downloadExcel(blob, `REDIL_Existencia_${todayStr()}.xlsx`)
        toast.success(`Excel generado: existencia + movimientos`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }

  // ── INGRESOS Y EGRESOS ──

  function handleExportIngresosEgresosExcel() {
    const cols = [
      { key: "fecha",               label: "Fecha" },
      { key: "tipo",                label: "Tipo" },
      { key: "ministerio",          label: "Ministerio" },
      { key: "categoria_principal", label: "Categoría" },
      { key: "detalle",             label: "Detalle" },
      { key: "monto",               label: "Monto" },
      { key: "metodo_pago",         label: "Método de Pago" },
      { key: "estado",              label: "Estado" },
      { key: "observacion",         label: "Centro de Gasto" },
    ]
    openGenericColumnFilter("Ingresos y Egresos", cols, async () => {
      setExporting(true)
      try {
        const monthId = selectedMonthId || currentMonth?.id
        if (!monthId) { toast.error("Seleccione un mes"); return }
        const selectedM = allMonths.find((m) => m.id === monthId)
        const monthName = selectedM?.name || "Mes"
        const monthNum = selectedM?.month || 0
        const yearNum = selectedM?.year || 0

        const ingresos = await storage.getIngresosByMonth(monthId)
        const egresos = await storage.getEgresosByMonth(monthId)

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

        const combined = [
          ...(ingresos || []).map((r: any) => ({ ...r, tipo: "Ingreso" })),
          ...(egresos || []).map((r: any) => ({ ...r, tipo: "Egreso" })),
        ].sort((a: any, b: any) => (a.fecha || "").localeCompare(b.fecha || ""))

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require("xlsx")
        const wb = XLSX.utils.book_new()

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
        downloadExcel(
          new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          `Ingresos_Egresos_${monthName.replace(/\s/g, "_")}_${todayStr()}.xlsx`,
        )
        toast.success(`Excel generado para ${monthName}`)
      } catch (error) { console.error(error); toast.error("Error al exportar") }
      finally { setExporting(false) }
    })
  }

  // ── Render helpers ──

  const currentSection = SECTIONS.find((s) => s.value === activeSection)
  const c = SECTION_COLORS[currentSection?.color || "green"]

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Listados y Exportaciones</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Generación de Certificados y Exportaciones</CardTitle>
            <CardDescription>Seleccione una lista para generar PDFs o exportar datos a Excel con filtros de columnas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* ── Selector de lista ── */}
            <div className="max-w-sm">
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Lista a exportar</Label>
              <Select value={activeSection} onValueChange={setActiveSection}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione una lista..." />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Contenido de la sección activa ── */}
            <div className={`${c.bg} ${c.border} border rounded-lg p-5 space-y-4`}>

              {/* BAUTIZOS */}
              {activeSection === "bautizos" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileText className="w-5 h-5" /> Certificados de Bautizo</h3>
                  <p className={`text-sm ${c.text}`}>Genera PDFs y Excel de todos los bautizos registrados (protocolo + MDG).</p>
                  <div className="flex flex-wrap gap-3">
                    <Button className={c.btn} onClick={handleGenerateBautizos} disabled={generating}>
                      {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</> : <><Download className="w-4 h-4 mr-2" />Generar PDF</>}
                    </Button>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={handleExportBautizosExcel} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
                    </Button>
                  </div>
                </>
              )}

              {/* MATRIMONIOS */}
              {activeSection === "matrimonios" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileText className="w-5 h-5" /> Certificados de Matrimonio</h3>
                  <p className={`text-sm ${c.text}`}>Genera PDFs con certificados y exporta datos a Excel.</p>
                  <div className="flex flex-wrap gap-3">
                    <Button className={c.btn} onClick={() => handleGenerateMatrimonios("v1")} disabled={generating}>
                      {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />...</> : <><Download className="w-4 h-4 mr-2" />PDF Completo</>}
                    </Button>
                    <Button variant="outline" onClick={() => handleGenerateMatrimonios("v2")} disabled={generating}>
                      <Download className="w-4 h-4 mr-2" />PDF Simple
                    </Button>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={handleExportMatrimoniosExcel} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
                    </Button>
                  </div>
                </>
              )}

              {/* PRESENTACIÓN */}
              {activeSection === "presentacion" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileText className="w-5 h-5" /> Certificados de Dedicación de Niños</h3>
                  <p className={`text-sm ${c.text}`}>Genera PDFs y exporta a Excel las presentaciones registradas.</p>
                  <div className="flex flex-wrap gap-3">
                    <Button className={c.btn} onClick={handleGeneratePresentacion} disabled={generating}>
                      {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />...</> : <><Download className="w-4 h-4 mr-2" />Generar PDF</>}
                    </Button>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={handleExportPresentacionExcel} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
                    </Button>
                  </div>
                </>
              )}

              {/* DISCIPULADO */}
              {activeSection === "discipulado" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileText className="w-5 h-5" /> Discipulado</h3>
                  <p className={`text-sm ${c.text}`}>Genera certificados PDF de aprobados y exporta todos los participantes a Excel.</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Generar PDF de certificados (ciclos completados)</p>
                      <div className="flex flex-wrap gap-2">
                        <Button className={c.btn} onClick={() => handleGenerateDiscipulado("primeros_pasos")} disabled={generating}>
                          {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}Primeros Pasos
                        </Button>
                        <Button variant="outline" onClick={() => handleGenerateDiscipulado("seguimos_avanzando")} disabled={generating}>
                          <Download className="w-4 h-4 mr-1" />Seguimos Avanzando
                        </Button>
                        <Button variant="outline" onClick={() => handleGenerateDiscipulado("siendo_iglesia")} disabled={generating}>
                          <Download className="w-4 h-4 mr-1" />Siendo Iglesia
                        </Button>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-purple-200">
                      <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={handleExportDiscipuladoExcel} disabled={exporting}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar todos a Excel
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* PROYECTO MARIO */}
              {activeSection === "proyecto_mario" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileSpreadsheet className="w-5 h-5" /> Proyecto Mario</h3>
                  <p className={`text-sm ${c.text}`}>Exporta participantes de los ciclos de Proyecto Mario. Puedes exportar por tipo de ciclo o todos juntos.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button className={c.btn} onClick={() => handleExportProyectoMarioExcel("todos")} disabled={exporting}>
                      {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}Todos los ciclos
                    </Button>
                    <Button variant="outline" onClick={() => handleExportProyectoMarioExcel("gastronomia")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-1" />Gastronomía
                    </Button>
                    <Button variant="outline" onClick={() => handleExportProyectoMarioExcel("manualidades")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-1" />Manualidades
                    </Button>
                    <Button variant="outline" onClick={() => handleExportProyectoMarioExcel("belleza_integral_sabados")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-1" />Belleza — Sábados
                    </Button>
                    <Button variant="outline" onClick={() => handleExportProyectoMarioExcel("belleza_integral_viernes")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-1" />Belleza — Viernes
                    </Button>
                    <Button variant="outline" onClick={() => handleExportProyectoMarioExcel("belleza_cejas")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-1" />Belleza — Cejas
                    </Button>
                  </div>
                </>
              )}

              {/* CENSO */}
              {activeSection === "censo" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileSpreadsheet className="w-5 h-5" /> Exportar Censo a Excel</h3>
                  <p className={`text-sm ${c.text}`}>Exporta la tabla de censo como Excel con filtros de columnas.</p>
                  <div className="flex flex-wrap gap-3">
                    <Button className={c.btn} onClick={() => openCensoColumnFilter("protocolo")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Censo Protocolo
                    </Button>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-100" onClick={() => openCensoColumnFilter("mdg")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Censo MDG
                    </Button>
                    <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100" onClick={() => openCensoColumnFilter("combinado")} disabled={exporting}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />Combinado
                    </Button>
                  </div>
                </>
              )}

              {/* EVENTOS */}
              {activeSection === "eventos" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileSpreadsheet className="w-5 h-5" /> Eventos / Encuentros</h3>
                  <p className={`text-sm ${c.text}`}>
                    Exporta participantes de uno o varios eventos. Puedes elegir eventos, columnas y formato de hojas (una hoja por evento o todo combinado).
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button className={c.btn} onClick={handleOpenEventosExport} disabled={loadingEventos || exporting}>
                      {loadingEventos
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cargando...</>
                        : <><FileSpreadsheet className="w-4 h-4 mr-2" />Exportar a Excel</>
                      }
                    </Button>
                  </div>
                  <p className="text-xs text-indigo-500">
                    Columnas disponibles: Nombre, Edad, Teléfono, Género, Ministerio, Contextura, Limitación Física, Valor, Abono, Saldo, Método de Pago, Estado, Equipo.
                  </p>
                </>
              )}

              {/* INCIDENCIAS HEREDEROS */}
              {activeSection === "incidencias_herederos" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileSpreadsheet className="w-5 h-5" /> Incidencias Herederos del Reino</h3>
                  <p className={`text-sm ${c.text}`}>Exporta el registro de incidencias del ministerio de niños Herederos del Reino.</p>
                  <div className="flex flex-wrap gap-3">
                    <Button className={c.btn} onClick={handleExportIncidenciasExcel} disabled={exporting}>
                      {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel</>}
                    </Button>
                  </div>
                </>
              )}

              {/* REDIL — CASOS */}
              {activeSection === "redil_casos" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileSpreadsheet className="w-5 h-5" /> REDIL — Casos de Ayuda Social</h3>
                  <p className={`text-sm ${c.text}`}>Exporta el listado de casos de ayuda social con datos del solicitante y estado del proceso.</p>
                  <div className="flex flex-wrap gap-3">
                    <Button className={c.btn} onClick={handleExportRedilCasosExcel} disabled={exporting}>
                      {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel</>}
                    </Button>
                  </div>
                </>
              )}

              {/* REDIL — EXISTENCIA */}
              {activeSection === "redil_existencia" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2`}><FileSpreadsheet className="w-5 h-5" /> REDIL — Existencia / Inventario</h3>
                  <p className={`text-sm ${c.text}`}>Exporta el inventario de productos y los movimientos de ingreso/egreso. Genera dos hojas: Existencia + Movimientos.</p>
                  <div className="flex flex-wrap gap-3">
                    <Button className={c.btn} onClick={handleExportRedilExistenciaExcel} disabled={exporting}>
                      {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel</>}
                    </Button>
                  </div>
                </>
              )}

              {/* INGRESOS Y EGRESOS */}
              {activeSection === "finanzas" && (
                <>
                  <h3 className={`font-semibold ${c.title} flex items-center gap-2 text-lg`}><FileSpreadsheet className="w-5 h-5" /> Ingresos y Egresos</h3>
                  <p className={`text-sm ${c.text}`}>Excel con hoja de resumen financiero + hoja de ingresos y egresos combinados con filtros.</p>
                  <div className="space-y-3">
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
                    <Button className={c.btn} onClick={handleExportIngresosEgresosExcel} disabled={exporting || allMonths.length === 0}>
                      {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Descargar Excel</>}
                    </Button>
                    {allMonths.length === 0 && (
                      <p className="text-sm text-yellow-700">No hay meses disponibles. Vaya a Resumen Mensual para crear uno.</p>
                    )}
                  </div>
                </>
              )}

            </div>
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
              <DialogDescription>Seleccione qué columnas incluir en el archivo Excel.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-sm text-gray-500">{selectedColumns.size}/{availableColumns.length} seleccionadas</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedColumns(new Set(availableColumns.map((c) => c.key)))}>Todas</Button>
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
                {exporting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando...</>
                  : <><FileSpreadsheet className="w-4 h-4 mr-2" />Exportar ({selectedColumns.size} columnas)</>
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de eventos (reutiliza el componente del módulo eventos) */}
        <ExportEventosDialog
          open={showEventosExport}
          onOpenChange={setShowEventosExport}
          allTabs={allEventosTabs}
        />
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
