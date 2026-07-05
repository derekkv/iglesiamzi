-- =============================================
-- Tabla para gestión de servidores atrasados
-- Cuando alguien es marcado como "atrasado" en asistencia de servidores,
-- se crea un registro aquí para que el líder lo gestione.
-- =============================================

CREATE TABLE IF NOT EXISTS gestion_atrasados (
  id SERIAL PRIMARY KEY,
  modulo TEXT NOT NULL,              -- ej: "protocolo", "mdg", "alabanza"
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  fecha TEXT NOT NULL,               -- fecha del atraso (YYYY-MM-DD)
  -- Gestión del líder
  gestionado BOOLEAN DEFAULT FALSE,
  respuesta_gestion BOOLEAN,         -- true = Sí se gestionó, false = No
  acuerdo TEXT,                      -- máximo 240 chars, acuerdo al que llegaron
  gestionado_por UUID REFERENCES users(id),
  gestionado_por_nombre TEXT,
  fecha_gestion TIMESTAMPTZ,
  -- Notificación
  notificado BOOLEAN DEFAULT FALSE,
  notificado_at TIMESTAMPTZ,
  -- Metadata
  registrado_por UUID REFERENCES users(id),
  registrado_por_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(modulo, user_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_gestion_atrasados_modulo ON gestion_atrasados(modulo);
CREATE INDEX IF NOT EXISTS idx_gestion_atrasados_gestionado ON gestion_atrasados(gestionado);
CREATE INDEX IF NOT EXISTS idx_gestion_atrasados_user ON gestion_atrasados(user_id);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE gestion_atrasados;
