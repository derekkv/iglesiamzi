-- ============================================================
-- MIGRACIÓN: Pasivos — agregar fecha_ingreso
-- Renombra semánticamente el campo 'fecha' a 'fecha de pago'
-- (sin cambiar el nombre de columna, solo el label en la UI)
-- y agrega 'fecha_ingreso' con zona horaria Ecuador (UTC-5).
-- ============================================================

-- 1. Agregar columna fecha_ingreso si no existe
ALTER TABLE pasivos
  ADD COLUMN IF NOT EXISTS fecha_ingreso TIMESTAMPTZ
    NOT NULL
    DEFAULT (now() AT TIME ZONE 'America/Guayaquil');

-- 2. Para registros existentes que tengan fecha_ingreso NULL,
--    rellenar con created_at (el momento más cercano a cuando se creó)
UPDATE pasivos
  SET fecha_ingreso = created_at
  WHERE fecha_ingreso IS NULL;

-- 3. Asegurar que el DEFAULT quede fijo para nuevas filas
ALTER TABLE pasivos
  ALTER COLUMN fecha_ingreso
    SET DEFAULT (now() AT TIME ZONE 'America/Guayaquil');
