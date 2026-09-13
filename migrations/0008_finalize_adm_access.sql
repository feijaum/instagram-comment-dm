UPDATE users
SET
  password_hash = 'pbkdf2-sha256$210000$k9+eIBxL+60UJFsAXM+P6Q==' || '$+RrNiXf6pLK0875j6V7YE9LrOPYn3oBOqt9MIDbQET8=',
  is_active = 1,
  must_change_password = 0,
  updated_at = datetime('now')
WHERE email = 'jvleite7' || '@gmail.com';

DELETE FROM auth_attempts
WHERE identifier_hash = 'lF3uXj8GrM1CznTVKeQyO+IiC3/Zhy15842/Hzl7CMA=';
