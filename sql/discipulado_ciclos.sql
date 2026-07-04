-- ============================================================
-- DISCIPULADO: Sistema de Ciclos con 3 sub-módulos
-- Primeros Pasos (13 clases), Seguimos Avanzando (15 clases), Siendo Iglesia (11 clases)
-- ============================================================

-- Tabla principal de ciclos de discipulado
CREATE TABLE IF NOT EXISTS discipulado_ciclos (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('primeros_pasos', 'seguimos_avanzando', 'siendo_iglesia')),
  fecha_inicio DATE NOT NULL,
  total_clases INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participantes por ciclo (se mantienen al reiniciar, pero se crea nueva relación)
CREATE TABLE IF NOT EXISTS discipulado_ciclo_participantes (
  id SERIAL PRIMARY KEY,
  ciclo_id INTEGER NOT NULL REFERENCES discipulado_ciclos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  estatus TEXT NOT NULL DEFAULT 'en_curso' CHECK (estatus IN ('en_curso', 'aprobado', 'reprobado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fechas (domingos) calculadas automáticamente por ciclo
CREATE TABLE IF NOT EXISTS discipulado_ciclo_fechas (
  id SERIAL PRIMARY KEY,
  ciclo_id INTEGER NOT NULL REFERENCES discipulado_ciclos(id) ON DELETE CASCADE,
  numero_clase INTEGER NOT NULL,
  fecha DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ciclo_id, numero_clase)
);

-- Asistencia vinculada al ciclo
CREATE TABLE IF NOT EXISTS discipulado_ciclo_asistencia (
  id SERIAL PRIMARY KEY,
  ciclo_id INTEGER NOT NULL REFERENCES discipulado_ciclos(id) ON DELETE CASCADE,
  participante_id INTEGER NOT NULL REFERENCES discipulado_ciclo_participantes(id) ON DELETE CASCADE,
  fecha_id INTEGER NOT NULL REFERENCES discipulado_ciclo_fechas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('A', 'J', 'F', 'AT', 'none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participante_id, fecha_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ciclo_tipo_activo ON discipulado_ciclos(tipo, activo);
CREATE INDEX IF NOT EXISTS idx_ciclo_participantes_ciclo ON discipulado_ciclo_participantes(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_ciclo_fechas_ciclo ON discipulado_ciclo_fechas(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_ciclo_asistencia_ciclo ON discipulado_ciclo_asistencia(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_ciclo_asistencia_participante ON discipulado_ciclo_asistencia(participante_id);
CREATE INDEX IF NOT EXISTS idx_ciclo_asistencia_fecha ON discipulado_ciclo_asistencia(fecha_id);

-- Habilitar Realtime para las nuevas tablas (ignorar si ya existen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'discipulado_ciclos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE discipulado_ciclos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'discipulado_ciclo_participantes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE discipulado_ciclo_participantes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'discipulado_ciclo_fechas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE discipulado_ciclo_fechas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'discipulado_ciclo_asistencia'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE discipulado_ciclo_asistencia;
  END IF;
END $$;

-- ============================================================
-- REGISTRAR LOS 3 MÓDULOS NUEVOS EN system_modules
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

-- ============================================================
-- DESACTIVAR el módulo viejo "discipulado" (opcional, descomentar si quieres)
-- ============================================================
-- UPDATE system_modules SET is_active = false WHERE name = 'discipulado';
