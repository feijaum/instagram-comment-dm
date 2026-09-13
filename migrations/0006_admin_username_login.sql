ALTER TABLE users ADD COLUMN username TEXT COLLATE NOCASE;
CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;

UPDATE users
SET
  username = 'ADM',
  password_hash = 'pbkdf2-sha256$210000$k9+eIBxL+60UJFsAXM+P6Q==' || '$+RrNiXf6pLK0875j6V7YE9LrOPYn3oBOqt9MIDbQET8=',
  is_active = 1,
  must_change_password = 0,
  updated_at = datetime('now')
WHERE email = 'jvleite7' || '@gmail.com';
