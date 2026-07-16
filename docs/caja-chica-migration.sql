-- =============================================
-- MIGRACIÓN: Módulo Caja Chica
-- Tablas: caja_chica_movimientos, caja_chica_arqueos
-- Módulo: caja_chica
-- =============================================

-- 1. Tabla de movimientos (ingresos/egresos de caja chica)
CREATE TABLE IF NOT EXISTS caja_chica_movimientos (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Ingreso', 'Egreso')),
  concepto TEXT NOT NULL,
  detalle TEXT,
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  metodo_pago TEXT NOT NULL DEFAULT 'Efectivo',
  responsable TEXT NOT NULL,
  mes_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de arqueos (conteo físico de caja)
CREATE TABLE IF NOT EXISTS caja_chica_arqueos (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  contado_por TEXT NOT NULL,
  billetes_20 INTEGER NOT NULL DEFAULT 0,
  billetes_10 INTEGER NOT NULL DEFAULT 0,
  billetes_5 INTEGER NOT NULL DEFAULT 0,
  billetes_1 INTEGER NOT NULL DEFAULT 0,
  monedas_050 INTEGER NOT NULL DEFAULT 0,
  monedas_025 INTEGER NOT NULL DEFAULT 0,
  monedas_010 INTEGER NOT NULL DEFAULT 0,
  monedas_005 INTEGER NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  observacion TEXT,
  mes_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS (Row Level Security)
ALTER TABLE caja_chica_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_chica_arqueos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON caja_chica_movimientos
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated" ON caja_chica_arqueos
  FOR ALL USING (true);

-- 4. Índices para rendimiento
CREATE INDEX idx_caja_chica_movimientos_mes ON caja_chica_movimientos(mes_id);
CREATE INDEX idx_caja_chica_movimientos_fecha ON caja_chica_movimientos(fecha DESC);
CREATE INDEX idx_caja_chica_arqueos_mes ON caja_chica_arqueos(mes_id);

-- 5. Registrar módulo en system_modules (para permisos)
INSERT INTO system_modules (name, display_name, description, sort_order)
VALUES ('caja_chica', 'Caja Chica', 'Gestión de fondos de caja chica, arqueos y efectivo', 50)
ON CONFLICT (name) DO NOTHING;

-- 6. Habilitar realtime para ambas tablas
ALTER PUBLICATION supabase_realtime ADD TABLE caja_chica_movimientos;
ALTER PUBLICATION supabase_realtime ADD TABLE caja_chica_arqueos;
