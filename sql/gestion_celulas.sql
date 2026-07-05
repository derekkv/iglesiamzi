-- =============================================
-- Tabla para gestión semanal de miembros en células
-- Cada registro = una gestión de un miembro en una semana específica
-- =============================================

CREATE TABLE IF NOT EXISTS gestion_celulas (
  id SERIAL PRIMARY KEY,
  miembro_id INTEGER NOT NULL,
  fuente TEXT NOT NULL CHECK (fuente IN ('protocolo', 'mdg')),
  celula_nombre TEXT NOT NULL,
  semana_inicio DATE NOT NULL, -- Lunes de la semana
  gestionado BOOLEAN NOT NULL DEFAULT false,
  respuesta TEXT, -- Notas/respuesta de la gestión
  asistio BOOLEAN, -- Si asistió o faltó a la célula esa semana
  gestionado_por TEXT, -- user_id de quien gestionó
  gestionado_por_nombre TEXT, -- nombre del usuario
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(miembro_id, fuente, semana_inicio)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_gestion_celulas_miembro ON gestion_celulas(miembro_id, fuente);
CREATE INDEX IF NOT EXISTS idx_gestion_celulas_semana ON gestion_celulas(semana_inicio);
CREATE INDEX IF NOT EXISTS idx_gestion_celulas_celula ON gestion_celulas(celula_nombre);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE gestion_celulas;
