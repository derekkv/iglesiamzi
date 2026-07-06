-- Agregar columna transaccion a la tabla diezmos
-- Valores: 'efectivo' o 'transferencia'
ALTER TABLE diezmos
ADD COLUMN IF NOT EXISTS transaccion text DEFAULT 'efectivo'
CHECK (transaccion IN ('efectivo', 'transferencia'));
