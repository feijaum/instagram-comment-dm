-- Corrige de forma idempotente o estado do administrador inicial sem
-- regravar ou expor material de credencial em uma nova migration.
UPDATE users
SET
  is_active = 1,
  must_change_password = 1,
  updated_at = datetime('now')
WHERE email = 'jvleite7' || '@gmail.com';
