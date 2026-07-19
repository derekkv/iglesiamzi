-- =============================================
-- SISTEMA DE EVENTOS CON TABS DINÁMICOS
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Tabla de tabs/eventos (cada tab es un evento independiente)
CREATE TABLE IF NOT EXISTS eventos_tabs (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  valor_default NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de participantes por evento (cada evento tiene su propia lista)
CREATE TABLE IF NOT EXISTS evento_participantes (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER NOT NULL REFERENCES eventos_tabs(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  edad INTEGER NOT NULL,
  telefono TEXT,
  genero TEXT NOT NULL CHECK (genero IN ('masculino', 'femenino')),
  contextura TEXT NOT NULL CHECK (contextura IN ('delgada', 'media', 'robusta')),
  limitacion_fisica BOOLEAN NOT NULL DEFAULT false,
  ministerio TEXT,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  abono NUMERIC(10,2) NOT NULL DEFAULT 0,
  metodo_pago TEXT NOT NULL DEFAULT 'Efectivo' CHECK (metodo_pago IN ('Efectivo', 'Transferencia')),
  equipo TEXT CHECK (equipo IN ('amarillo', 'azul', 'verde', 'naranja')),
  equipo_razon TEXT,
  importado_de_evento_id INTEGER REFERENCES eventos_tabs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_evento_participantes_evento_id ON evento_participantes(evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_participantes_nombre ON evento_participantes(nombre);
CREATE INDEX IF NOT EXISTS idx_eventos_tabs_active ON eventos_tabs(is_active);

-- 4. Habilitar realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE eventos_tabs;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE evento_participantes;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 5. RLS (Row Level Security)
ALTER TABLE eventos_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_participantes ENABLE ROW LEVEL SECURITY;

-- Políticas para eventos_tabs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eventos_tabs' AND policyname = 'Allow all for authenticated users') THEN
    CREATE POLICY "Allow all for authenticated users" ON eventos_tabs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eventos_tabs' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON eventos_tabs FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Políticas para evento_participantes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evento_participantes' AND policyname = 'Allow all for authenticated users') THEN
    CREATE POLICY "Allow all for authenticated users" ON evento_participantes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evento_participantes' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON evento_participantes FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Migración: mover datos existentes de encuentro_participantes al nuevo sistema
-- (Opcional: ejecutar si se desea migrar los datos actuales)
-- 
-- INSERT INTO eventos_tabs (nombre, descripcion, valor_default, is_active, sort_order)
-- VALUES ('Encuentro', 'Encuentro original (migrado)', 0, true, 0);
--
-- INSERT INTO evento_participantes (evento_id, nombre, edad, telefono, genero, contextura, limitacion_fisica, ministerio, valor, abono, equipo, equipo_razon, created_at, updated_at)
-- SELECT 
--   (SELECT id FROM eventos_tabs WHERE nombre = 'Encuentro' LIMIT 1),
--   nombre, edad, telefono, genero, contextura, limitacion_fisica, ministerio, valor, abono, equipo, equipo_razon, created_at, updated_at
-- FROM encuentro_participantes;
