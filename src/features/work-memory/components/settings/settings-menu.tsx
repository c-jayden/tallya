import { cn } from '@/lib/utils';
import { menuItems, type SettingsSection } from './settings-types';

type SettingsMenuProps = {
  activeSection: SettingsSection;
  onSelect: (section: SettingsSection) => void;
};

export function SettingsMenu({ activeSection, onSelect }: SettingsMenuProps) {
  return (
    <nav
      className="min-h-0 overflow-y-auto border-r border-app-border bg-transparent p-3 scrollbar-none [&::-webkit-scrollbar]:hidden"
      aria-label="设置分组"
    >
      <div className="flex flex-col gap-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'h-9 cursor-pointer rounded-lg bg-transparent px-2.5 text-left text-sm font-normal text-app-ink-muted transition-colors hover:bg-[#F8FAFC] hover:text-app-ink focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed dark:hover:bg-app-surface-muted',
              activeSection === item.id &&
                'bg-[#F1F5F9] font-semibold text-app-ink hover:bg-[#F1F5F9] dark:bg-app-surface-muted dark:hover:bg-app-surface-muted',
            )}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
