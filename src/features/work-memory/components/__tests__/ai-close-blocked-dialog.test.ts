import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AiCloseBlockedDialog', () => {
  const source = readFileSync(new URL('../ai-close-blocked-dialog.tsx', import.meta.url), 'utf8');

  it('uses a persistent alert dialog for native close attempts during AI work', () => {
    expect(source).toContain('<AlertDialog open={open} onOpenChange={onOpenChange}>');
    expect(source).toContain('正在整理，暂时不能关闭应用');
    expect(source).toContain('继续等待');
  });
});
