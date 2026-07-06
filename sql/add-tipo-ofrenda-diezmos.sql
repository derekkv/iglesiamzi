-- Agregar columna tipo_ofrenda a la tabla diezmos
-- Valores: 'diezmo', 'primicia', 'diezmo_especial'
ALTER TABLE diezmos
ADD COLUMN IF NOT EXISTS tipo_ofrenda text DEFAULT 'diezmo'
CHECK (tipo_ofrenda IN ('diezmo', 'primicia', 'diezmo_especial'));
