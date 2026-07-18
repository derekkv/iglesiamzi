-- Tabla de participantes de encuentro
-- Ejecutar en Supabase SQL Editor

-- 1. Registrar el módulo "eventos_encuentro" dentro del grupo Administración
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id, sort_order) 
VALUES (
  'eventos_encuentro', 
  'Encuentro', 
  'Gestión de participantes y equipos del Encuentro', 
  '⛺', 
  '/dashboard/eventos', 
  false, 
  true, 
  '9971f5dc-f8bc-44ae-a33e-a497c0f051af',
  20
)
ON CONFLICT (name) DO NOTHING;

-- 2. Dar permisos al admin (Derek y Jaime)
INSERT INTO user_permissions (user_id, module_id, can_view, can_edit, can_admin)
SELECT '83cb032c-38ef-4b47-85f1-84d4ae7d531e', id, true, true, true
FROM system_modules WHERE name = 'eventos_encuentro'
ON CONFLICT (user_id, module_id) DO NOTHING;

INSERT INTO user_permissions (user_id, module_id, can_view, can_edit, can_admin)
SELECT '8a799e01-11bb-4ea4-8a95-9f7033e90fb1', id, true, true, true
FROM system_modules WHERE name = 'eventos_encuentro'
ON CONFLICT (user_id, module_id) DO NOTHING;

-- 4. Crear la tabla de participantes
CREATE TABLE IF NOT EXISTS encuentro_participantes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  edad INTEGER NOT NULL,
  telefono TEXT,
  genero TEXT NOT NULL CHECK (genero IN ('masculino', 'femenino')),
  contextura TEXT NOT NULL CHECK (contextura IN ('delgada', 'media', 'robusta')),
  limitacion_fisica BOOLEAN NOT NULL DEFAULT false,
  ministerio TEXT,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  abono NUMERIC(10,2) NOT NULL DEFAULT 0,
  equipo TEXT CHECK (equipo IN ('amarillo', 'azul', 'verde', 'naranja')),
  equipo_razon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Habilitar realtime (ignorar si ya existe)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE encuentro_participantes;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 6. RLS (Row Level Security)
ALTER TABLE encuentro_participantes ENABLE ROW LEVEL SECURITY;

-- Políticas (solo crear si no existen)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'encuentro_participantes' AND policyname = 'Allow all for authenticated users') THEN
    CREATE POLICY "Allow all for authenticated users" ON encuentro_participantes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'encuentro_participantes' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON encuentro_participantes FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
