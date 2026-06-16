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
  value: string;
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

type EntryRow = {
  id: string;
  content: string;
  occurred_at: string;
  occurred_on: string;
  thread_id: string | null;
  difficulty: number | null;
  effort: string | null;
  created_at: string;
  updated_at: string;
};

type EntryClarificationRow = {
  id: string;
  entry_id: string;
  question: string | null;
  answer: string;
  created_at: string;
  updated_at: string;
};

type ThreadRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type TableName =
  | 'daily_memories'
  | 'reports'
  | 'app_settings'
  | 'entries'
  | 'entry_clarifications'
  | 'threads'
  | 'thread_suggestions';

export class TestDatabaseClient implements DatabaseClient {
  readonly createdTables = new Set<TableName>();
  dailyMemories = new Map<string, DailyMemoryRow>();
  appSettings = new Map<string, AppSettingsRow>();
  reports = new Map<string, ReportRow>();
  entries = new Map<string, EntryRow>();
  clarifications = new Map<string, EntryClarificationRow>();
  threads = new Map<string, ThreadRow>();
  clearedReports = false;
  transactionLog: string[] = [];
  userVersion = 0;
  private transactionDepth = 0;

  async transaction<T>(operation: (database: DatabaseClient) => Promise<T>): Promise<T> {
    if (this.transactionDepth > 0) {
      return operation(this);
    }

    this.transactionLog.push('BEGIN IMMEDIATE');
    this.transactionDepth += 1;

    try {
      const result = await operation(this);
      this.transactionLog.push('COMMIT');

      return result;
    } catch (error) {
      this.transactionLog.push('ROLLBACK');
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  async execute(query: string, bindValues: unknown[] = []) {
    const normalizedQuery = normalizeQuery(query);
    const userVersionMatch = normalizedQuery.match(/^pragma user_version = (\d+)$/);

    if (userVersionMatch) {
      this.userVersion = Number(userVersionMatch[1]);
      return;
    }

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

    if (normalizedQuery.startsWith('insert into entries')) {
      const row: EntryRow = {
        id: String(bindValues[0]),
        content: String(bindValues[1]),
        occurred_at: String(bindValues[2]),
        occurred_on: String(bindValues[3]),
        thread_id: toNullableString(bindValues[4]),
        difficulty: typeof bindValues[5] === 'number' ? bindValues[5] : null,
        effort: toNullableString(bindValues[6]),
        created_at: String(bindValues[7]),
        updated_at: String(bindValues[8]),
      };

      this.entries.set(row.id, row);
      return;
    }

    if (normalizedQuery.startsWith('update entries set content =')) {
      const id = String(bindValues[2]);
      const existing = this.entries.get(id);

      if (existing) {
        this.entries.set(id, {
          ...existing,
          content: String(bindValues[0]),
          updated_at: String(bindValues[1]),
        });
      }

      return;
    }

    if (normalizedQuery.startsWith('update entries set thread_id =')) {
      const id = String(bindValues[2]);
      const existing = this.entries.get(id);

      if (existing) {
        this.entries.set(id, {
          ...existing,
          thread_id: toNullableString(bindValues[0]),
          updated_at: String(bindValues[1]),
        });
      }

      return;
    }

    if (normalizedQuery.startsWith('delete from entries where id =')) {
      this.entries.delete(String(bindValues[0]));
      return;
    }

    if (normalizedQuery.startsWith('delete from entries')) {
      this.entries.clear();
      return;
    }

    if (normalizedQuery.startsWith('insert into threads')) {
      const row: ThreadRow = {
        id: String(bindValues[0]),
        title: String(bindValues[1]),
        status: String(bindValues[2]),
        created_at: String(bindValues[3]),
        updated_at: String(bindValues[4]),
      };

      this.threads.set(row.id, row);
      return;
    }

    if (normalizedQuery.startsWith('update threads set title =')) {
      const id = String(bindValues[3]);
      const existing = this.threads.get(id);

      if (existing) {
        this.threads.set(id, {
          ...existing,
          title: String(bindValues[0]),
          status: String(bindValues[1]),
          updated_at: String(bindValues[2]),
        });
      }

      return;
    }

    if (normalizedQuery.startsWith('delete from threads where id =')) {
      this.threads.delete(String(bindValues[0]));
      return;
    }

    if (normalizedQuery.startsWith('delete from threads')) {
      this.threads.clear();
      return;
    }

    if (normalizedQuery.startsWith('insert into entry_clarifications')) {
      const row: EntryClarificationRow = {
        id: String(bindValues[0]),
        entry_id: String(bindValues[1]),
        question: toNullableString(bindValues[2]),
        answer: String(bindValues[3]),
        created_at: String(bindValues[4]),
        updated_at: String(bindValues[5]),
      };

      this.clarifications.set(row.id, row);
      return;
    }

    if (normalizedQuery.startsWith('update entry_clarifications set answer =')) {
      const id = String(bindValues[2]);
      const existing = this.clarifications.get(id);

      if (existing) {
        this.clarifications.set(id, {
          ...existing,
          answer: String(bindValues[0]),
          updated_at: String(bindValues[1]),
        });
      }

      return;
    }

    if (normalizedQuery.startsWith('delete from entry_clarifications where id =')) {
      this.clarifications.delete(String(bindValues[0]));
      return;
    }

    if (normalizedQuery.startsWith('delete from entry_clarifications where entry_id =')) {
      const entryId = String(bindValues[0]);

      for (const [id, row] of this.clarifications) {
        if (row.entry_id === entryId) {
          this.clarifications.delete(id);
        }
      }

      return;
    }

    if (normalizedQuery.startsWith('delete from entry_clarifications')) {
      this.clarifications.clear();
      return;
    }

    if (normalizedQuery.startsWith('insert into app_settings')) {
      // Settings are written as one multi-row upsert: bind values arrive as
      // flat (key, value, updated_at) triples.
      for (let index = 0; index + 3 <= bindValues.length; index += 3) {
        const row: AppSettingsRow = {
          key: String(bindValues[index]),
          value: String(bindValues[index + 1]),
          updated_at: String(bindValues[index + 2]),
        };

        this.appSettings.set(row.key, row);
      }

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

    if (normalizedQuery.startsWith('delete from daily_memories')) {
      this.dailyMemories.clear();
      return;
    }

    if (normalizedQuery.startsWith('delete from reports')) {
      this.reports.clear();
      this.clearedReports = true;
      return;
    }

    if (normalizedQuery.startsWith('drop table if exists app_settings_legacy_json')) {
      return;
    }

    if (normalizedQuery.startsWith('drop table app_settings')) {
      this.appSettings.clear();
      this.createdTables.delete('app_settings');
      return;
    }
  }

  async select<T>(query: string, bindValues: unknown[] = []) {
    const normalizedQuery = normalizeQuery(query);

    if (normalizedQuery === 'pragma user_version') {
      return [{ user_version: this.userVersion }] as T;
    }

    if (normalizedQuery.includes("name = 'daily_memories'")) {
      return this.getTableRows('daily_memories') as T;
    }

    if (normalizedQuery.includes("name = 'reports'")) {
      return this.getTableRows('reports') as T;
    }

    if (normalizedQuery.includes("name = 'app_settings'")) {
      return this.getTableRows('app_settings') as T;
    }

    if (normalizedQuery.startsWith('pragma table_info(app_settings)')) {
      return (this.createdTables.has('app_settings')
        ? [{ name: 'key' }, { name: 'value' }, { name: 'updated_at' }]
        : []) as T;
    }

    if (normalizedQuery.startsWith('select count(*) as count from entries')) {
      return [{ count: this.entries.size }] as T;
    }

    if (normalizedQuery.startsWith('select id, date, raw_content')) {
      return Array.from(this.dailyMemories.values())
        .sort((first, second) => first.date.localeCompare(second.date))
        .map((row) => ({
          id: row.id,
          date: row.date,
          raw_content: row.raw_content,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })) as T;
    }

    if (normalizedQuery.startsWith('select * from entries where id =')) {
      const row = this.entries.get(String(bindValues[0]));
      return (row ? [row] : []) as T;
    }

    if (normalizedQuery.startsWith('select * from entries where occurred_on >=')) {
      const start = String(bindValues[0]);
      const end = String(bindValues[1]);
      return Array.from(this.entries.values())
        .filter((row) => row.occurred_on >= start && row.occurred_on <= end)
        .sort(compareEntriesByOccurredAtDesc) as T;
    }

    if (normalizedQuery.startsWith('select * from entries where occurred_on =')) {
      return Array.from(this.entries.values())
        .filter((row) => row.occurred_on === String(bindValues[0]))
        .sort(compareEntriesByOccurredAtDesc) as T;
    }

    if (normalizedQuery.startsWith('select * from entries where thread_id =')) {
      return Array.from(this.entries.values())
        .filter((row) => row.thread_id === String(bindValues[0]))
        .sort(compareEntriesByOccurredAtAsc) as T;
    }

    if (
      normalizedQuery.startsWith('select * from entries order by occurred_at desc') &&
      normalizedQuery.includes(' limit ')
    ) {
      const limit = Number(bindValues[0]);
      return Array.from(this.entries.values())
        .sort(compareEntriesByOccurredAtDesc)
        .slice(0, Number.isFinite(limit) ? limit : undefined) as T;
    }

    if (normalizedQuery.startsWith('select * from entries order by occurred_at desc')) {
      return Array.from(this.entries.values()).sort(compareEntriesByOccurredAtDesc) as T;
    }

    // FTS search path: the mock has no real FTS index, so it approximates the
    // MATCH query with a case-insensitive substring scan over content. The
    // trigram tokenizer only indexes 3+ character runs, so a shorter query
    // matches nothing — mirrored here so search routing stays honest in tests.
    if (normalizedQuery.startsWith('select e.* from entries e join entries_fts')) {
      const keyword = stripFtsQuotes(String(bindValues[0])).toLowerCase();
      if ([...keyword].length < 3) {
        return [] as T;
      }
      return Array.from(this.entries.values())
        .filter((row) => row.content.toLowerCase().includes(keyword))
        .sort(compareEntriesByOccurredAtDesc) as T;
    }

    if (normalizedQuery.startsWith('select * from entries where content like')) {
      const pattern = String(bindValues[0]).replace(/^%/, '').replace(/%$/, '').toLowerCase();
      return Array.from(this.entries.values())
        .filter((row) => row.content.toLowerCase().includes(pattern))
        .sort(compareEntriesByOccurredAtDesc) as T;
    }

    if (normalizedQuery.startsWith('select * from threads where id =')) {
      const row = this.threads.get(String(bindValues[0]));
      return (row ? [row] : []) as T;
    }

    if (normalizedQuery.startsWith('select * from threads order by updated_at desc')) {
      return Array.from(this.threads.values()).sort(
        (first, second) =>
          second.updated_at.localeCompare(first.updated_at) ||
          second.id.localeCompare(first.id),
      ) as T;
    }

    if (normalizedQuery.startsWith('select * from entry_clarifications where entry_id in')) {
      const ids = new Set(bindValues.map((value) => String(value)));
      return Array.from(this.clarifications.values())
        .filter((row) => ids.has(row.entry_id))
        .sort(compareClarificationsByCreatedAtAsc) as T;
    }

    if (normalizedQuery.startsWith('select * from entry_clarifications order by created_at asc')) {
      return Array.from(this.clarifications.values()).sort(compareClarificationsByCreatedAtAsc) as T;
    }

    if (normalizedQuery.startsWith('select * from entry_clarifications where entry_id =')) {
      return Array.from(this.clarifications.values())
        .filter((row) => row.entry_id === String(bindValues[0]))
        .sort(compareClarificationsByCreatedAtAsc) as T;
    }

    if (normalizedQuery.startsWith('select * from entry_clarifications where')) {
      // search path: answer LIKE $1 OR question LIKE $1
      const pattern = String(bindValues[0]).replace(/^%/, '').replace(/%$/, '').toLowerCase();
      return Array.from(this.clarifications.values())
        .filter(
          (row) =>
            row.answer.toLowerCase().includes(pattern) ||
            (row.question?.toLowerCase().includes(pattern) ?? false),
        )
        .sort((first, second) => second.created_at.localeCompare(first.created_at)) as T;
    }

    if (normalizedQuery.startsWith('select key, value from app_settings')) {
      return Array.from(this.appSettings.values()).map(({ key, value }) => ({ key, value })) as T;
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

    return [] as T;
  }

  private markCreatedTable(query: string) {
    if (query.includes('daily_memories')) {
      this.createdTables.add('daily_memories');
    }

    if (query.includes('reports')) {
      this.createdTables.add('reports');
    }

    if (query.includes('app_settings')) {
      this.createdTables.add('app_settings');
    }

    if (/create table if not exists entries\b/.test(query)) {
      this.createdTables.add('entries');
    }

    if (query.includes('entry_clarifications')) {
      this.createdTables.add('entry_clarifications');
    }

    if (/create table if not exists threads\b/.test(query)) {
      this.createdTables.add('threads');
    }

    if (/create table if not exists thread_suggestions\b/.test(query)) {
      this.createdTables.add('thread_suggestions');
    }
  }

  private getTableRows(tableName: TableName) {
    return this.createdTables.has(tableName) ? [{ name: tableName }] : [];
  }
}

function normalizeQuery(query: string) {
  return query.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Mirror the real SQL tiebreak: occurred_at, then created_at (real creation
// time, so backfilled same-day entries keep insertion order), then id as a
// deterministic last resort.
function compareEntriesByOccurredAtDesc(first: EntryRow, second: EntryRow) {
  return (
    second.occurred_at.localeCompare(first.occurred_at) ||
    second.created_at.localeCompare(first.created_at) ||
    second.id.localeCompare(first.id)
  );
}

function compareEntriesByOccurredAtAsc(first: EntryRow, second: EntryRow) {
  return (
    first.occurred_at.localeCompare(second.occurred_at) ||
    first.created_at.localeCompare(second.created_at) ||
    first.id.localeCompare(second.id)
  );
}

function stripFtsQuotes(value: string) {
  return value.replace(/^"+|"+$/g, '').replace(/""/g, '"');
}

function compareClarificationsByCreatedAtAsc(
  first: EntryClarificationRow,
  second: EntryClarificationRow,
) {
  // No id tiebreaker: ids are random, so equal timestamps must keep insertion
  // (Map) order via the stable sort, mirroring SQL `ORDER BY created_at, rowid`.
  return first.created_at.localeCompare(second.created_at);
}

function toNullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function compareReportRowsByGeneratedTimeDesc(first: ReportRow, second: ReportRow) {
  const firstTime = first.generated_at ?? first.created_at;
  const secondTime = second.generated_at ?? second.created_at;

  return secondTime.localeCompare(firstTime) || second.created_at.localeCompare(first.created_at);
}
