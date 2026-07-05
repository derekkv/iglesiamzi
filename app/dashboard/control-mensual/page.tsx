"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useMonth } from "@/contexts/month-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import { EditMonthModal } from "@/components/EditMonthModal"
import { CreateMonthModal } from "@/components/CreateMonthModal"
import { CloseMonthModal } from "@/components/CloseMonthModal"
import { supabase } from "@/lib/supabase"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { useRestrictedAccess } from "@/hooks/use-restricted-access"
import { currentMonthNameEcuador } from "@/lib/timezone"

import { Lock, ArrowLeft, TrendingUp, TrendingDown, Users, DollarSign } from "lucide-react"

function ControlMensualContent({ canEdit }: { canEdit: boolean }) {

  const router = useRouter()
  const { currentMonth, monthHistory, startNewMonth, closeCurrentMonth, editMonthDates, deleteMonth } = useMonth()
  const [selectedDate, setSelectedDate] = useState("")
  const [monthName, setMonthName] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<any>(null)
const [openCreateModal, setOpenCreateModal] = useState(false)
const [openCloseModal, setOpenCloseModal] = useState(false)

  // Resumen financiero y asistencia
  const [ingresos, setIngresos] = useState<any[]>([])
  const [egresos, setEgresos] = useState<any[]>([])
  const [asistenciaColumns, setAsistenciaColumns] = useState<any[]>([])
  const [asistenciaDetails, setAsistenciaDetails] = useState<any[]>([])
  const [asistenciaData, setAsistenciaData] = useState<any[]>([])
  const [nominaRecords, setNominaRecords] = useState<any[]>([])
  const { hasAccess: hasNominaAccess } = useRestrictedAccess("nomina")

 const { user, isLoading } = useAuth()
  useEffect(() => {
    const now = new Date()
    setSelectedDate(now.toISOString().split("T")[0])
    setMonthName(`${now.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`)
  }, [router])

  // Cargar resumen del mes
  useEffect(() => {
    if (currentMonth?.id) loadSummary()
  }, [currentMonth])

  const loadSummary = async (silent = false) => {
    if (!currentMonth?.id) return
    try {
      const [ingRes, egRes, colRes, detRes, datRes, nomRes] = await Promise.all([
        supabase.from("ingresos").select("*").eq("mes_id", currentMonth.id),
        supabase.from("egresos").select("*").eq("mes_id", currentMonth.id),
        supabase.from("asistencia_columnas").select("*").eq("mes_id", currentMonth.id).order("orden"),
        supabase.from("asistencia_detalles").select("*").eq("mes_id", currentMonth.id).order("orden"),
        supabase.from("asistencia_datos").select("*").eq("mes_id", currentMonth.id),
        supabase.from("nomina").select("*").eq("mes_id", currentMonth.id),
      ])
      setIngresos(ingRes.data || [])
      setEgresos(egRes.data || [])
      setAsistenciaColumns(colRes.data || [])
      setAsistenciaDetails(detRes.data || [])
      setAsistenciaData(datRes.data || [])
      setNominaRecords(nomRes.data || [])
    } catch (error) {
      console.error("Error cargando resumen:", error)
    }
  }

  // Realtime
  useRealtimeMultiple(["ingresos", "egresos", "asistencia_columnas", "asistencia_datos", "nomina"], () => loadSummary(true))

  // Cálculos del resumen
  const totalIngresos = ingresos.reduce((sum, r) => sum + Number(r.monto || 0), 0)
  const totalEgresos = egresos.reduce((sum, r) => sum + Number(r.monto || 0), 0)
  const balance = totalIngresos - totalEgresos

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

  // Asistencia totales por columna
  const getColumnTotal = (colId: number) => {
    return asistenciaData.filter((d: any) => d.columna_id === colId).reduce((sum: number, d: any) => sum + (d.cantidad || 0), 0)
  }

  const handleStartNewMonth = () => {
    if (selectedDate && monthName.trim()) {
    //  startNewMonth()
    }
  }

  const handleCloseMonth = () => {
    if (selectedDate) {
      //closeCurrentMonth()
    }
  }

  const viewMonthDetails = (month: any) => {
    router.push(`/dashboard/mes/${month.id}`)
  }


  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando..</p>
        </div>
      </div>
    )
  }

    function formatDateForTable(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`; // DD/MM/YYYY
}

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
              <h1 className="text-xl font-semibold text-gray-900">Control Mensual</h1>
            </div>
            <div className="flex items-center space-x-4">
              {!canEdit && (
                <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  <Lock className="w-3 h-3" /> Solo lectura
                </span>
              )}
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                {currentMonthNameEcuador()}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Estado del Mes Actual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>📊</span>
                <span>Estado del Mes Actual</span>
              </CardTitle>
              <CardDescription>Información y control del período activo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentMonth ? (
                <>
                  <div className="space-y-2">
                    <p>
                      <strong>Mes:</strong> {currentMonth.name}
                    </p>
                    <p>
                      <strong>Fecha de inicio:</strong> { formatDateForTable(currentMonth.start_date)}
                    </p>
                    <p>
                      <strong>Estado:</strong>
                      <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">Activo</Badge>
                    </p>
                  </div>

              {/*    <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{currentMonth.data.ingresos?.length || 0}</p>
                      <p className="text-sm text-gray-600">Ingresos</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{currentMonth.data.egresos?.length || 0}</p>
                      <p className="text-sm text-gray-600">Egresos</p>
                    </div>
                  </div>*/}

                  <div className="space-y-2 mt-6">
                    {canEdit && (
                      <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setOpenCreateModal(true)}>
                        Iniciar Nuevo Mes
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="outline" className="w-full bg-transparent" onClick={() => setOpenCloseModal(true)}>
                        Cerrar Mes Actual
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Alert>
                    <AlertDescription>
                      No hay un mes activo. Inicie un nuevo mes para comenzar a trabajar.
                    </AlertDescription>
                  </Alert>
                  {canEdit && (
                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setOpenCreateModal(true)}>
                      Crear Nuevo Mes
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          <CloseMonthModal open={openCloseModal} setOpen={setOpenCloseModal} />

<CreateMonthModal open={openCreateModal} setOpen={setOpenCreateModal} />
          {/* Historial de Meses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>📚</span>
                <span>Historial de Meses</span>
              </CardTitle>
              <CardDescription>Meses anteriores y sus datos</CardDescription>
            </CardHeader>
            <CardContent>
              {monthHistory.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {monthHistory
                    .slice()
              
                    .map((month) => (
                      <div key={month.id} className="p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{month.name}</p>
                            <p className="text-sm text-gray-600">
                              {formatDateForTable(month.start_date)} - {month.end_date ? formatDateForTable(month.end_date) : "Activo"}
                            </p>
                          </div>
                <div className="flex items-center space-x-2">
  <Badge variant="secondary" className="bg-red-100">
    {month.status === "closed" ? "Cerrado" : "Activo"}
  </Badge>

  <Button size="sm" variant="outline" onClick={() => viewMonthDetails(month)}>
    Ver
  </Button>

  {/* Nuevo: Editar
  <Button
    size="sm"
    variant="secondary"
    className="bg-yellow-200"
    onClick={() => {
    setSelectedMonth(month)
    setIsEditing(true)
  }}
  >
    Editar
  </Button>
 


<Button
  size="sm"
  variant="destructive"
  onClick={async () => {
    await deleteMonth(month.id)
    toast("🗑 Mes eliminado")
  }}
>
  Eliminar
</Button>
*/}
</div>


                        </div>
                        {selectedMonth && (
  <EditMonthModal
    month={selectedMonth}
    open={isEditing}
    setOpen={setIsEditing}
  />
)}
                               {/*   <div className="flex space-x-4 mt-2 text-sm">
                          <span className="text-blue-600">Ingresos: {month?.data?.ingresos?.length || 0}</span>
                          <span className="text-red-600">Egresos: {month?.data?.egresos?.length || 0}</span>
                          <span className="text-green-600">Diezmos: {month?.data?.diezmos?.length || 0}</span>
                        </div> */}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No hay meses en el historial</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== RESUMEN DEL MES ===== */}
        {currentMonth && (
          <div className="mt-8 space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Resumen del Mes: {currentMonth.name}</h2>

            {/* Cards de resumen financiero */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700">Total Ingresos</p>
                      <p className="text-2xl font-bold text-green-700">${totalIngresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-xs text-green-600 mt-1">{ingresos.length} registros</p>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-700">Total Egresos</p>
                      <p className="text-2xl font-bold text-red-700">${totalEgresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <TrendingDown className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-xs text-red-600 mt-1">{egresos.length} registros</p>
                </CardContent>
              </Card>

              <Card className={`border-${balance >= 0 ? "blue" : "amber"}-200 bg-${balance >= 0 ? "blue" : "amber"}-50/50`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">Balance</p>
                      <p className={`text-2xl font-bold ${balance >= 0 ? "text-blue-700" : "text-amber-700"}`}>
                        ${balance.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <DollarSign className={`w-8 h-8 ${balance >= 0 ? "text-blue-400" : "text-amber-400"}`} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{balance >= 0 ? "Superávit" : "Déficit"}</p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700">Días de Asistencia</p>
                      <p className="text-2xl font-bold text-purple-700">{asistenciaColumns.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-xs text-purple-600 mt-1">
                    Promedio: {asistenciaColumns.length > 0
                      ? Math.round(asistenciaData.reduce((s: number, d: any) => s + (d.cantidad || 0), 0) / asistenciaColumns.length)
                      : 0} personas/día
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Desglose por categoría */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ingresos por categoría */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Ingresos por Categoría
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(ingresosPorCategoria).length > 0 ? (
                    <div className="space-y-2">
                      {(Object.entries(ingresosPorCategoria) as [string, number][])
                        .sort(([, a], [, b]) => b - a)
                        .map(([cat, monto]) => (
                          <div key={cat} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                            <span className="text-sm text-gray-700">{cat}</span>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-green-700">
                                ${monto.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-gray-400 ml-2">
                                ({totalIngresos > 0 ? Math.round((monto / totalIngresos) * 100) : 0}%)
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">Sin ingresos registrados</p>
                  )}
                </CardContent>
              </Card>

              {/* Egresos por categoría */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    Egresos por Categoría
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(egresosPorCategoria).length > 0 ? (
                    <div className="space-y-2">
                      {(Object.entries(egresosPorCategoria) as [string, number][])
                        .sort(([, a], [, b]) => b - a)
                        .map(([cat, monto]) => (
                          <div key={cat} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                            <span className="text-sm text-gray-700">{cat}</span>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-red-700">
                                ${monto.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-gray-400 ml-2">
                                ({totalEgresos > 0 ? Math.round((monto / totalEgresos) * 100) : 0}%)
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">Sin egresos registrados</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Resumen de Asistencia */}
            {asistenciaColumns.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    Asistencia del Mes
                  </CardTitle>
                  <CardDescription>Total de asistencia por cada día registrado</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {asistenciaColumns.map((col: any) => {
                      const total = getColumnTotal(col.id)
                      return (
                        <div key={col.id} className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
                          <p className="text-xs text-purple-600 font-medium">{col.nombre}</p>
                          <p className="text-xl font-bold text-purple-800 mt-1">{total}</p>
                          <p className="text-xs text-gray-500">personas</p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Resumen por categoría de asistencia */}
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium text-gray-700 mb-2">Totales por categoría:</p>
                    <div className="space-y-1">
                      {asistenciaDetails.map((detail: any) => {
                        const detailTotal = asistenciaData
                          .filter((d: any) => d.detalle_id === detail.id)
                          .reduce((sum: number, d: any) => sum + (d.cantidad || 0), 0)
                        if (detailTotal === 0) return null
                        return (
                          <div key={detail.id} className="flex items-center justify-between py-1">
                            <span className="text-xs text-gray-600">{detail.nombre}</span>
                            <span className="text-xs font-semibold text-purple-700">{detailTotal}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resumen de Nómina (solo para usuarios con acceso) */}
            {hasNominaAccess && nominaRecords.length > 0 && (
              <Card className="border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>💰</span> Resumen de Nómina
                  </CardTitle>
                  <CardDescription>Estado de pagos de quincena del mes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <p className="text-xs text-amber-600">Total Nómina</p>
                      <p className="text-lg font-bold text-amber-800">
                        ${nominaRecords.reduce((s: number, r: any) => s + Number(r.valor), 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-600">Pagados 1ra Q.</p>
                      <p className="text-lg font-bold text-blue-800">
                        {nominaRecords.filter((r: any) => r.primera_quincena_pagada).length}/{nominaRecords.length}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs text-green-600">Pagados 2da Q.</p>
                      <p className="text-lg font-bold text-green-800">
                        {nominaRecords.filter((r: any) => r.segunda_quincena_pagada).length}/{nominaRecords.length}
                      </p>
                    </div>
                  </div>

                  {/* Pendientes */}
                  {(nominaRecords.some((r: any) => !r.primera_quincena_pagada) || nominaRecords.some((r: any) => !r.segunda_quincena_pagada)) && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Pagos pendientes:</p>
                      {nominaRecords.filter((r: any) => !r.primera_quincena_pagada).map((r: any) => (
                        <div key={`1q-${r.id}`} className="flex items-center justify-between py-1 px-3 bg-red-50 rounded text-sm">
                          <span>{r.nombre}</span>
                          <Badge variant="secondary" className="text-xs">1ra Quincena pendiente</Badge>
                        </div>
                      ))}
                      {nominaRecords.filter((r: any) => !r.segunda_quincena_pagada).map((r: any) => (
                        <div key={`2q-${r.id}`} className="flex items-center justify-between py-1 px-3 bg-orange-50 rounded text-sm">
                          <span>{r.nombre}</span>
                          <Badge variant="secondary" className="text-xs">2da Quincena pendiente</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
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
