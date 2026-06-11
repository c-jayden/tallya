import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Work memory UI copy', () => {
  it('uses a natural search placeholder and empty state', () => {
    const source = readFileSync(new URL('../spotlight-search-panel.tsx', import.meta.url), 'utf8');

    expect(source).toContain('搜索项目、同事、问题或一句原话');
    expect(source).toContain('暂时没搜到相关记忆');
    expect(source).toContain('换个词，或试试项目名');
    expect(source).not.toContain('输入关键词搜索工作记忆...');
  });

  it('keeps supplement placeholders short and low pressure', () => {
    const source = readFileSync(new URL('../entry-supplement-panel.tsx', import.meta.url), 'utf8');

    expect(source).toContain('写一两句，回车保存');
    expect(source).toContain('补一点背景，回车保存');
    expect(source).toContain('也可以直接补一两句，回车保存');
    expect(source).not.toContain('AI 正在想');
  });

  it('uses a softer report gap placeholder', () => {
    const source = readFileSync(new URL('../report-gap-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('写一两句就好，留空也可以跳过');
    expect(source).toContain('补充几句，让整理更完整');
    expect(source).not.toContain('答一两句就好');
  });

  it('keeps one-day整理 copy away from 日报 wording', () => {
    const dialogSource = readFileSync(new URL('../daily-report-dialog.tsx', import.meta.url), 'utf8');
    const homeSource = readFileSync(new URL('../../work-memory-home.tsx', import.meta.url), 'utf8');
    const flowSource = readFileSync(
      new URL('../../hooks/use-daily-report-flow.ts', import.meta.url),
      'utf8',
    );

    expect(dialogSource).toContain('{dateLabel}整理');
    expect(dialogSource).toContain('可直接编辑后复制，用在需要同步的一段文字里。');
    expect(homeSource).toContain("isSelectedDateToday ? '整理今日' : '整理这天'");
    expect(flowSource).toContain('AI 没有返回可用内容，已保留当前整理。');
    expect(`${dialogSource}\n${homeSource}\n${flowSource}`).not.toContain('日报');
  });
});
