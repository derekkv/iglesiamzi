"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, DollarSign, History, Plus } from "lucide-react"
import { toast } from "sonner"
import {
  getJuevesDelMes, getMesOfrendaActual, getTodasOfrendasMes,
  toggleRecibido, type OfrendaCelula,
} from "@/lib/mod/ofrenda-celulas-service"
import {
  getDomingosDelMes, getAlfoliMes, upsertAlfoli, eliminarAlfoli,
  toggleAlfoliRecibido, getAlfoliHistorial, type AlfoliRecord,
} from "@/lib/mod/alfoli-service"


const CELULAS = [
  "Carlos y Ruth", "Sarita y Lady", "Jessy Mendoza", "Líder y Angela",
  "Juan Pablo y Angie", "Alina y Anita", "Neyda y Carmen", "Yadira y Tania",
  "Luis y Ariana", "Layla Salem", "Estuardo y Catalina", "Gabriela López",
]
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function OfrendaCelulasContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const { checkAndExecute } = useSecurityCheck()
  const [ofrendas, setOfrendas] = useState<OfrendaCelula[]>([])
  const [alfoli, setAlfoli] = useState<AlfoliRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistorial, setShowHistorial] = useState(false)
  const [historial, setHistorial] = useState<AlfoliRecord[]>([])
  const [mdgFecha, setMdgFecha] = useState("")

  const { mes, anio } = getMesOfrendaActual()
  const jueves = getJuevesDelMes(anio, mes)
  const domingos = getDomingosDelMes(anio, mes)

  const loadData = async () => {
    const [ofr, alf] = await Promise.all([
      getTodasOfrendasMes(mes, anio),
      getAlfoliMes(mes, anio),
    ])
    setOfrendas(ofr)
    setAlfoli(alf)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])
  useRealtime({ table: "ofrendas_celulas", onChange: () => loadData() })
  useRealtime({ table: "alfoli", onChange: () => loadData() })

  // Ofrendas helpers
  const getOfrenda = (celula: string, fecha: string) => ofrendas.find((x) => x.celula_nombre === celula && x.fecha === fecha)
  const getTotalCelula = (celula: string) => ofrendas.filter((o) => o.celula_nombre === celula && o.recibido).reduce((s, o) => s + Number(o.valor), 0)
  const getTotalJueves = (fecha: string) => ofrendas.filter((o) => o.fecha === fecha && o.recibido).reduce((s, o) => s + Number(o.valor), 0)
  const totalOfrendas = ofrendas.filter((o) => o.recibido).reduce((s, o) => s + Number(o.valor), 0)

  // Alfolí helpers
  const getAlfoliRecord = (fecha: string, tipo: "domingo" | "mdg") => alfoli.find((a) => a.fecha === fecha && a.tipo === tipo)
  const totalAlfoli = alfoli.reduce((s, a) => s + Number(a.valor), 0)

  const handleToggleRecibido = async (ofrenda: OfrendaCelula) => {
    if (!user || !canEdit) return
    const r = await toggleRecibido({ id: ofrenda.id, recibido: !ofrenda.recibido, userId: user.id, userName: user.username })
    if (r.success) loadData(); else toast.error(r.error || "Error")
  }

  const handleAlfoliSave = async (fecha: string, tipo: "domingo" | "mdg", valor: string) => {
    if (!user || !valor || parseFloat(valor) <= 0) return
    const r = await upsertAlfoli({ fecha, mes, anio, tipo, valor: parseFloat(valor), userId: user.id, userName: user.username })
    if (r.success) { toast.success("Alfolí guardado"); loadData() } else toast.error(r.error || "Error")
  }

  const handleAlfoliToggle = async (record: AlfoliRecord) => {
    if (!user || !canEdit) return
    const r = await toggleAlfoliRecibido({ id: record.id, recibido: !record.recibido, userId: user.id, userName: user.username })
    if (r.success) loadData(); else toast.error(r.error || "Error")
  }

  const handleAlfoliDelete = async (record: AlfoliRecord) => {
    if (!canEdit) return
    checkAndExecute(record.created_at, async () => {
      const r = await eliminarAlfoli(record.id)
      if (r.success) { toast.success("Eliminado"); loadData() } else toast.error(r.error || "Error")
    })
  }

  const handleShowHistorial = async () => {
    const data = await getAlfoliHistorial()
    setHistorial(data)
    setShowHistorial(true)
  }

  const handleAddMdg = async () => {
    if (!mdgFecha || !user) return
    // Solo permitir 1 fecha MDG por mes
    const yaTieneMdg = alfoli.some((a) => a.tipo === "mdg")
    if (yaTieneMdg) {
      toast.error("Ya existe una fecha MDG este mes")
      return
    }
    const r = await upsertAlfoli({ fecha: mdgFecha, mes, anio, tipo: "mdg", valor: 0, userId: user.id, userName: user.username })
    if (r.success) { toast.success("Fecha MDG agregada"); setMdgFecha(""); loadData() } else toast.error(r.error || "Error")
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Ofrendas y Alfolí</h1>
                <p className="text-xs text-gray-500">{MESES[mes - 1]} {anio}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Células: ${totalOfrendas.toFixed(2)}</Badge>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Alfolí: ${totalAlfoli.toFixed(2)}</Badge>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-sm font-bold">Total: ${(totalOfrendas + totalAlfoli).toFixed(2)}</Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tarjetas resumen individual por célula */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {CELULAS.map((celula) => {
            const total = getTotalCelula(celula)
            const celOfrendas = ofrendas.filter((o) => o.celula_nombre === celula)
            const allRecibidas = celOfrendas.length > 0 && celOfrendas.every((o) => o.recibido)
            const hasAny = celOfrendas.length > 0
            return (
              <Card key={celula} className={`p-0 ${allRecibidas ? "border-green-300 bg-green-50" : hasAny ? "border-amber-300 bg-amber-50" : ""}`}>
                <CardContent className="p-2">
                  <p className="text-[10px] font-medium text-gray-700 truncate">{celula}</p>
                  <p className={`text-sm font-bold ${allRecibidas ? "text-green-700" : hasAny ? "text-amber-600" : "text-gray-300"}`}>${total.toFixed(2)}</p>
                  {hasAny && <p className={`text-[9px] ${allRecibidas ? "text-green-600" : "text-amber-500"}`}>{allRecibidas ? "✓ Todo recibido" : "⏳ Pendiente"}</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-6">
          {/* TABLA IZQUIERDA: Ofrendas de Células */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" /> Ofrenda Células (Jueves)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="text-[11px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-semibold">Célula</TableHead>
                      {jueves.map((j) => (
                        <TableHead key={j} className="text-[10px] text-center px-1">
                          {new Date(j + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}
                        </TableHead>
                      ))}
                      <TableHead className="text-[10px] text-center font-semibold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CELULAS.map((celula) => (
                      <TableRow key={celula}>
                        <TableCell className="text-[10px] font-medium py-1">{celula}</TableCell>
                        {jueves.map((j) => {
                          const o = getOfrenda(celula, j)
                          if (!o) return <TableCell key={j} className="text-center px-1 py-1"><span className="text-gray-300">—</span></TableCell>
                          return (
                            <TableCell key={j} className={`text-center px-1 py-1 ${o.recibido ? "bg-green-50" : "bg-amber-50"}`}>
                              <div className="flex items-center justify-center gap-1.5">
                                <Checkbox checked={o.recibido} disabled={!canEdit} onCheckedChange={() => handleToggleRecibido(o)} className={`h-4 w-4 ${o.recibido ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : "border-amber-400"}`} />
                                <span className={`text-[11px] font-semibold ${o.recibido ? "text-green-700" : "text-amber-600"}`}>${Number(o.valor)}</span>
                              </div>
                            </TableCell>
                          )
                        })}
                        {(() => {
                          const total = getTotalCelula(celula)
                          const celOfrendas = ofrendas.filter((o) => o.celula_nombre === celula)
                          const allRecibidas = celOfrendas.length > 0 && celOfrendas.every((o) => o.recibido)
                          return (
                            <TableCell className={`text-[10px] text-center font-bold py-1 ${allRecibidas ? "text-green-800 bg-green-100" : celOfrendas.length > 0 ? "text-amber-700 bg-amber-50" : "text-gray-400"}`}>
                              ${total.toFixed(2)}
                            </TableCell>
                          )
                        })()}
                      </TableRow>
                    ))}
                    <TableRow className="bg-green-50/50">
                      <TableCell className="text-[10px] font-bold py-1">TOTAL</TableCell>
                      {jueves.map((j) => {
                        const colOfrendas = ofrendas.filter((o) => o.fecha === j)
                        const allRecibidas = colOfrendas.length > 0 && colOfrendas.every((o) => o.recibido)
                        const total = getTotalJueves(j)
                        return (
                          <TableCell key={j} className={`text-[10px] text-center font-bold py-1 ${allRecibidas ? "text-green-800 bg-green-100" : colOfrendas.length > 0 ? "text-amber-700 bg-amber-50" : "text-gray-400"}`}>
                            ${total}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-[10px] text-center font-bold text-green-900 py-1 bg-green-100">${totalOfrendas.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>


          {/* TABLA DERECHA: Alfolí */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-blue-600" /> Alfolí (Domingos + MDG)</CardTitle>
                <Button size="sm" variant="outline" onClick={handleShowHistorial}><History className="w-3 h-3 mr-1" /> Historial</Button>
              </div>
              <CardDescription className="text-[10px]">Domingos del mes + fechas asignadas de MDG</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table className="text-[11px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Fecha</TableHead>
                      <TableHead className="text-[10px]">Tipo</TableHead>
                      <TableHead className="text-[10px] text-center">Valor ($)</TableHead>
                      <TableHead className="text-[10px] text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Domingos */}
                    {domingos.map((dom) => {
                      const record = getAlfoliRecord(dom, "domingo")
                      return (
                        <TableRow key={dom}>
                          <TableCell className="text-[10px] py-1">{new Date(dom + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}</TableCell>
                          <TableCell className="text-[10px] py-1"><Badge variant="outline" className="text-[9px] px-1">Domingo</Badge></TableCell>
                          <TableCell className="text-center py-1">
                            {record ? (
                              <span className="text-[11px] font-semibold text-blue-700">${Number(record.valor).toFixed(2)}</span>
                            ) : canEdit ? (
                              <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-6 w-20 text-[10px] mx-auto"
                                onBlur={(e) => { if (e.target.value && parseFloat(e.target.value) > 0) handleAlfoliSave(dom, "domingo", e.target.value) }}
                                onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value; if (v && parseFloat(v) > 0) handleAlfoliSave(dom, "domingo", v) } }}
                              />
                            ) : <span className="text-gray-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right py-1">
                            {record && canEdit && <Button variant="ghost" size="sm" className="h-5 text-[9px] text-red-500" onClick={() => handleAlfoliDelete(record)}>X</Button>}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {/* Fechas MDG */}
                    {alfoli.filter((a) => a.tipo === "mdg").map((record) => (
                      <TableRow key={record.id} className="bg-purple-50/30">
                        <TableCell className="text-[10px] py-1">{new Date(record.fecha + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}</TableCell>
                        <TableCell className="text-[10px] py-1"><Badge className="bg-purple-100 text-purple-700 text-[9px] px-1">MDG</Badge></TableCell>
                        <TableCell className="text-center py-1">
                          {record.valor > 0 ? (
                            <span className="text-[11px] font-semibold text-purple-700">${Number(record.valor).toFixed(2)}</span>
                          ) : canEdit ? (
                            <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-6 w-20 text-[10px] mx-auto"
                              onBlur={(e) => { if (e.target.value && parseFloat(e.target.value) > 0) handleAlfoliSave(record.fecha, "mdg", e.target.value) }}
                              onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value; if (v && parseFloat(v) > 0) handleAlfoliSave(record.fecha, "mdg", v) } }}
                            />
                          ) : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-right py-1">
                          {canEdit && <Button variant="ghost" size="sm" className="h-5 text-[9px] text-red-500" onClick={() => handleAlfoliDelete(record)}>X</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Agregar fecha MDG */}
              {canEdit && !alfoli.some((a) => a.tipo === "mdg") && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Label className="text-[10px] whitespace-nowrap">Agregar MDG:</Label>
                  <Input type="date" value={mdgFecha} onChange={(e) => setMdgFecha(e.target.value)} className="h-7 text-xs w-36" />
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddMdg} disabled={!mdgFecha}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
                </div>
              )}

              {/* Total Alfolí */}
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-gray-600">Total Alfolí Recibido:</p>
                <p className="text-xl font-bold text-blue-700">${totalAlfoli.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>


      {/* Modal Historial Alfolí */}
      <Dialog open={showHistorial} onOpenChange={setShowHistorial}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Historial Alfolí</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {historial.length === 0 ? (
              <p className="text-center text-gray-500 py-6">Sin registros</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Valor</TableHead>
                    <TableHead className="text-xs">Recibido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs">{new Date(h.fecha + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline" className="text-[9px]">{h.tipo === "domingo" ? "Domingo" : "MDG"}</Badge></TableCell>
                      <TableCell className="text-xs font-semibold text-blue-700">${Number(h.valor).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{h.recibido ? <Badge className="bg-green-100 text-green-700 text-[9px]">Sí</Badge> : <Badge variant="outline" className="text-[9px]">No</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function OfrendaCelulasPage() {
  return (
    <PermissionsGuard moduleName="ofrenda-celulas">
      {(canEdit) => <OfrendaCelulasContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
