-- =====================================================
-- MIGRACIÓN: Agregar confirmación de recepción y cierre
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Campo que indica si el solicitante confirmó recepción
ALTER TABLE requerimientos_bienes_servicios
  ADD COLUMN IF NOT EXISTS recibido BOOLEAN DEFAULT FALSE;

-- Fecha en la que el solicitante confirmó recepción
ALTER TABLE requerimientos_bienes_servicios
  ADD COLUMN IF NOT EXISTS fecha_recibido TIMESTAMPTZ;
