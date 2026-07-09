import express from "express"
import cors from "cors"
import multer from "multer"
import { WhatsAppService } from "./whatsapp-service"

const app = express()
const PORT = process.env.WA_SERVER_PORT || 3100

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "https://panel.iglesiaregalodedios.com",
  credentials: true,
}))
app.use(express.json())

// Multer: almacenar archivos en memoria (Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB max
})

const waService = new WhatsAppService()

// ============ ENDPOINTS ============

// Estado de la conexión
app.get("/api/whatsapp/status", (req, res) => {
  const status = waService.getStatus()
  res.json(status)
})

// Obtener QR code como base64 (para mostrar en el frontend)
app.get("/api/whatsapp/qr", (req, res) => {
  const qr = waService.getQR()
  if (qr) {
    res.json({ qr, available: true })
  } else {
    res.json({ qr: null, available: false, message: "No hay QR disponible. Puede que ya esté conectado." })
  }
})

// Iniciar/reiniciar conexión
app.post("/api/whatsapp/connect", async (req, res) => {
  try {
    await waService.connect()
    res.json({ success: true, message: "Conexión iniciada. Escanee el QR." })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Desconectar
app.post("/api/whatsapp/disconnect", async (req, res) => {
  try {
    await waService.disconnect()
    res.json({ success: true, message: "Desconectado exitosamente." })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Enviar mensaje de texto
app.post("/api/whatsapp/send", async (req, res) => {
  const { phone, message } = req.body

  if (!phone || !message) {
    return res.status(400).json({ success: false, error: "Se requiere 'phone' y 'message'" })
  }

  try {
    const result = await waService.sendMessage(phone, message)
    res.json({ success: true, messageId: result.key.id })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Enviar mensaje masivo
app.post("/api/whatsapp/send-bulk", async (req, res) => {
  const { phones, message } = req.body

  if (!phones || !Array.isArray(phones) || !message) {
    return res.status(400).json({ success: false, error: "Se requiere 'phones' (array) y 'message'" })
  }

  try {
    const results = await waService.sendBulkMessages(phones, message)
    res.json({ success: true, results })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Enviar media (imagen, video, audio, documento) a un número
app.post("/api/whatsapp/send-media", upload.single("file"), async (req, res) => {
  const { phone, caption, mediaType } = req.body

  if (!phone || !req.file) {
    return res.status(400).json({ success: false, error: "Se requiere 'phone' y un archivo 'file'" })
  }

  const type = mediaType || detectMediaType(req.file.mimetype)

  try {
    const result = await waService.sendMedia(
      phone,
      req.file.buffer,
      type,
      caption || undefined,
      req.file.mimetype,
      req.file.originalname
    )
    res.json({ success: true, messageId: result.key.id })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Enviar media masivo
app.post("/api/whatsapp/send-bulk-media", upload.single("file"), async (req, res) => {
  const { phones, caption, mediaType } = req.body

  if (!phones || !req.file) {
    return res.status(400).json({ success: false, error: "Se requiere 'phones' (JSON array string) y un archivo 'file'" })
  }

  let phoneList: string[]
  try {
    phoneList = JSON.parse(phones)
    if (!Array.isArray(phoneList)) throw new Error()
  } catch {
    return res.status(400).json({ success: false, error: "'phones' debe ser un JSON array válido" })
  }

  const type = mediaType || detectMediaType(req.file.mimetype)

  try {
    const results = await waService.sendBulkMedia(
      phoneList,
      req.file.buffer,
      type,
      caption || undefined,
      req.file.mimetype,
      req.file.originalname
    )
    res.json({ success: true, results })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Cerrar sesión (borra credenciales guardadas)
app.post("/api/whatsapp/logout", async (req, res) => {
  try {
    await waService.logout()
    res.json({ success: true, message: "Sesión cerrada. Necesitará escanear QR nuevamente." })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============ HELPERS ============

function detectMediaType(mimetype: string): "image" | "video" | "audio" | "document" {
  if (mimetype.startsWith("image/")) return "image"
  if (mimetype.startsWith("video/")) return "video"
  if (mimetype.startsWith("audio/")) return "audio"
  return "document"
}

// ============ INICIAR SERVIDOR ============

app.listen(PORT, () => {
  console.log(`🟢 WhatsApp Server corriendo en puerto ${PORT}`)
  // Auto-conectar al iniciar
  waService.connect().catch((err) => {
    console.log("⚠️  Auto-conexión fallida (normal si es primera vez):", err.message)
  })
})
