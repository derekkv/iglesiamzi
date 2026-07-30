"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/secure-db"
import { authFetch } from "@/lib/auth-fetch"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Inbox, Users, Send, Megaphone, FileText, Settings,
  AlertTriangle, RefreshCw,
} from "lucide-react"
import type { WaContact, WaHealthResponse, WaTag, WaQuickReply } from "./types"
import { WaInbox } from "./wa/WaInbox"
import { WaContacts } from "./wa/WaContacts"
import { WaSend } from "./wa/WaSend"
import { WaCampaigns } from "./wa/WaCampaigns"
import { WaTemplates } from "./wa/WaTemplates"
import { WaSettings } from "./wa/WaSettings"

type Section = "inbox" | "contacts" | "send" | "campaigns" | "templates" | "settings"

const SECTIONS: Array<{ id: Section; label: string; icon: typeof Inbox; adminOnly?: boolean }> = [
  { id: "inbox", label: "Bandeja", icon: Inbox },
  { id: "contacts", label: "Contactos", icon: Users },
  { id: "send", label: "Enviar", icon: Send },
  { id: "campaigns", label: "Campañas", icon: Megaphone },
  { id: "templates", label: "Plantillas", icon: FileText },
  { id: "settings", label: "Configuración", icon: Settings, adminOnly: true },
]

export function WhatsAppTab({ canEdit, canAdmin }: { canEdit: boolean; canAdmin?: boolean }) {
  const [section, setSection] = useState<Section>("inbox")
  const [health, setHealth] = useState<WaHealthResponse | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [contacts, setContacts] = useState<WaContact[]>([])
  const [tags, setTags] = useState<WaTag[]>([])
  const [quickReplies, setQuickReplies] = useState<WaQuickReply[]>([])

  // ---------------------------------------------------------------------
  // Datos
  // ---------------------------------------------------------------------

  const loadHealth = useCallback(async (silent = false) => {
    if (!silent) setLoadingHealth(true)
    try {
      const res = await authFetch("/api/whatsapp/status")
      const data = (await res.json()) as WaHealthResponse
      setHealth(data)
    } catch {
      setHealth(null)
    } finally {
      setLoadingHealth(false)
    }
  }, [])

  const loadContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from("wa_contacts")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(500)

    if (error) {
      console.error("Error cargando contactos:", error.message)
      return
    }
    setContacts((data as WaContact[]) || [])
  }, [])

  const loadCatalogs = useCallback(async () => {
    const [tagsRes, repliesRes] = await Promise.all([
      supabase.from("wa_tags").select("*").order("nombre"),
      supabase.from("wa_quick_replies").select("*").order("atajo"),
    ])
    setTags((tagsRes.data as WaTag[]) || [])
    setQuickReplies((repliesRes.data as WaQuickReply[]) || [])
  }, [])

  useEffect(() => {
    loadHealth()
    loadContacts()
    loadCatalogs()
  }, [loadHealth, loadContacts, loadCatalogs])

  // Refrescar el estado del canal cada 2 minutos (health check contra Meta)
  useEffect(() => {
    const interval = setInterval(() => loadHealth(true), 120_000)
    return () => clearInterval(interval)
  }, [loadHealth])

  // Realtime: los mensajes entrantes llegan por webhook → refrescar contactos
  useRealtimeMultiple(["wa_contacts", "wa_messages"], loadContacts)

  const totalUnread = contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  const visibleSections = SECTIONS.filter((s) => !s.adminOnly || canAdmin)

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Estado del canal */}
      <ChannelBanner
        health={health}
        loading={loadingHealth}
        onRefresh={() => loadHealth()}
        onGoToSettings={canAdmin ? () => setSection("settings") : undefined}
      />

      {/* Navegación de secciones */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {visibleSections.map((s) => {
          const Icon = s.icon
          const active = section === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
              {s.id === "inbox" && totalUnread > 0 && (
                <Badge className="bg-red-600 hover:bg-red-600 text-white text-[10px] px-1.5 py-0">
                  {totalUnread}
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      {section === "inbox" && (
        <WaInbox
          contacts={contacts}
          quickReplies={quickReplies}
          canEdit={canEdit}
          onContactsChange={loadContacts}
        />
      )}

      {section === "contacts" && (
        <WaContacts
          contacts={contacts}
          tags={tags}
          canEdit={canEdit}
          canAdmin={canAdmin}
          onChange={loadContacts}
          onTagsChange={loadCatalogs}
        />
      )}

      {section === "send" && (
        <WaSend
          contacts={contacts}
          tags={tags}
          canEdit={canEdit}
          onSent={loadContacts}
        />
      )}

      {section === "campaigns" && <WaCampaigns canEdit={canEdit} />}

      {section === "templates" && <WaTemplates canEdit={canEdit} />}

      {section === "settings" && canAdmin && (
        <WaSettings health={health} onSaved={() => loadHealth()} />
      )}
    </div>
  )
}

// -------------------------------------------------------------------------
// Banner de estado del canal
// -------------------------------------------------------------------------

function ChannelBanner({
  health,
  loading,
  onRefresh,
  onGoToSettings,
}: {
  health: WaHealthResponse | null
  loading: boolean
  onRefresh: () => void
  onGoToSettings?: () => void
}) {
  if (loading && !health) {
    return (
      <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
        <span className="text-sm text-gray-600">Verificando el canal de WhatsApp...</span>
      </div>
    )
  }

  // Sin credenciales todavía
  if (!health?.configured) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-900">WhatsApp Cloud API sin configurar</p>
            <p className="text-sm text-amber-800 mt-1">
              Registre las credenciales de Meta (Phone Number ID, WABA ID y token de acceso) para
              poder enviar y recibir mensajes. Hasta entonces los envíos automáticos del sistema
              quedarán registrados como fallidos.
            </p>
            {onGoToSettings && (
              <Button size="sm" className="mt-3" onClick={onGoToSettings}>
                Ir a Configuración
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Configurado pero con error
  if (!health.connected) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-900">El canal de WhatsApp no responde</p>
            <p className="text-sm text-red-800 mt-1">{health.error || "Error desconocido."}</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={onRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
              {onGoToSettings && (
                <Button size="sm" variant="outline" onClick={onGoToSettings}>
                  Revisar credenciales
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Operativo
  return (
    <div className="bg-white border rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-gray-900">Canal operativo</span>
      </div>
      {health.phoneNumber && (
        <span className="text-sm text-gray-600">
          Número: <span className="font-medium text-gray-900">{health.phoneNumber}</span>
        </span>
      )}
      {health.name && (
        <span className="text-sm text-gray-600">
          Nombre: <span className="font-medium text-gray-900">{health.name}</span>
        </span>
      )}
      {health.quality && (
        <span className="text-sm text-gray-600">
          Calidad: <span className="font-medium text-gray-900">{health.quality}</span>
        </span>
      )}
      {health.messagingLimit && (
        <span className="text-sm text-gray-600">
          Límite: <span className="font-medium text-gray-900">{health.messagingLimit}</span>
        </span>
      )}
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onRefresh}>
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>
  )
}
