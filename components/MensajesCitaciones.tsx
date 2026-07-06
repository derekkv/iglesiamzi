"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useRealtime } from "@/hooks/use-realtime"
import { useAuth } from "@/contexts/auth-context"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Send, Inbox, Mail, Plus, Eye, Lock } from "lucide-react"
import { toast } from "sonner"

interface MensajesCitacionesProps {
  moduloKey: string
  title: string
  canEdit: boolean
}

interface Mensaje {
  id: number
  remitente_id: string
  remitente_nombre: string
  modulo_origen: string
  destinatario_tipo: string
  destinatario_id: string | null
  destinatario_modulo: string | null
  destinatario_nombre: string | null
  tipo: "mensaje" | "invitacion"
  detalle: string
  fecha: string
  valor: number | null
  evento_lugar: string | null
  created_at: string
}

interface MensajeRecibido {
  id: number
  mensaje_id: number
  user_id: string
  leido: boolean
  leido_at: string | null
  mensaje?: Mensaje
}

const MODULOS_DESTINO = [
  { value: "protocolo", label: "Protocolo (todos)" },
  { value: "administracion", label: "Administración (todos)" },
  { value: "mdg", label: "Mujeres de Gracia (todos)" },
  { value: "discipulado", label: "Discipulado (todos)" },
]

export function MensajesCitaciones({ moduloKey, title, canEdit }: MensajesCitacionesProps) {
  const router = useRouter()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState("recibidos")
  const [enviados, setEnviados] = useState<Mensaje[]>([])
  const [recibidos, setRecibidos] = useState<MensajeRecibido[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<Mensaje | null>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [destTipo, setDestTipo] = useState<"usuario" | "modulo" | "todos">("usuario")
  const [destUsuarioId, setDestUsuarioId] = useState("")
  const [destModulo, setDestModulo] = useState("")
  const [tipoMensaje, setTipoMensaje] = useState<"mensaje" | "invitacion">("mensaje")
  const [detalle, setDetalle] = useState("")
  const [fecha, setFecha] = useState("")
  const [valor, setValor] = useState("")
  const [eventoLugar, setEventoLugar] = useState("")

  // User search
  const [userQuery, setUserQuery] = useState("")
  const [userResults, setUserResults] = useState<{ id: string; displayName: string }[]>([])
  const [showUserResults, setShowUserResults] = useState(false)
  const [selectedUserName, setSelectedUserName] = useState("")

  const loadEnviados = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from("mensajes_citaciones")
      .select("*")
      .eq("remitente_id", user.id)
      .eq("modulo_origen", moduloKey)
      .order("created_at", { ascending: false })

    if (!error) setEnviados((data || []) as Mensaje[])
  }, [user, moduloKey])

  const loadRecibidos = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from("mensajes_citaciones_recibidos")
      .select(`
        *,
        mensaje:mensajes_citaciones(*)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (!error) setRecibidos((data || []) as MensajeRecibido[])
  }, [user])

  useEffect(() => {
    Promise.all([loadEnviados(), loadRecibidos()]).finally(() => setLoading(false))
  }, [loadEnviados, loadRecibidos])

  useRealtime({ table: "mensajes_citaciones", onChange: () => loadEnviados() })
  useRealtime({ table: "mensajes_citaciones_recibidos", filter: user ? `user_id=eq.${user.id}` : undefined, enabled: !!user, onChange: () => loadRecibidos() })

  const handleSearchUsers = async (query: string) => {
    setUserQuery(query)
    if (query.trim().length < 2) {
      setUserResults([])
      setShowUserResults(false)
      return
    }
    const { data } = await supabase
      .from("users")
      .select("id, displayName")
      .eq("is_active", true)
      .ilike("displayName", `%${query}%`)
      .limit(10)

    setUserResults(data || [])
    setShowUserResults(true)
  }

  const handleSelectUser = (u: { id: string; displayName: string }) => {
    setDestUsuarioId(u.id)
    setSelectedUserName(u.displayName)
    setUserQuery(u.displayName)
    setShowUserResults(false)
  }

  const handleSend = async () => {
    if (!user) return
    if (!detalle.trim()) { toast.error("Escriba el detalle del mensaje"); return }
    if (!fecha) { toast.error("Seleccione una fecha"); return }
    if (destTipo === "usuario" && !destUsuarioId) { toast.error("Seleccione un destinatario"); return }
    if (destTipo === "modulo" && !destModulo) { toast.error("Seleccione un módulo destino"); return }

    setSaving(true)
    try {
      let destNombre = ""
      if (destTipo === "usuario") destNombre = selectedUserName
      else if (destTipo === "modulo") destNombre = MODULOS_DESTINO.find((m) => m.value === destModulo)?.label || destModulo
      else destNombre = "Todos los usuarios"

      // Insertar mensaje
      const { data: msg, error: msgError } = await supabase
        .from("mensajes_citaciones")
        .insert({
          remitente_id: user.id,
          remitente_nombre: `${user.displayName} - ${title}`,
          modulo_origen: moduloKey,
          destinatario_tipo: destTipo,
          destinatario_id: destTipo === "usuario" ? destUsuarioId : null,
          destinatario_modulo: destTipo === "modulo" ? destModulo : null,
          destinatario_nombre: destNombre,
          tipo: tipoMensaje,
          detalle: detalle.trim(),
          fecha,
          valor: valor ? parseFloat(valor) : null,
          evento_lugar: eventoLugar.trim() || null,
        })
        .select()
        .single()

      if (msgError) throw msgError

      // Determinar destinatarios y crear registros de recepción
      let destinatarioIds: string[] = []

      if (destTipo === "usuario") {
        destinatarioIds = [destUsuarioId]
      } else if (destTipo === "modulo") {
        // Obtener usuarios con permiso en el módulo
        const moduleName = `cronograma-${destModulo}`
        const { data: perms } = await supabase
          .from("user_permissions")
          .select(`user_id, module:system_modules!inner(name)`)
          .eq("can_view", true)
          .eq("system_modules.name", moduleName)

        destinatarioIds = [...new Set((perms || []).map((p: any) => p.user_id))]
      } else {
        // Todos los usuarios activos
        const { data: allUsers } = await supabase
          .from("users")
          .select("id")
          .eq("is_active", true)

        destinatarioIds = (allUsers || []).map((u: any) => u.id)
      }

      // Excluir al remitente
      destinatarioIds = destinatarioIds.filter((id) => id !== user.id)

      if (destinatarioIds.length > 0) {
        const recibidosInsert = destinatarioIds.map((uid) => ({
          mensaje_id: msg.id,
          user_id: uid,
        }))

        await supabase.from("mensajes_citaciones_recibidos").insert(recibidosInsert)

        // Enviar notificaciones por email y WhatsApp a cada destinatario
        const { data: destUsers } = await supabase
          .from("users")
          .select("id, email, phone, displayName")
          .in("id", destinatarioIds)

        const asunto = tipoMensaje === "invitacion" ? "Citación" : "Mensaje"
        const cuerpo = `${asunto} de ${user.displayName} (${title}): ${detalle.trim()}${fecha ? ` - Fecha: ${fecha}` : ""}${eventoLugar ? ` - Lugar: ${eventoLugar}` : ""}`

        for (const dest of (destUsers || [])) {
          // Email
          if (dest.email) {
            fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: dest.email,
                subject: `✉️ ${asunto} - ${title}`,
                html: `
                  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                    <div style="background:#2563eb;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
                      <h2 style="margin:0;">${asunto}</h2>
                      <p style="margin:4px 0 0;opacity:0.85;font-size:14px;">${title}</p>
                    </div>
                    <div style="background:white;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 12px 12px;">
                      <p>Hola <strong>${dest.displayName}</strong>,</p>
                      <p>Has recibido ${tipoMensaje === "invitacion" ? "una citación" : "un mensaje"} de <strong>${user.displayName}</strong> (${title}):</p>
                      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
                        <p style="margin:0 0 8px;"><strong>Detalle:</strong> ${detalle.trim()}</p>
                        ${fecha ? `<p style="margin:0 0 8px;"><strong>Fecha:</strong> ${fecha}</p>` : ""}
                        ${valor ? `<p style="margin:0 0 8px;"><strong>Valor:</strong> $${parseFloat(valor).toFixed(2)}</p>` : ""}
                        ${eventoLugar ? `<p style="margin:0;"><strong>Evento/Lugar:</strong> ${eventoLugar}</p>` : ""}
                      </div>
                      <p style="text-align:center;margin-top:24px;">
                        <a href="https://panel.iglesiaregalodedios.com/dashboard" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Abrir la App</a>
                      </p>
                      <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:16px;">Iglesia Regalo de Dios — Este es un correo automático.</p>
                    </div>
                  </div>`,
              }),
            }).catch(() => {})
          }
          // WhatsApp
          if (dest.phone) {
            fetch("/api/whatsapp/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: dest.phone, message: cuerpo }),
            }).catch(() => {})
          }
          // Push
          fetch("/api/send-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: dest.id, title: `${asunto} - ${title}`, body: detalle.trim().slice(0, 100), url: "/dashboard" }),
          }).catch(() => {})
        }
      }

      toast.success(`Mensaje enviado a ${destinatarioIds.length} destinatario(s)`)
      resetForm()
      setShowCreate(false)
      loadEnviados()
    } catch (error: any) {
      toast.error("Error: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleMarcarLeido = async (recibidoId: number) => {
    await supabase
      .from("mensajes_citaciones_recibidos")
      .update({ leido: true, leido_at: new Date().toISOString() })
      .eq("id", recibidoId)
    loadRecibidos()
  }

  const resetForm = () => {
    setDestTipo("usuario")
    setDestUsuarioId("")
    setDestModulo("")
    setSelectedUserName("")
    setUserQuery("")
    setTipoMensaje("mensaje")
    setDetalle("")
    setFecha("")
    setValor("")
    setEventoLugar("")
  }

  const noLeidos = recibidos.filter((r) => !r.leido).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Mensajes y Citaciones</h1>
                <p className="text-xs text-gray-500">{title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!canEdit && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Solo lectura
                </Badge>
              )}
              {canEdit && (
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Nuevo
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recibidos">
              <Inbox className="w-4 h-4 mr-2" /> Recibidos
              {noLeidos > 0 && <Badge className="ml-2 bg-red-500 text-white text-xs">{noLeidos}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="enviados">
              <Send className="w-4 h-4 mr-2" /> Enviados ({enviados.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recibidos" className="mt-4">
            {recibidos.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  <Inbox className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No tiene mensajes recibidos</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {recibidos.map((r) => {
                  const msg = r.mensaje as unknown as Mensaje
                  if (!msg) return null
                  return (
                    <Card key={r.id} className={`cursor-pointer transition-all hover:shadow-md ${!r.leido ? "border-blue-300 bg-blue-50/30" : ""}`}
                      onClick={() => { if (!r.leido) handleMarcarLeido(r.id); setShowDetail(msg) }}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={msg.tipo === "invitacion" ? "default" : "secondary"} className="text-[10px]">
                                {msg.tipo === "invitacion" ? "Invitación" : "Mensaje"}
                              </Badge>
                              {!r.leido && <Badge className="bg-blue-500 text-white text-[10px]">Nuevo</Badge>}
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">{msg.detalle}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              De: {msg.remitente_nombre} | {new Date(msg.created_at).toLocaleDateString("es")}
                            </p>
                          </div>
                          <Eye className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="enviados" className="mt-4">
            {enviados.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  <Send className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No ha enviado mensajes</p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Para</TableHead>
                      <TableHead className="text-xs">Detalle</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Evento/Lugar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enviados.map((msg) => (
                      <TableRow key={msg.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setShowDetail(msg)}>
                        <TableCell>
                          <Badge variant={msg.tipo === "invitacion" ? "default" : "secondary"} className="text-[10px]">
                            {msg.tipo === "invitacion" ? "Invitación" : "Mensaje"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{msg.destinatario_nombre || "-"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{msg.detalle}</TableCell>
                        <TableCell className="text-xs">{new Date(msg.fecha).toLocaleDateString("es")}</TableCell>
                        <TableCell className="text-xs">{msg.evento_lugar || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal crear mensaje */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Mensaje / Citación</DialogTitle>
            <DialogDescription>Envíe un mensaje o invitación</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Remitente */}
            <div>
              <Label className="text-sm text-gray-500">Remitente</Label>
              <Input value={`${user?.displayName || ""} - ${title}`} disabled className="bg-gray-50" />
            </div>

            {/* Destinatario */}
            <div className="space-y-2">
              <Label className="text-sm">Para *</Label>
              <Select value={destTipo} onValueChange={(v) => { setDestTipo(v as any); setDestUsuarioId(""); setDestModulo(""); setUserQuery(""); setSelectedUserName("") }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Un usuario específico</SelectItem>
                  <SelectItem value="modulo">Todos los de un módulo</SelectItem>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                </SelectContent>
              </Select>

              {destTipo === "usuario" && (
                <div className="relative">
                  <Input
                    value={userQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="Buscar usuario por nombre..."
                  />
                  {showUserResults && userResults.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {userResults.map((u) => (
                        <button key={u.id} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0" onClick={() => handleSelectUser(u)}>
                          {u.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {destTipo === "modulo" && (
                <Select value={destModulo} onValueChange={setDestModulo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar módulo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULOS_DESTINO.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Tipo */}
            <div>
              <Label className="text-sm">Tipo *</Label>
              <Select value={tipoMensaje} onValueChange={(v) => setTipoMensaje(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensaje">Mensaje</SelectItem>
                  <SelectItem value="invitacion">Invitación</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Detalle */}
            <div>
              <Label className="text-sm">Detalle * <span className="text-gray-400">({detalle.length}/240)</span></Label>
              <Textarea
                value={detalle}
                onChange={(e) => setDetalle(e.target.value.slice(0, 240))}
                placeholder="Escriba el mensaje..."
                maxLength={240}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Fecha *</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm">Valor ($)</Label>
                <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0.00" />
              </div>
            </div>

            <div>
              <Label className="text-sm">Evento o Lugar</Label>
              <Input value={eventoLugar} onChange={(e) => setEventoLugar(e.target.value)} placeholder="Ej: Templo principal, salón 2..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreate(false) }}>Cancelar</Button>
            <Button onClick={handleSend} disabled={saving}>
              {saving ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal detalle */}
      <Dialog open={!!showDetail} onOpenChange={(open) => { if (!open) setShowDetail(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {showDetail?.tipo === "invitacion" ? "Invitación" : "Mensaje"}
            </DialogTitle>
          </DialogHeader>

          {showDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">De</p>
                  <p className="font-medium">{showDetail.remitente_nombre}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Para</p>
                  <p className="font-medium">{showDetail.destinatario_nombre || "Todos"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Fecha</p>
                  <p className="font-medium">{new Date(showDetail.fecha).toLocaleDateString("es")}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Tipo</p>
                  <Badge variant={showDetail.tipo === "invitacion" ? "default" : "secondary"}>
                    {showDetail.tipo === "invitacion" ? "Invitación" : "Mensaje"}
                  </Badge>
                </div>
                {showDetail.valor && (
                  <div>
                    <p className="text-gray-500 text-xs">Valor</p>
                    <p className="font-medium">${showDetail.valor.toFixed(2)}</p>
                  </div>
                )}
                {showDetail.evento_lugar && (
                  <div>
                    <p className="text-gray-500 text-xs">Evento/Lugar</p>
                    <p className="font-medium">{showDetail.evento_lugar}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-gray-500 text-xs">Detalle</p>
                <p className="mt-1 bg-gray-50 p-3 rounded-lg">{showDetail.detalle}</p>
              </div>
              <p className="text-xs text-gray-400">Enviado: {new Date(showDetail.created_at).toLocaleString("es")}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
