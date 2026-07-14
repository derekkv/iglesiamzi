import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
  ConnectionState,
  proto,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import pino from "pino"
import * as QRCode from "qrcode"
import * as path from "path"
import * as fs from "fs"

const AUTH_FOLDER = path.join(__dirname, "..", "auth_info")
const logger = pino({ level: "silent" })

const MAX_RECONNECT_ATTEMPTS = 8
const BASE_RECONNECT_DELAY_MS = 2000 // 2s base, crece exponencialmente
const MAX_RECONNECT_DELAY_MS = 60000 // máximo 60s entre reintentos
const WATCHDOG_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutos sin evento = socket muerto

export interface WAStatus {
  connected: boolean
  connecting: boolean
  phoneNumber: string | null
  name: string | null
  lastConnected: string | null
}

export class WhatsAppService {
  private socket: WASocket | null = null
  private qrCode: string | null = null
  private reconnectAttempts = 0
  private connectingLock = false
  private lastEventTimestamp = Date.now()
  private watchdogInterval: NodeJS.Timeout | null = null
  private status: WAStatus = {
    connected: false,
    connecting: false,
    phoneNumber: null,
    name: null,
    lastConnected: null,
  }

  getStatus(): WAStatus {
    return { ...this.status }
  }

  getQR(): string | null {
    return this.qrCode
  }

  /**
   * Calcula el delay de reconexión con backoff exponencial + jitter.
   * Intento 1: ~2-3s, Intento 2: ~4-6s, Intento 3: ~8-12s, etc.
   */
  private getReconnectDelay(): number {
    const exponentialDelay = BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1)
    const cappedDelay = Math.min(exponentialDelay, MAX_RECONNECT_DELAY_MS)
    // Agregar jitter aleatorio (±30%) para evitar thundering herd
    const jitter = cappedDelay * (0.7 + Math.random() * 0.6)
    return Math.round(jitter)
  }

  /**
   * Watchdog: si no recibimos ningún evento del socket en 5 minutos,
   * asumimos que está congelado y matamos el proceso para que PM2 lo reinicie.
   */
  private startWatchdog(): void {
    this.stopWatchdog()
    this.lastEventTimestamp = Date.now()

    this.watchdogInterval = setInterval(() => {
      const elapsed = Date.now() - this.lastEventTimestamp
      if (elapsed > WATCHDOG_TIMEOUT_MS) {
        console.error(`🐕 WATCHDOG: Sin eventos por ${Math.round(elapsed / 1000)}s. Socket congelado. Terminando proceso...`)
        process.exit(1) // PM2 lo reiniciará
      }
    }, 60_000) // Verificar cada 60 segundos
  }

  private stopWatchdog(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval)
      this.watchdogInterval = null
    }
  }

  /** Registra actividad para el watchdog */
  private touchWatchdog(): void {
    this.lastEventTimestamp = Date.now()
  }

  /**
   * Destruye el socket actual completamente: cierra conexión,
   * remueve todos los listeners, y libera la referencia.
   */
  private destroySocket(): void {
    if (this.socket) {
      try {
        // Remover todos los event listeners para evitar leaks
        this.socket.ev.removeAllListeners("connection.update")
        this.socket.ev.removeAllListeners("creds.update")
        this.socket.ev.removeAllListeners("messages.upsert")
        // Cerrar el socket
        this.socket.end(undefined)
      } catch (err) {
        // Ignorar errores al destruir — el socket puede ya estar muerto
      }
      this.socket = null
    }
  }

  async connect(): Promise<void> {
    // Si ya está conectado, no hacer nada
    if (this.status.connected && this.socket) {
      return
    }

    // Evitar conexiones múltiples simultáneas
    if (this.connectingLock) {
      return
    }
    this.connectingLock = true

    this.status.connecting = true
    this.qrCode = null

    try {
      // Destruir socket anterior si existe (evitar listeners duplicados)
      this.destroySocket()

      // Asegurar que existe la carpeta de auth
      if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true })
      }

      // Obtener la versión más reciente del protocolo — siempre fresca, sin cache
      const { version, isLatest } = await fetchLatestBaileysVersion()
      console.log(`📋 Usando versión WA: ${version.join(".")} (${isLatest ? "última" : "actualizada"})`)

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER)

      this.socket = makeWASocket({
        auth: state,
        logger,
        version,
        browser: ["IglesiaRegaloDeDios", "Chrome", "1.0.0"],
        // No cachear la versión — fetchLatestBaileysVersion ya nos da la más reciente
        printQRInTerminal: false,
      })

      // Iniciar watchdog
      this.startWatchdog()

      // Manejar actualizaciones de conexión
      this.socket.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        this.touchWatchdog()
        const { connection, lastDisconnect, qr } = update

        if (qr) {
          // Convertir QR a base64 data URL para enviar al frontend
          try {
            this.qrCode = await QRCode.toDataURL(qr, {
              width: 300,
              margin: 2,
              color: { dark: "#000000", light: "#ffffff" },
            })
            console.log("📱 Nuevo QR generado - esperando escaneo...")
          } catch (err) {
            console.error("Error generando QR:", err)
          }
        }

        if (connection === "close") {
          this.status.connected = false
          this.status.connecting = false
          this.qrCode = null
          this.connectingLock = false

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut

          console.log(`❌ Conexión cerrada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`)

          // Si las credenciales son inválidas (401, 403, 405), limpiar y empezar de cero
          if (statusCode === 401 || statusCode === 403 || statusCode === 405) {
            console.log("🗑️  Credenciales inválidas. Limpiando...")
            this.destroySocket()
            this.cleanAuthFolder()
            if (this.reconnectAttempts < 2) {
              this.reconnectAttempts++
              const delay = this.getReconnectDelay()
              console.log(`🔄 Reintento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} en ${Math.round(delay / 1000)}s...`)
              setTimeout(() => this.connect(), delay)
            } else {
              console.log("⛔ Múltiples fallos con credenciales limpias. Detenido.")
              this.reconnectAttempts = 0
              this.stopWatchdog()
            }
            return
          }

          if (shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++
            const delay = this.getReconnectDelay()
            console.log(`🔄 Reintento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} en ${Math.round(delay / 1000)}s (backoff)...`)
            // Destruir el socket viejo antes de reconectar
            this.destroySocket()
            setTimeout(() => this.connect(), delay)
          } else if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error(`⛔ Máximo de reintentos (${MAX_RECONNECT_ATTEMPTS}) alcanzado. Matando proceso para reinicio limpio...`)
            this.stopWatchdog()
            // Dar un momento para que los logs se escriban
            setTimeout(() => process.exit(1), 1000)
          } else {
            // Logout intencional
            this.destroySocket()
            this.cleanAuthFolder()
            this.stopWatchdog()
          }
        }

        if (connection === "open") {
          this.status.connected = true
          this.status.connecting = false
          this.qrCode = null
          this.connectingLock = false
          this.reconnectAttempts = 0 // Reset en conexión exitosa
          this.status.lastConnected = new Date().toISOString()

          // Obtener info del usuario conectado
          const user = this.socket?.user
          if (user) {
            this.status.phoneNumber = user.id.split(":")[0].split("@")[0]
            this.status.name = user.name || null
          }

          console.log(`✅ WhatsApp conectado como ${this.status.name} (${this.status.phoneNumber})`)
        }
      })

      // Guardar credenciales cuando se actualizan — SIEMPRE
      this.socket.ev.on("creds.update", () => {
        this.touchWatchdog()
        saveCreds()
      })

      // Escuchar mensajes para mantener vivo el watchdog
      this.socket.ev.on("messages.upsert", () => {
        this.touchWatchdog()
      })
    } catch (err: any) {
      console.error("❌ Error iniciando conexión:", err.message)
      this.status.connecting = false
      this.connectingLock = false

      // Si falla la conexión inicial, intentar reconectar con backoff
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++
        const delay = this.getReconnectDelay()
        console.log(`🔄 Error en connect(). Reintento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} en ${Math.round(delay / 1000)}s...`)
        setTimeout(() => this.connect(), delay)
      } else {
        console.error("⛔ Error persistente en connect(). Matando proceso...")
        setTimeout(() => process.exit(1), 1000)
      }
    }
  }

  async disconnect(): Promise<void> {
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS // evitar reconexión
    this.stopWatchdog()
    this.destroySocket()
    this.status.connected = false
    this.status.connecting = false
    this.qrCode = null
    this.connectingLock = false
  }

  async logout(): Promise<void> {
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS
    this.stopWatchdog()
    if (this.socket) {
      try {
        await this.socket.logout()
      } catch (err) {
        // Si falla el logout, igual limpiamos
      }
    }
    this.destroySocket()
    this.status = {
      connected: false,
      connecting: false,
      phoneNumber: null,
      name: null,
      lastConnected: null,
    }
    this.qrCode = null
    this.connectingLock = false
    this.reconnectAttempts = 0
    this.cleanAuthFolder()
  }

  async sendMessage(phone: string, message: string): Promise<proto.WebMessageInfo> {
    if (!this.socket || !this.status.connected) {
      throw new Error("WhatsApp no está conectado")
    }

    const cleanPhone = this.formatPhoneNumber(phone)
    const jid = cleanPhone.includes("@s.whatsapp.net")
      ? cleanPhone
      : `${cleanPhone}@s.whatsapp.net`

    const result = await this.socket.sendMessage(jid, { text: message })
    this.touchWatchdog()
    console.log(`📤 Mensaje enviado a ${cleanPhone}`)
    return result!
  }

  async sendMedia(
    phone: string,
    mediaBuffer: Buffer,
    mediaType: "image" | "video" | "audio" | "document",
    caption?: string,
    mimetype?: string,
    fileName?: string
  ): Promise<proto.WebMessageInfo> {
    if (!this.socket || !this.status.connected) {
      throw new Error("WhatsApp no está conectado")
    }

    const cleanPhone = this.formatPhoneNumber(phone)
    const jid = cleanPhone.includes("@s.whatsapp.net")
      ? cleanPhone
      : `${cleanPhone}@s.whatsapp.net`

    let messageContent: any

    switch (mediaType) {
      case "image":
        messageContent = { image: mediaBuffer, caption: caption || undefined, mimetype: mimetype || "image/jpeg" }
        break
      case "video":
        messageContent = { video: mediaBuffer, caption: caption || undefined, mimetype: mimetype || "video/mp4" }
        break
      case "audio":
        messageContent = { audio: mediaBuffer, mimetype: mimetype || "audio/ogg; codecs=opus", ptt: true }
        break
      case "document":
        messageContent = { document: mediaBuffer, mimetype: mimetype || "application/pdf", fileName: fileName || "archivo", caption: caption || undefined }
        break
      default:
        throw new Error(`Tipo de media no soportado: ${mediaType}`)
    }

    const result = await this.socket.sendMessage(jid, messageContent)
    this.touchWatchdog()
    console.log(`📤 Media (${mediaType}) enviado a ${cleanPhone}`)
    return result!
  }

  async sendBulkMedia(
    phones: string[],
    mediaBuffer: Buffer,
    mediaType: "image" | "video" | "audio" | "document",
    caption?: string,
    mimetype?: string,
    fileName?: string
  ): Promise<{ phone: string; success: boolean; error?: string; messageId?: string }[]> {
    if (!this.socket || !this.status.connected) {
      throw new Error("WhatsApp no está conectado")
    }

    const results: { phone: string; success: boolean; error?: string; messageId?: string }[] = []

    for (const phone of phones) {
      try {
        const result = await this.sendMedia(phone, mediaBuffer, mediaType, caption, mimetype, fileName)
        results.push({ phone, success: true, messageId: result.key.id || undefined })
        await this.delay(1000 + Math.random() * 2000)
      } catch (error: any) {
        results.push({ phone, success: false, error: error.message })
      }
    }

    return results
  }

  async sendBulkMessages(
    phones: string[],
    message: string
  ): Promise<{ phone: string; success: boolean; error?: string; messageId?: string }[]> {
    if (!this.socket || !this.status.connected) {
      throw new Error("WhatsApp no está conectado")
    }

    const results: { phone: string; success: boolean; error?: string; messageId?: string }[] = []

    for (const phone of phones) {
      try {
        const result = await this.sendMessage(phone, message)
        results.push({ phone, success: true, messageId: result.key.id || undefined })
        // Esperar entre mensajes para evitar ban (1-3 segundos aleatorio)
        await this.delay(1000 + Math.random() * 2000)
      } catch (error: any) {
        results.push({ phone, success: false, error: error.message })
      }
    }

    return results
  }

  /**
   * Formatea un número de teléfono al formato internacional para WhatsApp.
   * Maneja estos casos:
   * - "0980932062" → "593980932062" (quita el 0 inicial, agrega 593)
   * - "+593980932062" → "593980932062" (quita el +)
   * - "593980932062" → "593980932062" (ya está correcto)
   * - "09 8093 2062" → "593980932062" (quita espacios, formatea)
   */
  private formatPhoneNumber(phone: string): string {
    // Limpiar: quitar +, espacios, guiones, paréntesis, puntos
    let cleaned = phone.replace(/[\s\-\+\(\)\.]/g, "")

    // Si empieza con 0 y tiene 10 dígitos (formato local Ecuador: 09XXXXXXXX)
    if (cleaned.startsWith("0") && cleaned.length === 10) {
      cleaned = "593" + cleaned.substring(1)
    }

    // Si tiene 9 dígitos y empieza con 9 (solo el número sin código de país ni 0)
    if (cleaned.length === 9 && cleaned.startsWith("9")) {
      cleaned = "593" + cleaned
    }

    return cleaned
  }

  private cleanAuthFolder(): void {
    try {
      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true })
        console.log("🗑️  Credenciales eliminadas")
      }
    } catch (err) {
      console.error("Error limpiando credenciales:", err)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
