"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Settings, CalendarPlus } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { eventosTabsService, type EventoTab } from "@/lib/mod/eventos-service"
import { EventoTabContent } from "./EventoTabContent"
import { GestionTabsDialog } from "./GestionTabsDialog"
import { EquiposEventoTab } from "./EquiposEventoTab"

function EventosContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const [tabs, setTabs] = useState<EventoTab[]>([])
  const [allTabs, setAllTabs] = useState<EventoTab[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("")
  const [showGestion, setShowGestion] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    loadTabs()
  }, [])

  useRealtimeMultiple(["eventos_tabs"], loadTabs)

  async function loadTabs() {
    try {
      const all = await eventosTabsService.getAll()
      setAllTabs(all)
      const active = all.filter(t => t.is_active)
      setTabs(active)
      // Si no hay tab activo seleccionado o el actual ya no existe, seleccionar el primero
      if (active.length > 0 && (!activeTab || !active.find(t => String(t.id) === activeTab))) {
        setActiveTab(String(active[0].id))
      }
    } catch (error) {
      console.error("Error cargando tabs:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleTabsChanged = () => {
    loadTabs()
    setRefreshKey(prev => prev + 1)
  }

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
              <h1 className="text-xl font-semibold text-gray-900">Eventos</h1>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGestion(true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Gestionar Eventos
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : tabs.length === 0 ? (
          <div className="text-center py-16">
            <CalendarPlus className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-lg font-medium text-gray-600 mb-2">No hay eventos creados</h2>
            <p className="text-sm text-gray-400 mb-6">
              Cree un nuevo evento para comenzar a registrar participantes.
            </p>
            {canEdit && (
              <Button onClick={() => setShowGestion(true)}>
                <CalendarPlus className="w-4 h-4 mr-2" /> Crear Primer Evento
              </Button>
            )}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="flex-wrap h-auto gap-1">
              {tabs.map(tab => (
                <TabsTrigger key={tab.id} value={String(tab.id)} className="text-sm">
                  {tab.nombre}
                </TabsTrigger>
              ))}
              <TabsTrigger value="equipos" className="text-sm">
                Equipos
              </TabsTrigger>
            </TabsList>

            {tabs.map(tab => (
              <TabsContent key={tab.id} value={String(tab.id)}>
                <EventoTabContent
                  evento={tab}
                  allTabs={allTabs}
                  canEdit={canEdit}
                  userId={user.id}
                  userName={user.username}
                  onDataChanged={handleDataChanged}
                />
              </TabsContent>
            ))}

            <TabsContent value="equipos">
              <EquiposEventoTab
                tabs={tabs}
                canEdit={canEdit}
                userId={user.id}
                userName={user.username}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Diálogo de gestión de tabs */}
      <GestionTabsDialog
        open={showGestion}
        onOpenChange={setShowGestion}
        tabs={allTabs}
        canEdit={canEdit}
        userId={user.id}
        userName={user.username}
        onTabsChanged={handleTabsChanged}
      />
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
