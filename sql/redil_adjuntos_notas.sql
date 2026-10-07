-- ============================================================
-- REDIL — Ayuda Social: Adjuntos y Notas por etapa
-- ------------------------------------------------------------
-- Permite subir archivos (fotos, videos, documentos) y registrar
-- notas en CUALQUIER etapa del caso (desde el inicio y en cada
-- paso: general, solicitud, visita técnica y entrega), sin
-- depender de que exista aún la fila de solicitud/visita/entrega.
--
-- Se usan dos tablas genéricas vinculadas al caso. El acceso del
-- cliente pasa por /api/db (JWT + permisos del módulo
-- redil_ayuda_social). Las subidas de archivos usan /api/upload-file
-- (bucket redil-archivos); aquí solo se guarda la metadata/URL.
--
-- Etapas válidas: 'general' | 'solicitud' | 'visita' | 'entrega'
-- ============================================================

-- 1. Adjuntos (archivos) por caso + etapa
CREATE TABLE IF NOT EXISTS redil_adjuntos (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caso_id           BIGINT NOT NULL REFERENCES casos_redil(id) ON DELETE CASCADE,
  etapa             TEXT NOT NULL DEFAULT 'general'
                      CHECK (etapa IN ('general', 'solicitud', 'visita', 'entrega')),
  url               TEXT NOT NULL,
  path              TEXT,
  name              TEXT NOT NULL,
  size              BIGINT NOT NULL DEFAULT 0,
  type              TEXT,
  descripcion       TEXT,
  subido_por        UUID,
  subido_por_nombre TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redil_adjuntos_caso  ON redil_adjuntos(caso_id);
CREATE INDEX IF NOT EXISTS idx_redil_adjuntos_etapa ON redil_adjuntos(caso_id, etapa);

-- 2. Notas / seguimiento por caso + etapa (editable)
CREATE TABLE IF NOT EXISTS redil_notas (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caso_id           BIGINT NOT NULL REFERENCES casos_redil(id) ON DELETE CASCADE,
  etapa             TEXT NOT NULL DEFAULT 'general'
                      CHECK (etapa IN ('general', 'solicitud', 'visita', 'entrega')),
  contenido         TEXT NOT NULL,
  usuario_id        UUID,
  usuario_nombre    TEXT,
  editado           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redil_notas_caso  ON redil_notas(caso_id);
CREATE INDEX IF NOT EXISTS idx_redil_notas_etapa ON redil_notas(caso_id, etapa);

-- 3. Habilitar Realtime (idempotente: solo agrega si aún no es miembro)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['redil_adjuntos', 'redil_notas']
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

-- 4. RLS (solo service_role — el acceso del cliente pasa por /api/db)
ALTER TABLE redil_adjuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE redil_notas    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_redil_adjuntos" ON redil_adjuntos;
CREATE POLICY "service_role_full_redil_adjuntos"
  ON redil_adjuntos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_redil_notas" ON redil_notas;
CREATE POLICY "service_role_full_redil_notas"
  ON redil_notas FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
