-- ============================================================
-- ASISTENCIA AL CULTO — Módulo de Protocolo
-- Registra la asistencia dominical y gestiona seguimiento
-- automático cuando un miembro acumula 2 faltas en el mes.
-- ============================================================

-- 1. Tabla de registros de asistencia por domingo
CREATE TABLE IF NOT EXISTS asistencia_culto (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mes_id        TEXT NOT NULL REFERENCES meses(id) ON DELETE CASCADE,
  persona_id    BIGINT NOT NULL,
  fuente        TEXT NOT NULL CHECK (fuente IN ('protocolo', 'mdg', 'jovenes')),
  nombre        TEXT NOT NULL,
  apellido      TEXT NOT NULL,
  celular       TEXT,
  fecha_domingo DATE NOT NULL,
  asistio       BOOLEAN,
  registrado_por      UUID,
  registrado_por_nombre TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_asistencia_culto_persona_domingo UNIQUE (persona_id, fuente, fecha_domingo)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_culto_mes ON asistencia_culto(mes_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_culto_fecha ON asistencia_culto(fecha_domingo);
CREATE INDEX IF NOT EXISTS idx_asistencia_culto_persona ON asistencia_culto(persona_id, fuente);

-- 2. Tabla de seguimiento (personas con 2+ faltas en el mes)
CREATE TABLE IF NOT EXISTS asistencia_culto_seguimiento (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mes_id        TEXT NOT NULL REFERENCES meses(id) ON DELETE CASCADE,
  persona_id    BIGINT NOT NULL,
  fuente        TEXT NOT NULL CHECK (fuente IN ('protocolo', 'mdg', 'jovenes')),
  nombre        TEXT NOT NULL,
  apellido      TEXT NOT NULL,
  celular       TEXT,
  total_faltas  INT NOT NULL DEFAULT 0,
  gestionado            BOOLEAN NOT NULL DEFAULT false,
  respuesta_gestion     TEXT,
  gestionado_por        UUID,
  gestionado_por_nombre TEXT,
  fecha_gestion         TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_seguimiento_culto_persona_mes UNIQUE (persona_id, fuente, mes_id)
);

CREATE INDEX IF NOT EXISTS idx_seguimiento_culto_mes ON asistencia_culto_seguimiento(mes_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_culto_gestionado ON asistencia_culto_seguimiento(gestionado);

-- 3. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE asistencia_culto;
ALTER PUBLICATION supabase_realtime ADD TABLE asistencia_culto_seguimiento;

-- 4. RLS
ALTER TABLE asistencia_culto ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia_culto_seguimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_asistencia_culto"
  ON asistencia_culto FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_full_seguimiento_culto"
  ON asistencia_culto_seguimiento FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Registrar el módulo en system_modules
DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM module_groups WHERE name ILIKE '%protocolo%' LIMIT 1;

  INSERT INTO system_modules (name, display_name, description, group_id, sort_order, is_active, icon, route)
  VALUES (
    'asistencia_culto',
    'Asistencia al Culto',
    'Registro de asistencia dominical y seguimiento automático de personas con 2+ faltas',
    v_group_id,
    5,
    true,
    'ClipboardCheck',
    '/dashboard/asistencia-culto'
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    group_id = EXCLUDED.group_id,
    icon = EXCLUDED.icon,
    route = EXCLUDED.route;
END $$;
