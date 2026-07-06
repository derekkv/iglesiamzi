-- ============================================================
-- Migración: Crear grupo "Comunicación" con sus 5 módulos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Crear el grupo de módulos "comunicacion"
INSERT INTO module_groups (id, name, display_name, icon, image, sort_order)
VALUES (
  gen_random_uuid(),
  'comunicacion',
  'Comunicación',
  '📡',
  '/Comunicacion.jpeg',
  9  -- Ajustar según el orden deseado
);

-- 2. Obtener el ID del grupo recién creado
-- (Los INSERTs de módulos usan un subquery)

-- 3. Crear los 5 módulos del sistema para "Comunicación"
INSERT INTO system_modules (id, name, display_name, description, icon, route, requires_active_month, is_active, group_id, sort_order)
VALUES
  (
    gen_random_uuid(),
    'cronograma-comunicacion',
    'Cronograma de Servicio',
    'Gestión de cronogramas de servicio de Comunicación',
    '📅',
    '/dashboard/cronograma-comunicacion',
    false,
    true,
    (SELECT id FROM module_groups WHERE name = 'comunicacion'),
    1
  ),
  (
    gen_random_uuid(),
    'cronograma-eventos-comunicacion',
    'Cronograma de Eventos',
    'Eventos generales del ministerio de Comunicación',
    '🗓️',
    '/dashboard/cronograma-eventos-comunicacion',
    false,
    true,
    (SELECT id FROM module_groups WHERE name = 'comunicacion'),
    2
  ),
  (
    gen_random_uuid(),
    'requerimientos-comunicacion',
    'Requerimientos de Bienes y Servicios',
    'Solicitudes de bienes y servicios de Comunicación',
    '📋',
    '/dashboard/requerimientos/comunicacion',
    false,
    true,
    (SELECT id FROM module_groups WHERE name = 'comunicacion'),
    3
  ),
  (
    gen_random_uuid(),
    'mensajes-comunicacion',
    'Mensajes y Citaciones',
    'Mensajes y citaciones del ministerio de Comunicación',
    '✉️',
    '/dashboard/mensajes-comunicacion',
    false,
    true,
    (SELECT id FROM module_groups WHERE name = 'comunicacion'),
    4
  ),
  (
    gen_random_uuid(),
    'asistencia-servidores-comunicacion',
    'Control de Asistencia de Servidores',
    'Control de asistencia de servidores de Comunicación',
    '✅',
    '/dashboard/asistencia-servidores-comunicacion',
    false,
    true,
    (SELECT id FROM module_groups WHERE name = 'comunicacion'),
    5
  );
