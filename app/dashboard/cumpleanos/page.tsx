"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import {
  ArrowLeft, Cake, Send, Search, CheckCircle2, XCircle, Loader2,
  Phone, Mail, Bell, PartyPopper, Calendar, Download,
} from "lucide-react"
import {
  getCumpleanerosMes,
  generarMensajeCumple,
  type CumpleaneroRecord,
} from "@/lib/mod/cumpleanos-service"
import { authFetch } from "@/lib/auth-fetch"
import { currentMonthEcuador, currentYearEcuador } from "@/lib/timezone"
import { generateCumpleanosPDF } from "@/lib/generate-cumpleanos-pdf"

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function CumpleanosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const [cumpleaneros, setCumpleaneros] = useState<CumpleaneroRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState("")
  const [selectedMonth, setSelectedMonth] = useState(currentMonthEcuador())
  const [selectedYear, setSelectedYear] = useState(currentYearEcuador())
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [sendingAll, setSendingAll] = useState(false)

  useEffect(() => {
    loadCumpleaneros()
  }, [selectedMonth, selectedYear])

  const loadCumpleaneros = async () => {
    try {
      setLoading(true)
      const data = await getCumpleanerosMes(selectedMonth, selectedYear)
      setCumpleaneros(data)
    } catch (error) {
      console.error("Error cargando cumpleañeros:", error)
      toast.error("Error al cargar cumpleañeros")
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async (nombre: string) => {
    try {
      const pdfBytes = await generateCumpleanosPDF(nombre)
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Cumpleaños - ${nombre}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error generando PDF:", error)
      toast.error("Error al generar el PDF de cumpleaños")
    }
  }

  const enviarFelicitacion = async (cumpleanero: CumpleaneroRecord) => {
    setSendingId(cumpleanero.id)
    try {
      const res = await authFetch("/api/cron-cumpleanos", {
        method: "POST",
        body: JSON.stringify({
          censoId: cumpleanero.id,
          fuente: cumpleanero.fuente,
          nombre: cumpleanero.apellidos_nombres,
          celular: cumpleanero.celular,
          correo: cumpleanero.correo,
          edad: cumpleanero.edad_cumple,
          fecha_cumple: cumpleanero.fecha_nacimiento,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Felicitación enviada a ${cumpleanero.apellidos_nombres}`)
      } else {
        toast.error(data.error || "Error al enviar felicitación")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSendingId(null)
    }
  }

  const enviarTodosHoy = async () => {
    const today = new Date()
    const diaHoy = today.getDate()
    const cumpleanerosHoy = cumpleaneros.filter((c) => c.dia === diaHoy)

    if (cumpleanerosHoy.length === 0) {
      toast.info("No hay cumpleañeros hoy")
      return
    }

    if (!confirm(`¿Enviar felicitación a ${cumpleanerosHoy.length} cumpleañero(s) de hoy?`)) return

    setSendingAll(true)
    let enviados = 0
    for (const c of cumpleanerosHoy) {
      try {
        const res = await authFetch("/api/cron-cumpleanos", {
          method: "POST",
          body: JSON.stringify({
            censoId: c.id,
            fuente: c.fuente,
            nombre: c.apellidos_nombres,
            celular: c.celular,
            correo: c.correo,
            edad: c.edad_cumple,
            fecha_cumple: c.fecha_nacimiento,
          }),
        })
        const data = await res.json()
        if (data.success) enviados++
      } catch {}
    }
    toast.success(`${enviados}/${cumpleanerosHoy.length} felicitaciones enviadas`)
    setSendingAll(false)
  }

  const filtered = cumpleaneros.filter((c) => {
    const q = searchFilter.toLowerCase()
    return c.apellidos_nombres.toLowerCase().includes(q)
  })

  const today = new Date()
  const diaHoy = today.getDate()
  const cumpleanerosHoyCount = cumpleaneros.filter((c) => c.dia === diaHoy && selectedMonth === currentMonthEcuador()).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
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
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Cake className="w-5 h-5 text-pink-500" />
                Cumpleaños
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              {canEdit && selectedMonth === currentMonthEcuador() && cumpleanerosHoyCount > 0 && (
                <Button size="sm" onClick={enviarTodosHoy} disabled={sendingAll}>
                  {sendingAll ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Enviando...</>
                  ) : (
                    <><PartyPopper className="w-4 h-4 mr-1" />Felicitar hoy ({cumpleanerosHoyCount})</>
                  )}
                </Button>
              )}
              <Badge variant="outline" className="text-pink-600 border-pink-200">
                {cumpleaneros.length} cumpleañero{cumpleaneros.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_NOMBRES.map((nombre, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)}>{nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value) || currentYearEcuador())}
                className="w-[90px]"
                min={2020}
                max={2030}
              />
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar por nombre..."
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de cumpleañeros */}
      <Card>
        <CardHeader>
          <CardTitle>
            Cumpleañeros de {MESES_NOMBRES[selectedMonth - 1]} {selectedYear}
          </CardTitle>
          <CardDescription>
            Lista de personas del censo que cumplen años este mes. Se envía imagen, audio, email, push y alerta interna.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Cake className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay cumpleañeros {searchFilter ? "con ese filtro" : "este mes"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Canales</TableHead>
                    {canEdit && <TableHead className="text-right">Acción</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const esHoy = c.dia === diaHoy && selectedMonth === currentMonthEcuador()
                    return (
                      <TableRow key={`${c.fuente}-${c.id}`} className={esHoy ? "bg-pink-50" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-lg">{c.dia}</span>
                            {esHoy && <Badge className="bg-pink-500 text-white text-xs">HOY</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{c.apellidos_nombres}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{c.edad_cumple} años</Badge>
                        </TableCell>
                        <TableCell>
                          {c.celular ? (
                            <span className="flex items-center gap-1 text-sm text-green-700">
                              <Phone className="w-3 h-3" />{c.celular}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.correo ? (
                            <span className="flex items-center gap-1 text-sm text-blue-700">
                              <Mail className="w-3 h-3" />{c.correo}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {c.fuente === "protocolo" ? "Protocolo" : "MDG"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {c.celular && <Phone className="w-3.5 h-3.5 text-green-600" />}
                            {c.correo && <Mail className="w-3.5 h-3.5 text-blue-600" />}
                            <Bell className="w-3.5 h-3.5 text-yellow-600" />
                          </div>
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadPDF(c.apellidos_nombres)}
                                className="text-purple-600 border-purple-200 hover:bg-purple-50"
                              >
                                <Download className="w-4 h-4 mr-1" />PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => enviarFelicitacion(c)}
                                disabled={sendingId === c.id}
                                className="text-pink-600 border-pink-200 hover:bg-pink-50"
                              >
                                {sendingId === c.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <><Send className="w-4 h-4 mr-1" />Enviar</>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </main>
    </div>
  )
}

export default function CumpleanosPage() {
  return (
    <PermissionsGuard moduleName="cumpleanos-comunicacion">
      {(canEdit, canAdmin, canLeader) => (
        <CumpleanosContent canEdit={!!(canEdit || canLeader)} />
      )}
    </PermissionsGuard>
  )
}
