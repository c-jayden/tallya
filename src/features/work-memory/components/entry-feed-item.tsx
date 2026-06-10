import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Entry } from '../types';

type EntryFeedItemProps = {
  entry: Entry;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (content: string) => void;
  onRequestDelete: () => void;
};

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatEntryTime(occurredAt: string) {
  const parsed = new Date(occurredAt);

  return Number.isNaN(parsed.getTime()) ? '' : timeFormatter.format(parsed);
}

type EntryInlineEditorProps = {
  initialValue: string;
  onSubmit: (content: string) => void;
  onCancel: () => void;
};

// The editor mounts only while editing, so its draft is initialized on mount
// rather than synced through an effect (avoids setState-in-effect churn).
function EntryInlineEditor({ initialValue, onSubmit, onCancel }: EntryInlineEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => editRef.current?.focus());

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();

      if (draft.trim()) {
        onSubmit(draft);
      }

      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <li className="rounded-lg bg-app-surface px-2.5 py-0.5 ring-1 ring-inset ring-app-border-strong">
      <Textarea
        ref={editRef}
        className="block field-sizing-content max-h-40 min-h-6 w-full resize-none border-0 bg-transparent px-0 py-1 text-sm leading-6 text-app-ink shadow-none outline-none focus-visible:ring-0"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="flex items-center justify-end gap-1.5 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 cursor-pointer gap-1 rounded-lg px-2 text-[13px] text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink [&_svg]:size-3.5"
          onClick={onCancel}
        >
          <X aria-hidden="true" />
          取消
        </Button>
        <Button
          type="button"
          size="xs"
          className="h-7 cursor-pointer gap-1 rounded-lg px-2.5 text-[13px] font-medium [&_svg]:size-3.5"
          onClick={() => draft.trim() && onSubmit(draft)}
          disabled={!draft.trim()}
        >
          <Check aria-hidden="true" />
          保存
        </Button>
      </div>
    </li>
  );
}

export function EntryFeedItem({
  entry,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onRequestDelete,
}: EntryFeedItemProps) {
  if (isEditing) {
    return (
      <EntryInlineEditor
        initialValue={entry.content}
        onSubmit={onSubmitEdit}
        onCancel={onCancelEdit}
      />
    );
  }

  const time = formatEntryTime(entry.occurredAt);

  return (
    <li className="group flex items-start gap-3 rounded-lg px-2.5 py-1.5 transition-colors duration-150 hover:bg-app-surface-muted">
      {time ? (
        <span className="h-6 shrink-0 font-mono text-xs leading-6 tabular-nums text-app-ink-subtle">
          {time}
        </span>
      ) : null}
      <p className="min-w-0 flex-1 text-sm leading-6 whitespace-pre-wrap break-words text-app-ink">
        {entry.content}
      </p>
      <div
        className={cn(
          'flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 focus-within:opacity-100',
        )}
      >
        <button
          type="button"
          className="grid size-6 cursor-pointer place-items-center rounded-md text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface hover:text-app-ink focus-visible:bg-app-surface focus-visible:text-app-ink focus-visible:outline-none"
          onClick={onStartEdit}
          aria-label="编辑这条记录"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="grid size-6 cursor-pointer place-items-center rounded-md text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface hover:text-[var(--app-danger,#dc2626)] focus-visible:bg-app-surface focus-visible:outline-none"
          onClick={onRequestDelete}
          aria-label="删除这条记录"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
