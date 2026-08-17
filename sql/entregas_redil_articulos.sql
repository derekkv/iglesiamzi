-- ============================================================
-- AYUDA SOCIAL (REDIL) — Artículos entregados
-- Agrega a la tabla de entregas la lista de artículos de
-- existencia-ayuda que se entregaron en el caso. Esto permite
-- registrar qué se entregó (canasta de alimentos + otros
-- artículos), descontarlo del inventario y dejar trazabilidad.
--
-- Formato de articulos_entregados (JSONB):
-- {
--   "incluye_canasta": true,
--   "articulos": [
--     { "item_id": 1, "item_nombre": "Arroz", "categoria": "Alimentos", "cantidad": 2 },
--     ...
--   ]
-- }
-- ============================================================

ALTER TABLE IF EXISTS entregas_redil
  ADD COLUMN IF NOT EXISTS articulos_entregados JSONB;
