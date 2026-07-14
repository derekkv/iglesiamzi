"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Wallet } from "lucide-react"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"

function CajaChicaContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Caja Chica</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Administración
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Caja Chica
            </CardTitle>
            <CardDescription>Gestión de fondos de caja chica</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-500 py-16">Módulo en construcción</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function CajaChicaPage() {
  return (
    <PermissionsGuard moduleName="flujo_pago">
      {(canEdit) => <CajaChicaContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
