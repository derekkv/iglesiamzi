-- =====================================================
-- MIGRACIÓN: Mensajes y Citaciones
-- Ejecutar en Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS mensajes_citaciones (
  id BIGSERIAL PRIMARY KEY,
  -- Remitente
  remitente_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remitente_nombre VARCHAR(200) NOT NULL,
  modulo_origen VARCHAR(100) NOT NULL,  -- protocolo, mdg, administracion, discipulado
  -- Destinatario
  destinatario_tipo VARCHAR(20) NOT NULL, -- usuario, modulo, todos
  destinatario_id UUID REFERENCES users(id) ON DELETE SET NULL, -- si es usuario específico
  destinatario_modulo VARCHAR(100),      -- si es un módulo (todos los del módulo)
  destinatario_nombre VARCHAR(200),      -- nombre display del destinatario o módulo
  -- Contenido
  tipo VARCHAR(20) NOT NULL DEFAULT 'mensaje', -- mensaje, invitacion
  detalle VARCHAR(240) NOT NULL,
  fecha DATE NOT NULL,
  valor DECIMAL(12,2),
  evento_lugar VARCHAR(250),
  -- Estado
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de recepción (para tracking individual de quién recibió el mensaje)
CREATE TABLE IF NOT EXISTS mensajes_citaciones_recibidos (
  id BIGSERIAL PRIMARY KEY,
  mensaje_id BIGINT NOT NULL REFERENCES mensajes_citaciones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leido BOOLEAN NOT NULL DEFAULT FALSE,
  leido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mensaje_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mensajes_remitente ON mensajes_citaciones(remitente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_modulo ON mensajes_citaciones(modulo_origen);
CREATE INDEX IF NOT EXISTS idx_mensajes_recib_user ON mensajes_citaciones_recibidos(user_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_recib_msg ON mensajes_citaciones_recibidos(mensaje_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes_citaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes_citaciones_recibidos;
