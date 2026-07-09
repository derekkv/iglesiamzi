-- ============================================================
-- Migración: Crear módulo "Cumpleaños" en grupo Comunicación
-- + Tabla cumpleanos_enviados para tracking de envíos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Crear la tabla de tracking de cumpleaños enviados
CREATE TABLE IF NOT EXISTS cumpleanos_enviados (
  id bigserial PRIMARY KEY,
  censo_id integer NOT NULL,
  fuente text NOT NULL CHECK (fuente IN ('protocolo', 'mdg')),
  fecha_cumple text NOT NULL,
  anio integer NOT NULL,
  canal_buzon boolean DEFAULT false,
  canal_push boolean DEFAULT false,
  canal_email boolean DEFAULT false,
  canal_whatsapp_imagen boolean DEFAULT false,
  canal_whatsapp_audio boolean DEFAULT false,
  enviado_at timestamptz DEFAULT now(),
  UNIQUE (censo_id, fuente, anio)
);

-- 2. Crear el módulo de cumpleaños dentro del grupo Comunicación
INSERT INTO system_modules (id, name, display_name, description, icon, route, requires_active_month, is_active, group_id, sort_order)
VALUES (
  gen_random_uuid(),
  'cumpleanos-comunicacion',
  'Cumpleaños',
  'Gestión de felicitaciones de cumpleaños del censo',
  '🎂',
  '/dashboard/cumpleanos',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'comunicacion'),
  6
);
