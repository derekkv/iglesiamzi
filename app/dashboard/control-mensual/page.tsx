"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useMonth } from "@/contexts/month-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/secure-db"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { useRestrictedAccess } from "@/hooks/use-restricted-access"
import { currentMonthNameEcuador, todayEcuador, currentMonthEcuador, currentYearEcuador } from "@/lib/timezone"
import { getAlfoliMes } from "@/lib/mod/alfoli-service"

import { Lock, ArrowLeft, TrendingUp, TrendingDown, Users, DollarSign, ChevronDown, ChevronRight, ExternalLink } from "lucide-react"

function ControlMensualContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { currentMonth, monthHistory, startNewMonth, closeCurrentMonth } = useMonth()
  const { user } = useAuth()

  // Resumen financiero y asistencia
  const [ingresos, setIngresos] = useState<any[]>([])
  const [egresos, setEgresos] = useState<any[]>([])
  const [asistenciaColumns, setAsistenciaColumns] = useState<any[]>([])
  const [asistenciaDetails, setAsistenciaDetails] = useState<any[]>([])
  const [asistenciaData, setAsistenciaData] = useState<any[]>([])
  const [nominaRecords, setNominaRecords] = useState<any[]>([])
  const [pagoDiarioRecords, setPagoDiarioRecords] = useState<any[]>([])
  const [totalCelulas, setTotalCelulas] = useState(0)
  const [totalAlfoli, setTotalAlfoli] = useState(0)
  const { hasAccess: hasNominaAccess } = useRestrictedAccess("nomina")

  // Acordeones
  const [openIngresos, setOpenIngresos] = useState(false)
  const [openEgresos, setOpenEgresos] = useState(false)
  const [openAsistencia, setOpenAsistencia] = useState(false)
  const [openNomina, setOpenNomina] = useState(false)

  // Auto apertura/cierre de mes
  const autoManageRef = useRef(false)
  const hasAutoManagedRef = useRef(false)

  useEffect(() => {
    // Solo ejecutar una vez cuando se monta y hay datos cargados
    if (!canEdit || !user) return
    // Solo ejecutar una vez por montaje del componente
    if (hasAutoManagedRef.current) return
    autoManageMonth()
  }, [currentMonth, canEdit, user])

  const autoManageMonth = async () => {
    // Prevenir ejecuciones simultáneas
    if (autoManageRef.current) return
    if (!canEdit) return

    const mesActual = currentMonthEcuador()
    const anioActual = currentYearEcuador()

    // Si hay mes activo y es el mes correcto, no hacer nada
    if (currentMonth && currentMonth.month === mesActual && currentMonth.year === anioActual) {
      hasAutoManagedRef.current = true
      return
    }

    // Si hay mes activo pero es de otro mes, cerrarlo
    if (currentMonth && (currentMonth.month !== mesActual || currentMonth.year !== anioActual)) {
      autoManageRef.current = true
      hasAutoManagedRef.current = true
      try {
        await closeCurrentMonth(todayEcuador())
      } catch (e) { console.error("Error auto-cerrando mes:", e) }
      finally { autoManageRef.current = false }
    }
    // No crear automáticamente — dejar que el usuario lo haga desde el dashboard
  }

  // Cargar resumen del mes
  useEffect(() => {
    if (currentMonth?.id) loadSummary()
  }, [currentMonth])

  const loadSummary = async () => {
    if (!currentMonth?.id) return
    try {
      const [ingRes, egRes, colRes, detRes, datRes, nomRes, pdRes] = await Promise.all([
        supabase.from("ingresos").select("*").eq("mes_id", currentMonth.id),
        supabase.from("egresos").select("*").eq("mes_id", currentMonth.id),
        supabase.from("asistencia_columnas").select("*").eq("mes_id", currentMonth.id).order("orden"),
        supabase.from("asistencia_detalles").select("*").eq("mes_id", currentMonth.id).order("orden"),
        supabase.from("asistencia_datos").select("*").eq("mes_id", currentMonth.id),
        supabase.from("nomina").select("*").eq("mes_id", currentMonth.id),
        supabase.from("pago_diario").select("*").eq("mes_id", currentMonth.id),
      ])
      setIngresos(ingRes.data || [])
      setEgresos(egRes.data || [])
      setAsistenciaColumns(colRes.data || [])
      setAsistenciaDetails(detRes.data || [])
      setAsistenciaData(datRes.data || [])
      setNominaRecords(nomRes.data || [])
      setPagoDiarioRecords(pdRes.data || [])

      // Cargar totales consolidados (células + alfolí)
      const monthNum = currentMonth.month
      const yearNum = currentMonth.year

      const alfoliRecords = await getAlfoliMes(monthNum, yearNum)
      setTotalAlfoli(alfoliRecords.reduce((sum, r) => sum + Number(r.valor), 0))

      const { data: celulasData } = await supabase
        .from("ofrendas_celulas")
        .select("valor")
        .eq("mes", monthNum)
        .eq("anio", yearNum)
        .eq("recibido", true)
      setTotalCelulas((celulasData || []).reduce((sum: number, r: any) => sum + Number(r.valor), 0))
    } catch (error) {
      console.error("Error cargando resumen:", error)
    }
  }

  useRealtimeMultiple(["ingresos", "egresos", "asistencia_columnas", "asistencia_datos", "nomina", "pago_diario"], () => loadSummary())

  // Cálculos
  const totalIngresosModulo = ingresos.reduce((sum, r) => sum + Number(r.monto || 0), 0)
  const totalIngresos = totalIngresosModulo + totalCelulas + totalAlfoli
  const totalEgresos = egresos.reduce((sum, r) => sum + Number(r.monto || 0), 0)
  const totalPagoDiario = pagoDiarioRecords.reduce((sum: number, r: any) => sum + Number(r.valor || 0), 0)
  const totalNominaAPagar = nominaRecords.reduce((s: number, r: any) => s + Number(r.valor_a_pagar || 0), 0)
  const totalNominaPagado = nominaRecords.reduce((s: number, r: any) => {
    let pagado = 0
    if (r.primera_quincena_pagada) pagado += Number(r.primera_quincena_valor || 0)
    if (r.segunda_quincena_pagada) pagado += Number(r.segunda_quincena_valor || 0)
    return s + pagado
  }, 0)
  const totalTodoPagado = totalEgresos + totalPagoDiario

  // Ingresos por categoría
  const ingresosPorCategoria = ingresos.reduce((acc, r) => {
    const cat = r.categoria_principal || "Sin categoría"
    acc[cat] = (acc[cat] || 0) + Number(r.monto || 0)
    return acc
  }, {} as Record<string, number>)

  // Egresos por categoría
  const egresosPorCategoria = egresos.reduce((acc, r) => {
    const cat = r.categoria_principal || "Sin categoría"
    acc[cat] = (acc[cat] || 0) + Number(r.monto || 0)
    return acc
  }, {} as Record<string, number>)

  // Asistencia
  const getColumnTotal = (colId: number) => asistenciaData.filter((d: any) => d.columna_id === colId).reduce((sum: number, d: any) => sum + (d.cantidad || 0), 0)
  const totalAsistencia = asistenciaData.reduce((s: number, d: any) => s + (d.cantidad || 0), 0)

  function formatDateForTable(dateString: string) {
    if (!dateString) return ""
    const date = new Date(dateString)
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`
  }

  if (!user) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div></div>
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
              <h1 className="text-xl font-semibold text-gray-900">Control Mensual</h1>
            </div>
            <div className="flex items-center space-x-3">
              {!canEdit && <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full"><Lock className="w-3 h-3" /> Solo lectura</span>}
              <Badge variant="outline" className="text-blue-600 border-blue-200">{currentMonthNameEcuador()}</Badge>
              {currentMonth && <Badge className="bg-green-100 text-green-800 border-green-200">Activo</Badge>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Info del mes */}
        {currentMonth ? (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{currentMonth.name}</h2>
                  <p className="text-sm text-gray-600">Inicio: {formatDateForTable(currentMonth.start_date)} · El mes se gestiona automáticamente</p>
                </div>
                <Badge className="bg-green-600 text-white">Activo</Badge>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert><AlertDescription>No hay mes activo. Se creará automáticamente.</AlertDescription></Alert>
        )}

        {/* Tarjetas de resumen */}
        {currentMonth && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-green-200 bg-green-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/ingresos-egresos")}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-700">Ingresos</p>
                      <p className="text-xl font-bold text-green-700">${totalIngresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] text-green-600 mt-0.5">Incluye células, alfolí y diezmos</p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/ingresos-egresos")}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-red-700">Egresos</p>
                      <p className="text-xl font-bold text-red-700">${totalEgresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <TrendingDown className="w-6 h-6 text-red-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/flujo-pago")}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-700">Nómina (a pagar)</p>
                      <p className="text-xl font-bold text-amber-700">${totalNominaAPagar.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <DollarSign className="w-6 h-6 text-amber-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/asistencia")}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-700">Asistencia Total</p>
                      <p className="text-xl font-bold text-purple-700">{totalAsistencia}</p>
                      <div className="flex gap-3 mt-1">
                        <p className="text-[10px] text-purple-600">{asistenciaColumns.length} días registrados</p>
                        <p className="text-[10px] text-purple-600">Promedio: {asistenciaColumns.length > 0 ? Math.round(totalAsistencia / asistenciaColumns.length) : 0}/día</p>
                      </div>
                    </div>
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Acordeones */}
            <div className="space-y-3">
              {/* INGRESOS */}
              <Card className="overflow-hidden">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenIngresos(!openIngresos)}>
                  <div className="flex items-center gap-3">
                    {openIngresos ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-gray-900">Ingresos por Categoría</span>
                    <Badge className="bg-green-100 text-green-800 text-xs">{ingresos.length} registros</Badge>
                  </div>
                  <span className="font-bold text-green-700">${totalIngresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                </button>
                {openIngresos && (
                  <CardContent className="pt-0 pb-4 border-t">
                    <div className="space-y-2 mt-3">
                      {(Object.entries(ingresosPorCategoria) as [string, number][]).sort(([, a], [, b]) => b - a).map(([cat, monto]) => (
                        <div key={cat} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-700">{cat}</span>
                          <span className="text-sm font-semibold text-green-700">${monto.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="mt-3 text-green-700" onClick={() => router.push("/dashboard/ingresos-egresos")}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Ir a Ingresos y Egresos
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* EGRESOS */}
              <Card className="overflow-hidden">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenEgresos(!openEgresos)}>
                  <div className="flex items-center gap-3">
                    {openEgresos ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <TrendingDown className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-gray-900">Egresos por Categoría</span>
                    <Badge className="bg-red-100 text-red-800 text-xs">{egresos.length} registros</Badge>
                  </div>
                  <span className="font-bold text-red-700">${totalEgresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                </button>
                {openEgresos && (
                  <CardContent className="pt-0 pb-4 border-t">
                    <div className="space-y-2 mt-3">
                      {(Object.entries(egresosPorCategoria) as [string, number][]).sort(([, a], [, b]) => b - a).map(([cat, monto]) => (
                        <div key={cat} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-700">{cat}</span>
                          <span className="text-sm font-semibold text-red-700">${monto.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="mt-3 text-red-700" onClick={() => router.push("/dashboard/ingresos-egresos")}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Ir a Ingresos y Egresos
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* ASISTENCIA */}
              <Card className="overflow-hidden">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenAsistencia(!openAsistencia)}>
                  <div className="flex items-center gap-3">
                    {openAsistencia ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <Users className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-gray-900">Asistencia</span>
                    <Badge className="bg-purple-100 text-purple-800 text-xs">{asistenciaColumns.length} días</Badge>
                  </div>
                  <span className="font-bold text-purple-700">{totalAsistencia} personas</span>
                </button>
                {openAsistencia && (
                  <CardContent className="pt-0 pb-4 border-t">
                    {asistenciaColumns.length > 0 ? (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-3">
                          {asistenciaColumns.map((col: any) => (
                            <div key={col.id} className="text-center p-2 bg-purple-50 rounded-lg border border-purple-100">
                              <p className="text-[10px] text-purple-600 font-medium">{col.nombre}</p>
                              <p className="text-lg font-bold text-purple-800">{getColumnTotal(col.id)}</p>
                            </div>
                          ))}
                        </div>
                        <Button variant="ghost" size="sm" className="mt-3 text-purple-700" onClick={() => router.push("/dashboard/asistencia")}>
                          <ExternalLink className="w-3 h-3 mr-1" /> Ir a Asistencia
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4 mt-3">Sin datos de asistencia</p>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* NÓMINA */}
              {hasNominaAccess && (
                <Card className="overflow-hidden">
                  <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenNomina(!openNomina)}>
                    <div className="flex items-center gap-3">
                      {openNomina ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span className="text-xl">💰</span>
                      <span className="font-semibold text-gray-900">Nómina</span>
                      <Badge className="bg-amber-100 text-amber-800 text-xs">{nominaRecords.length} personas</Badge>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-amber-700">${totalNominaAPagar.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                      <p className="text-[10px] text-green-600">Pagado: ${totalNominaPagado.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </button>
                  {openNomina && (
                    <CardContent className="pt-0 pb-4 border-t">
                      {(() => {
                        const pendientes1ra = nominaRecords.filter((r: any) => !r.primera_quincena_pagada && !(Number(r.movilizacion_valor || 0) > 0 && !r.movilizacion_con_quincenas))
                        const pendientes2da = nominaRecords.filter((r: any) => !r.segunda_quincena_pagada && !(Number(r.movilizacion_valor || 0) > 0 && !r.movilizacion_con_quincenas))
                        const pendientesTransporte = nominaRecords.filter((r: any) => (Number(r.movilizacion_valor || 0) > 0 || r.movilizacion_pagada) && !r.movilizacion_pagada)
                        const totalTransportePagado = nominaRecords.reduce((s: number, r: any) => s + (r.movilizacion_pagada ? Number(r.movilizacion_valor || 0) : 0) + (r.movilizacion_segunda_pagada ? Number(r.movilizacion_segunda_valor || 0) : 0), 0)
                        return (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                              <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <p className="text-xs text-amber-600">Total a Pagar</p>
                                <p className="text-lg font-bold text-amber-800">${totalNominaAPagar.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                                <p className="text-xs text-green-600">Pagado Quincenas</p>
                                <p className="text-lg font-bold text-green-800">${totalNominaPagado.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
                                <p className="text-xs text-purple-600">Transporte Pagado</p>
                                <p className="text-lg font-bold text-purple-800">${totalTransportePagado.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
                                <p className="text-xs text-red-600">Pendiente Total</p>
                                <p className="text-lg font-bold text-red-800">${(totalNominaAPagar - totalNominaPagado).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>

                            {/* Pendientes por categoría */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                              {pendientes1ra.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-blue-700 mb-2">Falta 1ra Quincena ({pendientes1ra.length})</p>
                                  <div className="space-y-1">
                                    {pendientes1ra.map((r: any) => (
                                      <div key={r.id} className="flex justify-between text-xs">
                                        <span className="text-gray-700 truncate">{r.nombre}</span>
                                        <span className="text-blue-700 font-medium">${(Number(r.valor_a_pagar || 0) / 2).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {pendientes2da.length > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-green-700 mb-2">Falta 2da Quincena ({pendientes2da.length})</p>
                                  <div className="space-y-1">
                                    {pendientes2da.map((r: any) => (
                                      <div key={r.id} className="flex justify-between text-xs">
                                        <span className="text-gray-700 truncate">{r.nombre}</span>
                                        <span className="text-green-700 font-medium">${(Number(r.valor_a_pagar || 0) / 2).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {pendientesTransporte.length > 0 && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-purple-700 mb-2">Falta Transporte ({pendientesTransporte.length})</p>
                                  <div className="space-y-1">
                                    {pendientesTransporte.map((r: any) => (
                                      <div key={r.id} className="flex justify-between text-xs">
                                        <span className="text-gray-700 truncate">{r.nombre}</span>
                                        <span className="text-purple-700 font-medium">${Number(r.movilizacion_valor || 0).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {pendientes1ra.length === 0 && pendientes2da.length === 0 && pendientesTransporte.length === 0 && (
                              <p className="text-sm text-green-600 text-center mt-4 font-medium">Toda la nómina está al día</p>
                            )}

                            <Button variant="ghost" size="sm" className="mt-3 text-amber-700" onClick={() => router.push("/dashboard/flujo-pago")}>
                              <ExternalLink className="w-3 h-3 mr-1" /> Ir a Flujo de Pago
                            </Button>
                          </>
                        )
                      })()}
                    </CardContent>
                  )}
                </Card>
              )}
            </div>

            {/* Historial */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">📚 Historial de Meses</CardTitle>
              </CardHeader>
              <CardContent>
                {monthHistory.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {monthHistory.map((month) => (
                      <div key={month.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-sm">{month.name}</p>
                          <p className="text-xs text-gray-500">{formatDateForTable(month.start_date)} - {month.end_date ? formatDateForTable(month.end_date) : "Activo"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{month.status === "closed" ? "Cerrado" : "Activo"}</Badge>
                          <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/mes/${month.id}`)}>Ver</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">Sin historial</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

export default function ControlMensualPage() {
  return (
    <PermissionsGuard moduleName="control_mensual">
      {(canEdit) => <ControlMensualContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
