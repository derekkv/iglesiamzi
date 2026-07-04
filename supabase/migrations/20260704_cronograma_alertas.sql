-- ============================================================
-- SISTEMA DE ALERTAS Y ACUSES PARA CRONOGRAMA DE SERVICIOS
-- ============================================================

-- 1. Agregar columnas de control de alertas y acuses a cronograma_servicio
ALTER TABLE cronograma_servicio
  ADD COLUMN IF NOT EXISTS acuse_asignacion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acuse_asignacion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alerta2_enviada BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alerta2_enviada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acuse_alerta2 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acuse_alerta2_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alerta1_enviada BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alerta1_enviada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acuse_alerta1 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acuse_alerta1_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_asignacion_enviado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_alerta2_enviado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_alerta1_enviado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_asignacion_enviado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_alerta2_enviado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_alerta1_enviado BOOLEAN DEFAULT FALSE;

-- 2. Índices para consultas del cron (buscar alertas pendientes de enviar)
CREATE INDEX IF NOT EXISTS idx_cronograma_alerta2_pendiente
  ON cronograma_servicio(fecha)
  WHERE alerta2_enviada = FALSE;

CREATE INDEX IF NOT EXISTS idx_cronograma_alerta1_pendiente
  ON cronograma_servicio(fecha)
  WHERE alerta1_enviada = FALSE;

CREATE INDEX IF NOT EXISTS idx_cronograma_acuse_asignacion_pendiente
  ON cronograma_servicio(user_id)
  WHERE acuse_asignacion = FALSE;

-- 3. Tabla de historial detallado de notificaciones enviadas
CREATE TABLE IF NOT EXISTS service_notifications_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cronograma_id INTEGER NOT NULL REFERENCES cronograma_servicio(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('asignacion', 'alerta2', 'alerta1')),
  canal VARCHAR(20) NOT NULL CHECK (canal IN ('buzon', 'push', 'email', 'whatsapp')),
  estado VARCHAR(20) DEFAULT 'enviado' CHECK (estado IN ('enviado', 'fallido', 'leido', 'aceptado')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_notif_cronograma ON service_notifications_log(cronograma_id);
CREATE INDEX IF NOT EXISTS idx_service_notif_user ON service_notifications_log(user_id);
CREATE INDEX IF NOT EXISTS idx_service_notif_tipo ON service_notifications_log(tipo, canal);

-- 4. RLS para service_notifications_log
ALTER TABLE service_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_notifications_log_insert" ON service_notifications_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "service_notifications_log_select" ON service_notifications_log
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "service_notifications_log_update" ON service_notifications_log
  FOR UPDATE TO authenticated
  USING (true);
