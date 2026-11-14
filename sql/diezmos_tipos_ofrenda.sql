-- =============================================================================
-- Diezmos: tipos de ofrenda por actividades
-- =============================================================================
--
-- Añade cuatro valores a `diezmos.tipo_ofrenda`:
--   actividad_redil     → Actividad Redil
--   entradas_eventos    → Entradas a Eventos
--   seminarios          → Seminarios
--   otras_actividades   → Otras Ofrendas por Actividades
--
-- Los tres valores anteriores (diezmo, primicia, diezmo_especial) no cambian.
--
-- POR QUÉ ESTE SCRIPT ES NECESARIO
-- --------------------------------
-- El repositorio no versiona el DDL de `diezmos`, así que no se puede saber
-- desde el código si la columna tiene una restricción CHECK que limite sus
-- valores. Si la tiene y no se ejecuta esto, al registrar una ofrenda de los
-- tipos nuevos la base la rechaza; la aplicación lo mostrará como error y
-- revertirá el registro, pero el usuario no podrá guardar.
--
-- El script es idempotente y no toca datos: se puede ejecutar varias veces.
--
-- CÓMO EJECUTARLO
-- ---------------
-- SQL Editor de Supabase, con un respaldo previo de la tabla `diezmos`.
-- =============================================================================

BEGIN;

-- 1. Verificación informativa: qué valores existen hoy en la tabla.
--    Si aquí aparece algo que no esté en la lista de abajo, deténgase y
--    revíselo antes de continuar: la restricción nueva lo rechazaría.
DO $$
DECLARE
  valores text;
BEGIN
  SELECT string_agg(DISTINCT COALESCE(tipo_ofrenda, '(nulo)'), ', ')
    INTO valores
    FROM public.diezmos;
  RAISE NOTICE 'Valores actuales de tipo_ofrenda: %', COALESCE(valores, '(tabla vacía)');
END $$;

-- 2. Eliminar cualquier CHECK existente sobre `tipo_ofrenda`, cualquiera sea
--    su nombre. Se buscan por definición para no depender del nombre que
--    Postgres le haya puesto.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'diezmos'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%tipo_ofrenda%'
  LOOP
    EXECUTE format('ALTER TABLE public.diezmos DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Restricción eliminada: %', r.conname;
  END LOOP;
END $$;

-- 3. Restricción nueva con los siete tipos. Se permite NULL porque hay
--    registros antiguos sin tipo, que la aplicación cuenta como diezmo.
ALTER TABLE public.diezmos
  ADD CONSTRAINT diezmos_tipo_ofrenda_check
  CHECK (
    tipo_ofrenda IS NULL
    OR tipo_ofrenda IN (
      'diezmo',
      'primicia',
      'diezmo_especial',
      'actividad_redil',
      'entradas_eventos',
      'seminarios',
      'otras_actividades'
    )
  );

-- 4. Valor por omisión, para que un insert sin tipo quede clasificado.
ALTER TABLE public.diezmos
  ALTER COLUMN tipo_ofrenda SET DEFAULT 'diezmo';

COMMIT;

-- =============================================================================
-- Comprobación posterior (ejecutar aparte):
--
--   SELECT tipo_ofrenda, transaccion, count(*), sum(valor)
--     FROM public.diezmos
--    GROUP BY 1, 2
--    ORDER BY 1, 2;
--
-- Para revertir, basta volver a dejar la restricción con los tres valores
-- originales, DESPUÉS de comprobar que no haya filas con los tipos nuevos:
--
--   SELECT count(*) FROM public.diezmos
--    WHERE tipo_ofrenda IN ('actividad_redil','entradas_eventos','seminarios','otras_actividades');
-- =============================================================================
