"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { AdminRequerimientos } from "@/components/AdminRequerimientos"

function AdminRequerimientosContent({ canEdit }: { canEdit: boolean }) {
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
                Gestión de Requerimientos
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Aprobar, negar o suspender solicitudes de bienes y servicios
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AdminRequerimientos />
      </main>
    </div>
  )
}

export default function RequerimientosAdminPage() {
  return (
    <PermissionsGuard moduleName="requerimientos-admin">
      {(canEdit) => <AdminRequerimientosContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
