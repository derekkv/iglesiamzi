-- ============================================================
-- EJECUTAR DESPUÉS del script anterior (tablas ya existen)
-- Solo registra los 3 módulos nuevos en system_modules
-- ============================================================

-- Módulo 1: Primeros pasos de la vida cristiana
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'discipulado_primeros_pasos',
  'Primeros pasos de la vida cristiana',
  'Discipulado de 13 clases para nuevos creyentes',
  '📖',
  '/dashboard/discipulado-primeros-pasos',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'discipulado' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Módulo 2: Seguimos avanzando
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'discipulado_seguimos_avanzando',
  'Seguimos avanzando',
  'Discipulado de 15 clases para crecimiento espiritual',
  '📗',
  '/dashboard/discipulado-seguimos-avanzando',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'discipulado' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Módulo 3: Siendo iglesia
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'discipulado_siendo_iglesia',
  'Siendo iglesia',
  'Discipulado de 11 clases para servicio en comunidad',
  '📘',
  '/dashboard/discipulado-siendo-iglesia',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'discipulado' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Desactivar el módulo viejo "discipulado" (ya reemplazado por los 3 nuevos)
UPDATE system_modules SET is_active = false WHERE name = 'discipulado';
