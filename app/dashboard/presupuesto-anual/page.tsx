"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { supabase } from "@/lib/secure-db"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart } from "lucide-react"

const MESES_NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]


const COLORES_INGRESOS = [
  "bg-green-500", "bg-emerald-500", "bg-teal-500", "bg-lime-500",
  "bg-green-400", "bg-emerald-400", "bg-teal-400", "bg-lime-400",
]

const COLORES_EGRESOS = [
  "bg-red-500", "bg-rose-500", "bg-pink-500", "bg-orange-500",
  "bg-red-400", "bg-rose-400", "bg-amber-500", "bg-orange-400",
]

interface MesData {
  mes: number
  nombre: string
  ingresos: number
  egresos: number
  diferencia: number
}

interface DetalleIngreso {
  mes: number
  nombre_mes: string
  categoria_principal: string
  monto: number
  fuente: string // "ingresos" | "ofrendas_celulas" | "alfoli"
}

interface DetalleEgreso {
  mes: number
  nombre_mes: string
  ministerio: string
  detalle: string
  monto: number
  categoria_principal: string
}


function PresupuestoAnualContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(new Date().getFullYear())
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([])
  const [resumenMensual, setResumenMensual] = useState<MesData[]>([])
  const [detalleEgresos, setDetalleEgresos] = useState<DetalleEgreso[]>([])
  const [detalleIngresos, setDetalleIngresos] = useState<DetalleIngreso[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAniosDisponibles()
  }, [])

  useEffect(() => {
    if (anioSeleccionado) loadDatosAnuales(anioSeleccionado)
  }, [anioSeleccionado])

  const loadAniosDisponibles = async () => {
    try {
      const { data } = await supabase.from("meses").select("year").order("year", { ascending: false })
      if (data) {
        const yearsSet = Array.from(new Set(data.map((m: any) => Number(m.year)))) as number[]
        const years = yearsSet.sort((a, b) => b - a)
        setAniosDisponibles(years)
        if (years.length > 0 && !years.includes(anioSeleccionado)) {
          setAnioSeleccionado(years[0])
        }
      }
    } catch (error) {
      console.error("Error cargando años:", error)
    }
  }


  const loadDatosAnuales = async (year: number) => {
    setIsLoading(true)
    try {
      const { data: meses } = await supabase
        .from("meses")
        .select("id, month, year")
        .eq("year", year)
        .order("month", { ascending: true })

      if (!meses || meses.length === 0) {
        setResumenMensual([])
        setDetalleEgresos([])
        setDetalleIngresos([])
        setIsLoading(false)
        return
      }

      const mesIds = meses.map((m: any) => m.id)

      const [ingresosRes, egresosRes, celulasRes, alfoliRes] = await Promise.all([
        supabase.from("ingresos").select("mes_id, monto, categoria_principal, detalle").in("mes_id", mesIds),
        supabase.from("egresos").select("mes_id, monto, ministerio, detalle, categoria_principal").in("mes_id", mesIds),
        supabase.from("ofrendas_celulas").select("mes, valor").eq("anio", year).eq("recibido", true),
        supabase.from("alfoli").select("mes, valor").eq("anio", year),
      ])

      const ingresos = ingresosRes.data || []
      const egresos = egresosRes.data || []
      const celulas = celulasRes.data || []
      const alfoli = alfoliRes.data || []

      const mesIdToMonth: Record<string, number> = {}
      for (const m of meses) mesIdToMonth[m.id] = m.month


      // === INGRESOS ===
      const ingresosPorMes: Record<number, number> = {}
      const detalleIng: DetalleIngreso[] = []

      for (const ing of ingresos) {
        const mes = mesIdToMonth[ing.mes_id]
        if (mes) {
          ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + Number(ing.monto)
          detalleIng.push({
            mes,
            nombre_mes: MESES_NOMBRES[mes - 1],
            categoria_principal: ing.categoria_principal || ing.detalle || "Sin categoría",
            monto: Number(ing.monto),
            fuente: "ingresos",
          })
        }
      }

      for (const cel of celulas) {
        const mes = Number(cel.mes)
        if (mes) {
          ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + Number(cel.valor)
          detalleIng.push({
            mes,
            nombre_mes: MESES_NOMBRES[mes - 1],
            categoria_principal: "Ofrendas Células",
            monto: Number(cel.valor),
            fuente: "ofrendas_celulas",
          })
        }
      }

      for (const alf of alfoli) {
        const mes = Number(alf.mes)
        if (mes) {
          ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + Number(alf.valor)
          detalleIng.push({
            mes,
            nombre_mes: MESES_NOMBRES[mes - 1],
            categoria_principal: "Alfolí",
            monto: Number(alf.valor),
            fuente: "alfoli",
          })
        }
      }

      setDetalleIngresos(detalleIng)


      // === EGRESOS ===
      const egresosPorMes: Record<number, number> = {}
      for (const egr of egresos) {
        const mes = mesIdToMonth[egr.mes_id]
        if (mes) egresosPorMes[mes] = (egresosPorMes[mes] || 0) + Number(egr.monto)
      }

      // Construir resumen mensual
      const resumen: MesData[] = MESES_NOMBRES.map((nombre, idx) => {
        const mes = idx + 1
        const ing = ingresosPorMes[mes] || 0
        const egr = egresosPorMes[mes] || 0
        return { mes, nombre, ingresos: ing, egresos: egr, diferencia: ing - egr }
      }).filter(m => m.ingresos > 0 || m.egresos > 0)

      setResumenMensual(resumen)

      // Construir detalle de egresos
      const detalle: DetalleEgreso[] = egresos.map((egr: any) => ({
        mes: mesIdToMonth[egr.mes_id],
        nombre_mes: MESES_NOMBRES[(mesIdToMonth[egr.mes_id] || 1) - 1],
        ministerio: egr.ministerio || "Sin ministerio",
        detalle: egr.detalle || "Sin detalle",
        categoria_principal: egr.categoria_principal || egr.detalle || "Otros",
        monto: Number(egr.monto),
      })).sort((a: DetalleEgreso, b: DetalleEgreso) => a.mes - b.mes)

      setDetalleEgresos(detalle)
    } catch (error) {
      console.error("Error cargando datos anuales:", error)
    } finally {
      setIsLoading(false)
    }
  }


  // Totales generales
  const totales = useMemo(() => {
    const totalIngresos = resumenMensual.reduce((sum, m) => sum + m.ingresos, 0)
    const totalEgresos = resumenMensual.reduce((sum, m) => sum + m.egresos, 0)
    return { ingresos: totalIngresos, egresos: totalEgresos, diferencia: totalIngresos - totalEgresos }
  }, [resumenMensual])

  // Ingresos resumidos por categoría y mes
  const ingresosResumidoPorMes = useMemo(() => {
    const porMes: Record<number, { mes: number; nombre: string; categorias: Record<string, number>; total: number }> = {}
    for (const d of detalleIngresos) {
      if (!porMes[d.mes]) porMes[d.mes] = { mes: d.mes, nombre: d.nombre_mes, categorias: {}, total: 0 }
      porMes[d.mes].categorias[d.categoria_principal] = (porMes[d.mes].categorias[d.categoria_principal] || 0) + d.monto
      porMes[d.mes].total += d.monto
    }
    return Object.values(porMes).sort((a, b) => a.mes - b.mes)
  }, [detalleIngresos])

  // Egresos resumidos por categoría y mes
  const egresosResumidoPorMes = useMemo(() => {
    const porMes: Record<number, { mes: number; nombre: string; categorias: Record<string, number>; total: number }> = {}
    for (const d of detalleEgresos) {
      if (!porMes[d.mes]) porMes[d.mes] = { mes: d.mes, nombre: d.nombre_mes, categorias: {}, total: 0 }
      const cat = d.categoria_principal
      porMes[d.mes].categorias[cat] = (porMes[d.mes].categorias[cat] || 0) + d.monto
      porMes[d.mes].total += d.monto
    }
    return Object.values(porMes).sort((a, b) => a.mes - b.mes)
  }, [detalleEgresos])


  // Categorías globales de ingresos (para gráficos)
  const categoriasIngresosGlobal = useMemo(() => {
    const cats: Record<string, number> = {}
    for (const d of detalleIngresos) {
      cats[d.categoria_principal] = (cats[d.categoria_principal] || 0) + d.monto
    }
    return Object.entries(cats).sort((a, b) => b[1] - a[1])
  }, [detalleIngresos])

  // Categorías globales de egresos (para gráficos)
  const categoriasEgresosGlobal = useMemo(() => {
    const cats: Record<string, number> = {}
    for (const d of detalleEgresos) {
      cats[d.categoria_principal] = (cats[d.categoria_principal] || 0) + d.monto
    }
    return Object.entries(cats).sort((a, b) => b[1] - a[1])
  }, [detalleEgresos])

  const formatMoney = (val: number) => `$${val.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`


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
                <h1 className="text-xl font-semibold text-gray-900">Informe Económico Anual</h1>
                <p className="text-xs text-gray-500">Presupuesto e Informe de Ingresos y Egresos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={String(anioSeleccionado)} onValueChange={(v) => setAnioSeleccionado(Number(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aniosDisponibles.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">


        {/* Tarjetas resumen con barras de proporción */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-green-200 bg-green-50/30">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Total Ingresos {anioSeleccionado}</p>
                  <p className="text-2xl font-bold text-green-800">{formatMoney(totales.ingresos)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
              {totales.ingresos + totales.egresos > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-green-600 mb-1">
                    <span>Proporción del total</span>
                    <span>{((totales.ingresos / (totales.ingresos + totales.egresos)) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-green-100 rounded-full h-2">
                    <div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${(totales.ingresos / (totales.ingresos + totales.egresos)) * 100}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>


          <Card className="border-red-200 bg-red-50/30">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Total Egresos {anioSeleccionado}</p>
                  <p className="text-2xl font-bold text-red-800">{formatMoney(totales.egresos)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-400" />
              </div>
              {totales.ingresos + totales.egresos > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-red-600 mb-1">
                    <span>Proporción del total</span>
                    <span>{((totales.egresos / (totales.ingresos + totales.egresos)) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-red-100 rounded-full h-2">
                    <div className="h-2 bg-red-500 rounded-full transition-all" style={{ width: `${(totales.egresos / (totales.ingresos + totales.egresos)) * 100}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>


          <Card className={totales.diferencia >= 0 ? "border-blue-200 bg-blue-50/30" : "border-orange-200 bg-orange-50/30"}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Diferencia</p>
                  <p className={`text-2xl font-bold ${totales.diferencia >= 0 ? "text-blue-800" : "text-orange-800"}`}>{formatMoney(totales.diferencia)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-gray-400" />
              </div>
              {totales.ingresos > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Ingresos vs Egresos</span>
                    <span>{totales.ingresos > 0 ? ((totales.egresos / totales.ingresos) * 100).toFixed(0) : 0}% gastado</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 bg-green-500 rounded-full" style={{ width: `${Math.min((totales.ingresos / Math.max(totales.ingresos, totales.egresos)) * 100, 100)}%` }} />
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-1 overflow-hidden">
                    <div className="h-2 bg-red-500 rounded-full" style={{ width: `${Math.min((totales.egresos / Math.max(totales.ingresos, totales.egresos)) * 100, 100)}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>


        <Tabs defaultValue="resumen" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
          </TabsList>

          {/* TAB RESUMEN */}
          <TabsContent value="resumen" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumen de Ingresos y Egresos — {anioSeleccionado}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Cargando datos...</div>
                ) : resumenMensual.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay datos para el año {anioSeleccionado}</div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/80">
                          <TableHead className="font-semibold">Mes</TableHead>
                          <TableHead className="font-semibold text-right">Ingresos</TableHead>
                          <TableHead className="font-semibold text-right">Egresos</TableHead>
                          <TableHead className="font-semibold text-right">Diferencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resumenMensual.map((m) => (
                          <TableRow key={m.mes} className="hover:bg-gray-50/50">
                            <TableCell className="font-medium">{m.nombre}</TableCell>
                            <TableCell className="text-right text-green-700 font-medium">{formatMoney(m.ingresos)}</TableCell>
                            <TableCell className="text-right text-red-700 font-medium">{formatMoney(m.egresos)}</TableCell>
                            <TableCell className={`text-right font-bold ${m.diferencia >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                              {formatMoney(m.diferencia)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-100 font-bold border-t-2">
                          <TableCell className="font-bold text-gray-900">TOTAL ANUAL</TableCell>
                          <TableCell className="text-right text-green-800 font-bold">{formatMoney(totales.ingresos)}</TableCell>
                          <TableCell className="text-right text-red-800 font-bold">{formatMoney(totales.egresos)}</TableCell>
                          <TableCell className={`text-right font-bold ${totales.diferencia >= 0 ? "text-blue-800" : "text-orange-800"}`}>
                            {formatMoney(totales.diferencia)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* TAB DETALLE - Sub-tabs Ingresos / Egresos */}
          <TabsContent value="detalle" className="space-y-4">
            <Tabs defaultValue="detalle-ingresos" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="detalle-ingresos" className="text-green-700 data-[state=active]:bg-green-50">Ingresos</TabsTrigger>
                <TabsTrigger value="detalle-egresos" className="text-red-700 data-[state=active]:bg-red-50">Egresos</TabsTrigger>
              </TabsList>

              {/* Sub-tab INGRESOS */}
              <TabsContent value="detalle-ingresos" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-green-800">Ingresos Resumidos por Mes — {anioSeleccionado}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-gray-500">Cargando datos...</div>
                    ) : ingresosResumidoPorMes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">No hay ingresos registrados para {anioSeleccionado}</div>
                    ) : (
                      <div className="space-y-4">
                        {ingresosResumidoPorMes.map((mesData) => (
                          <div key={mesData.mes} className="rounded-md border border-green-200">
                            <div className="bg-green-50 px-4 py-2.5 flex items-center justify-between border-b border-green-200">
                              <span className="font-semibold text-sm text-gray-900">{mesData.nombre}</span>
                              <Badge className="font-bold bg-green-100 text-green-800 hover:bg-green-100">{formatMoney(mesData.total)}</Badge>
                            </div>
                            <div className="divide-y">
                              {Object.entries(mesData.categorias)
                                .sort((a, b) => b[1] - a[1])
                                .map(([categoria, monto]) => (
                                  <div key={categoria} className="flex items-center justify-between px-4 py-2 hover:bg-green-50/30">
                                    <span className="text-sm text-gray-700">{categoria}</span>
                                    <span className="text-sm font-medium text-green-700">{formatMoney(monto)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                        <div className="rounded-md border-2 border-green-300 bg-green-50 px-4 py-3 flex items-center justify-between">
                          <span className="font-bold text-gray-900">TOTAL INGRESOS {anioSeleccionado}</span>
                          <span className="font-bold text-green-800 text-lg">{formatMoney(totales.ingresos)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>


              {/* Sub-tab EGRESOS */}
              <TabsContent value="detalle-egresos" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-red-800">Egresos Resumidos por Mes — {anioSeleccionado}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-gray-500">Cargando datos...</div>
                    ) : egresosResumidoPorMes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">No hay egresos registrados para {anioSeleccionado}</div>
                    ) : (
                      <div className="space-y-4">
                        {egresosResumidoPorMes.map((mesData) => (
                          <div key={mesData.mes} className="rounded-md border border-red-200">
                            <div className="bg-red-50 px-4 py-2.5 flex items-center justify-between border-b border-red-200">
                              <span className="font-semibold text-sm text-gray-900">{mesData.nombre}</span>
                              <Badge className="font-bold bg-red-100 text-red-800 hover:bg-red-100">{formatMoney(mesData.total)}</Badge>
                            </div>
                            <div className="divide-y">
                              {Object.entries(mesData.categorias)
                                .sort((a, b) => b[1] - a[1])
                                .map(([categoria, monto]) => (
                                  <div key={categoria} className="flex items-center justify-between px-4 py-2 hover:bg-red-50/30">
                                    <span className="text-sm text-gray-700">{categoria}</span>
                                    <span className="text-sm font-medium text-red-700">{formatMoney(monto)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                        <div className="rounded-md border-2 border-red-300 bg-red-50 px-4 py-3 flex items-center justify-between">
                          <span className="font-bold text-gray-900">TOTAL EGRESOS {anioSeleccionado}</span>
                          <span className="font-bold text-red-800 text-lg">{formatMoney(totales.egresos)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>


          {/* TAB ESTADÍSTICAS */}
          <TabsContent value="estadisticas" className="space-y-4">
            {/* Gráfico de barras - Ingresos por categoría */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-green-600" />
                  Ingresos por Categoría — {anioSeleccionado}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Cargando datos...</div>
                ) : categoriasIngresosGlobal.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay datos de ingresos</div>
                ) : (
                  <div className="space-y-3">
                    {categoriasIngresosGlobal.map(([cat, monto], idx) => {
                      const maxVal = categoriasIngresosGlobal[0][1]
                      const porcentaje = totales.ingresos > 0 ? ((monto / totales.ingresos) * 100).toFixed(1) : "0"
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 truncate max-w-[45%]">{cat}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500 text-xs">{porcentaje}%</span>
                              <span className="font-semibold text-green-800 w-28 text-right">{formatMoney(monto)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-4">
                            <div
                              className={`h-4 rounded-full transition-all ${COLORES_INGRESOS[idx % COLORES_INGRESOS.length]}`}
                              style={{ width: `${(monto / maxVal) * 100}%`, minWidth: "6px" }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    <div className="pt-3 border-t flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900">Total Ingresos</span>
                      <span className="font-bold text-green-800">{formatMoney(totales.ingresos)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>


            {/* Gráfico de barras - Egresos por categoría */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-red-600" />
                  Egresos por Categoría — {anioSeleccionado}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Cargando datos...</div>
                ) : categoriasEgresosGlobal.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay datos de egresos</div>
                ) : (
                  <div className="space-y-3">
                    {categoriasEgresosGlobal.map(([cat, monto], idx) => {
                      const maxVal = categoriasEgresosGlobal[0][1]
                      const porcentaje = totales.egresos > 0 ? ((monto / totales.egresos) * 100).toFixed(1) : "0"
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 truncate max-w-[45%]">{cat}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500 text-xs">{porcentaje}%</span>
                              <span className="font-semibold text-red-800 w-28 text-right">{formatMoney(monto)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-4">
                            <div
                              className={`h-4 rounded-full transition-all ${COLORES_EGRESOS[idx % COLORES_EGRESOS.length]}`}
                              style={{ width: `${(monto / maxVal) * 100}%`, minWidth: "6px" }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    <div className="pt-3 border-t flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900">Total Egresos</span>
                      <span className="font-bold text-red-800">{formatMoney(totales.egresos)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>


            {/* Comparativa mensual */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="w-4 h-4" />
                  Comparativa Mensual — {anioSeleccionado}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Cargando datos...</div>
                ) : resumenMensual.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay datos para graficar</div>
                ) : (
                  <div className="space-y-3">
                    {resumenMensual.map((m) => {
                      const maxVal = Math.max(...resumenMensual.map(x => Math.max(x.ingresos, x.egresos)), 1)
                      return (
                        <div key={m.mes} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span className="font-medium w-20">{m.nombre.slice(0, 3)}</span>
                            <div className="flex gap-4">
                              <span className="text-green-700">{formatMoney(m.ingresos)}</span>
                              <span className="text-red-700">{formatMoney(m.egresos)}</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <div className="h-4 bg-green-500 rounded-sm transition-all" style={{ width: `${(m.ingresos / maxVal) * 100}%`, minWidth: m.ingresos > 0 ? "4px" : "0" }} />
                          </div>
                          <div className="flex gap-1">
                            <div className="h-4 bg-red-500 rounded-sm transition-all" style={{ width: `${(m.egresos / maxVal) * 100}%`, minWidth: m.egresos > 0 ? "4px" : "0" }} />
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-center gap-6 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded-sm" />
                        <span className="text-sm text-gray-600">Ingresos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded-sm" />
                        <span className="text-sm text-gray-600">Egresos</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}


export default function PresupuestoAnualPage() {
  return (
    <PermissionsGuard moduleName="presupuesto_anual">
      {(canEdit) => <PresupuestoAnualContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
