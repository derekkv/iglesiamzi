-- Agregar columna updated_at a asistencia_datos si no existe
-- Esto permite el check de seguridad por celda individual
ALTER TABLE asistencia_datos
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Llenar las celdas existentes con su created_at como valor inicial
UPDATE asistencia_datos SET updated_at = created_at WHERE updated_at IS NULL;
