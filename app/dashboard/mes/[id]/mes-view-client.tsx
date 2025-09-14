"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface MesViewClientProps {
  selectedMonth: any
}

export function MesViewClient({ selectedMonth }: MesViewClientProps) {
  const [activeModule, setActiveModule] = useState("overview")
  const router = useRouter()

  const modules = [
    { id: "overview", name: "Resumen", icon: "📊" },
    { id: "ingresos-egresos", name: "Ingresos y Egresos", icon: "💰" },
    { id: "diezmos", name: "Diezmos", icon: "🙏" },
    { id: "asistencia", name: "Estadísticas", icon: "📈" },
    { id: "discipulado", name: "Discipulado", icon: "👥" },
  ]

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Ingresos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            $
            {(selectedMonth.data.ingresos || [])
              .reduce((sum: number, item: any) => sum + item.valor, 0)
              .toLocaleString()}
          </div>
          <p className="text-xs text-gray-500">{(selectedMonth.data.ingresos || []).length} registros</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Egresos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            $
            {(selectedMonth.data.egresos || [])
              .reduce((sum: number, item: any) => sum + item.valor, 0)
              .toLocaleString()}
          </div>
          <p className="text-xs text-gray-500">{(selectedMonth.data.egresos || []).length} registros</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Diezmos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            $
            {(selectedMonth.data.diezmos || [])
              .reduce((sum: number, item: any) => sum + item.valor, 0)
              .toLocaleString()}
          </div>
          <p className="text-xs text-gray-500">{(selectedMonth.data.diezmos || []).length} registros</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Participantes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            {(selectedMonth.data.discipulado?.participants || []).length}
          </div>
          <p className="text-xs text-gray-500">En discipulado</p>
        </CardContent>
      </Card>
    </div>
  )

  const renderIngresosEgresos = () => (
    <Card>
      <CardHeader>
        <CardTitle>Reporte de Ingresos y Egresos</CardTitle>
        <CardDescription>Movimientos financieros del mes</CardDescription>
      </CardHeader>
      <CardContent>
        {(selectedMonth.data.ingresos || []).length > 0 || (selectedMonth.data.egresos || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Fecha</th>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Ministerio</th>
                  <th className="text-left p-3 font-medium">Categoría</th>
                  <th className="text-left p-3 font-medium">Detalle</th>
                  <th className="text-left p-3 font-medium">Observación</th>
                  <th className="text-right p-3 font-medium">Valor</th>
                  <th className="text-center p-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {[...(selectedMonth.data.ingresos || []), ...(selectedMonth.data.egresos || [])]
                  .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                  .map((record: any) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{new Date(record.fecha).toLocaleDateString()}</td>
                      <td className="p-3">
                        <Badge
                          className={
                            record.tipo === "Ingreso" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }
                        >
                          {record.tipo}
                        </Badge>
                      </td>
                      <td className="p-3">{record.ministerio}</td>
                      <td className="p-3">{record.categoria}</td>
                      <td className="p-3">{record.detalle}</td>
                      <td className="p-3">{record.observacion}</td>
                      <td className="p-3 text-right font-semibold">${record.valor.toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <Badge variant={record.estado === "Procesado" ? "default" : "secondary"}>{record.estado}</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No hay registros financieros</p>
        )}
      </CardContent>
    </Card>
  )

  const renderDiezmos = () => (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Diezmos</CardTitle>
        <CardDescription>Diezmos recibidos durante el mes</CardDescription>
      </CardHeader>
      <CardContent>
        {(selectedMonth.data.diezmos || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Número</th>
                  <th className="text-left p-3 font-medium">Fecha</th>
                  <th className="text-left p-3 font-medium">Donador</th>
                  <th className="text-right p-3 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(selectedMonth.data.diezmos || [])
                  .sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                  .map((diezmo: any) => (
                    <tr key={diezmo.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-blue-600">#{diezmo.numero}</td>
                      <td className="p-3">{new Date(diezmo.fecha).toLocaleDateString()}</td>
                      <td className="p-3">{diezmo.donador}</td>
                      <td className="p-3 text-right font-semibold">${diezmo.valor.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No hay diezmos registrados</p>
        )}
      </CardContent>
    </Card>
  )

  const renderAsistencia = () => {
    const calculateRowTotal = (detailId: number) => {
      return (selectedMonth.data.asistencia.columns || []).reduce((sum: number, col: any) => {
        const value =
          (selectedMonth.data.asistencia.data || []).find((d: any) => d.detailId === detailId && d.columnId === col.id)
            ?.value || 0
        return sum + value
      }, 0)
    }

    const calculateColumnTotal = (columnId: number) => {
      return (selectedMonth.data.asistencia.details || []).reduce((sum: number, detail: any) => {
        const value =
          (selectedMonth.data.asistencia.data || []).find(
            (d: any) => d.detailId === detail.id && d.columnId === columnId,
          )?.value || 0
        return sum + value
      }, 0)
    }

    const grandTotal = (selectedMonth.data.asistencia.data || []).reduce((sum: number, d: any) => sum + d.value, 0)

    return (
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas de Asistencia</CardTitle>
          <CardDescription>Registro de asistencia por categorías</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedMonth.data.asistencia && (selectedMonth.data.asistencia.details || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Detalle</th>
                    {(selectedMonth.data.asistencia.columns || []).map((col: any) => (
                      <th key={col.id} className="text-center p-3 font-medium">
                        {col.name}
                      </th>
                    ))}
                    <th className="text-center p-3 font-medium bg-gray-50">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedMonth.data.asistencia.details || []).map((detail: any) => (
                    <tr key={detail.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{detail.name}</td>
                      {(selectedMonth.data.asistencia.columns || []).map((col: any) => {
                        const value =
                          (selectedMonth.data.asistencia.data || []).find(
                            (d: any) => d.detailId === detail.id && d.columnId === col.id,
                          )?.value || 0
                        return (
                          <td key={col.id} className="p-3 text-center font-semibold">
                            {value}
                          </td>
                        )
                      })}
                      <td className="p-3 text-center font-bold bg-gray-50">{calculateRowTotal(detail.id)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 bg-gray-50 font-bold">
                    <td className="p-3">Total</td>
                    {(selectedMonth.data.asistencia.columns || []).map((col: any) => (
                      <td key={col.id} className="p-3 text-center">
                        {calculateColumnTotal(col.id)}
                      </td>
                    ))}
                    <td className="p-3 text-center bg-gray-100">{grandTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay estadísticas de asistencia</p>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderDiscipulado = () => {
    const calculateParticipantTotal = (participantId: number) => {
      return (selectedMonth.data.discipulado.dates || []).reduce((count: number, date: string) => {
        const attendance = (selectedMonth.data.discipulado.attendance || []).find(
          (a: any) => a.participantId === participantId && a.date === date,
        )
        return attendance?.status === "A" ? count + 1 : count
      }, 0)
    }

    const calculateDateTotal = (date: string) => {
      return (selectedMonth.data.discipulado.participants || []).reduce((count: number, participant: any) => {
        const attendance = (selectedMonth.data.discipulado.attendance || []).find(
          (a: any) => a.participantId === participant.id && a.date === date,
        )
        return attendance?.status === "A" ? count + 1 : count
      }, 0)
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Asistencia Discipulado</CardTitle>
          <CardDescription>Control de asistencia individual</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedMonth.data.discipulado && (selectedMonth.data.discipulado.participants || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Participante</th>
                    {(selectedMonth.data.discipulado.dates || []).map((date: string) => (
                      <th key={date} className="text-center p-3 font-medium">
                        {new Date(date + "T00:00:00").toLocaleDateString()}
                      </th>
                    ))}
                    <th className="text-center p-3 font-medium bg-gray-50">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedMonth.data.discipulado.participants || []).map((participant: any) => (
                    <tr key={participant.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{participant.name}</td>
                      {(selectedMonth.data.discipulado.dates || []).map((date: string) => {
                        const attendance = (selectedMonth.data.discipulado.attendance || []).find(
                          (a: any) => a.participantId === participant.id && a.date === date,
                        )
                        const status = attendance?.status || "none"
                        const statusColors = {
                          A: "bg-green-100 text-green-800",
                          J: "bg-blue-100 text-blue-800",
                          F: "bg-red-100 text-red-800",
                          AT: "bg-yellow-100 text-yellow-800",
                          none: "bg-gray-100 text-gray-500",
                        }
                        return (
                          <td key={date} className="p-3 text-center">
                            <Badge className={statusColors[status as keyof typeof statusColors] || statusColors.none}>
                              {status === "none" ? "-" : status}
                            </Badge>
                          </td>
                        )
                      })}
                      <td className="p-3 text-center font-bold bg-gray-50">
                        {calculateParticipantTotal(participant.id)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 bg-gray-50 font-bold">
                    <td className="p-3">Total</td>
                    {(selectedMonth.data.discipulado.dates || []).map((date: string) => (
                      <td key={date} className="p-3 text-center">
                        {calculateDateTotal(date)}
                      </td>
                    ))}
                    <td className="p-3 text-center bg-gray-100">
                      {(selectedMonth.data.discipulado.attendance || []).filter((a: any) => a.status === "A").length}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay registros de discipulado</p>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderContent = () => {
    switch (activeModule) {
      case "overview":
        return renderOverview()
      case "ingresos-egresos":
        return renderIngresosEgresos()
      case "diezmos":
        return renderDiezmos()
      case "asistencia":
        return renderAsistencia()
      case "discipulado":
        return renderDiscipulado()
      default:
        return renderOverview()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => router.push("/dashboard/control-mensual")}>
                ← Volver al Control
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">{selectedMonth.name}</h1>
            </div>
            <Badge variant="outline" className="text-gray-600 border-gray-200">
              Modo Solo Lectura
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-64 flex-shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Módulos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {modules.map((module) => (
                    <button
                      key={module.id}
                      onClick={() => setActiveModule(module.id)}
                      className={`w-full text-left px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors ${
                        activeModule === module.id
                          ? "bg-blue-50 border-r-2 border-blue-500 text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      <span className="text-lg">{module.icon}</span>
                      <span className="font-medium">{module.name}</span>
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          <div className="flex-1">{renderContent()}</div>
        </div>
      </div>
    </div>
  )
}
