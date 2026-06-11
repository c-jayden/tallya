import { describe, expect, it } from 'vitest';
import { assembleDailyReportSource, assemblePlainDailyReport } from '../daily-report';
import type { Clarification, Entry } from '../../types';

function entry(id: string, content: string): Entry {
  return {
    id,
    content,
    occurredAt: '2026-06-11T03:00:00.000Z',
    occurredOn: '2026-06-11',
    threadId: null,
    difficulty: null,
    effort: null,
    createdAt: '2026-06-11T03:00:00.000Z',
    updatedAt: '2026-06-11T03:00:00.000Z',
  };
}

function clarification(entryId: string, answer: string): Clarification {
  return {
    id: `clar_${entryId}_${answer}`,
    entryId,
    question: null,
    answer,
    createdAt: '2026-06-11T03:00:00.000Z',
    updatedAt: '2026-06-11T03:00:00.000Z',
  };
}

describe('daily report assembly', () => {
  it('folds clarification answers into the entry line', () => {
    const entries = [entry('e1', '对接订单接口'), entry('e2', '上午开会')];
    const clarifications: Record<string, Clarification[]> = {
      e1: [clarification('e1', '字段映射对不上'), clarification('e1', '联调两小时')],
    };

    expect(assembleDailyReportSource(entries, clarifications)).toBe(
      '对接订单接口（字段映射对不上；联调两小时）\n上午开会',
    );
  });

  it('renders a plain bullet list with no markdown headers', () => {
    const entries = [entry('e1', '对接订单接口'), entry('e2', '上午开会')];

    expect(assemblePlainDailyReport(entries, {})).toBe('- 对接订单接口\n- 上午开会');
  });

  it('returns empty string when there are no entries', () => {
    expect(assemblePlainDailyReport([], {})).toBe('');
    expect(assembleDailyReportSource([], {})).toBe('');
  });
});
