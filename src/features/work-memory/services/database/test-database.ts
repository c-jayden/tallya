import type { DatabaseClient } from './database';

type DailyMemoryRow = {
  id: string;
  date: string;
  raw_content: string;
  supplements_json: string | null;
  generated_json: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  locked_at: string | null;
};

type AppSettingsRow = {
  key: string;
  value_json: string;
  updated_at: string;
};

type TableName = 'daily_memories' | 'reports' | 'report_sources' | 'app_settings';

export class TestDatabaseClient implements DatabaseClient {
  readonly createdTables = new Set<TableName>();
  dailyMemories = new Map<string, DailyMemoryRow>();
  appSettings = new Map<string, AppSettingsRow>();
  clearedReports = false;
  clearedReportSources = false;

  async execute(query: string, bindValues: unknown[] = []) {
    const normalizedQuery = normalizeQuery(query);

    if (normalizedQuery.startsWith('create table if not exists')) {
      this.markCreatedTable(normalizedQuery);
      return;
    }

    if (normalizedQuery.startsWith('insert into daily_memories')) {
      const row: DailyMemoryRow = {
        id: String(bindValues[0]),
        date: String(bindValues[1]),
        raw_content: String(bindValues[2]),
        supplements_json: toNullableString(bindValues[3]),
        generated_json: toNullableString(bindValues[4]),
        status: String(bindValues[5]),
        created_at: String(bindValues[6]),
        updated_at: String(bindValues[7]),
        locked_at: toNullableString(bindValues[8]),
      };

      this.dailyMemories.set(row.date, row);
      return;
    }

    if (normalizedQuery.startsWith('insert into app_settings')) {
      const row: AppSettingsRow = {
        key: String(bindValues[0]),
        value_json: String(bindValues[1]),
        updated_at: String(bindValues[2]),
      };

      this.appSettings.set(row.key, row);
      return;
    }

    if (normalizedQuery.startsWith('delete from daily_memories')) {
      this.dailyMemories.clear();
      return;
    }

    if (normalizedQuery.startsWith('delete from reports')) {
      this.clearedReports = true;
      return;
    }

    if (normalizedQuery.startsWith('delete from report_sources')) {
      this.clearedReportSources = true;
      return;
    }
  }

  async select<T>(query: string, bindValues: unknown[] = []) {
    const normalizedQuery = normalizeQuery(query);

    if (normalizedQuery.includes("name = 'daily_memories'")) {
      return this.getTableRows('daily_memories') as T;
    }

    if (normalizedQuery.includes("name = 'reports'")) {
      return this.getTableRows('reports') as T;
    }

    if (normalizedQuery.includes("name = 'report_sources'")) {
      return this.getTableRows('report_sources') as T;
    }

    if (normalizedQuery.includes("name = 'app_settings'")) {
      return this.getTableRows('app_settings') as T;
    }

    if (normalizedQuery.startsWith('select * from daily_memories where date =')) {
      const row = this.dailyMemories.get(String(bindValues[0]));
      return (row ? [row] : []) as T;
    }

    if (normalizedQuery.startsWith('select * from daily_memories order by date desc')) {
      return Array.from(this.dailyMemories.values()).sort((first, second) =>
        second.date.localeCompare(first.date),
      ) as T;
    }

    if (normalizedQuery.startsWith("select * from daily_memories where status in")) {
      return Array.from(this.dailyMemories.values())
        .filter((row) => row.status === 'generated' || row.status === 'locked')
        .filter((row) => row.generated_json !== null)
        .sort((first, second) => second.date.localeCompare(first.date)) as T;
    }

    if (normalizedQuery.startsWith('select value_json from app_settings where key =')) {
      const row = this.appSettings.get(String(bindValues[0]));
      return (row ? [{ value_json: row.value_json }] : []) as T;
    }

    return [] as T;
  }

  private markCreatedTable(query: string) {
    if (query.includes('daily_memories')) {
      this.createdTables.add('daily_memories');
    }

    if (query.includes('reports')) {
      this.createdTables.add('reports');
    }

    if (query.includes('report_sources')) {
      this.createdTables.add('report_sources');
    }

    if (query.includes('app_settings')) {
      this.createdTables.add('app_settings');
    }
  }

  private getTableRows(tableName: TableName) {
    return this.createdTables.has(tableName) ? [{ name: tableName }] : [];
  }
}

function normalizeQuery(query: string) {
  return query.replace(/\s+/g, ' ').trim().toLowerCase();
}

function toNullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}
