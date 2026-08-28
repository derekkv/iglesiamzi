-- ============================================================
-- EXISTENCIA — Módulo MUJERES DE GRACIA (MDG)
-- Inventario de productos/recursos del ministerio MDG con
-- registro de ingresos y egresos. Categorías dinámicas.
-- Tablas completamente independientes del módulo REDIL.
-- ============================================================

-- 1. Tabla de categorías
CREATE TABLE IF NOT EXISTS existencia_mdg_categorias (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL,
  icon        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_existencia_mdg_categoria UNIQUE (nombre)
);

-- 2. Tabla de items del inventario
CREATE TABLE IF NOT EXISTS existencia_mdg_items (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre                TEXT NOT NULL,
  categoria             TEXT NOT NULL DEFAULT 'General',
  cantidad_actual       NUMERIC NOT NULL DEFAULT 0,
  descripcion           TEXT,
  registrado_por        UUID,
  registrado_por_nombre TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_existencia_mdg_item UNIQUE (nombre, categoria)
);

CREATE INDEX IF NOT EXISTS idx_existencia_mdg_items_categoria ON existencia_mdg_items(categoria);

-- 3. Tabla de movimientos
CREATE TABLE IF NOT EXISTS existencia_mdg_movimientos (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id           BIGINT REFERENCES existencia_mdg_items(id) ON DELETE SET NULL,
  item_nombre       TEXT NOT NULL,
  categoria         TEXT,
  tipo              TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  cantidad          NUMERIC NOT NULL CHECK (cantidad > 0),
  motivo            TEXT,
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id        UUID,
  usuario_nombre    TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_existencia_mdg_mov_item  ON existencia_mdg_movimientos(item_id);
CREATE INDEX IF NOT EXISTS idx_existencia_mdg_mov_tipo  ON existencia_mdg_movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_existencia_mdg_mov_fecha ON existencia_mdg_movimientos(fecha);

-- 4. Habilitar Realtime
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'existencia_mdg_categorias',
    'existencia_mdg_items',
    'existencia_mdg_movimientos'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 5. RLS (solo service_role — acceso del cliente pasa por /api/db)
ALTER TABLE existencia_mdg_categorias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE existencia_mdg_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE existencia_mdg_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_existencia_mdg_categorias"  ON existencia_mdg_categorias;
CREATE POLICY "service_role_full_existencia_mdg_categorias"
  ON existencia_mdg_categorias FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_existencia_mdg_items" ON existencia_mdg_items;
CREATE POLICY "service_role_full_existencia_mdg_items"
  ON existencia_mdg_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_existencia_mdg_mov" ON existencia_mdg_movimientos;
CREATE POLICY "service_role_full_existencia_mdg_mov"
  ON existencia_mdg_movimientos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6. Registrar el módulo en system_modules (área MDG)
DO $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Buscar el grupo de MDG (mujeres de gracia)
  SELECT id INTO v_group_id FROM module_groups
  WHERE name ILIKE '%mujeres%' OR name ILIKE '%gracia%' OR name ILIKE '%mdg%'
  LIMIT 1;

  INSERT INTO system_modules (name, display_name, description, group_id, sort_order, is_active, icon, route)
  VALUES (
    'existencia_mdg',
    'Existencia',
    'Inventario de recursos y productos del ministerio Mujeres de Gracia con registro de ingresos y egresos',
    v_group_id,
    20,
    true,
    'Package',
    '/dashboard/mdg-existencia'
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description  = EXCLUDED.description,
    group_id     = EXCLUDED.group_id,
    icon         = EXCLUDED.icon,
    route        = EXCLUDED.route;
END $$;

-- 7. Seed de categorías iniciales (idempotente)
INSERT INTO existencia_mdg_categorias (nombre, icon) VALUES
  ('Telas',          '🧵'),
  ('Accesorios',     '💍'),
  ('Papelería',      '📄'),
  ('Decoración',     '🎀'),
  ('Alimentos',      '🍽️'),
  ('General',        '📦')
ON CONFLICT (nombre) DO NOTHING;
