-- =============================================
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE
-- Registrar módulos de Cronograma de Servicio en Administración, Discipulado y MDG
-- =============================================

-- Cronograma de Servicio - Administración
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-administracion',
  'Cronograma de Servicio',
  'Asignación de turnos de servicio para Administración',
  '📋',
  '/dashboard/cronograma-administracion',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'administracion' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Cronograma de Servicio - Discipulado
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-discipulado',
  'Cronograma de Servicio',
  'Asignación de turnos de servicio para Discipulado',
  '📋',
  '/dashboard/cronograma-discipulado',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'discipulado' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Cronograma de Servicio - MDG (Mujeres de Gracia)
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-mdg',
  'Cronograma de Servicio',
  'Asignación de turnos de servicio para Mujeres de Gracia',
  '📋',
  '/dashboard/cronograma-mdg',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'mdg' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
