import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('KeyboardShortcutsSettingsSection', () => {
  const source = readFileSync(
    new URL('../keyboard-shortcuts-settings-section.tsx', import.meta.url),
    'utf8',
  );

  it('renders implemented shortcuts with the shared Kbd component', () => {
    expect(source).toContain("import { Kbd, KbdGroup } from '@/components/ui/kbd'");
    expect(source).toContain('搜索记忆');
    expect(source).toContain('整理记录');
    expect(source).toContain('关闭搜索');
    expect(source).not.toContain('保存草稿');
  });

  it('uses platform-aware modifier labels instead of Ctrl/Cmd text', () => {
    expect(source).toContain('getShortcutModifierLabel');
    expect(source).not.toContain('Ctrl/Cmd');
  });
});
