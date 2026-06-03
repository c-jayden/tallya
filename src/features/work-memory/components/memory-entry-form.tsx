import type { Ref } from 'react';
import { Loader2, PencilLine, Sparkles } from 'lucide-react';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { SupplementField } from '../constants';

type MemoryEntryFormProps = {
  workNote: string;
  isSupplementOpen: boolean;
  activeSupplementFields: readonly SupplementField[];
  commandKey: string;
  isLocked: boolean;
  isGeneratingMemory: boolean;
  isPrimaryPulsing: boolean;
  isSavingDraft: boolean;
  primaryActionLabel: string;
  primaryActionRef: Ref<HTMLButtonElement>;
  workNoteInputRef: Ref<HTMLTextAreaElement>;
  supplementFields: readonly SupplementField[];
  supplementPlaceholders: Record<SupplementField, string>;
  supplementValues: Record<SupplementField, string>;
  onSaveDraft: () => void;
  onSettleTodayMemory: () => void;
  onSupplementValueChange: (field: SupplementField, value: string) => void;
  onToggleSupplementPanel: () => void;
  onToggleSupplementField: (field: SupplementField) => void;
  onWorkNoteChange: (value: string) => void;
};

export function MemoryEntryForm({
  workNote,
  isSupplementOpen,
  activeSupplementFields,
  commandKey,
  isLocked,
  isGeneratingMemory,
  isPrimaryPulsing,
  isSavingDraft,
  primaryActionLabel,
  primaryActionRef,
  workNoteInputRef,
  supplementFields,
  supplementPlaceholders,
  supplementValues,
  onSaveDraft,
  onSettleTodayMemory,
  onSupplementValueChange,
  onToggleSupplementPanel,
  onToggleSupplementField,
  onWorkNoteChange,
}: MemoryEntryFormProps) {
  const hasActiveSupplementFields = activeSupplementFields.length > 0;
  const supplementInputClass =
    'h-9 min-w-0 w-full rounded-lg border border-transparent bg-transparent px-2.5 text-[13px] text-app-ink outline-none transition-[background-color,border-color] duration-150 placeholder:text-[var(--app-placeholder)] hover:bg-app-surface-muted focus:border-app-border focus:bg-app-surface disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <section
      className={cn('grid gap-0', isSupplementOpen ? 'mb-5' : 'mb-7.5')}
      aria-label="记录今日工作"
    >
      <TallyaScrollArea className="tallya-textarea-scroll h-26 min-h-26 rounded-xl border border-app-border bg-app-surface shadow-none transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-app-border-strong focus-within:bg-app-surface focus-within:ring-3 focus-within:ring-[color-mix(in_srgb,var(--app-ink)_6%,transparent)] max-[600px]:h-26 max-[600px]:min-h-26">
        <Textarea
          ref={workNoteInputRef}
          className="block min-h-full resize-none overflow-hidden rounded-none border-0 bg-transparent p-3 text-sm leading-6 text-app-ink shadow-none outline-none placeholder:text-[var(--app-placeholder)] focus-visible:border-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
          value={workNote}
          onChange={(event) => onWorkNoteChange(event.currentTarget.value)}
          placeholder="例如：上午推进需求讨论，下午整理方案并同步进展，明天继续跟进剩余问题。"
          disabled={isLocked}
        />
      </TallyaScrollArea>
      <div className="flex pt-2.5" aria-label="补充记录项">
        <Button
          variant="ghost"
          size="xs"
          type="button"
          className={cn(
            'h-7 cursor-pointer rounded-full border border-transparent bg-transparent px-1.5 text-[13px] font-medium text-app-ink-subtle transition-colors duration-150 hover:border-app-border hover:bg-[color-mix(in_srgb,var(--app-surface)_70%,transparent)] hover:text-app-ink-muted focus-visible:border-app-border focus-visible:bg-[color-mix(in_srgb,var(--app-surface)_70%,transparent)] focus-visible:text-app-ink-muted',
            isSupplementOpen &&
              'border-app-border bg-[color-mix(in_srgb,var(--app-surface)_70%,transparent)] text-app-ink-muted',
          )}
          aria-controls="supplement-fields"
          aria-expanded={isSupplementOpen}
          onClick={onToggleSupplementPanel}
          disabled={isLocked}
        >
          {isSupplementOpen ? '收起补充信息' : '+ 添加补充信息'}
        </Button>
      </div>
      {isSupplementOpen ? (
        <div
          id="supplement-fields"
          className="mt-2.5 rounded-xl border border-app-border bg-app-surface px-3 py-2.5"
          aria-label="已展开的补充信息"
        >
          <div className="flex min-h-8 flex-wrap items-center gap-2.5">
            <span className="mr-1 shrink-0 text-[13px] font-semibold text-app-ink-muted">
              补充信息
            </span>
            {supplementFields.map((field) => {
              const isActive = activeSupplementFields.includes(field);

              return (
                <Button
                  key={field}
                  variant="ghost"
                  size="xs"
                  type="button"
                  className={cn(
                    'h-7 cursor-pointer rounded-full border border-app-border bg-app-surface px-2.5 text-[13px] font-medium text-app-ink-muted transition-colors duration-150 hover:border-app-border-strong hover:bg-app-surface-muted hover:text-app-ink focus-visible:border-app-border-strong focus-visible:bg-app-surface-muted focus-visible:text-app-ink',
                    isActive && 'border-app-border-strong bg-app-surface-muted text-app-ink',
                  )}
                  aria-pressed={isActive}
                  onClick={() => onToggleSupplementField(field)}
                  disabled={isLocked}
                >
                  {isActive ? `✓ ${field}` : `+ ${field}`}
                </Button>
              );
            })}
          </div>

          {hasActiveSupplementFields ? (
            <div className="mt-2 grid gap-1.5">
              {activeSupplementFields.map((field, index) => {
                const inputId = `supplement-field-${index}`;

                return (
                  <div
                    key={field}
                    className="grid h-9 grid-cols-[80px_minmax(0,1fr)] items-center gap-2 rounded-lg"
                  >
                    <label
                      htmlFor={inputId}
                      className="truncate text-[13px] font-semibold text-app-ink-muted"
                    >
                      {field}
                    </label>
                    <input
                      id={inputId}
                      type="text"
                      className={supplementInputClass}
                      value={supplementValues[field]}
                      onChange={(event) =>
                        onSupplementValueChange(field, event.currentTarget.value)
                      }
                      aria-label={`${field}补充内容`}
                      placeholder={supplementPlaceholders[field]}
                      disabled={isLocked}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="ghost"
          className="h-9.75 cursor-pointer gap-1.5 rounded-xl px-2.5 text-sm text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink focus-visible:bg-app-surface-muted focus-visible:text-app-ink [&_svg]:size-3.5"
          onClick={onSaveDraft}
          disabled={isLocked || isSavingDraft || isGeneratingMemory}
          aria-busy={isSavingDraft}
        >
          {isSavingDraft ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <PencilLine aria-hidden="true" />
          )}
          保存草稿
        </Button>
        <Button
          ref={primaryActionRef}
          type="button"
          className={cn(
            'h-9.75 cursor-pointer rounded-xl px-3.5 text-sm font-semibold shadow-none transition-[background-color,box-shadow,transform] duration-150 hover:shadow-[0_4px_10px_rgb(24_24_27/0.08)] focus-visible:shadow-[0_4px_10px_rgb(24_24_27/0.08)] [&_svg]:size-3 [&_svg]:opacity-80',
            isPrimaryPulsing && '-translate-y-px shadow-[0_4px_10px_rgb(24_24_27/0.08)]',
          )}
          aria-label={`${primaryActionLabel}，快捷键 ${commandKey} Enter`}
          onClick={onSettleTodayMemory}
          disabled={isLocked || isSavingDraft || isGeneratingMemory}
          aria-busy={isGeneratingMemory}
        >
          {isGeneratingMemory ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          {isGeneratingMemory ? '整理中...' : primaryActionLabel}
        </Button>
      </div>
    </section>
  );
}
