-- =============================================
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE
-- Eliminar el módulo "mdg-general" (placeholder) 
-- Dejar solo censo-mdg y cronograma-mdg dentro del grupo MDG
-- =============================================

DELETE FROM user_permissions WHERE module_id = (SELECT id FROM system_modules WHERE name = 'mdg-general');
DELETE FROM system_modules WHERE name = 'mdg-general';
