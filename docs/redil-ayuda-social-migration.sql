-- ============================================================
-- MÓDULO REDIL - AYUDA SOCIAL
-- Migración para crear las tablas del flujo de trabajo
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. TABLA PRINCIPAL: casos_redil
-- Información general del caso y su estado en el flujo
CREATE TABLE IF NOT EXISTS casos_redil (
  id BIGSERIAL PRIMARY KEY,
  -- Estado del flujo de trabajo
  estado TEXT NOT NULL DEFAULT 'pendiente_visita'
    CHECK (estado IN (
      'pendiente_visita',
      'en_visita_tecnica',
      'aprobado',
      'rechazado',
      'pendiente_entrega',
      'entregado',
      'cerrado'
    )),
  -- Metadatos
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  usuario_creador TEXT NOT NULL,          -- user_id del que crea la solicitud
  usuario_creador_nombre TEXT NOT NULL,   -- nombre del usuario para display
  aprobado_por TEXT,                       -- user_id de Gema o quien aprueba
  aprobado_por_nombre TEXT,               -- nombre display
  fecha_aprobacion TIMESTAMPTZ,
  -- Soft delete / audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABLA: solicitudes_redil
-- Todos los datos del formulario de solicitud (Paso 1)
CREATE TABLE IF NOT EXISTS solicitudes_redil (
  id BIGSERIAL PRIMARY KEY,
  caso_id BIGINT NOT NULL REFERENCES casos_redil(id) ON DELETE CASCADE,
  -- Datos personales
  nombre_completo TEXT NOT NULL,
  edad INTEGER,
  cedula TEXT,
  telefono TEXT,
  direccion TEXT,
  barrio_sector TEXT,
  estado_civil TEXT,
  numero_hijos INTEGER DEFAULT 0,
  edad_hijos TEXT,                        -- texto libre: "5, 8, 12 años"
  tiempo_asistiendo TEXT,                 -- ej: "2 años", "6 meses"
  -- Situación laboral
  trabaja_actualmente BOOLEAN DEFAULT FALSE,
  lugar_trabajo TEXT,
  ingreso_mensual TEXT,                   -- texto o numérico aproximado
  -- Motivo
  motivo TEXT,                            -- campo de texto grande
  -- Tipo de ayuda solicitada (puede ser múltiple)
  tipo_ayuda TEXT[] DEFAULT '{}',         -- array: ['canasta','medicinas','ropa',...]
  tipo_ayuda_otro TEXT,                   -- si selecciona "otro"
  -- Referencia
  referencia_nombre TEXT,
  referencia_telefono TEXT,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLA: visitas_tecnicas
-- Informe de la visita técnica (Paso 2 - Gema)
CREATE TABLE IF NOT EXISTS visitas_tecnicas (
  id BIGSERIAL PRIMARY KEY,
  caso_id BIGINT NOT NULL REFERENCES casos_redil(id) ON DELETE CASCADE,
  -- Resultado
  resultado TEXT NOT NULL CHECK (resultado IN ('aprobado', 'no_aprobado')),
  -- Detalles de la visita
  observaciones TEXT,                     -- campo grande
  motivo_rechazo TEXT,                    -- si fue rechazado
  -- Tipo de ayuda aprobada (lo que finalmente se entregará)
  tipo_ayuda_aprobada TEXT[] DEFAULT '{}',
  -- Metadatos
  fecha_visita TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  realizada_por TEXT NOT NULL,            -- user_id de Gema
  realizada_por_nombre TEXT NOT NULL,     -- nombre display
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLA: entregas_redil
-- Registro de entrega de la ayuda (Paso 3)
CREATE TABLE IF NOT EXISTS entregas_redil (
  id BIGSERIAL PRIMARY KEY,
  caso_id BIGINT NOT NULL REFERENCES casos_redil(id) ON DELETE CASCADE,
  -- Datos de entrega
  fecha_entrega TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archivos JSONB DEFAULT '[]',            -- Array de objetos: [{url, name, size, type}]
  observaciones TEXT,
  -- Metadatos
  entregado_por TEXT NOT NULL,            -- user_id
  entregado_por_nombre TEXT NOT NULL,     -- nombre display
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_casos_redil_estado ON casos_redil(estado);
CREATE INDEX IF NOT EXISTS idx_casos_redil_usuario_creador ON casos_redil(usuario_creador);
CREATE INDEX IF NOT EXISTS idx_casos_redil_fecha_creacion ON casos_redil(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_redil_caso_id ON solicitudes_redil(caso_id);
CREATE INDEX IF NOT EXISTS idx_visitas_tecnicas_caso_id ON visitas_tecnicas(caso_id);
CREATE INDEX IF NOT EXISTS idx_entregas_redil_caso_id ON entregas_redil(caso_id);

-- ============================================================
-- TRIGGER para actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_casos_redil_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_casos_redil_updated_at ON casos_redil;
CREATE TRIGGER trigger_casos_redil_updated_at
  BEFORE UPDATE ON casos_redil
  FOR EACH ROW
  EXECUTE FUNCTION update_casos_redil_updated_at();

-- ============================================================
-- REGISTRO DEL MÓDULO EN system_modules
-- El módulo aparecerá en el dashboard dentro del grupo REDIL
-- ============================================================

-- Registrar el módulo de ayuda social en el grupo REDIL existente:
INSERT INTO system_modules (name, display_name, description, icon, route, requires_active_month, is_active, group_id, sort_order)
VALUES (
  'redil_ayuda_social',
  'Ayuda Social',
  'Administrar solicitudes de ayuda social del ministerio REDIL',
  '🤝',
  '/dashboard/redil-ayuda-social',
  false,
  true,
  (SELECT id FROM module_groups WHERE name = 'redil'),
  50
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PERMISOS: Asignar a usuarios relevantes
-- Reemplazar los IDs con los IDs reales de los usuarios
-- ============================================================

-- Para usuarios del ministerio REDIL (crear solicitudes, ver sus casos, hacer entregas):
-- INSERT INTO user_permissions (user_id, module_id, can_view, can_edit, can_admin)
-- SELECT '<USER_ID_REDIL>', id, true, true, false
-- FROM system_modules WHERE name = 'redil_ayuda_social';

-- Para Gema (visita técnica, aprobar/rechazar):
-- INSERT INTO user_permissions (user_id, module_id, can_view, can_edit, can_admin)
-- SELECT '<USER_ID_GEMA>', id, true, true, false
-- FROM system_modules WHERE name = 'redil_ayuda_social';

-- Para Derek (admin completo):
-- INSERT INTO user_permissions (user_id, module_id, can_view, can_edit, can_admin)
-- SELECT '<USER_ID_DEREK>', id, true, true, false
-- FROM system_modules WHERE name = 'redil_ayuda_social';


-- ============================================================
-- SUPABASE STORAGE: Crear bucket para archivos del REDIL
-- Ejecutar en SQL Editor o desde Dashboard > Storage
-- ============================================================

-- Crear bucket público para archivos de entregas (fotos, videos, documentos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'redil-archivos',
  'redil-archivos',
  true,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Política de acceso público para lectura (las URLs son públicas)
CREATE POLICY "Acceso público lectura redil-archivos"
ON storage.objects FOR SELECT
USING (bucket_id = 'redil-archivos');

-- Política para subir archivos (solo service_role, se maneja desde el API route)
CREATE POLICY "Service role upload redil-archivos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'redil-archivos');
