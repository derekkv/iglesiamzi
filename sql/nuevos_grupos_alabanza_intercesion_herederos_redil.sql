-- =============================================
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE
-- Crear 4 nuevos grupos: Alabanza, Intercesión, Herederos del Reino, Redil
-- Cada uno con 5 sub-módulos genéricos
-- =============================================

-- 1. CREAR GRUPOS
INSERT INTO module_groups (name, display_name, description, icon, image, sort_order)
VALUES
  ('alabanza', 'Alabanza', 'Módulos del ministerio de Alabanza', '🎵', '/Alabanza.jpeg', 50),
  ('intercesion', 'Intercesión', 'Módulos del ministerio de Intercesión', '🙏', '/Intercesion.jpeg', 60),
  ('herederos', 'Herederos del Reino', 'Módulos del ministerio Herederos del Reino', '👑', '/Herederos del reino.jpeg', 70),
  ('redil', 'Redil', 'Módulos del ministerio Redil', '🐑', '/redil.jpeg', 80)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 2. MÓDULOS PARA ALABANZA
-- =============================================

-- Mensajes y Citaciones - Alabanza
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'mensajes-alabanza',
  'Mensajes y Citaciones',
  'Enviar y recibir mensajes y citaciones',
  '💬',
  '/dashboard/mensajes-alabanza',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'alabanza' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Asistencia Servidores - Alabanza
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'asistencia-servidores-alabanza',
  'Control de Asistencia de Servidores',
  'Registro de asistencia de servidores',
  '📋',
  '/dashboard/asistencia-servidores-alabanza',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'alabanza' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Cronograma Eventos - Alabanza
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-eventos-alabanza',
  'Cronograma y Eventos General',
  'Planificación de eventos y actividades',
  '📅',
  '/dashboard/cronograma-eventos-alabanza',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'alabanza' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Requerimientos - Alabanza
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'requerimientos-alabanza',
  'Requerimientos de Bienes y Servicios',
  'Solicitudes de bienes y servicios para Alabanza',
  '🛒',
  '/dashboard/requerimientos/alabanza',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'alabanza' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Cronograma Servicio - Alabanza
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-alabanza',
  'Cronograma de Servicio',
  'Planificación de turnos y servicios',
  '🗓️',
  '/dashboard/cronograma-alabanza',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'alabanza' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 3. MÓDULOS PARA INTERCESIÓN
-- =============================================

-- Mensajes y Citaciones - Intercesión
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'mensajes-intercesion',
  'Mensajes y Citaciones',
  'Enviar y recibir mensajes y citaciones',
  '💬',
  '/dashboard/mensajes-intercesion',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'intercesion' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Asistencia Servidores - Intercesión
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'asistencia-servidores-intercesion',
  'Control de Asistencia de Servidores',
  'Registro de asistencia de servidores',
  '📋',
  '/dashboard/asistencia-servidores-intercesion',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'intercesion' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Cronograma Eventos - Intercesión
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-eventos-intercesion',
  'Cronograma y Eventos General',
  'Planificación de eventos y actividades',
  '📅',
  '/dashboard/cronograma-eventos-intercesion',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'intercesion' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Requerimientos - Intercesión
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'requerimientos-intercesion',
  'Requerimientos de Bienes y Servicios',
  'Solicitudes de bienes y servicios para Intercesión',
  '🛒',
  '/dashboard/requerimientos/intercesion',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'intercesion' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Cronograma Servicio - Intercesión
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-intercesion',
  'Cronograma de Servicio',
  'Planificación de turnos y servicios',
  '🗓️',
  '/dashboard/cronograma-intercesion',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'intercesion' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 4. MÓDULOS PARA HEREDEROS DEL REINO
-- =============================================

-- Mensajes y Citaciones - Herederos
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'mensajes-herederos',
  'Mensajes y Citaciones',
  'Enviar y recibir mensajes y citaciones',
  '💬',
  '/dashboard/mensajes-herederos',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'herederos' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Asistencia Servidores - Herederos
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'asistencia-servidores-herederos',
  'Control de Asistencia de Servidores',
  'Registro de asistencia de servidores',
  '📋',
  '/dashboard/asistencia-servidores-herederos',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'herederos' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Cronograma Eventos - Herederos
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-eventos-herederos',
  'Cronograma y Eventos General',
  'Planificación de eventos y actividades',
  '📅',
  '/dashboard/cronograma-eventos-herederos',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'herederos' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Requerimientos - Herederos
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'requerimientos-herederos',
  'Requerimientos de Bienes y Servicios',
  'Solicitudes de bienes y servicios para Herederos del Reino',
  '🛒',
  '/dashboard/requerimientos/herederos',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'herederos' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Cronograma Servicio - Herederos
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-herederos',
  'Cronograma de Servicio',
  'Planificación de turnos y servicios',
  '🗓️',
  '/dashboard/cronograma-herederos',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'herederos' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 5. MÓDULOS PARA REDIL
-- =============================================

-- Mensajes y Citaciones - Redil
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'mensajes-redil',
  'Mensajes y Citaciones',
  'Enviar y recibir mensajes y citaciones',
  '💬',
  '/dashboard/mensajes-redil',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'redil' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Asistencia Servidores - Redil
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'asistencia-servidores-redil',
  'Control de Asistencia de Servidores',
  'Registro de asistencia de servidores',
  '📋',
  '/dashboard/asistencia-servidores-redil',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'redil' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Cronograma Eventos - Redil
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-eventos-redil',
  'Cronograma y Eventos General',
  'Planificación de eventos y actividades',
  '📅',
  '/dashboard/cronograma-eventos-redil',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'redil' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Requerimientos - Redil
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'requerimientos-redil',
  'Requerimientos de Bienes y Servicios',
  'Solicitudes de bienes y servicios para Redil',
  '🛒',
  '/dashboard/requerimientos/redil',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'redil' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;

-- Cronograma Servicio - Redil
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-redil',
  'Cronograma de Servicio',
  'Planificación de turnos y servicios',
  '🗓️',
  '/dashboard/cronograma-redil',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'redil' LIMIT 1)
) ON CONFLICT (name) DO NOTHING;
