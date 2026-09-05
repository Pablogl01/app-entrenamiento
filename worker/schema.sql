-- Tablas del notificador (especificaciones §6.2) más la cuenta de usuario
-- (plans/007). Una base ya creada se pone al día con migrations/001-auth.sql.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  -- Instalaciones sin cuenta: SHA-256 del token anónimo del cliente.
  -- Cuentas: 'acct:' || id (único, sin uso). La columna se retirará con el token anónimo.
  token_hash TEXT UNIQUE NOT NULL,
  timezone TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  email TEXT,
  password_hash TEXT,
  password_salt TEXT,
  password_iterations INTEGER
);
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
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  local_time TEXT NOT NULL,
  only_scheduled_days INTEGER NOT NULL,
  PRIMARY KEY (user_id, type)
);
CREATE TABLE IF NOT EXISTS weekly_schedule (
  user_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  routine_name TEXT NOT NULL,
  PRIMARY KEY (user_id, weekday, routine_name)
);
CREATE TABLE IF NOT EXISTS daily_facts (
  user_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  weighed_in INTEGER NOT NULL DEFAULT 0,
  trained INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, local_date)
);
CREATE TABLE IF NOT EXISTS notification_log (
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  local_date TEXT NOT NULL,
  PRIMARY KEY (user_id, type, local_date)
);
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  blob TEXT NOT NULL
);
