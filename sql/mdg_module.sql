-- =============================================
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE
-- =============================================

-- 1. Eliminar el módulo suelto "mdg" (sin grupo) y sus permisos
DELETE FROM user_permissions WHERE module_id = (SELECT id FROM system_modules WHERE name = 'mdg' AND group_id IS NULL);
DELETE FROM system_modules WHERE name = 'mdg' AND group_id IS NULL;

-- 2. Actualizar el nombre del grupo MDG a "Mujeres de Gracia"
UPDATE module_groups SET display_name = 'Mujeres de Gracia' WHERE name = 'mdg';

-- 3. Actualizar el sub-módulo
UPDATE system_modules 
SET display_name = 'MDG General', description = 'Módulo principal de Mujeres de Gracia'
WHERE name = 'mdg-general';
