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

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 5000

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
      // Asegurar que existe la carpeta de auth
      if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true })
      }

      // Obtener la versión más reciente del protocolo
      const { version, isLatest } = await fetchLatestBaileysVersion()
      console.log(`📋 Usando versión WA: ${version.join(".")} (${isLatest ? "última" : "cache"})`)

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER)

      this.socket = makeWASocket({
        auth: state,
        logger,
        version,
        browser: ["IglesiaMZI", "Chrome", "1.0.0"],
      })

      // Manejar actualizaciones de conexión
      this.socket.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
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
            this.cleanAuthFolder()
            // Solo reconectar una vez con credenciales limpias
            if (this.reconnectAttempts < 2) {
              this.reconnectAttempts++
              setTimeout(() => this.connect(), 3000)
            } else {
              console.log("⛔ Múltiples fallos con credenciales limpias. Detenido.")
              this.reconnectAttempts = 0
            }
            return
          }

          if (shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++
            console.log(`🔄 Reintento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`)
            setTimeout(() => this.connect(), RECONNECT_DELAY_MS)
          } else if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log("⛔ Máximo de reintentos alcanzado.")
            this.reconnectAttempts = 0
          } else {
            // Logout intencional
            this.cleanAuthFolder()
          }
        }

        if (connection === "open") {
          this.status.connected = true
          this.status.connecting = false
          this.qrCode = null
          this.connectingLock = false
          this.reconnectAttempts = 0
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

      // Guardar credenciales cuando se actualizan
      this.socket.ev.on("creds.update", saveCreds)
    } catch (err: any) {
      console.error("❌ Error iniciando conexión:", err.message)
      this.status.connecting = false
      this.connectingLock = false
    }
  }

  async disconnect(): Promise<void> {
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS // evitar reconexión
    if (this.socket) {
      this.socket.end(undefined)
      this.socket = null
    }
    this.status.connected = false
    this.status.connecting = false
    this.qrCode = null
    this.connectingLock = false
  }

  async logout(): Promise<void> {
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS
    if (this.socket) {
      try {
        await this.socket.logout()
      } catch (err) {
        // Si falla el logout, igual limpiamos
      }
      this.socket = null
    }
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
    console.log(`📤 Mensaje enviado a ${cleanPhone}`)
    return result!
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
