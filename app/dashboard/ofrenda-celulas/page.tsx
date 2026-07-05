"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, DollarSign } from "lucide-react"
import {
  getJuevesDelMes,
  getMesOfrendaActual,
  getTodasOfrendasMes,
  type OfrendaCelula,
} from "@/lib/mod/ofrenda-celulas-service"

const CELULAS = [
  "Carlos y Ruth", "Sarita y Lady", "Jessy Mendoza", "Líder y Angela",
  "Juan Pablo y Angie", "Alina y Anita", "Neyda y Carmen", "Yadira y Tania",
  "Luis y Ariana", "Layla Salem", "Estuardo y Catalina", "Gabriela López",
]

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]


function OfrendaCelulasContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const [ofrendas, setOfrendas] = useState<OfrendaCelula[]>([])
  const [loading, setLoading] = useState(true)

  const { mes, anio } = getMesOfrendaActual()
  const jueves = getJuevesDelMes(anio, mes)

  const loadData = async () => {
    const data = await getTodasOfrendasMes(mes, anio)
    setOfrendas(data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])
  useRealtime({ table: "ofrendas_celulas", onChange: () => loadData() })

  const getValor = (celula: string, fecha: string): number | null => {
    const o = ofrendas.find((x) => x.celula_nombre === celula && x.fecha === fecha)
    return o ? Number(o.valor) : null
  }

  const getTotalCelula = (celula: string): number => {
    return ofrendas.filter((o) => o.celula_nombre === celula).reduce((s, o) => s + Number(o.valor), 0)
  }

  const getTotalJueves = (fecha: string): number => {
    return ofrendas.filter((o) => o.fecha === fecha).reduce((s, o) => s + Number(o.valor), 0)
  }

  const totalGeneral = ofrendas.reduce((s, o) => s + Number(o.valor), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
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
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Ofrenda de Células</h1>
                <p className="text-xs text-gray-500">{MESES[mes - 1]} {anio}</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800 border-green-200 text-sm">
              Total: ${totalGeneral.toFixed(2)}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Cards resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CELULAS.map((celula) => {
            const total = getTotalCelula(celula)
            return (
              <Card key={celula} className="p-0">
                <CardContent className="p-3">
                  <p className="text-xs font-medium text-gray-700 truncate">{celula}</p>
                  <p className={`text-lg font-bold ${total > 0 ? "text-green-700" : "text-gray-300"}`}>
                    ${total.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>


        {/* Tabla cruzada: Células x Jueves */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Detalle por Jueves - {MESES[mes - 1]} {anio}
            </CardTitle>
            <CardDescription>{jueves.length} jueves en el mes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Célula</TableHead>
                    {jueves.map((j) => (
                      <TableHead key={j} className="text-xs text-center">
                        {new Date(j + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}
                      </TableHead>
                    ))}
                    <TableHead className="text-xs text-center font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CELULAS.map((celula) => (
                    <TableRow key={celula}>
                      <TableCell className="text-xs font-medium">{celula}</TableCell>
                      {jueves.map((j) => {
                        const val = getValor(celula, j)
                        return (
                          <TableCell key={j} className="text-xs text-center">
                            {val !== null ? (
                              <span className="text-green-700 font-semibold">${val.toFixed(2)}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-xs text-center font-bold text-green-800">
                        ${getTotalCelula(celula).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Fila de totales por jueves */}
                  <TableRow className="bg-green-50/50 font-semibold">
                    <TableCell className="text-xs font-bold">TOTAL</TableCell>
                    {jueves.map((j) => (
                      <TableCell key={j} className="text-xs text-center font-bold text-green-800">
                        ${getTotalJueves(j).toFixed(2)}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs text-center font-bold text-green-900 text-base">
                      ${totalGeneral.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
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
