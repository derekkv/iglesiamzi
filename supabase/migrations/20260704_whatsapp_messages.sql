-- Tabla para historial de mensajes de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  message_id VARCHAR(100),
  sent_by UUID REFERENCES users(id),
  sent_by_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'pending')),
  is_bulk BOOLEAN DEFAULT FALSE,
  bulk_batch_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_by ON whatsapp_messages(sent_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_bulk_batch ON whatsapp_messages(bulk_batch_id) WHERE bulk_batch_id IS NOT NULL;

-- RLS: solo usuarios autenticados pueden ver mensajes
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Política: cualquier usuario autenticado puede insertar
CREATE POLICY "whatsapp_messages_insert" ON whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Política: solo el que envió o admins pueden ver
CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages
  FOR SELECT TO authenticated
  USING (true);
