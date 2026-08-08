-- Tabla para almacenar los cumpleañeros del día, usada por el handler "VER"
-- del webhook de WhatsApp. El cron de cumpleaños la llena y el webhook la lee
-- cuando un admin responde "VER" para recibir los videos gratis.
CREATE TABLE IF NOT EXISTS cumpleanos_pendientes_ver (
  id BIGSERIAL PRIMARY KEY,
  censo_id INTEGER NOT NULL,
  fuente TEXT NOT NULL,
  nombre TEXT NOT NULL,
  edad INTEGER NOT NULL,
  celular TEXT,
  fecha DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(censo_id, fuente, fecha)
);

-- Índice para buscar por fecha rápidamente
CREATE INDEX IF NOT EXISTS idx_cumpleanos_pendientes_ver_fecha
  ON cumpleanos_pendientes_ver(fecha);

-- RLS: solo service_role necesita acceso (se usa desde el backend)
ALTER TABLE cumpleanos_pendientes_ver ENABLE ROW LEVEL SECURITY;

-- Política que permite todo al service_role (el cron y webhook usan service_role)
CREATE POLICY "service_role_full_access" ON cumpleanos_pendientes_ver
  FOR ALL
  USING (true)
  WITH CHECK (true);
