-- Tabla para cronograma de servicio
CREATE TABLE IF NOT EXISTS cronograma_servicio (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  lugar TEXT NOT NULL,
  fecha DATE NOT NULL,
  modulo TEXT NOT NULL DEFAULT 'protocolo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_cronograma_modulo ON cronograma_servicio(modulo);
CREATE INDEX idx_cronograma_fecha ON cronograma_servicio(fecha);
CREATE INDEX idx_cronograma_user ON cronograma_servicio(user_id);

-- Registrar módulo en system_modules
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id)
VALUES (
  'cronograma-protocolo',
  'Cronograma de Servicio',
  'Asignación de turnos de servicio para protocolo',
  '📋',
  '/dashboard/cronograma-protocolo',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'protocolo' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
