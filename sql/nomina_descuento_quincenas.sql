-- ============================================================
-- NÓMINA — Agregar campos de tiempo/quincenas para descuentos
-- Permite definir por cuántas quincenas se aplicará un descuento
-- y llevar el control de cuántas ya se han aplicado.
-- ============================================================

-- Agregar columnas a la tabla nomina
ALTER TABLE nomina
  ADD COLUMN IF NOT EXISTS descuento_quincenas_total INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS descuento_quincenas_aplicadas INT DEFAULT 0;

-- Comentarios descriptivos
COMMENT ON COLUMN nomina.descuento_quincenas_total IS 'Número total de quincenas durante las cuales se aplicará el descuento';
COMMENT ON COLUMN nomina.descuento_quincenas_aplicadas IS 'Número de quincenas en las que ya se ha aplicado el descuento';
