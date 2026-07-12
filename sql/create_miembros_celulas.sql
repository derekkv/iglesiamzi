-- Tabla para miembros agregados manualmente al módulo de células
-- Separada del censo para no contaminar los datos del censo principal
CREATE TABLE IF NOT EXISTS miembros_celulas (
  id BIGSERIAL PRIMARY KEY,
  apellidos_nombres TEXT NOT NULL,
  celular TEXT,
  celula_nombre TEXT NOT NULL,
  celula_asiste BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas por célula
CREATE INDEX IF NOT EXISTS idx_miembros_celulas_celula_nombre ON miembros_celulas(celula_nombre);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE miembros_celulas;
