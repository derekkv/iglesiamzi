-- Agregar nuevos campos a la tabla nomina
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS telefono text;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS descuento text;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS categoria_principal text DEFAULT 'Pago de nómina';
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS detalle text;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS primera_quincena_valor numeric;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS segunda_quincena_valor numeric;

-- Eliminar columnas viejas de descuento si existen
ALTER TABLE nomina DROP COLUMN IF EXISTS descuento_prestamo;
ALTER TABLE nomina DROP COLUMN IF EXISTS descuento_multas;
ALTER TABLE nomina DROP COLUMN IF EXISTS descuento_eventos;

-- Agregar campo nomina_detalles a configuraciones_globales
ALTER TABLE configuraciones_globales ADD COLUMN IF NOT EXISTS nomina_detalles text[] DEFAULT '{}';
