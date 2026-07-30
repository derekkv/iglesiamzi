"use client"

import { useCallback, useEffect, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Inbox, PenLine, FileText, Settings, AlertTriangle, RefreshCw, Loader2 } from "lucide-react"
import type { EmailConfigPublic } from "./types"
import { EmailInbox } from "./email/EmailInbox"
import { EmailCompose } from "./email/EmailCompose"
import { EmailTemplates } from "./email/EmailTemplates"
import { EmailSettings } from "./email/EmailSettings"

type Section = "inbox" | "compose" | "templates" | "settings"

const SECTIONS: Array<{ id: Section; label: string; icon: typeof Inbox; adminOnly?: boolean }> = [
  { id: "inbox", label: "Bandeja", icon: Inbox },
  { id: "compose", label: "Redactar", icon: PenLine },
  { id: "templates", label: "Plantillas", icon: FileText },
  { id: "settings", label: "Configuración", icon: Settings, adminOnly: true },
]

export function EmailTab({ canEdit, canAdmin }: { canEdit: boolean; canAdmin?: boolean }) {
  const [section, setSection] = useState<Section>("inbox")
  const [config, setConfig] = useState<EmailConfigPublic | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true)
    try {
      const res = await authFetch("/api/email/config")
      const data = await res.json()
      if (data.success) setConfig(data.config as EmailConfigPublic)
    } catch {
      setConfig(null)
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  useEffect(() => {
    // Solo los admins pueden leer la configuración; el resto usa la bandeja igual
    if (canAdmin) loadConfig()
    else setLoadingConfig(false)
  }, [canAdmin, loadConfig])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await authFetch("/api/email/sync", {
        method: "POST",
        body: JSON.stringify({ force: true }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "No se pudo sincronizar")

      if (data.synced > 0) toast.success(`${data.synced} correo(s) nuevo(s) descargado(s)`)
      else toast.info("No hay correos nuevos")

      setReloadKey((k) => k + 1)
      if (canAdmin) loadConfig()
    } catch (error: any) {
      toast.error(error?.message || "Error sincronizando el correo")
    } finally {
      setSyncing(false)
    }
  }

  const visibleSections = SECTIONS.filter((s) => !s.adminOnly || canAdmin)

  return (
    <div className="space-y-4">
      {/* Aviso de configuración */}
      {canAdmin && !loadingConfig && config && !config.configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">SMTP sin configurar</p>
              <p className="text-sm text-amber-800 mt-1">
                Registre el usuario y la contraseña del correo para poder enviar. Mientras no esté
                configurado, los envíos del sistema quedarán registrados como fallidos.
              </p>
              <Button size="sm" className="mt-3" onClick={() => setSection("settings")}>
                Ir a Configuración
              </Button>
            </div>
          </div>
        </div>
      )}

      {canAdmin && !loadingConfig && config?.configured && !config.imap_configured && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-blue-900">Correos recibidos desactivados</p>
              <p className="text-sm text-blue-800 mt-1">
                El envío funciona, pero falta configurar IMAP para poder ver los correos que
                llegan a la bandeja.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setSection("settings")}
              >
                Configurar IMAP
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        {visibleSections.map((s) => {
          const Icon = s.icon
          const active = section === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
            </button>
          )
        })}

        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={handleSync}
          disabled={syncing}
          title="Descargar los correos nuevos por IMAP"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sincronizar
        </Button>
      </div>

      {section === "inbox" && <EmailInbox reloadKey={reloadKey} canEdit={canEdit} />}
      {section === "compose" && <EmailCompose canEdit={canEdit} onSent={() => setReloadKey((k) => k + 1)} />}
      {section === "templates" && <EmailTemplates canEdit={canEdit} />}
      {section === "settings" && canAdmin && (
        <EmailSettings config={config} onSaved={loadConfig} />
      )}
    </div>
  )
}
