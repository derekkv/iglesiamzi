-- ============================================================
-- INGRESOS auto-evento — índice único (barrera anti-duplicados)
-- ------------------------------------------------------------
-- Un abono de evento equivale a UN SOLO ingreso, identificado por
-- (concepto='auto-evento' + detalle). Este índice único parcial impide
-- físicamente que se vuelvan a crear ingresos duplicados del mismo abono
-- (p.ej. la re-emisión mes a mes que infló los totales).
--
-- IMPORTANTE: ejecutar DESPUÉS de limpiar los duplicados existentes
-- (script de respaldo/borrado). Si aún hay detalles repetidos, la creación
-- del índice fallará indicando el valor duplicado.
--
-- Nota: el detalle incluye el nombre del participante y el nombre del evento:
--   "Abono evento - {nombre} ({EVENTO})"
-- Dos participantes con EXACTAMENTE el mismo nombre en el mismo evento
-- compartirían detalle; en ese caso debe distinguirse el nombre antes de crear
-- el índice (es un caso raro y, de hecho, otra fuente potencial de error).
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingresos_auto_evento_detalle
  ON ingresos (detalle)
  WHERE concepto = 'auto-evento';
