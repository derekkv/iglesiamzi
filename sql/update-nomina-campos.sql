-- Actualizar tabla nomina con nuevos campos
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS telefono text;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS valor_sueldo numeric DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS descuento text;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS descuento_valor numeric DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS descuento_motivo text;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS valor_a_pagar numeric DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS categoria_principal text DEFAULT 'Pago de nómina';
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS detalle text;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS primera_quincena_valor numeric;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS segunda_quincena_valor numeric;

-- Migrar datos existentes: copiar "valor" a "valor_sueldo" y "valor_a_pagar"
UPDATE nomina SET valor_sueldo = valor, valor_a_pagar = valor WHERE valor_sueldo = 0 OR valor_sueldo IS NULL;

-- Agregar campo nomina_detalles a configuraciones_globales
ALTER TABLE configuraciones_globales ADD COLUMN IF NOT EXISTS nomina_detalles text[] DEFAULT '{}';
