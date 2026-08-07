-- ============================================================
-- PAGO DIARIO — Actualizar CHECK constraint de metodo_pago
-- Agrega opciones de Tarjeta de Crédito prestada por hermanos
-- ============================================================

-- 1. Eliminar el constraint actual
ALTER TABLE pago_diario DROP CONSTRAINT IF EXISTS pago_diario_metodo_pago_check;

-- 2. Agregar el nuevo constraint con las opciones de TC
ALTER TABLE pago_diario ADD CONSTRAINT pago_diario_metodo_pago_check
  CHECK (metodo_pago IN (
    'Efectivo',
    'Transferencia',
    'TC - Henry Arias',
    'TC - Valeria Escobar',
    'TC - Leonardo Lucas',
    'TC - Yamil Machuca',
    'TC - Jaime Salas',
    'TC - Miguel Machuca'
  ));

-- 3. Verificar si egresos tiene un constraint similar y actualizarlo
ALTER TABLE egresos DROP CONSTRAINT IF EXISTS egresos_metodo_pago_check;
