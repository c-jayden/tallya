import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('daily memory AI prompt', () => {
  it('asks providers to return dailyReportText for copyable daily reports', () => {
    const openAISource = readFileSync(
      new URL('../openai-compatible-provider.ts', import.meta.url),
      'utf8',
    );
    const rustSource = readFileSync(
      new URL('../../../../../../src-tauri/src/lib.rs', import.meta.url),
      'utf8',
    );

    expect(openAISource).toContain('dailyReportText?:string');
    expect(openAISource).toContain('80-300 字');
    expect(openAISource).toContain('不要使用 Markdown 标题符号');
    expect(rustSource).toContain('dailyReportText?:string');
    expect(rustSource).toContain('80-300 字');
  });
});
