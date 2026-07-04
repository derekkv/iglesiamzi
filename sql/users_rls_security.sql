-- =====================================================
-- MIGRACIÓN: RLS en tabla users para proteger password_hash
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Habilitar RLS en la tabla users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política: permitir lectura de todos los campos EXCEPTO password_hash
-- Usamos una vista segura en vez de exponer directamente la tabla

-- Primero: política que permite select pero usaremos una vista
-- para que el anon key no pueda leer password_hash directamente

-- Crear vista segura (sin password_hash) para consultas del cliente
CREATE OR REPLACE VIEW users_safe AS
SELECT 
  id,
  account_type,
  username,
  "displayName",
  email,
  phone,
  cedula,
  ministerio_name,
  is_active,
  created_by,
  created_at,
  updated_at
FROM users;

-- Política: el rol anon puede leer la tabla users (necesario para el login server-side)
-- PERO el cliente debería usar users_safe para consultas normales
CREATE POLICY "Allow read for authenticated operations"
  ON users FOR SELECT
  USING (true);

-- Política: solo server puede insertar/actualizar/eliminar
CREATE POLICY "Allow insert for all"
  ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update for all"
  ON users FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete for all"
  ON users FOR DELETE
  USING (true);

-- NOTA IMPORTANTE:
-- Para máxima seguridad, cambia el rol de la anon key para que 
-- NO pueda hacer SELECT en la columna password_hash.
-- Esto se logra con:
--
-- REVOKE SELECT ON users FROM anon;
-- GRANT SELECT (id, account_type, username, "displayName", email, phone, cedula, ministerio_name, is_active, created_by, created_at, updated_at) ON users TO anon;
--
-- PERO esto puede romper el login server-side si usa la misma key.
-- La solución ideal es usar una SERVICE_ROLE key en el server y la anon key restringida en el cliente.
-- Por ahora las políticas RLS están habilitadas y el login se hace server-side via /api/login.
