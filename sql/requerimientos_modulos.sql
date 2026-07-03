-- =============================================
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE
-- Registrar módulos de Requerimientos de Bienes y Servicios en cada grupo
-- (excepto administración, donde se gestionan desde el panel admin)
-- =============================================

-- Requerimientos - Protocolo
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'requerimientos-protocolo',
  'Requerimientos de Bienes y Servicios',
  'Solicitudes de bienes y servicios para Protocolo',
  '🛒',
  '/dashboard/requerimientos/protocolo',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'protocolo' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Requerimientos - Discipulado
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'requerimientos-discipulado',
  'Requerimientos de Bienes y Servicios',
  'Solicitudes de bienes y servicios para Discipulado',
  '🛒',
  '/dashboard/requerimientos/discipulado',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'discipulado' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Requerimientos - Mujeres de Gracia (MDG)
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'requerimientos-mdg',
  'Requerimientos de Bienes y Servicios',
  'Solicitudes de bienes y servicios para Mujeres de Gracia',
  '🛒',
  '/dashboard/requerimientos/mdg',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'mdg' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Requerimientos - Administración (submódulo para gestionar TODOS los requerimientos)
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'requerimientos-admin',
  'Gestión de Requerimientos',
  'Aprobar, negar o suspender requerimientos de todos los módulos',
  '✅',
  '/dashboard/requerimientos-admin',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'administracion' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- ACTUALIZAR si ya existen (por si se ejecutó antes con valores anteriores)
-- =============================================
UPDATE system_modules
SET display_name = 'Requerimientos de Bienes y Servicios', icon = '🛒'
WHERE name = 'requerimientos-protocolo';

UPDATE system_modules
SET display_name = 'Requerimientos de Bienes y Servicios', icon = '🛒'
WHERE name = 'requerimientos-discipulado';

UPDATE system_modules
SET display_name = 'Requerimientos de Bienes y Servicios', icon = '🛒'
WHERE name = 'requerimientos-mdg';
