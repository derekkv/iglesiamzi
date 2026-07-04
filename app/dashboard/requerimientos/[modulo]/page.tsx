"use client"

import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { RequerimientosBienesServicios } from "@/components/RequerimientosBienesServicios"

// Mapa de slug a nombre de módulo en system_modules para permisos
const MODULO_CONFIG: Record<string, { permiso: string; titulo: string }> = {
  "protocolo": { permiso: "requerimientos-protocolo", titulo: "Requerimientos de Bienes y Servicios - Protocolo" },
  "discipulado": { permiso: "requerimientos-discipulado", titulo: "Requerimientos de Bienes y Servicios - Discipulado" },
  "mdg": { permiso: "requerimientos-mdg", titulo: "Requerimientos de Bienes y Servicios - Mujeres de Gracia" },
  "alabanza": { permiso: "requerimientos-alabanza", titulo: "Requerimientos de Bienes y Servicios - Alabanza" },
  "intercesion": { permiso: "requerimientos-intercesion", titulo: "Requerimientos de Bienes y Servicios - Intercesión" },
  "herederos": { permiso: "requerimientos-herederos", titulo: "Requerimientos de Bienes y Servicios - Herederos del Reino" },
  "redil": { permiso: "requerimientos-redil", titulo: "Requerimientos de Bienes y Servicios - Redil" },
}

function RequerimientosContent({ modulo, titulo, canEdit }: { modulo: string; titulo: string; canEdit: boolean }) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4 sm:h-16 gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <div className="border-l pl-3">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                Requerimientos de Bienes y Servicios
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                {titulo}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <RequerimientosBienesServicios modulo={modulo} canEdit={canEdit} />
      </main>
    </div>
  )
}

export default function RequerimientosModuloPage() {
  const params = useParams()
  const modulo = params.modulo as string

  const config = MODULO_CONFIG[modulo]

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Módulo no encontrado</p>
      </div>
    )
  }

  return (
    <PermissionsGuard moduleName={config.permiso}>
      {(canEdit) => <RequerimientosContent modulo={modulo} titulo={config.titulo} canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
