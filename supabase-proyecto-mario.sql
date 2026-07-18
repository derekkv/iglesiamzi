-- =============================================
-- PROYECTO MARIO - Tablas de Supabase
-- =============================================
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Tabla principal de ciclos
CREATE TABLE IF NOT EXISTS proyecto_mario_ciclos (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('belleza_integral_sabados', 'belleza_integral_viernes', 'manualidades', 'belleza_cejas', 'gastronomia')),
  fecha_inicio DATE NOT NULL,
  total_clases INTEGER NOT NULL DEFAULT 10,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla de participantes por ciclo
CREATE TABLE IF NOT EXISTS proyecto_mario_ciclo_participantes (
  id BIGSERIAL PRIMARY KEY,
  ciclo_id BIGINT NOT NULL REFERENCES proyecto_mario_ciclos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  estatus TEXT NOT NULL DEFAULT 'en_curso' CHECK (estatus IN ('en_curso', 'aprobado', 'reprobado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabla de fechas (clases) por ciclo
CREATE TABLE IF NOT EXISTS proyecto_mario_ciclo_fechas (
  id BIGSERIAL PRIMARY KEY,
  ciclo_id BIGINT NOT NULL REFERENCES proyecto_mario_ciclos(id) ON DELETE CASCADE,
  numero_clase INTEGER NOT NULL,
  fecha DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabla de asistencia
CREATE TABLE IF NOT EXISTS proyecto_mario_ciclo_asistencia (
  id BIGSERIAL PRIMARY KEY,
  ciclo_id BIGINT NOT NULL REFERENCES proyecto_mario_ciclos(id) ON DELETE CASCADE,
  participante_id BIGINT NOT NULL REFERENCES proyecto_mario_ciclo_participantes(id) ON DELETE CASCADE,
  fecha_id BIGINT NOT NULL REFERENCES proyecto_mario_ciclo_fechas(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('A', 'J', 'F', 'AT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participante_id, fecha_id)
);

-- === ÍNDICES ===
CREATE INDEX IF NOT EXISTS idx_pm_ciclos_tipo_activo ON proyecto_mario_ciclos(tipo, activo);
CREATE INDEX IF NOT EXISTS idx_pm_participantes_ciclo ON proyecto_mario_ciclo_participantes(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_pm_fechas_ciclo ON proyecto_mario_ciclo_fechas(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_pm_asistencia_ciclo ON proyecto_mario_ciclo_asistencia(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_pm_asistencia_participante ON proyecto_mario_ciclo_asistencia(participante_id);
CREATE INDEX IF NOT EXISTS idx_pm_asistencia_fecha ON proyecto_mario_ciclo_asistencia(fecha_id);

-- === HABILITAR REALTIME ===
ALTER PUBLICATION supabase_realtime ADD TABLE proyecto_mario_ciclos;
ALTER PUBLICATION supabase_realtime ADD TABLE proyecto_mario_ciclo_participantes;
ALTER PUBLICATION supabase_realtime ADD TABLE proyecto_mario_ciclo_fechas;
ALTER PUBLICATION supabase_realtime ADD TABLE proyecto_mario_ciclo_asistencia;

-- === RLS (Row Level Security) ===
-- Habilitar RLS en todas las tablas
ALTER TABLE proyecto_mario_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_mario_ciclo_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_mario_ciclo_fechas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_mario_ciclo_asistencia ENABLE ROW LEVEL SECURITY;

-- Política: Solo el service_role puede acceder (las queries pasan por /api/db con service_key)
CREATE POLICY "Service role full access" ON proyecto_mario_ciclos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON proyecto_mario_ciclo_participantes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON proyecto_mario_ciclo_fechas
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON proyecto_mario_ciclo_asistencia
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- MÓDULOS EN system_modules (insertar los módulos para permisos)
-- =============================================

-- Módulos de ciclos/cursos
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, group_id, sort_order) VALUES
  ('proyecto_mario_belleza_integral_sabados', 'Belleza integral - Sabados', 'Control de asistencia del curso Belleza integral - Sabados', '💇', '/dashboard/proyecto-mario-belleza-integral-sabados', false, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 1),
  ('proyecto_mario_belleza_integral_viernes', 'Belleza integral - Viernes', 'Control de asistencia del curso Belleza integral - Viernes', '💇', '/dashboard/proyecto-mario-belleza-integral-viernes', false, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 2),
  ('proyecto_mario_manualidades', 'Manualidades', 'Control de asistencia del curso Manualidades', '🎨', '/dashboard/proyecto-mario-manualidades', false, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 3),
  ('proyecto_mario_belleza_cejas', 'Belleza Cejas', 'Control de asistencia del curso Belleza Cejas', '✨', '/dashboard/proyecto-mario-belleza-cejas', false, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 4),
  ('proyecto_mario_gastronomia', 'Gastronomía', 'Control de asistencia del curso de Gastronomía', '🍳', '/dashboard/proyecto-mario-gastronomia', false, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 5),
  ('historial_proyecto_mario', 'Historial', 'Historial de ciclos cerrados de Proyecto Mario', '📋', '/dashboard/historial-proyecto-mario', false, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 4)
ON CONFLICT (name) DO NOTHING;

-- Módulos genéricos
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, group_id, sort_order) VALUES
  ('cronograma-proyecto-mario', 'Cronograma de Servicio', 'Cronograma de servicio de Proyecto Mario', '📅', '/dashboard/cronograma-proyecto-mario', true, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 5),
  ('cronograma-eventos-proyecto-mario', 'Cronograma y Eventos General', 'Cronograma y eventos general de Proyecto Mario', '🗓️', '/dashboard/cronograma-eventos-proyecto-mario', true, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 6),
  ('asistencia-servidores-proyecto-mario', 'Control de Asistencia Servidores', 'Control de asistencia de los servidores de Proyecto Mario', '✅', '/dashboard/asistencia-servidores-proyecto-mario', true, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 7),
  ('mensajes-proyecto-mario', 'Mensajes y Citaciones', 'Mensajes y citaciones de Proyecto Mario', '✉️', '/dashboard/mensajes-proyecto-mario', true, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 8),
  ('requerimientos-proyecto-mario', 'Requerimientos de Bienes y Servicios', 'Requerimientos de bienes y servicios de Proyecto Mario', '📦', '/dashboard/requerimientos/proyecto-mario', true, (SELECT id FROM module_groups WHERE name = 'Proyecto Mario' LIMIT 1), 9)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- GRUPO DE MÓDULOS (crear el grupo si no existe)
-- =============================================
-- NOTA: Ejecutar PRIMERO este INSERT si el grupo no existe:

INSERT INTO module_groups (name, display_name, icon, image, sort_order) VALUES
  ('Proyecto Mario', 'Proyecto Mario', '/proyecto mario.png', '/proyecto mario.png', 99)
ON CONFLICT (name) DO NOTHING;

-- Después de crear el grupo, actualizar los system_modules con el group_id correcto:
UPDATE system_modules 
SET group_id = (SELECT id FROM module_groups WHERE name = 'Proyecto Mario')
WHERE name IN (
  'proyecto_mario_belleza_integral_sabados',
  'proyecto_mario_belleza_integral_viernes',
  'proyecto_mario_manualidades',
  'proyecto_mario_belleza_cejas',
  'proyecto_mario_gastronomia',
  'historial_proyecto_mario',
  'cronograma-proyecto-mario',
  'cronograma-eventos-proyecto-mario',
  'asistencia-servidores-proyecto-mario',
  'mensajes-proyecto-mario',
  'requerimientos-proyecto-mario'
);
