export const DATABASE_PATH = 'sqlite:tallya.db';
export const SCHEMA_VERSION = 1;

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

export const createReportSourcesTableSql = `
  CREATE TABLE IF NOT EXISTS report_sources (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    daily_memory_id TEXT NOT NULL,
    daily_memory_updated_at_snapshot TEXT NOT NULL
  )
`;

export const createAppSettingsTableSql = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;
