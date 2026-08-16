-- ============================================================
-- EXISTENCIA DE AYUDA — Módulo REDIL
-- Inventario de productos de ayuda social (víveres, pañales,
-- ropa, medicamentos) con registro de ingresos y egresos.
-- Categorías dinámicas (administrables desde la UI).
-- ============================================================

-- 1. Tabla de categorías (administrable)
CREATE TABLE IF NOT EXISTS existencia_ayuda_categorias (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL,
  icon        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_existencia_ayuda_categoria UNIQUE (nombre)
);

-- 2. Tabla de items del inventario (existencia actual)
CREATE TABLE IF NOT EXISTS existencia_ayuda_items (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre                TEXT NOT NULL,
  categoria             TEXT NOT NULL DEFAULT 'Otro',
  cantidad_actual       NUMERIC NOT NULL DEFAULT 0,
  descripcion           TEXT,
  registrado_por        UUID,
  registrado_por_nombre TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_existencia_ayuda_item UNIQUE (nombre, categoria)
);

CREATE INDEX IF NOT EXISTS idx_existencia_ayuda_items_categoria ON existencia_ayuda_items(categoria);

-- 2b. Ajustes para instalaciones previas (esquema viejo):
--     - quitar el CHECK de categoría (ahora las categorías son dinámicas)
--     - eliminar la columna 'unidad' si existe
DO $$
DECLARE
  c RECORD;
BEGIN
  -- Eliminar cualquier CHECK sobre la columna categoria de la tabla items
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'existencia_ayuda_items'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%categoria%'
  LOOP
    EXECUTE format('ALTER TABLE public.existencia_ayuda_items DROP CONSTRAINT %I', c.conname);
  END LOOP;

  -- Quitar la columna unidad si quedó de una versión anterior
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'existencia_ayuda_items'
      AND column_name = 'unidad'
  ) THEN
    ALTER TABLE public.existencia_ayuda_items DROP COLUMN unidad;
  END IF;

  -- Asegurar el default nuevo de categoria
  ALTER TABLE public.existencia_ayuda_items ALTER COLUMN categoria SET DEFAULT 'Otro';
END $$;

-- 2c. Normalizar categorías viejas (minúsculas) a los nombres nuevos,
--     para evitar productos duplicados al re-ejecutar el seed.
UPDATE existencia_ayuda_items SET categoria = 'Alimentos'    WHERE categoria = 'alimentos';
UPDATE existencia_ayuda_items SET categoria = 'Pañales'      WHERE categoria = 'panales';
UPDATE existencia_ayuda_items SET categoria = 'Ropa'         WHERE categoria = 'ropa';
UPDATE existencia_ayuda_items SET categoria = 'Medicamentos' WHERE categoria = 'medicamentos';
UPDATE existencia_ayuda_items SET categoria = 'Otro'         WHERE categoria = 'otro';
UPDATE existencia_ayuda_movimientos SET categoria = 'Alimentos'    WHERE categoria = 'alimentos';
UPDATE existencia_ayuda_movimientos SET categoria = 'Pañales'      WHERE categoria = 'panales';
UPDATE existencia_ayuda_movimientos SET categoria = 'Ropa'         WHERE categoria = 'ropa';
UPDATE existencia_ayuda_movimientos SET categoria = 'Medicamentos' WHERE categoria = 'medicamentos';
UPDATE existencia_ayuda_movimientos SET categoria = 'Otro'         WHERE categoria = 'otro';

-- 3. Tabla de movimientos (ingresos / egresos de productos)
CREATE TABLE IF NOT EXISTS existencia_ayuda_movimientos (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id           BIGINT REFERENCES existencia_ayuda_items(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_existencia_ayuda_mov_item ON existencia_ayuda_movimientos(item_id);
CREATE INDEX IF NOT EXISTS idx_existencia_ayuda_mov_tipo ON existencia_ayuda_movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_existencia_ayuda_mov_fecha ON existencia_ayuda_movimientos(fecha);

-- 4. Habilitar Realtime (idempotente: solo agrega si aún no es miembro)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'existencia_ayuda_categorias',
    'existencia_ayuda_items',
    'existencia_ayuda_movimientos'
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

-- 5. RLS (solo service_role — el acceso del cliente pasa por /api/db)
ALTER TABLE existencia_ayuda_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE existencia_ayuda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE existencia_ayuda_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_existencia_categorias" ON existencia_ayuda_categorias;
CREATE POLICY "service_role_full_existencia_categorias"
  ON existencia_ayuda_categorias FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_existencia_items" ON existencia_ayuda_items;
CREATE POLICY "service_role_full_existencia_items"
  ON existencia_ayuda_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_existencia_mov" ON existencia_ayuda_movimientos;
CREATE POLICY "service_role_full_existencia_mov"
  ON existencia_ayuda_movimientos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6. Registrar el módulo en system_modules (área REDIL)
DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM module_groups WHERE name ILIKE '%redil%' LIMIT 1;

  INSERT INTO system_modules (name, display_name, description, group_id, sort_order, is_active, icon, route)
  VALUES (
    'existencia_ayuda',
    'Existencia de Ayuda',
    'Inventario de productos de ayuda social (víveres, pañales, ropa, medicamentos) con registro de ingresos y egresos',
    v_group_id,
    10,
    true,
    'Package',
    '/dashboard/redil-existencia-ayuda'
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    group_id = EXCLUDED.group_id,
    icon = EXCLUDED.icon,
    route = EXCLUDED.route;
END $$;

-- 7. Seed de categorías iniciales (idempotente por UNIQUE(nombre))
INSERT INTO existencia_ayuda_categorias (nombre, icon) VALUES
  ('Alimentos',    '🍚'),
  ('Pañales',      '👶'),
  ('Ropa',         '👕'),
  ('Medicamentos', '💊'),
  ('Otro',         '📦')
ON CONFLICT (nombre) DO NOTHING;

-- 8. Seed de productos iniciales (idempotente por UNIQUE(nombre, categoria))
INSERT INTO existencia_ayuda_items (nombre, categoria, cantidad_actual) VALUES
  -- Alimentos / víveres
  ('Arroz',            'Alimentos', 0),
  ('Atún',             'Alimentos', 0),
  ('Aceite',           'Alimentos', 0),
  ('Azúcar',           'Alimentos', 0),
  ('Leche',            'Alimentos', 0),
  ('Fideo / Tallarín', 'Alimentos', 0),
  ('Sal',              'Alimentos', 0),
  ('Maizabrosa',       'Alimentos', 0),
  ('Mantequilla',      'Alimentos', 0),
  ('Café',             'Alimentos', 0),
  ('Avena Quaker',     'Alimentos', 0),
  ('Lenteja',          'Alimentos', 0),
  -- Pañales (por talla)
  ('Pañales - Talla pequeña',      'Pañales', 0),
  ('Pañales - Talla mediana',      'Pañales', 0),
  ('Pañales - Talla grande',       'Pañales', 0),
  ('Pañales - Talla extra grande', 'Pañales', 0),
  -- Ropa
  ('Blusas',        'Ropa', 0),
  ('Camisetas',     'Ropa', 0),
  ('Pantalón',      'Ropa', 0),
  ('Short',         'Ropa', 0),
  ('Pantalonetas',  'Ropa', 0),
  ('Buzos',         'Ropa', 0),
  ('Chompas',       'Ropa', 0),
  ('Gorras',        'Ropa', 0),
  ('Medias',        'Ropa', 0),
  -- Medicamentos
  ('Medicamentos',  'Medicamentos', 0)
ON CONFLICT (nombre, categoria) DO NOTHING;
