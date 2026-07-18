-- =============================================
-- MIGRACIÓN: Renombrar Belleza Integral → Belleza integral - Sabados
--            Agregar Belleza integral - Viernes y Manualidades
-- =============================================
-- Ejecutar en el SQL Editor de Supabase

-- 1. Eliminar el CHECK constraint viejo
ALTER TABLE proyecto_mario_ciclos DROP CONSTRAINT IF EXISTS proyecto_mario_ciclos_tipo_check;

-- 2. Renombrar los ciclos existentes de belleza_integral → belleza_integral_sabados (SIN constraint)
UPDATE proyecto_mario_ciclos 
SET tipo = 'belleza_integral_sabados' 
WHERE tipo = 'belleza_integral';

-- 3. Crear el nuevo CHECK constraint (ahora que los datos ya están migrados)
ALTER TABLE proyecto_mario_ciclos ADD CONSTRAINT proyecto_mario_ciclos_tipo_check 
  CHECK (tipo IN ('belleza_integral_sabados', 'belleza_integral_viernes', 'manualidades', 'belleza_cejas', 'gastronomia'));

-- 3. Renombrar el módulo existente en system_modules
UPDATE system_modules 
SET name = 'proyecto_mario_belleza_integral_sabados',
    display_name = 'Belleza integral - Sabados',
    description = 'Control de asistencia del curso Belleza integral - Sabados',
    route = '/dashboard/proyecto-mario-belleza-integral-sabados'
WHERE name = 'proyecto_mario_belleza_integral';

-- 4. Insertar los nuevos módulos
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, group_id, sort_order) VALUES
  ('proyecto_mario_belleza_integral_viernes', 'Belleza integral - Viernes', 'Control de asistencia del curso Belleza integral - Viernes', '💇', '/dashboard/proyecto-mario-belleza-integral-viernes', false, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 2),
  ('proyecto_mario_manualidades', 'Manualidades', 'Control de asistencia del curso Manualidades', '🎨', '/dashboard/proyecto-mario-manualidades', false, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 3)
ON CONFLICT (name) DO NOTHING;

-- 5. Actualizar sort_order de los módulos existentes para acomodar los nuevos
UPDATE system_modules SET sort_order = 1 WHERE name = 'proyecto_mario_belleza_integral_sabados';
UPDATE system_modules SET sort_order = 2 WHERE name = 'proyecto_mario_belleza_integral_viernes';
UPDATE system_modules SET sort_order = 3 WHERE name = 'proyecto_mario_manualidades';
UPDATE system_modules SET sort_order = 4 WHERE name = 'proyecto_mario_belleza_cejas';
UPDATE system_modules SET sort_order = 5 WHERE name = 'proyecto_mario_gastronomia';

-- 6. Copiar permisos del módulo viejo a los nuevos módulos
-- (Los usuarios que tenían acceso a belleza_integral ahora lo tendrán en los nuevos)
INSERT INTO user_permissions (user_id, module_id, can_view, can_edit)
SELECT up.user_id, sm.id, up.can_view, up.can_edit
FROM user_permissions up
JOIN system_modules sm_old ON sm_old.id = up.module_id AND sm_old.name = 'proyecto_mario_belleza_integral_sabados'
CROSS JOIN system_modules sm 
WHERE sm.name IN ('proyecto_mario_belleza_integral_viernes', 'proyecto_mario_manualidades')
ON CONFLICT (user_id, module_id) DO NOTHING;
