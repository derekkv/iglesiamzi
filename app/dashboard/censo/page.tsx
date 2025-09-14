import { Suspense } from "react"
import { CensoClient } from "./censo-client"
import { getCensoData, getCensoConfiguraciones } from "@/lib/database"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function CensoPage() {
  const [datosPersonales, datosIglesia, configuraciones] = await Promise.all([
    getCensoData("datos_personales"),
    getCensoData("datos_iglesia"),
    getCensoConfiguraciones(),
  ])

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="flex items-center space-x-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Control de Datos de Censo</h1>
        <p className="text-gray-600 mt-2">Gestión de datos personales y de iglesia</p>
      </div>

      <Suspense fallback={<div>Cargando...</div>}>
        <CensoClient
          // @ts-ignore
          initialDatosPersonales={datosPersonales}
          initialDatosIglesia={datosIglesia}
          configuraciones={configuraciones}
        />
      </Suspense>
    </div>
  )
}
