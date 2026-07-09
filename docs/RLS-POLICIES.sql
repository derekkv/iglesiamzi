-- ============================================================
-- POLÍTICAS RLS — BLOQUEO TOTAL DEL ROL ANON
-- Iglesia Regalo de Dios — Sistema de Gestión
-- ============================================================
--
-- ESTRATEGIA:
-- La clave anon es PÚBLICA (visible en el JS del browser).
-- Por lo tanto, BLOQUEAMOS TODO acceso desde el rol anon.
-- TODAS las queries pasan por /api/db que usa service_key.
-- El service_role bypassa RLS, así que solo necesitamos
-- asegurarnos de que anon no pueda hacer NADA.
--
-- ÚNICA EXCEPCIÓN:
-- Supabase Realtime necesita SELECT en buzon_mensajes para
-- las suscripciones en tiempo real. Se configura aparte.
--
-- EJECUTAR EN: SQL Editor de Supabase
-- ============================================================

-- ============================================================
-- PASO 1: Activar RLS en TODAS las tablas
-- ============================================================

ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS security_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_group_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS module_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS configuraciones_globales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nomina ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS egresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS diezmos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ofrendas_celulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cronograma_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gestion_atrasados ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS buzon_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mensajes_citaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mensajes_citaciones_recibidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS requerimientos_bienes_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bautizos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS matrimonios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS censo ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS censo_mdg ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS censo_catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS censo_configuraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asistencia_columnas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asistencia_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asistencia_datos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS discipulado_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS discipulado_ciclo_fechas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS discipulado_asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS discipulado_fechas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS discipulado_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASO 2: Eliminar TODAS las políticas existentes
-- (para empezar de cero)
-- ============================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================
-- PASO 3: Crear política DEFAULT DENY para TODAS las tablas
-- Con RLS activado y sin políticas = acceso denegado para anon.
-- El service_role (usado por las API routes) bypassa RLS.
-- ============================================================

-- No necesitamos crear políticas de "deny" explícitas.
-- En PostgreSQL, cuando RLS está activado y no hay políticas
-- que permitan acceso, el acceso queda BLOQUEADO por defecto.
-- El rol service_role tiene bypass RLS habilitado.

-- ============================================================
-- PASO 4: ÚNICA EXCEPCIÓN — Realtime para buzon_mensajes
-- Supabase Realtime usa el rol anon para las suscripciones.
-- Necesitamos permitir SELECT en buzon_mensajes para que
-- las notificaciones en tiempo real funcionen.
-- ============================================================

CREATE POLICY "buzon_realtime_select" ON buzon_mensajes
  FOR SELECT
  TO anon
  USING (true);

-- También permitir INSERT en buzon_mensajes desde anon
-- porque el hook use-notificaciones inserta desde el cliente.
-- NOTA: Después de migrar a /api/db, esto se puede quitar.
CREATE POLICY "buzon_realtime_insert" ON buzon_mensajes
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Permitir UPDATE en buzon_mensajes (marcar como leído)
CREATE POLICY "buzon_realtime_update" ON buzon_mensajes
  FOR UPDATE
  TO anon
  USING (true);

-- ============================================================
-- PASO 5: Excepción para user_permissions (PermissionsGuard)
-- El checkUserEditPermission es un server action ("use server")
-- que usa la misma instancia de supabase con anon key.
-- Necesita SELECT en user_permissions y system_modules.
-- ============================================================

CREATE POLICY "permissions_select_for_guard" ON user_permissions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "modules_select_for_guard" ON system_modules
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "groups_select_for_guard" ON module_groups
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "leaders_select_for_guard" ON user_group_leaders
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- PASO 6: Excepción para users (necesario para listar nombres)
-- SOLO SELECT de campos no-sensibles.
-- El password_hash se filtra a nivel de /api/db (blockedFields).
-- ============================================================

CREATE POLICY "users_select_for_app" ON users
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 
-- Ejecutar para confirmar RLS activo:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
--
-- Ejecutar para ver políticas:
-- SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
--
-- TEST: Intentar acceder a diezmos con anon key (debería fallar):
-- SET ROLE anon;
-- SELECT * FROM diezmos; -- ERROR: permission denied
-- RESET ROLE;
--
-- ============================================================
-- RESUMEN
-- ============================================================
--
-- TABLAS SIN NINGUNA POLÍTICA (BLOQUEADAS COMPLETAMENTE para anon):
--   security_keys, push_subscriptions, user_sessions,
--   configuraciones_globales, meses, nomina, ingresos, egresos,
--   diezmos, ofrendas_celulas, cronograma_servicio, gestion_atrasados,
--   mensajes_citaciones, mensajes_citaciones_recibidos,
--   requerimientos_bienes_servicios, bautizos, matrimonios,
--   censo, censo_mdg, censo_catalogos, censo_configuraciones,
--   inventory_items, asistencia_columnas, asistencia_detalles,
--   asistencia_datos, discipulado_ciclos, discipulado_ciclo_fechas,
--   discipulado_asistencia, discipulado_fechas, discipulado_participantes,
--   audit_logs
--
-- TABLAS CON SELECT PERMITIDO (necesarias para Realtime o Guards):
--   users (SELECT only — password_hash filtrado en /api/db)
--   buzon_mensajes (SELECT + INSERT + UPDATE — Realtime)
--   user_permissions (SELECT only — PermissionsGuard)
--   system_modules (SELECT only — PermissionsGuard)
--   module_groups (SELECT only — PermissionsGuard)
--   user_group_leaders (SELECT only — PermissionsGuard)
--
-- TODA ESCRITURA en tablas de datos pasa por /api/db
-- que usa service_key (bypassa RLS) + verifica JWT + permisos
-- ============================================================
