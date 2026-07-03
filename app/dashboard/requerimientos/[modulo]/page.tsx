"use client"

import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { RequerimientosBienesServicios } from "@/components/RequerimientosBienesServicios"
import { useAuth } from "@/contexts/auth-context"

// Mapa de módulo-slug a moduleName para permisos (módulos individuales)
const MODULO_MAP: Record<string, { permiso: string; titulo: string }> = {
  "asistencia": { permiso: "asistencia", titulo: "Asistencia" },
  "bautizo": { permiso: "bautizo", titulo: "Bautizo" },
  "censo": { permiso: "censo", titulo: "Censo" },
  "censo-mdg": { permiso: "censo-mdg", titulo: "Censo MDG" },
  "control-mensual": { permiso: "control_mensual", titulo: "Control Mensual" },
  "cronograma-administracion": { permiso: "cronograma-administracion", titulo: "Cronograma Administración" },
  "cronograma-discipulado": { permiso: "cronograma-discipulado", titulo: "Cronograma Discipulado" },
  "cronograma-mdg": { permiso: "cronograma-mdg", titulo: "Cronograma MDG" },
  "cronograma-protocolo": { permiso: "cronograma-protocolo", titulo: "Cronograma Protocolo" },
  "diezmos": { permiso: "diezmos", titulo: "Diezmos" },
  "discipulado": { permiso: "discipulado", titulo: "Discipulado" },
  "flujo-pago": { permiso: "flujo_pago", titulo: "Flujo de Pago" },
  "ingresos-egresos": { permiso: "ingresos_egresos", titulo: "Ingresos y Egresos" },
  "inventario": { permiso: "inventario", titulo: "Inventario" },
  "matrimonio": { permiso: "matrimonio", titulo: "Matrimonio" },
  "pastoral": { permiso: "pastoral", titulo: "Pastoral" },
}

// Mapa de grupos - cada grupo usa un permiso de un módulo representativo del grupo
const GRUPO_MAP: Record<string, { titulo: string; permiso: string }> = {
  "protocolo": { titulo: "Protocolo", permiso: "cronograma-protocolo" },
  "discipulado": { titulo: "Discipulado", permiso: "discipulado" },
  "mdg": { titulo: "Mujeres de Gracia", permiso: "cronograma-mdg" },
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
              onClick={() => router.back()}
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

  // Verificar si es un grupo o un módulo individual
  const grupoInfo = GRUPO_MAP[modulo]
  const moduloInfo = MODULO_MAP[modulo]

  const info = grupoInfo || moduloInfo

  if (!info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Módulo no encontrado</p>
      </div>
    )
  }

  return (
    <PermissionsGuard moduleName={info.permiso}>
      {(canEdit) => <RequerimientosContent modulo={modulo} titulo={info.titulo} canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
