import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { getShortcutModifierLabel } from '@/lib/platform';

type ShortcutRow = {
  label: string;
  keys: string[];
};

export function KeyboardShortcutsSettingsSection() {
  const modifierKey = getShortcutModifierLabel();
  const shortcuts: ShortcutRow[] = [
    { label: '搜索记忆', keys: [modifierKey, 'K'] },
    { label: '整理记录', keys: [modifierKey, 'Enter'] },
    { label: '关闭搜索', keys: ['Esc'] },
  ];

  return (
    <section className="space-y-4" aria-label="快捷键">
      <div className="space-y-1.5">
        <p className="text-sm text-app-ink-subtle">
          常用快捷键会根据当前系统显示对应按键。
        </p>
      </div>

      <div className="space-y-3">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.label}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="text-app-ink-muted">{shortcut.label}</span>
            <KbdGroup
              className="[&_kbd]:h-5.5 [&_kbd]:min-w-5.5 [&_kbd]:border [&_kbd]:border-app-border [&_kbd]:bg-app-surface-muted [&_kbd]:px-1.5 [&_kbd]:text-xs [&_kbd]:text-app-ink-muted"
              aria-label={`${shortcut.label}快捷键 ${shortcut.keys.join(' ')}`}
            >
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </div>
        ))}
      </div>
    </section>
  );
}
