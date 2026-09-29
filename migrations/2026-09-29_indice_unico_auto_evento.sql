-- =============================================================================
-- Migración: barrera dura anti-duplicados para ingresos de eventos
-- Fecha: 2026-09-29
-- Ejecutar en: Supabase Studio > SQL Editor (requiere acceso a la BD)
-- =============================================================================
--
-- CONTEXTO
-- Un bug de sincronización concurrente creó ~102 ingresos duplicados de eventos
-- ("auto-evento"). El código ya se endureció (candado de concurrencia +
-- idempotencia), pero este índice único es la barrera FÍSICA a nivel de base de
-- datos: aunque el código fallara, Postgres rechazaría el duplicado.
--
-- ALCANCE
-- SOLO aplica a filas con concepto = 'auto-evento', donde la regla de negocio es
-- "un (1) ingreso por participante por mes". El detalle es único por participante
-- y evento: "Abono evento - <nombre> (<EVENTO>)".
--
-- POR QUÉ NO SE INDEXAN LOS OTROS 'auto-*'
--   - auto-diezmo:     un mismo donante puede dar varias veces en el mes
--                      (ej. ESTUARDO Y CATALINA ROBALINO: $386.28 y $597) -> legítimo.
--   - auto-caja-chica: un mismo responsable puede tener varias gestiones en el mes
--                      (ej. JAIME SALAS: $10, $65, $65, $10) -> legítimo.
--   Un índice único sobre (concepto, mes_id, detalle) en esos casos RECHAZARÍA
--   registros válidos. Por eso el índice se limita a 'auto-evento'.
--
-- PRE-REQUISITO
-- No deben existir duplicados 'auto-evento' vigentes en (mes_id, detalle).
-- Verificado el 2026-09-29: 0 colisiones. Para re-verificar antes de aplicar:
--
--   SELECT mes_id, detalle, count(*)
--   FROM ingresos
--   WHERE concepto = 'auto-evento'
--   GROUP BY mes_id, detalle
--   HAVING count(*) > 1;
--
-- Si esa consulta devuelve filas, resolverlas antes de crear el índice.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ingreso_auto_evento
  ON ingresos (mes_id, detalle)
  WHERE concepto = 'auto-evento';

-- Para revertir:
-- DROP INDEX IF EXISTS uniq_ingreso_auto_evento;
