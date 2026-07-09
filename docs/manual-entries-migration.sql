-- Tabla para registros manuales de matrimonios
CREATE TABLE IF NOT EXISTS matrimonios_manual (
  id SERIAL PRIMARY KEY,
  cedula TEXT NOT NULL,
  apellidos_nombres TEXT NOT NULL,
  conyuge TEXT,
  cedula_conyugue TEXT,
  fecha_matrimonio TEXT,
  hora_matrimonio TEXT,
  oficio_matrimonio TEXT,
  padrino1_matrimonio TEXT,
  padrino2_matrimonio TEXT,
  celular TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla para registros manuales de bautizos
CREATE TABLE IF NOT EXISTS bautizos_manual (
  id SERIAL PRIMARY KEY,
  cedula TEXT NOT NULL,
  apellidos_nombres TEXT NOT NULL,
  fecha_bautizo TEXT,
  celular TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: permitir acceso a usuarios autenticados
ALTER TABLE matrimonios_manual ENABLE ROW LEVEL SECURITY;
ALTER TABLE bautizos_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON matrimonios_manual
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated" ON bautizos_manual
  FOR ALL USING (true);
