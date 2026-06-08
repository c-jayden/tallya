import { describe, expect, it, vi } from 'vitest';
import { collectText, findElements } from '@/test/react-tree';
import { DailyMemoryPreviewDialog } from '../daily-memory-preview-dialog';
import { MemoryDocument } from '../memory-document';

const generatedContent = {
  summary: '整理需求讨论并同步后续计划。',
  completedItems: ['确认优先处理范围'],
  keyOutcome: '',
  problems: '',
  tomorrowPlan: '',
  extraNote: '',
};

describe('DailyMemoryPreviewDialog component structure', () => {
  it('renders the dialog title, description, document, and save action', () => {
    const element = DailyMemoryPreviewDialog({
      open: true,
      content: generatedContent,
      title: '这天记忆预览',
      description: '确认后会保存为这一天的工作记忆。',
      isSaving: false,
      saveLabel: '保存记忆',
      onOpenChange: vi.fn(),
      onSave: vi.fn(),
    });

    expect(collectText(element)).toContain('这天记忆预览');
    expect(collectText(element)).toContain('确认后会保存为这一天的工作记忆。');
    expect(collectText(element)).toContain('保存记忆');

    const documents = findElements(element, (node) => node.type === MemoryDocument);

    expect(documents).toHaveLength(1);
    expect(documents[0].props.content).toEqual(generatedContent);
  });

  it('disables cancel and save actions while saving', () => {
    const element = DailyMemoryPreviewDialog({
      open: true,
      content: generatedContent,
      title: '今日记忆预览',
      description: '确认后会保存为今天唯一一条工作记忆。',
      isSaving: true,
      saveLabel: '保存记忆',
      onOpenChange: vi.fn(),
      onSave: vi.fn(),
    });
    const buttons = findElements(element, (node) => node.props.type === 'button');

    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.props.disabled === true)).toBe(true);
  });
});
