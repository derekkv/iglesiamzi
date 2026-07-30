"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { ArrowLeft, MessageCircle, Mail } from "lucide-react"
import { WhatsAppTab } from "./WhatsAppTab"
import { EmailTab } from "./EmailTab"

function ComunicacionesContent({ canEdit, canAdmin }: { canEdit: boolean; canAdmin?: boolean }) {
  const router = useRouter()
  const { user: currentUser, isLoading: authLoading } = useAuth()
  const [tab, setTab] = useState<string>("whatsapp")

  // Recordar el último tab abierto durante la sesión
  useEffect(() => {
    const saved = sessionStorage.getItem("comunicaciones_tab")
    if (saved === "whatsapp" || saved === "email") setTab(saved)
  }, [])

  useEffect(() => {
    sessionStorage.setItem("comunicaciones_tab", tab)
  }, [tab])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
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
              <h1 className="text-xl font-semibold text-gray-900">WhatsApp / Email</h1>
            </div>
            <div className="text-sm text-gray-600 hidden sm:block">
              Usuario: <span className="font-medium">{currentUser?.displayName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp">
            <WhatsAppTab canEdit={canEdit} canAdmin={canAdmin} />
          </TabsContent>

          <TabsContent value="email">
            <EmailTab canEdit={canEdit} canAdmin={canAdmin} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function ComunicacionesPage() {
  return (
    <PermissionsGuard moduleName="comunicaciones" alternateModules={["administracion"]}>
      {(canEdit, canAdmin) => <ComunicacionesContent canEdit={canEdit} canAdmin={canAdmin} />}
    </PermissionsGuard>
  )
}
