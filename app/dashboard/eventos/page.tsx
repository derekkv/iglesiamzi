"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { EncuentroTab } from "./EncuentroTab"
import { EquiposTab } from "./EquiposTab"

function EventosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  const handleDataChanged = () => {
    setRefreshKey(prev => prev + 1)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      </div>
    )
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
              <h1 className="text-xl font-semibold text-gray-900">Eventos - Encuentro</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="encuentro" className="space-y-6">
          <TabsList>
            <TabsTrigger value="encuentro">Encuentro</TabsTrigger>
            <TabsTrigger value="equipos">Equipos</TabsTrigger>
          </TabsList>

          <TabsContent value="encuentro">
            <EncuentroTab
              canEdit={canEdit}
              userId={user.id}
              userName={user.username}
              onDataChanged={handleDataChanged}
            />
          </TabsContent>

          <TabsContent value="equipos">
            <EquiposTab
              canEdit={canEdit}
              userId={user.id}
              userName={user.username}
              refreshKey={refreshKey}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function EventosPage() {
  return (
    <PermissionsGuard moduleName="eventos_encuentro">
      {(canEdit) => <EventosContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
