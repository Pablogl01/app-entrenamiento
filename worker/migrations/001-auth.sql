-- 001: cuenta de usuario con sesión persistente (plans/007 §2.1).
-- Se ejecuta UNA vez sobre una base que ya tenía las tablas del notificador:
--   local:  npx wrangler d1 execute entrenamiento --local  --file=migrations/001-auth.sql
--   remoto: npx wrangler d1 execute entrenamiento --remote --file=migrations/001-auth.sql
-- Los ALTER TABLE fallan si la columna ya existe: no repetir. Una base nueva
-- no la necesita: schema.sql ya crea las tablas con estas columnas.

ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;
ALTER TABLE users ADD COLUMN password_iterations INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  family TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  replaced_by TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  locked_until INTEGER
);
