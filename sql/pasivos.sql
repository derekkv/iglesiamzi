-- ============================================================
-- PASIVOS — Módulo de Administración
-- Lista de deudas que la iglesia tiene con terceros (acreedores).
-- Cada abono baja el saldo y genera un egreso en el mes activo
-- (categoría "PAGO DE PASIVOS"), igual que la nómina.
-- ============================================================

-- 1. Tabla de pasivos (deudas)
CREATE TABLE IF NOT EXISTS pasivos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acreedor      TEXT NOT NULL,
  detalle       TEXT,
  monto_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha         DATE NOT NULL DEFAULT current_date,
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
  observacion   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de abonos (pagos parciales a un pasivo)
CREATE TABLE IF NOT EXISTS pasivos_abonos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pasivo_id     BIGINT NOT NULL REFERENCES pasivos(id) ON DELETE CASCADE,
  monto         NUMERIC(12,2) NOT NULL,
  fecha         DATE NOT NULL DEFAULT current_date,
  metodo_pago   TEXT,
  observacion   TEXT,
  egreso_id     BIGINT,   -- egreso generado por este abono (para poder revertirlo)
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pasivos_estado ON pasivos(estado);
CREATE INDEX IF NOT EXISTS idx_pasivos_abonos_pasivo ON pasivos_abonos(pasivo_id);

-- 3. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pasivos;
ALTER PUBLICATION supabase_realtime ADD TABLE pasivos_abonos;

-- 4. RLS (solo service_role; el acceso real lo controla /api/db por permisos)
ALTER TABLE pasivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pasivos_abonos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_pasivos"
  ON pasivos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_full_pasivos_abonos"
  ON pasivos_abonos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Registrar el módulo en system_modules (área Administración)
DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM module_groups
   WHERE name ILIKE '%administ%' OR display_name ILIKE '%administ%'
   LIMIT 1;

  INSERT INTO system_modules (name, display_name, description, group_id, sort_order, is_active, icon, route)
  VALUES (
    'pasivos',
    'Lista de Pasivos',
    'Deudas de la iglesia con terceros; registro de abonos que bajan el saldo y generan egresos',
    v_group_id,
    50,
    true,
    'Wallet',
    '/dashboard/pasivos'
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    group_id = EXCLUDED.group_id,
    icon = EXCLUDED.icon,
    route = EXCLUDED.route;
END $$;

-- 6. (Opcional) Otorgar permiso a un usuario concreto para que vea/edite el módulo.
--    Reemplaza <USER_ID> por el id del usuario (tabla users). También puedes
--    hacerlo desde el panel de Administración → Permisos.
--
-- INSERT INTO user_permissions (user_id, module_id, can_view, can_edit, can_admin)
-- SELECT '<USER_ID>', sm.id, true, true, false
--   FROM system_modules sm WHERE sm.name = 'pasivos'
-- ON CONFLICT (user_id, module_id) DO UPDATE
--   SET can_view = true, can_edit = true;
