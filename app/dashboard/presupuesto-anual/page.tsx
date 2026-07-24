"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Construction } from "lucide-react"
import { PermissionsGuard } from "@/lib/permissions-guard"

function PresupuestoAnualContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Presupuesto Anual</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Card className="max-w-lg mx-auto border-amber-200 bg-amber-50/30">
          <CardContent className="pt-12 pb-12 text-center">
            <Construction className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">En desarrollo</h2>
            <p className="text-gray-600">Este módulo está siendo construido. Pronto podrá gestionar el presupuesto anual de la iglesia desde aquí.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function PresupuestoAnualPage() {
  return (
    <PermissionsGuard moduleName="presupuesto_anual">
      {(canEdit) => <PresupuestoAnualContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
