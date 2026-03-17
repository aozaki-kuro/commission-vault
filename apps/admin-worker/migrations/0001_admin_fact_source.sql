CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'stale')),
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  file_name TEXT NOT NULL UNIQUE,
  links TEXT NOT NULL,
  design TEXT,
  description TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  keyword TEXT,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS creator_aliases (
  creator_name TEXT PRIMARY KEY,
  aliases TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_aliases (
  character_name TEXT PRIMARY KEY,
  aliases TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keyword_aliases (
  base_keyword TEXT PRIMARY KEY,
  aliases TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS home_featured_search_keywords (
  keyword TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_characters_sort_order ON characters(sort_order);
