-- Access-code accounts: a player signs in with a code (NEKO-XXXX-XXXX) issued separately.
-- Codes and session tokens are stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_player ON sessions(player_id);

-- The haunted house of each player (the game's JSON save), so it follows the code to any device.
CREATE TABLE IF NOT EXISTS house_saves (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  json TEXT NOT NULL,
  saved_at INTEGER NOT NULL
);

-- EXP earned in the grimoire, waiting for the house to hand it to the cat.
CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  cat TEXT NOT NULL,
  exp INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rewards_player ON rewards(player_id);
