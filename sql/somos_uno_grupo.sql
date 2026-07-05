-- =============================================
-- Convertir Somos Uno en grupo de módulos
-- Sub-módulos: Células y Ofrenda
-- =============================================

-- 1. Crear el grupo
INSERT INTO module_groups (name, display_name, description, icon, image, sort_order)
VALUES ('somos_uno', 'Somos Uno', 'Módulos de Células y Ofrendas', '🤝', '/somos uno logo.jpg (2).jpeg', 45)
ON CONFLICT (name) DO NOTHING;

-- 2. Eliminar el módulo viejo somos_uno (si existe)
-- Primero quitar permisos asociados
DELETE FROM user_permissions WHERE module_id = (SELECT id FROM system_modules WHERE name = 'somos_uno');
DELETE FROM system_modules WHERE name = 'somos_uno';

-- 3. Crear sub-módulo: Células
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'celulas',
  'Células',
  'Gestión de células, miembros y asistencia semanal',
  '🏠',
  '/dashboard/celulas',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'somos_uno' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- 4. Crear sub-módulo: Ofrenda de Células (en grupo Administración)
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'ofrenda-celulas',
  'Ofrenda de Células',
  'Resumen y registro de ofrendas semanales por célula',
  '💰',
  '/dashboard/ofrenda-celulas',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'administracion' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- 5. Tabla de ofrendas por célula (cada jueves)
CREATE TABLE IF NOT EXISTS ofrendas_celulas (
  id SERIAL PRIMARY KEY,
  celula_nombre TEXT NOT NULL,
  fecha DATE NOT NULL,            -- Fecha del jueves
  mes INTEGER NOT NULL,           -- Mes (1-12)
  anio INTEGER NOT NULL,          -- Año
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  recibido BOOLEAN NOT NULL DEFAULT FALSE,  -- Check de confirmación de recepción
  recibido_por UUID REFERENCES users(id),
  recibido_por_nombre TEXT,
  recibido_at TIMESTAMPTZ,
  registrado_por UUID REFERENCES users(id),
  registrado_por_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(celula_nombre, fecha)
);

CREATE INDEX IF NOT EXISTS idx_ofrendas_celulas_fecha ON ofrendas_celulas(fecha);
CREATE INDEX IF NOT EXISTS idx_ofrendas_celulas_mes ON ofrendas_celulas(mes, anio);
CREATE INDEX IF NOT EXISTS idx_ofrendas_celulas_celula ON ofrendas_celulas(celula_nombre);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ofrendas_celulas;
