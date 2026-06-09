import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { collectText, findElements } from '@/test/react-tree';
import { MemoryDetailDialog } from '../memory-detail-dialog';
import type { DailyMemory } from '../../types';

describe('MemoryDetailDialog', () => {
  it('shows copy daily report action in the footer', () => {
    const element = MemoryDetailDialog({
      open: true,
      memory: createMemory(),
      currentDate: '2026-06-08',
      isReferencedByReport: false,
      onOpenChange: vi.fn(),
      onCopyDailyReport: vi.fn(),
      onEditOriginal: vi.fn(),
    });

    expect(collectText(element)).toContain('复制日报');
    expect(collectText(element)).toContain('编辑原始记录');
  });

  it('wires the copy daily report action through props', () => {
    const source = readFileSync(new URL('../memory-detail-dialog.tsx', import.meta.url), 'utf8');

    expect(source).toContain('onCopyDailyReport');
    expect(source).toContain('复制日报');
  });

  it('keeps the footer compact with three actions', () => {
    const element = MemoryDetailDialog({
      open: true,
      memory: createMemory(),
      currentDate: '2026-06-08',
      isReferencedByReport: false,
      onOpenChange: vi.fn(),
      onCopyDailyReport: vi.fn(),
      onEditOriginal: vi.fn(),
    });
    const buttons = findElements(element, (node) => node.props.type === 'button');

    expect(buttons).toHaveLength(3);
  });

  it('keeps edit available for an unreferenced historical memory', () => {
    const element = MemoryDetailDialog({
      open: true,
      memory: createMemory({ date: '2026-06-06' }),
      currentDate: '2026-06-08',
      isReferencedByReport: false,
      onOpenChange: vi.fn(),
      onCopyDailyReport: vi.fn(),
      onEditOriginal: vi.fn(),
    });

    expect(collectText(element)).toContain('复制日报');
    expect(collectText(element)).toContain('编辑原始记录');
  });

  it('explains when a memory is referenced by a report', () => {
    const element = MemoryDetailDialog({
      open: true,
      memory: createMemory({ date: '2026-06-06' }),
      currentDate: '2026-06-08',
      isReferencedByReport: true,
      onOpenChange: vi.fn(),
      onCopyDailyReport: vi.fn(),
      onEditOriginal: vi.fn(),
    });

    expect(collectText(element)).toContain('这条记忆已被报告引用，修改后相关报告可能需要重新生成。');
    expect(collectText(element)).toContain('编辑原始记录');
  });

  it('hides edit for locked memories with an explanation', () => {
    const element = MemoryDetailDialog({
      open: true,
      memory: createMemory({ status: 'locked' }),
      currentDate: '2026-06-08',
      isReferencedByReport: true,
      onOpenChange: vi.fn(),
      onCopyDailyReport: vi.fn(),
      onEditOriginal: vi.fn(),
    });

    expect(collectText(element)).toContain('这条记忆已被报告引用，暂不支持直接编辑。');
    expect(collectText(element)).not.toContain('编辑原始记录');
  });
});

function createMemory(overrides: Partial<DailyMemory> = {}): DailyMemory {
  return {
    id: 'daily-memory-2026-06-08',
    date: overrides.date ?? '2026-06-08',
    rawContent: '整理需求讨论内容。',
    supplements: {},
    generated: {
      summary: '整理需求讨论并同步计划。',
      completedItems: ['整理需求讨论内容'],
    },
    status: overrides.status ?? 'generated',
    createdAt: '2026-06-08T01:00:00.000Z',
    updatedAt: '2026-06-08T02:00:00.000Z',
  };
}
