import { describe, expect, it, vi } from 'vitest';
import { buildDiagnosticLogFileName, createDiagnosticLogService } from '../diagnostic-log';

describe('diagnostic log service', () => {
  it('skips debug logs when detailed diagnostics are disabled', async () => {
    const deps = createDependencies();
    const service = createDiagnosticLogService(deps);

    service.setDetailedLoggingEnabled(false);
    await service.debug('ai', 'openai-compatible.request_start', 'request started', {
      apiKey: 'sk-1234567890abcdef',
    });

    expect(deps.writeTextFile).not.toHaveBeenCalled();
  });

  it('writes redacted JSON lines when detailed diagnostics are enabled', async () => {
    const deps = createDependencies();
    deps.readTextFile.mockRejectedValueOnce(new Error('not found'));
    const service = createDiagnosticLogService(deps);

    service.setDetailedLoggingEnabled(true);
    await service.debug('ai', 'openai-compatible.response_received', 'response received', {
      model: 'gpt-test',
      Authorization: 'Bearer secret-token',
      responsePreview: `{"key":"sk-1234567890abcdef","content":"${'x'.repeat(700)}"}`,
    });

    expect(deps.mkdir).toHaveBeenCalledWith('/mock/app-data/logs', { recursive: true });
    expect(deps.writeTextFile).toHaveBeenCalledWith(
      '/mock/app-data/logs/tallya-2026-06-09.log',
      expect.stringContaining('"event":"openai-compatible.response_received"'),
    );
    const writeCalls = deps.writeTextFile.mock.calls as unknown as Array<[string, string]>;
    const written = String(writeCalls[0]?.[1] ?? '');

    expect(written).not.toContain('secret-token');
    expect(written).not.toContain('sk-1234567890abcdef');
    expect(written).toContain('"scope":"ai"');
  });

  it('exports recent logs into one diagnostic file', async () => {
    const deps = createDependencies();
    deps.readDir.mockResolvedValueOnce([
      { name: 'tallya-2026-06-08.log', isFile: true },
      { name: 'tallya-2026-06-09.log', isFile: true },
      { name: 'notes.txt', isFile: true },
    ]);
    deps.readTextFile
      .mockResolvedValueOnce('old log\n')
      .mockResolvedValueOnce('new log\n');
    deps.save.mockResolvedValueOnce('/mock/export/tallya-diagnostic.log');
    const service = createDiagnosticLogService(deps);

    await expect(service.exportDiagnosticLogs()).resolves.toEqual({ status: 'exported' });

    expect(deps.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: 'tallya-diagnostic-2026-06-09-100203.log',
      }),
    );
    expect(deps.writeTextFile).toHaveBeenCalledWith(
      '/mock/export/tallya-diagnostic.log',
      expect.stringContaining('old log\n\nnew log'),
    );
  });

  it('opens the logs directory inside the Tauri app data directory', async () => {
    const deps = createDependencies();
    const service = createDiagnosticLogService(deps);

    await service.openLogsDirectory();

    expect(deps.mkdir).toHaveBeenCalledWith('/mock/app-data/logs', { recursive: true });
    expect(deps.openPath).toHaveBeenCalledWith('/mock/app-data/logs');
  });

  it('builds timestamped diagnostic export filenames', () => {
    expect(buildDiagnosticLogFileName(new Date('2026-06-09T10:02:03'))).toBe(
      'tallya-diagnostic-2026-06-09-100203.log',
    );
  });
});

function createDependencies() {
  return {
    now: () => new Date('2026-06-09T10:02:03'),
    appDataDir: vi.fn(async () => '/mock/app-data'),
    joinPath: vi.fn(async (...parts: string[]) => parts.join('/')),
    mkdir: vi.fn(async () => undefined),
    readDir: vi.fn(async () => [] as Array<{ name: string; isFile?: boolean }>),
    readTextFile: vi.fn(async () => ''),
    writeTextFile: vi.fn(async () => undefined),
    openPath: vi.fn(async () => undefined),
    save: vi.fn(async () => null as string | null),
  };
}
