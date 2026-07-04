"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
  MessageSquare,
  Wifi,
  WifiOff,
  QrCode,
  Send,
  RefreshCw,
  LogOut,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  Search,
} from "lucide-react"
import { getAllUsers } from "@/lib/admin"
import { formatPhoneForWhatsApp, formatPhoneDisplay } from "@/lib/format-phone"

interface WAStatus {
  connected: boolean
  connecting: boolean
  phoneNumber: string | null
  name: string | null
  lastConnected: string | null
  error?: string
}

interface SendResult {
  phone: string
  success: boolean
  error?: string
  messageId?: string
}

interface RegisteredUser {
  id: string
  username: string
  displayName: string
  phone: string
  account_type: string
  ministerio_name?: string
}

export function WhatsAppTab() {
  const [status, setStatus] = useState<WAStatus>({
    connected: false,
    connecting: false,
    phoneNumber: null,
    name: null,
    lastConnected: null,
  })
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isLoadingQR, setIsLoadingQR] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [serverOnline, setServerOnline] = useState(true)

  // Formulario envío individual
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [searchFilter, setSearchFilter] = useState("")

  // Formulario envío masivo
  const [bulkMessage, setBulkMessage] = useState("")
  const [bulkResults, setBulkResults] = useState<SendResult[]>([])
  const [isSendingBulk, setIsSendingBulk] = useState(false)

  // Usuarios registrados con teléfono
  const [usersWithPhone, setUsersWithPhone] = useState<RegisteredUser[]>([])
  const [selectedBulkUsers, setSelectedBulkUsers] = useState<Set<string>>(new Set())

  // Tab interno
  const [activeSection, setActiveSection] = useState<"connection" | "send" | "bulk">("connection")

  // Polling del estado
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status")
      if (res.status === 503) {
        setServerOnline(false)
        return
      }
      setServerOnline(true)
      const data: WAStatus = await res.json()
      setStatus(data)

      // Si está conectando pero no conectado, buscar QR
      if (data.connecting && !data.connected) {
        fetchQR()
      }
      // Si se conectó, limpiar QR
      if (data.connected) {
        setQrCode(null)
      }
    } catch {
      setServerOnline(false)
    }
  }, [])

  const fetchQR = async () => {
    setIsLoadingQR(true)
    try {
      const res = await fetch("/api/whatsapp/qr")
      if (res.ok) {
        const data: { available: boolean; qr: string | null } = await res.json()
        if (data.available && data.qr) {
          setQrCode(data.qr)
        }
      }
    } catch {
      // silenciar
    } finally {
      setIsLoadingQR(false)
    }
  }

  // Polling cada 3 segundos
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Polling más frecuente del QR cuando está conectando
  useEffect(() => {
    if (status.connecting && !status.connected) {
      const qrInterval = setInterval(fetchQR, 5000)
      return () => clearInterval(qrInterval)
    }
  }, [status.connecting, status.connected])

  // Cargar usuarios registrados con teléfono
  useEffect(() => {
    const loadUsers = async () => {
      const result = await getAllUsers()
      if (result.success && result.users) {
        const withPhone = result.users
          .filter((u: any) => u.phone && u.phone.trim() !== "" && u.is_active)
          .map((u: any) => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            phone: u.phone,
            account_type: u.account_type,
            ministerio_name: u.ministerio_name,
          }))
        setUsersWithPhone(withPhone)
      }
    }
    loadUsers()
  }, [])

  // Cuando se selecciona un usuario, poner su número en el campo
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId)
    if (userId === "__manual__") {
      setPhone("")
      return
    }
    const user = usersWithPhone.find((u) => u.id === userId)
    if (user) {
      setPhone(user.phone)
    }
  }

  // Filtrar usuarios para búsqueda
  const filteredUsers = usersWithPhone.filter((u) => {
    const q = searchFilter.toLowerCase()
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      (u.ministerio_name || "").toLowerCase().includes(q)
    )
  })

  // Toggle selección masiva
  const toggleBulkUser = (userId: string) => {
    setSelectedBulkUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  // Seleccionar/deseleccionar todos
  const toggleAllBulkUsers = () => {
    if (selectedBulkUsers.size === filteredUsers.length) {
      setSelectedBulkUsers(new Set())
    } else {
      setSelectedBulkUsers(new Set(filteredUsers.map((u) => u.id)))
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" })
      const data: { success: boolean; error?: string } = await res.json()
      if (data.success) {
        toast.success("Iniciando conexión. Escanee el código QR.")
        // Esperar un poco y luego buscar QR
        setTimeout(fetchQR, 2000)
      } else {
        toast.error(data.error || "Error al conectar")
      }
    } catch {
      toast.error("Servidor WhatsApp no disponible")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" })
      const data: { success: boolean } = await res.json()
      if (data.success) {
        toast.success("Desconectado")
        setQrCode(null)
        setStatus((prev) => ({ ...prev, connected: false, connecting: false }))
      }
    } catch {
      toast.error("Error al desconectar")
    }
  }

  const handleLogout = async () => {
    if (!confirm("¿Cerrar sesión de WhatsApp? Necesitará escanear el QR nuevamente.")) return
    try {
      const res = await fetch("/api/whatsapp/logout", { method: "POST" })
      const data: { success: boolean } = await res.json()
      if (data.success) {
        toast.success("Sesión cerrada. Escanee QR para reconectar.")
        setQrCode(null)
        setStatus({
          connected: false,
          connecting: false,
          phoneNumber: null,
          name: null,
          lastConnected: null,
        })
      }
    } catch {
      toast.error("Error al cerrar sesión")
    }
  }

  const handleSendMessage = async () => {
    if (!phone.trim() || !message.trim()) {
      toast.error("Ingrese número y mensaje")
      return
    }

    const formattedPhone = formatPhoneForWhatsApp(phone.trim())

    setIsSending(true)
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone, message: message.trim() }),
      })
      const data: { success: boolean; error?: string } = await res.json()
      if (data.success) {
        toast.success(`Mensaje enviado a ${formatPhoneDisplay(phone)}`)
        setMessage("")
      } else {
        toast.error(data.error || "Error al enviar mensaje")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setIsSending(false)
    }
  }

  const handleSendBulk = async () => {
    if (selectedBulkUsers.size === 0 || !bulkMessage.trim()) {
      toast.error("Seleccione al menos un usuario y escriba un mensaje")
      return
    }

    const phones = usersWithPhone
      .filter((u) => selectedBulkUsers.has(u.id))
      .map((u) => formatPhoneForWhatsApp(u.phone))

    if (phones.length === 0) {
      toast.error("No hay números válidos")
      return
    }

    if (!confirm(`¿Enviar mensaje a ${phones.length} contactos?`)) return

    setIsSendingBulk(true)
    setBulkResults([])

    try {
      const res = await fetch("/api/whatsapp/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones, message: bulkMessage.trim() }),
      })
      const data: { success: boolean; results?: SendResult[]; error?: string } = await res.json()
      if (data.success) {
        setBulkResults(data.results || [])
        const sent = (data.results || []).filter((r) => r.success).length
        toast.success(`${sent}/${phones.length} mensajes enviados`)
      } else {
        toast.error(data.error || "Error al enviar mensajes")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setIsSendingBulk(false)
    }
  }

  // ============ RENDER ============

  if (!serverOnline) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <WifiOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Servidor WhatsApp No Disponible</h3>
            <p className="text-gray-600 mb-4">
              El servidor de WhatsApp no está corriendo. Inicie el servidor con:
            </p>
            <code className="bg-gray-100 px-4 py-2 rounded text-sm font-mono">
              cd whatsapp-server && npm run dev
            </code>
            <div className="mt-6">
              <Button onClick={fetchStatus} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar Conexión
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con estado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-600" />
            WhatsApp
          </h2>
          <p className="text-gray-600">Gestione la conexión y envíe mensajes por WhatsApp</p>
        </div>
        <div className="flex items-center gap-3">
          {status.connected ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              Conectado
            </Badge>
          ) : status.connecting ? (
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Conectando...
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              Desconectado
            </Badge>
          )}
        </div>
      </div>

      {/* Info de conexión activa */}
      {status.connected && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-green-100 rounded-full p-3">
                  <Phone className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">{status.name || "WhatsApp"}</p>
                  <p className="text-sm text-green-700">+{status.phoneNumber}</p>
                  {status.lastConnected && (
                    <p className="text-xs text-green-600">
                      Conectado desde: {new Date(status.lastConnected).toLocaleString("es-ES")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  <WifiOff className="w-4 h-4 mr-1" />
                  Desconectar
                </Button>
                <Button variant="destructive" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-1" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navegación interna */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeSection === "connection" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSection("connection")}
        >
          <QrCode className="w-4 h-4 mr-1" />
          Conexión
        </Button>
        <Button
          variant={activeSection === "send" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSection("send")}
          disabled={!status.connected}
        >
          <Send className="w-4 h-4 mr-1" />
          Enviar Mensaje
        </Button>
        <Button
          variant={activeSection === "bulk" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSection("bulk")}
          disabled={!status.connected}
        >
          <Users className="w-4 h-4 mr-1" />
          Envío Masivo
        </Button>
      </div>

      {/* Sección: Conexión / QR */}
      {activeSection === "connection" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Conexión WhatsApp
            </CardTitle>
            <CardDescription>
              {status.connected
                ? "WhatsApp está conectado y listo para enviar mensajes."
                : "Escanee el código QR con WhatsApp para conectar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!status.connected && !status.connecting && (
              <div className="text-center py-8">
                <WifiOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">WhatsApp no está conectado</p>
                <Button onClick={handleConnect} disabled={isConnecting} size="lg">
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4 mr-2" />
                      Generar QR para Conectar
                    </>
                  )}
                </Button>
              </div>
            )}

            {(status.connecting || (qrCode && !status.connected)) && (
              <div className="text-center py-6">
                {qrCode ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Abra WhatsApp &gt; Dispositivos vinculados &gt; Vincular dispositivo
                    </p>
                    <div className="inline-block bg-white p-4 rounded-xl shadow-lg border">
                      <img
                        src={qrCode}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64 mx-auto"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      El QR se actualiza automáticamente. Si expira, haga clic en refrescar.
                    </p>
                    <Button variant="outline" size="sm" onClick={fetchQR} disabled={isLoadingQR}>
                      <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingQR ? "animate-spin" : ""}`} />
                      Refrescar QR
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-500 mx-auto animate-spin" />
                    <p className="text-gray-600">Generando código QR...</p>
                  </div>
                )}
              </div>
            )}

            {status.connected && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-green-700 font-medium text-lg">WhatsApp conectado exitosamente</p>
                <p className="text-gray-600 mt-2">
                  Puede enviar mensajes usando las secciones de arriba.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sección: Enviar mensaje individual */}
      {activeSection === "send" && status.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Enviar Mensaje
            </CardTitle>
            <CardDescription>
              Seleccione un usuario registrado o ingrese un número manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Seleccionar Usuario</Label>
              <Select value={selectedUserId} onValueChange={handleSelectUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un usuario con teléfono..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">✏️ Ingresar número manualmente</SelectItem>
                  {usersWithPhone.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.displayName} — {formatPhoneDisplay(user.phone)}
                      {user.ministerio_name ? ` (${user.ministerio_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {usersWithPhone.length} usuarios con número registrado
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Número de Teléfono</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="593999999999 (con código de país, sin +)"
                disabled={selectedUserId !== "" && selectedUserId !== "__manual__"}
              />
              <p className="text-xs text-gray-500">
                Incluya el código de país sin + ni espacios. Ej: 593987654321
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escriba su mensaje aquí..."
                rows={4}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={isSending || !phone.trim() || !message.trim()}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Mensaje
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sección: Envío masivo */}
      {activeSection === "bulk" && status.connected && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Envío Masivo
              </CardTitle>
              <CardDescription>
                Seleccione los usuarios registrados a quienes enviar el mensaje.
                Solo se muestran usuarios activos con número de teléfono.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar por nombre, usuario, teléfono o ministerio..."
                  className="pl-10"
                />
              </div>

              {/* Seleccionar/Deseleccionar todos */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={filteredUsers.length > 0 && selectedBulkUsers.size === filteredUsers.length}
                    onCheckedChange={toggleAllBulkUsers}
                  />
                  <span className="text-sm font-medium">
                    Seleccionar todos ({filteredUsers.length})
                  </span>
                </div>
                <Badge variant="outline">
                  {selectedBulkUsers.size} seleccionados
                </Badge>
              </div>

              {/* Lista de usuarios */}
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No hay usuarios con teléfono registrado
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedBulkUsers.has(user.id)}
                        onCheckedChange={() => toggleBulkUser(user.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{user.displayName}</span>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {user.account_type === "ministerio" ? user.ministerio_name || "Ministerio" : "Personal"}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500 font-mono">{formatPhoneDisplay(user.phone)}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>

              {/* Mensaje */}
              <div className="grid gap-2">
                <Label htmlFor="bulk-message">Mensaje</Label>
                <Textarea
                  id="bulk-message"
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  placeholder="Escriba el mensaje que se enviará a todos los seleccionados..."
                  rows={4}
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Los mensajes se envían con intervalos aleatorios (1-3 seg) para
                  evitar bloqueos. Envíos grandes pueden tomar varios minutos.
                </p>
              </div>

              <Button
                onClick={handleSendBulk}
                disabled={isSendingBulk || selectedBulkUsers.size === 0 || !bulkMessage.trim()}
                className="w-full"
              >
                {isSendingBulk ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando a {selectedBulkUsers.size} contactos...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar a {selectedBulkUsers.size} Contactos
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Resultados del envío masivo */}
          {bulkResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resultados del Envío</CardTitle>
                <CardDescription>
                  {bulkResults.filter((r) => r.success).length}/{bulkResults.length} mensajes enviados exitosamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkResults.map((result, idx) => {
                      const user = usersWithPhone.find((u) => u.phone === result.phone)
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">{result.phone}</TableCell>
                          <TableCell className="text-sm">{user?.displayName || "-"}</TableCell>
                          <TableCell>
                            {result.success ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Enviado
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 border-red-200">
                                <XCircle className="w-3 h-3 mr-1" />
                                Error
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {result.success ? `ID: ${result.messageId || "-"}` : result.error}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
