-- =====================================================
-- MIGRACIÓN: Buzón de Mensajes y Requerimientos de Bienes y Servicios
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TABLA: buzon_mensajes (notificaciones in-app)
-- =====================================================
CREATE TABLE IF NOT EXISTS buzon_mensajes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'info', -- info, requerimiento, aprobado, negado, suspenso
  leido BOOLEAN NOT NULL DEFAULT FALSE,
  referencia_tipo VARCHAR(50), -- 'requerimiento', etc.
  referencia_id BIGINT, -- ID del requerimiento u otro recurso
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para buzón
CREATE INDEX IF NOT EXISTS idx_buzon_user_id ON buzon_mensajes(user_id);
CREATE INDEX IF NOT EXISTS idx_buzon_user_leido ON buzon_mensajes(user_id, leido);
CREATE INDEX IF NOT EXISTS idx_buzon_created_at ON buzon_mensajes(created_at DESC);

-- Habilitar Realtime para buzon_mensajes
ALTER PUBLICATION supabase_realtime ADD TABLE buzon_mensajes;

-- RLS para buzón (cada usuario solo ve sus mensajes)
ALTER TABLE buzon_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON buzon_mensajes FOR SELECT
  USING (true);

CREATE POLICY "Users can update own messages"
  ON buzon_mensajes FOR UPDATE
  USING (true);

CREATE POLICY "Allow insert for all authenticated"
  ON buzon_mensajes FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 2. TABLA: requerimientos_bienes_servicios
-- =====================================================
CREATE TABLE IF NOT EXISTS requerimientos_bienes_servicios (
  id BIGSERIAL PRIMARY KEY,
  modulo VARCHAR(100) NOT NULL, -- módulo desde donde se envía
  ministerio VARCHAR(100) NOT NULL, -- select de config global
  persona_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- quien envía
  persona_nombre VARCHAR(200) NOT NULL, -- displayName del que envía
  requerimiento VARCHAR(250) NOT NULL, -- descripción, max 250
  valor DECIMAL(12,2), -- valor monetario
  evento_lugar VARCHAR(250) NOT NULL, -- evento o lugar
  fecha_requerimiento DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega DATE, -- fecha esperada de entrega
  -- Campos que se rellenan después (respuesta)
  respuesta VARCHAR(20) DEFAULT 'pendiente', -- pendiente, aprobado, negado, suspenso
  observaciones VARCHAR(250), -- por qué se aprobó/negó, max 250
  respondido_por_id UUID REFERENCES users(id), -- quien aprobó/negó
  respondido_por_nombre VARCHAR(200), -- displayName del que respondió
  fecha_respuesta TIMESTAMPTZ, -- cuándo se respondió
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para requerimientos
CREATE INDEX IF NOT EXISTS idx_requerimientos_modulo ON requerimientos_bienes_servicios(modulo);
CREATE INDEX IF NOT EXISTS idx_requerimientos_persona ON requerimientos_bienes_servicios(persona_id);
CREATE INDEX IF NOT EXISTS idx_requerimientos_respuesta ON requerimientos_bienes_servicios(respuesta);
CREATE INDEX IF NOT EXISTS idx_requerimientos_created ON requerimientos_bienes_servicios(created_at DESC);

-- Habilitar Realtime para requerimientos
ALTER PUBLICATION supabase_realtime ADD TABLE requerimientos_bienes_servicios;

-- RLS para requerimientos
ALTER TABLE requerimientos_bienes_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view requerimientos"
  ON requerimientos_bienes_servicios FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert requerimientos"
  ON requerimientos_bienes_servicios FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update requerimientos"
  ON requerimientos_bienes_servicios FOR UPDATE
  USING (true);

-- =====================================================
-- 3. Trigger para updated_at en requerimientos
-- =====================================================
CREATE OR REPLACE FUNCTION update_requerimientos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_requerimientos_updated_at
  BEFORE UPDATE ON requerimientos_bienes_servicios
  FOR EACH ROW
  EXECUTE FUNCTION update_requerimientos_updated_at();
