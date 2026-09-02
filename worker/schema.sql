-- Tablas del notificador (especificaciones §6.2), idénticas al servidor Node.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  timezone TEXT NOT NULL,
  created_at INTEGER NOT NULL
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
