CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '2');

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  seed TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  outcome TEXT,         -- null while in-progress; 'win' | 'loss' at end
  final_tick INTEGER
);

CREATE TABLE IF NOT EXISTS run_events (
  run_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  tick INTEGER NOT NULL,
  action_json TEXT NOT NULL,
  PRIMARY KEY (run_id, idx),
  FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE INDEX IF NOT EXISTS idx_run_events_run ON run_events(run_id, idx);
