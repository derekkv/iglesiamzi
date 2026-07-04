-- =====================================================
-- MIGRACIÓN: Control de Asistencia de Servidores
-- Ejecutar en Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS asistencia_servidores (
  id BIGSERIAL PRIMARY KEY,
  modulo VARCHAR(50) NOT NULL,         -- protocolo, mdg, administracion, discipulado
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(200) NOT NULL,
  fecha DATE NOT NULL,                  -- el domingo específico
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- asistio, falto, justifico, pendiente
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(modulo, user_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asist_serv_modulo ON asistencia_servidores(modulo);
CREATE INDEX IF NOT EXISTS idx_asist_serv_fecha ON asistencia_servidores(fecha);
CREATE INDEX IF NOT EXISTS idx_asist_serv_user ON asistencia_servidores(user_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE asistencia_servidores;
