INSERT INTO users (id, email, password_hash, is_active, must_change_password)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'jvleite7' || '@gmail.com',
  'pbkdf2-sha256$210000$3pH7xImQjMteJS9+V+JIOQ==' || '$v36aGl6q6t0vR82fxdaGlKThpjCEYOR6g7Jvch6ce7o=',
  1,
  1
)
ON CONFLICT(email) DO UPDATE SET
  password_hash = excluded.password_hash,
  is_active = 1,
  must_change_password = 1,
  updated_at = datetime('now');
