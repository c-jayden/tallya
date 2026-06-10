import { useState, type KeyboardEvent as ReactKeyboardEvent, type Ref } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type EntryComposerProps = {
  placeholder: string;
  isSaving: boolean;
  inputRef: Ref<HTMLTextAreaElement>;
  onSubmit: (content: string) => Promise<boolean> | boolean;
};

export function EntryComposer({ placeholder, isSaving, inputRef, onSubmit }: EntryComposerProps) {
  const [value, setValue] = useState('');

  async function submit() {
    if (!value.trim() || isSaving) {
      return;
    }

    const saved = await onSubmit(value);

    if (saved) {
      setValue('');
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    // Enter records; Shift+Enter inserts a newline. The IME guard keeps pinyin
    // composition from submitting a half-typed entry.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <section className="mb-5 grid gap-0" aria-label="记录一条工作">
      <TallyaScrollArea className="tallya-textarea-scroll h-22 min-h-22 rounded-xl border border-app-border bg-app-surface shadow-none transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-app-border-strong focus-within:bg-app-surface focus-within:ring-3 focus-within:ring-[color-mix(in_srgb,var(--app-ink)_6%,transparent)]">
        <Textarea
          ref={inputRef}
          className="block min-h-full resize-none overflow-hidden rounded-none border-0 bg-transparent p-3 text-sm leading-6 text-app-ink shadow-none outline-none placeholder:text-[var(--app-placeholder)] focus-visible:border-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      </TallyaScrollArea>
      <div className="flex items-center justify-between pt-2.5">
        <span className="text-[13px] leading-[1.45] text-app-ink-subtle">
          回车记录，Shift + 回车换行
        </span>
        <Button
          type="button"
          className="h-9 cursor-pointer gap-1.5 rounded-xl px-3.5 text-sm font-semibold shadow-none transition-[background-color,box-shadow] duration-150 hover:shadow-[0_4px_10px_rgb(24_24_27/0.08)] focus-visible:shadow-[0_4px_10px_rgb(24_24_27/0.08)] disabled:cursor-not-allowed [&_svg]:size-3.5 [&_svg]:opacity-80"
          onClick={() => void submit()}
          disabled={!value.trim() || isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          记录
        </Button>
      </div>
    </section>
  );
}
