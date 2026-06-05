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

type ReportRow = {
  id: string;
  type: string;
  title: string;
  start_date: string;
  end_date: string;
  content_json: string;
  status: string;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
};

type ReportSourceRow = {
  id: string;
  report_id: string;
  daily_memory_id: string;
  daily_memory_updated_at_snapshot: string;
};

type TableName = 'daily_memories' | 'reports' | 'report_sources' | 'app_settings';

export class TestDatabaseClient implements DatabaseClient {
  readonly createdTables = new Set<TableName>();
  dailyMemories = new Map<string, DailyMemoryRow>();
  appSettings = new Map<string, AppSettingsRow>();
  reports = new Map<string, ReportRow>();
  reportSources = new Map<string, ReportSourceRow>();
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

    if (normalizedQuery.startsWith('insert into reports')) {
      const existing = this.reports.get(String(bindValues[0]));
      const row: ReportRow = {
        id: String(bindValues[0]),
        type: String(bindValues[1]),
        title: String(bindValues[2]),
        start_date: String(bindValues[3]),
        end_date: String(bindValues[4]),
        content_json: String(bindValues[5]),
        status: String(bindValues[6]),
        created_at: existing?.created_at ?? String(bindValues[7]),
        updated_at: String(bindValues[8]),
        generated_at: toNullableString(bindValues[9]),
      };

      this.reports.set(row.id, row);
      return;
    }

    if (normalizedQuery.startsWith('insert into report_sources')) {
      const row: ReportSourceRow = {
        id: String(bindValues[0]),
        report_id: String(bindValues[1]),
        daily_memory_id: String(bindValues[2]),
        daily_memory_updated_at_snapshot: String(bindValues[3]),
      };

      this.reportSources.set(row.id, row);
      return;
    }

    if (normalizedQuery.startsWith('delete from daily_memories')) {
      this.dailyMemories.clear();
      return;
    }

    if (normalizedQuery.startsWith('delete from report_sources where report_id =')) {
      const reportId = String(bindValues[0]);

      for (const [id, source] of this.reportSources) {
        if (source.report_id === reportId) {
          this.reportSources.delete(id);
        }
      }

      return;
    }

    if (normalizedQuery.startsWith('delete from reports')) {
      this.reports.clear();
      this.clearedReports = true;
      return;
    }

    if (normalizedQuery.startsWith('delete from report_sources')) {
      this.reportSources.clear();
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

    if (normalizedQuery.startsWith('select * from reports where type =')) {
      return Array.from(this.reports.values())
        .filter((row) => {
          if (bindValues.length === 1) {
            return row.type === String(bindValues[0]);
          }

          return (
            row.type === String(bindValues[0]) &&
            row.start_date === String(bindValues[1]) &&
            row.end_date === String(bindValues[2])
          );
        })
        .sort((first, second) => second.updated_at.localeCompare(first.updated_at))
        .slice(0, bindValues.length === 1 ? undefined : 1) as T;
    }

    if (normalizedQuery.startsWith('select * from reports order by')) {
      return Array.from(this.reports.values()).sort(compareReportRowsByGeneratedTimeDesc) as T;
    }

    if (normalizedQuery.startsWith('select * from reports where id =')) {
      const row = this.reports.get(String(bindValues[0]));
      return (row ? [row] : []) as T;
    }

    if (normalizedQuery.startsWith('select * from report_sources where report_id =')) {
      return Array.from(this.reportSources.values())
        .filter((row) => row.report_id === String(bindValues[0]))
        .sort((first, second) => first.id.localeCompare(second.id)) as T;
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

function compareReportRowsByGeneratedTimeDesc(first: ReportRow, second: ReportRow) {
  const firstTime = first.generated_at ?? first.created_at;
  const secondTime = second.generated_at ?? second.created_at;

  return secondTime.localeCompare(firstTime) || second.created_at.localeCompare(first.created_at);
}
