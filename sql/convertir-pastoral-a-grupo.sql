-- ============================================================
-- Migración: Convertir Pastoral de módulo individual a grupo con 6 módulos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Crear el grupo de módulos "pastoral"
INSERT INTO module_groups (id, name, display_name, icon, image, sort_order)
VALUES (gen_random_uuid(), 'pastoral', 'Pastoral', '⛪', '/Pastoral.jpg', 1);

-- 2. Renombrar el módulo existente "pastoral" a "resumen-pastoral" y asignarlo al grupo
UPDATE system_modules
SET name = 'resumen-pastoral',
    display_name = 'Resumen Pastoral',
    description = 'Vista panorámica de asistencia y atrasados',
    icon = '📊',
    route = '/dashboard/pastoral',
    group_id = (SELECT id FROM module_groups WHERE name = 'pastoral')
WHERE name = 'pastoral';

-- 3. Crear los 5 módulos genéricos para Pastoral
INSERT INTO system_modules (id, name, display_name, description, icon, route, requires_active_month, is_active, group_id, sort_order)
VALUES
  (gen_random_uuid(), 'cronograma-pastoral', 'Cronograma de Servicio', 'Gestión de cronogramas de servicio de Pastoral', '📅', '/dashboard/cronograma-pastoral', false, true, (SELECT id FROM module_groups WHERE name = 'pastoral'), 2),
  (gen_random_uuid(), 'cronograma-eventos-pastoral', 'Cronograma de Eventos', 'Eventos generales de Pastoral', '🗓️', '/dashboard/cronograma-eventos-pastoral', false, true, (SELECT id FROM module_groups WHERE name = 'pastoral'), 3),
  (gen_random_uuid(), 'requerimientos-pastoral', 'Requerimientos de Bienes y Servicios', 'Solicitudes de bienes y servicios de Pastoral', '📋', '/dashboard/requerimientos/pastoral', false, true, (SELECT id FROM module_groups WHERE name = 'pastoral'), 4),
  (gen_random_uuid(), 'mensajes-pastoral', 'Mensajes y Citaciones', 'Mensajes y citaciones de Pastoral', '✉️', '/dashboard/mensajes-pastoral', false, true, (SELECT id FROM module_groups WHERE name = 'pastoral'), 5),
  (gen_random_uuid(), 'asistencia-servidores-pastoral', 'Control de Asistencia de Servidores', 'Control de asistencia de servidores de Pastoral', '✅', '/dashboard/asistencia-servidores-pastoral', false, true, (SELECT id FROM module_groups WHERE name = 'pastoral'), 6);
