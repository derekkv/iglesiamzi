-- =============================================
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE
-- Tabla censo_mdg (independiente del censo de protocolo) + módulo
-- =============================================

-- 1. Crear tabla censo_mdg (misma estructura que censo)
CREATE TABLE IF NOT EXISTS censo_mdg (
  id SERIAL PRIMARY KEY,
  cedula TEXT NOT NULL,
  apellidos_nombres TEXT NOT NULL,
  fecha_nacimiento DATE,
  edad INTEGER,
  si_a_cristo TEXT,
  bautizo TEXT,
  tipo_sangre TEXT,
  estado_civil TEXT,
  sexo TEXT,
  capacidad_esp TEXT,
  tiene_discapacidad BOOLEAN DEFAULT false,
  porcentaje INTEGER,
  tipo_discapacidad TEXT,
  celular TEXT,
  convencional TEXT,
  familiar TEXT,
  familiar_nombre TEXT,
  conyuge TEXT,
  cedula_conyugue TEXT,
  correo TEXT,
  nivel_estudio TEXT,
  curso TEXT,
  direccion TEXT,
  ciudad TEXT,
  parroquia TEXT,
  barrio TEXT,
  tiene_hijos BOOLEAN DEFAULT false,
  hijos JSONB DEFAULT '[]',
  jornada_trabajo TEXT,
  cargo TEXT,
  lugar_trabajo TEXT,
  discipulado_irdd BOOLEAN DEFAULT false,
  primeros_pasos BOOLEAN DEFAULT false,
  seguimos_avanzando BOOLEAN DEFAULT false,
  siendo_iglesia BOOLEAN DEFAULT false,
  bautizo_irdd BOOLEAN DEFAULT false,
  fecha_bautizo DATE,
  matrimonio_irdd BOOLEAN DEFAULT false,
  fecha_matrimonio DATE,
  miembro BOOLEAN DEFAULT false,
  miembro_activo BOOLEAN DEFAULT false,
  sirve_iglesia BOOLEAN DEFAULT false,
  ministerio TEXT,
  cargo_ministerio TEXT,
  seminarios JSONB DEFAULT '[]',
  proyecto_mario BOOLEAN DEFAULT false,
  proyecto_mario_detalle TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_censo_mdg_nombre ON censo_mdg(apellidos_nombres);
CREATE INDEX idx_censo_mdg_cedula ON censo_mdg(cedula);

-- 2. Registrar módulo censo-mdg dentro del grupo MDG
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'censo-mdg',
  'Censo',
  'Registro de censo de Mujeres de Gracia',
  '📝',
  '/dashboard/censo-mdg',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'mdg' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
