-- ============================================================
-- Migración: Crear grupos "Jóvenes" y "Hombres" con sus 5 módulos cada uno
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Grupo Jóvenes
INSERT INTO module_groups (id, name, display_name, icon, image, sort_order)
VALUES (gen_random_uuid(), 'jovenes', 'Jóvenes', '🧑‍🤝‍🧑', '/jovenes.jpeg', 10);

INSERT INTO system_modules (id, name, display_name, description, icon, route, requires_active_month, is_active, group_id, sort_order)
VALUES
  (gen_random_uuid(), 'cronograma-jovenes', 'Cronograma de Servicio', 'Gestión de cronogramas de servicio de Jóvenes', '📅', '/dashboard/cronograma-jovenes', false, true, (SELECT id FROM module_groups WHERE name = 'jovenes'), 1),
  (gen_random_uuid(), 'cronograma-eventos-jovenes', 'Cronograma de Eventos', 'Eventos generales del ministerio de Jóvenes', '🗓️', '/dashboard/cronograma-eventos-jovenes', false, true, (SELECT id FROM module_groups WHERE name = 'jovenes'), 2),
  (gen_random_uuid(), 'requerimientos-jovenes', 'Requerimientos de Bienes y Servicios', 'Solicitudes de bienes y servicios de Jóvenes', '📋', '/dashboard/requerimientos/jovenes', false, true, (SELECT id FROM module_groups WHERE name = 'jovenes'), 3),
  (gen_random_uuid(), 'mensajes-jovenes', 'Mensajes y Citaciones', 'Mensajes y citaciones del ministerio de Jóvenes', '✉️', '/dashboard/mensajes-jovenes', false, true, (SELECT id FROM module_groups WHERE name = 'jovenes'), 4),
  (gen_random_uuid(), 'asistencia-servidores-jovenes', 'Control de Asistencia de Servidores', 'Control de asistencia de servidores de Jóvenes', '✅', '/dashboard/asistencia-servidores-jovenes', false, true, (SELECT id FROM module_groups WHERE name = 'jovenes'), 5);

-- 2. Grupo Hombres
INSERT INTO module_groups (id, name, display_name, icon, image, sort_order)
VALUES (gen_random_uuid(), 'hombres', 'Hombres', '💪', '/Hombres.jpeg', 11);

INSERT INTO system_modules (id, name, display_name, description, icon, route, requires_active_month, is_active, group_id, sort_order)
VALUES
  (gen_random_uuid(), 'cronograma-hombres', 'Cronograma de Servicio', 'Gestión de cronogramas de servicio de Hombres', '📅', '/dashboard/cronograma-hombres', false, true, (SELECT id FROM module_groups WHERE name = 'hombres'), 1),
  (gen_random_uuid(), 'cronograma-eventos-hombres', 'Cronograma de Eventos', 'Eventos generales del ministerio de Hombres', '🗓️', '/dashboard/cronograma-eventos-hombres', false, true, (SELECT id FROM module_groups WHERE name = 'hombres'), 2),
  (gen_random_uuid(), 'requerimientos-hombres', 'Requerimientos de Bienes y Servicios', 'Solicitudes de bienes y servicios de Hombres', '📋', '/dashboard/requerimientos/hombres', false, true, (SELECT id FROM module_groups WHERE name = 'hombres'), 3),
  (gen_random_uuid(), 'mensajes-hombres', 'Mensajes y Citaciones', 'Mensajes y citaciones del ministerio de Hombres', '✉️', '/dashboard/mensajes-hombres', false, true, (SELECT id FROM module_groups WHERE name = 'hombres'), 4),
  (gen_random_uuid(), 'asistencia-servidores-hombres', 'Control de Asistencia de Servidores', 'Control de asistencia de servidores de Hombres', '✅', '/dashboard/asistencia-servidores-hombres', false, true, (SELECT id FROM module_groups WHERE name = 'hombres'), 5);
