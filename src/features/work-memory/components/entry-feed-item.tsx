import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, GitMerge, MessageSquarePlus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EntrySupplementPanel } from './entry-supplement-panel';
import type { Clarification, Entry } from '../types';

type EntryFeedItemProps = {
  entry: Entry;
  clarifications: Clarification[];
  fadeOpacity: number;
  isEditing: boolean;
  isFocused: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (content: string) => void;
  onRequestDelete: () => void;
  onAddClarification: (question: string | null, answer: string) => Promise<boolean> | boolean;
  onRemoveClarification: (id: string) => void;
  onRequestMerge: () => void;
  onSuggestQuestions: (content: string) => Promise<string[]>;
};

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function toLocalDay(iso: string) {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// An entry is backfilled when it was logged onto a past day: its "created"
// local day differs from the day it belongs to, so the noon occurredAt is
// synthetic and carries no real clock time.
function isBackfilledEntry(entry: Entry) {
  return toLocalDay(entry.createdAt) !== entry.occurredOn;
}

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
      <div className="flex items-center justify-end gap-1.5 pt-1 pb-1.5">
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
  clarifications,
  fadeOpacity,
  isEditing,
  isFocused,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onRequestDelete,
  onAddClarification,
  onRemoveClarification,
  onRequestMerge,
  onSuggestQuestions,
}: EntryFeedItemProps) {
  const [isSupplementOpen, setIsSupplementOpen] = useState(false);
  const itemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isFocused) {
      itemRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [isFocused]);

  if (isEditing) {
    return (
      <EntryInlineEditor
        initialValue={entry.content}
        onSubmit={onSubmitEdit}
        onCancel={onCancelEdit}
      />
    );
  }

  const backfilled = isBackfilledEntry(entry);
  const time = backfilled ? '' : formatEntryTime(entry.occurredAt);

  return (
    <li
      ref={itemRef}
      style={{ opacity: isFocused ? 1 : fadeOpacity }}
      className={cn(
        'group rounded-lg px-2.5 py-1.5 transition-[background-color,opacity] duration-300 hover:bg-app-surface-muted',
        isFocused && 'bg-[color-mix(in_srgb,#f59e0b_14%,transparent)]',
      )}
    >
      <div className="flex items-start gap-3">
        {time ? (
          <span className="h-6 shrink-0 font-mono text-xs leading-6 tabular-nums text-app-ink-subtle">
            {time}
          </span>
        ) : backfilled ? (
          <span className="h-6 shrink-0 text-xs leading-6 text-app-ink-subtle">追记</span>
        ) : null}
        <p className="min-w-0 flex-1 text-sm leading-6 whitespace-pre-wrap break-words text-app-ink">
          {entry.content}
        </p>
        <div
          className={cn(
            'flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity duration-150',
            'group-hover:opacity-100 focus-within:opacity-100',
            isSupplementOpen && 'opacity-100',
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="grid size-6 cursor-pointer place-items-center rounded-md text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface hover:text-app-ink focus-visible:bg-app-surface focus-visible:text-app-ink focus-visible:outline-none"
                onClick={() => setIsSupplementOpen((open) => !open)}
                aria-label="补充细节"
                aria-pressed={isSupplementOpen}
              >
                <MessageSquarePlus className="size-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>补充细节</TooltipContent>
          </Tooltip>
          {entry.threadId ? null : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="grid size-6 cursor-pointer place-items-center rounded-md text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface hover:text-app-ink focus-visible:bg-app-surface focus-visible:text-app-ink focus-visible:outline-none"
                  onClick={onRequestMerge}
                  aria-label="归并到线索"
                >
                  <GitMerge className="size-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>归并到线索</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="grid size-6 cursor-pointer place-items-center rounded-md text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface hover:text-app-ink focus-visible:bg-app-surface focus-visible:text-app-ink focus-visible:outline-none"
                onClick={onStartEdit}
                aria-label="编辑这条记录"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>编辑</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="grid size-6 cursor-pointer place-items-center rounded-md text-app-ink-subtle transition-colors duration-150 hover:bg-app-surface hover:text-[var(--app-danger,#dc2626)] focus-visible:bg-app-surface focus-visible:outline-none"
                onClick={onRequestDelete}
                aria-label="删除这条记录"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>删除</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {clarifications.length > 0 ? (
        <ul className="mt-1.5 ml-9 grid gap-1.5 border-l border-app-border pl-3">
          {clarifications.map((clarification) => (
            <li key={clarification.id} className="group/clar flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {clarification.question ? (
                  <p className="text-[12px] leading-[1.5] text-app-ink-subtle">
                    {clarification.question}
                  </p>
                ) : null}
                <p className="text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-app-ink-muted">
                  {clarification.answer}
                </p>
              </div>
              <button
                type="button"
                className="mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded text-app-ink-subtle opacity-0 transition-opacity duration-150 group-hover/clar:opacity-100 hover:text-[var(--app-danger,#dc2626)] focus-visible:opacity-100 focus-visible:outline-none"
                onClick={() => onRemoveClarification(clarification.id)}
                aria-label="删除这条补充"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {isSupplementOpen ? (
        <div className="mt-1.5 ml-9">
          <EntrySupplementPanel
            entryContent={entry.content}
            onAdd={onAddClarification}
            onSuggest={onSuggestQuestions}
            onClose={() => setIsSupplementOpen(false)}
          />
        </div>
      ) : null}
    </li>
  );
}
