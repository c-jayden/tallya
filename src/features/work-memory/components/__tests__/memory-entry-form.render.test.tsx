import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { findElements, collectText } from '@/test/react-tree';
import { supplementFields, supplementPlaceholders } from '../../constants';
import { MemoryEntryForm } from '../memory-entry-form';

describe('MemoryEntryForm component structure', () => {
  it('renders editable note input, draft action, and date-aware primary action label', () => {
    const element = MemoryEntryForm({
      workNote: '整理需求内容',
      isSupplementOpen: false,
      activeSupplementFields: [],
      commandKey: 'Ctrl',
      isLocked: false,
      isGeneratingMemory: false,
      isPrimaryPulsing: false,
      isSavingDraft: false,
      primaryActionLabel: '整理成这天记录',
      placeholder: '例如：整理需求内容。',
      primaryActionRef: createRef<HTMLButtonElement>(),
      workNoteInputRef: createRef<HTMLTextAreaElement>(),
      supplementFields,
      supplementPlaceholders,
      supplementValues: createSupplementValues(),
      onSaveDraft: vi.fn(),
      onSettleTodayMemory: vi.fn(),
      onSupplementValueChange: vi.fn(),
      onToggleSupplementPanel: vi.fn(),
      onToggleSupplementField: vi.fn(),
      onWorkNoteChange: vi.fn(),
    });

    expect(collectText(element)).toContain('保存草稿');
    expect(collectText(element)).toContain('整理成这天记录');

    const textareas = findElements(element, (node) => node.props.value === '整理需求内容');

    expect(textareas).toHaveLength(1);
    expect(textareas[0].props.value).toBe('整理需求内容');
    expect(textareas[0].props.placeholder).toBe('例如：整理需求内容。');
  });

  it('renders optional supplement fields only after the supplement panel is open', () => {
    const onSupplementValueChange = vi.fn();
    const element = MemoryEntryForm({
      workNote: '',
      isSupplementOpen: true,
      activeSupplementFields: ['项目/主题'],
      commandKey: 'Ctrl',
      isLocked: false,
      isGeneratingMemory: false,
      isPrimaryPulsing: false,
      isSavingDraft: false,
      primaryActionLabel: '整理成今日记录',
      placeholder: '例如：上午推进需求讨论。',
      primaryActionRef: createRef<HTMLButtonElement>(),
      workNoteInputRef: createRef<HTMLTextAreaElement>(),
      supplementFields,
      supplementPlaceholders,
      supplementValues: {
        ...createSupplementValues(),
        '项目/主题': '产品优化',
      },
      onSaveDraft: vi.fn(),
      onSettleTodayMemory: vi.fn(),
      onSupplementValueChange,
      onToggleSupplementPanel: vi.fn(),
      onToggleSupplementField: vi.fn(),
      onWorkNoteChange: vi.fn(),
    });

    const supplementInputs = findElements(
      element,
      (node) => node.type === 'input' && node.props['aria-label'] === '项目/主题补充内容',
    );

    expect(collectText(element)).toContain('收起补充信息');
    expect(supplementInputs).toHaveLength(1);
    expect(supplementInputs[0].props.value).toBe('产品优化');
  });
});

function createSupplementValues() {
  return {
    '项目/主题': '',
    明日计划: '',
    补充说明: '',
  };
}
