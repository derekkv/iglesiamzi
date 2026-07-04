-- =====================================================
-- MIGRACIÓN: Campos de Célula en censos + módulo Somos Uno
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Agregar campos de célula al censo de protocolo
ALTER TABLE censo
  ADD COLUMN IF NOT EXISTS celula_asiste BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS celula_nombre VARCHAR(100);

-- Agregar campos de célula al censo MDG
ALTER TABLE censo_mdg
  ADD COLUMN IF NOT EXISTS celula_asiste BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS celula_nombre VARCHAR(100);

-- Índice para consultar miembros por célula
CREATE INDEX IF NOT EXISTS idx_censo_celula ON censo(celula_nombre) WHERE celula_nombre IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_censo_mdg_celula ON censo_mdg(celula_nombre) WHERE celula_nombre IS NOT NULL;
