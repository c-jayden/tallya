export const DATABASE_PATH = 'sqlite:tallya.db';
export const SCHEMA_VERSION = 7;

export const createDailyMemoriesTableSql = `
  CREATE TABLE IF NOT EXISTS daily_memories (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    raw_content TEXT NOT NULL,
    supplements_json TEXT,
    generated_json TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    locked_at TEXT
  )
`;

// The entry is the core unit of the work-memory model: one low-friction note
// with a timestamp. thread_id / difficulty / effort are created up front but
// stay null until later milestones so we never have to migrate columns again.
export const createEntriesTableSql = `
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    occurred_on TEXT NOT NULL,
    thread_id TEXT,
    difficulty INTEGER,
    effort TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const createEntriesIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_entries_occurred_on ON entries(occurred_on)
`;

// thread_id was reserved on entries since M1; the index is added now that M3
// links entries into cross-day threads so listing a thread's entries is cheap.
export const createEntriesThreadIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_entries_thread_id ON entries(thread_id)
`;

// A thread is a cross-day storyline: several entries that turned out to be the
// same piece of work. Threads emerge after the fact (AI-suggested merges), so
// the table is intentionally minimal — no parent/child tree, no task state.
export const createThreadsTableSql = `
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const createThreadsIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at)
`;

// Clarifications add detail to an entry (AI-asked or manual). They are short and
// low-volume, so search uses LIKE rather than a dedicated FTS table.
export const createEntryClarificationsTableSql = `
  CREATE TABLE IF NOT EXISTS entry_clarifications (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    question TEXT,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const createEntryClarificationsIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_entry_clarifications_entry_id ON entry_clarifications(entry_id)
`;

// External-content FTS5 over entries.content. trigram tokenizer gives CJK
// substring matching without an external segmenter. If trigram is unavailable
// on the bundled SQLite, FTS creation is skipped and search falls back to LIKE.
export const createEntriesFtsSql = `
  CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
    content,
    content='entries',
    content_rowid='rowid',
    tokenize='trigram'
  )
`;

export const createEntriesFtsTriggersSql = [
  `CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
    INSERT INTO entries_fts(rowid, content) VALUES (new.rowid, new.content);
  END`,
  `CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
  END`,
  `CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
    INSERT INTO entries_fts(rowid, content) VALUES (new.rowid, new.content);
  END`,
];

export const createReportsTableSql = `
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    content_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    generated_at TEXT
  )
`;

export const createAppSettingsTableSql = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;
