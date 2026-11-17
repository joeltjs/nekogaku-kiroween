-- NekoGaku Kiroween: the grimoire's curriculum and each player's progress.
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  ord INTEGER NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('jlpt', 'ssw'))
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('vocab', 'kanji', 'grammar', 'ssw')),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS units_track ON units(track_id, ord);

CREATE TABLE IF NOT EXISTS progress (
  player_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  best INTEGER NOT NULL,
  total INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, unit_id)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
