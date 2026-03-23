-- Rename character status value from 'stale' to 'archived'
-- D1 doesn't support ALTER TABLE CHECK constraints, so we:
-- 1. Create new table with updated constraint
-- 2. Copy data with value replacement
-- 3. Swap tables

CREATE TABLE characters_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  sort_order INTEGER NOT NULL
);

INSERT INTO characters_new (id, name, status, sort_order)
SELECT
  id,
  name,
  CASE WHEN status = 'stale' THEN 'archived' ELSE status END,
  sort_order
FROM characters;

DROP TABLE characters;

ALTER TABLE characters_new RENAME TO characters;
