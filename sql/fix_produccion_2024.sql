-- ============================================================
-- Correcciones para producción — Módulos WhatsApp, Cumpleaños, Push
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. RPC para incremento atómico de unread_count (evita race condition)
CREATE OR REPLACE FUNCTION increment_unread_count(contact_id_param UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE wa_contacts
  SET unread_count = unread_count + 1,
      updated_at = now()
  WHERE id = contact_id_param;
$$;

-- 2. Columna video_error en cumpleanos_enviados para registrar fallos de generación
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cumpleanos_enviados' AND column_name = 'video_error'
  ) THEN
    ALTER TABLE cumpleanos_enviados ADD COLUMN video_error TEXT;
    COMMENT ON COLUMN cumpleanos_enviados.video_error IS 'Detalle del error si la generación de video falló';
  END IF;
END $$;

-- 3. Índice para consultas de reintentos (personas donde todo falló)
CREATE INDEX IF NOT EXISTS idx_cumpleanos_enviados_fallidos
  ON cumpleanos_enviados (anio, fuente)
  WHERE canal_buzon = false
    AND canal_push = false
    AND canal_email = false
    AND canal_whatsapp_imagen = false;

-- 4. Tabla de configuración de admins para notificaciones
-- (en vez de IDs hardcodeados en el código)
CREATE TABLE IF NOT EXISTS admin_notification_config (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  config_key    TEXT NOT NULL UNIQUE,
  user_ids      UUID[] NOT NULL DEFAULT '{}',
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Insertar config por defecto para cumpleaños
INSERT INTO admin_notification_config (config_key, user_ids, description)
VALUES (
  'birthday_notify',
  ARRAY['bb4dce93-0345-4203-8e8a-76b6d58490e8', '5047fe7d-0e7b-4752-b25a-ae3b9bbac009']::UUID[],
  'Administradores que reciben el resumen diario de cumpleaños'
)
ON CONFLICT (config_key) DO NOTHING;

-- RLS para admin_notification_config
ALTER TABLE admin_notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_admin_notification_config"
  ON admin_notification_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
