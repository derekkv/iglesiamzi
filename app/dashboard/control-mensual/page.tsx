"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useMonth } from "@/contexts/month-context"

export default function ControlMensualPage() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const { currentMonth, monthHistory, startNewMonth, closeCurrentMonth } = useMonth()
  const [selectedDate, setSelectedDate] = useState("")
  const [monthName, setMonthName] = useState("")

  useEffect(() => {
    const userData = localStorage.getItem("churchUser")
    if (!userData) {
      router.push("/")
      return
    }
    setUser(JSON.parse(userData))

    const now = new Date()
    setSelectedDate(now.toISOString().split("T")[0])
    setMonthName(`${now.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`)
  }, [router])

  const handleStartNewMonth = () => {
    if (selectedDate && monthName.trim()) {
      startNewMonth()
    }
  }

  const handleCloseMonth = () => {
    if (selectedDate) {
      closeCurrentMonth()
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
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                ← Volver al Dashboard
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Control Mensual</h1>
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              {currentMonth?.name || "Sin mes activo"}
            </Badge>
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
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleStartNewMonth}>
                      Iniciar Nuevo Mes
                    </Button>

                    <Button variant="outline" className="w-full bg-transparent" onClick={handleCloseMonth}>
                      Cerrar Mes Actual
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Alert>
                    <AlertDescription>
                      No hay un mes activo. Inicie un nuevo mes para comenzar a trabajar.
                    </AlertDescription>
                  </Alert>
                  <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleStartNewMonth}>
                    Crear Nuevo Mes
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

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
                            <Badge variant="secondary" className="bg-red-100">{month.status === "closed" ? "Cerrado" : "Activo"}</Badge>
                            <Button size="sm" variant="outline" onClick={() => viewMonthDetails(month)}>
                              Ver
                            </Button>
                          </div>
                        </div>
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
      </main>
    </div>
  )
}
