-- =============================================
-- Tabla Alfolí: Ofrendas dominicales + fechas MDG
-- Se muestra al lado de la tabla de ofrendas de células
-- =============================================

CREATE TABLE IF NOT EXISTS alfoli (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  mes INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'domingo' CHECK (tipo IN ('domingo', 'mdg')),
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  recibido BOOLEAN NOT NULL DEFAULT FALSE,
  recibido_por UUID REFERENCES users(id),
  recibido_por_nombre TEXT,
  recibido_at TIMESTAMPTZ,
  registrado_por UUID REFERENCES users(id),
  registrado_por_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha, tipo)
);

CREATE INDEX IF NOT EXISTS idx_alfoli_mes ON alfoli(mes, anio);
CREATE INDEX IF NOT EXISTS idx_alfoli_fecha ON alfoli(fecha);

ALTER PUBLICATION supabase_realtime ADD TABLE alfoli;
