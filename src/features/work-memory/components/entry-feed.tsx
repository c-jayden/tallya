import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EntryFeedItem } from './entry-feed-item';
import type { ThreadSuggestionView } from '../hooks/use-entries-controller';
import type { Clarification, Entry } from '../types';

type EntryFeedProps = {
  entries: Entry[];
  clarificationsByEntry: Record<string, Clarification[]>;
  threadSuggestionByEntry: Record<string, ThreadSuggestionView>;
  focusedEntryId: string | null;
  isLoading: boolean;
  emptyHint: string;
  onUpdateEntry: (id: string, content: string) => Promise<boolean> | boolean;
  onRemoveEntry: (id: string) => void;
  onAddClarification: (
    entryId: string,
    question: string | null,
    answer: string,
  ) => Promise<boolean> | boolean;
  onRemoveClarification: (id: string) => void;
  onConfirmThreadSuggestion: (entryId: string) => void;
  onDismissThreadSuggestion: (entryId: string) => void;
  onSuggestQuestions: (content: string) => Promise<string[]>;
};

export function EntryFeed({
  entries,
  clarificationsByEntry,
  threadSuggestionByEntry,
  focusedEntryId,
  isLoading,
  emptyHint,
  onUpdateEntry,
  onRemoveEntry,
  onAddClarification,
  onRemoveClarification,
  onConfirmThreadSuggestion,
  onDismissThreadSuggestion,
  onSuggestQuestions,
}: EntryFeedProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleSubmitEdit(id: string, content: string) {
    const saved = await onUpdateEntry(id, content);

    if (saved) {
      setEditingId(null);
    }
  }

  function confirmDelete() {
    if (pendingDeleteId) {
      onRemoveEntry(pendingDeleteId);
    }

    setPendingDeleteId(null);
  }

  if (isLoading) {
    return null;
  }

  return (
    <section aria-label="工作记录" className="grid gap-0">
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-app-border px-3.5 py-6 text-center text-[13px] leading-[1.55] text-app-ink-subtle">
          {emptyHint}
        </p>
      ) : (
        <ul className="grid gap-0">
          {entries.map((entry) => (
            <EntryFeedItem
              key={entry.id}
              entry={entry}
              clarifications={clarificationsByEntry[entry.id] ?? []}
              threadSuggestion={threadSuggestionByEntry[entry.id]}
              isEditing={editingId === entry.id}
              isFocused={focusedEntryId === entry.id}
              onStartEdit={() => setEditingId(entry.id)}
              onCancelEdit={() => setEditingId(null)}
              onSubmitEdit={(content) => void handleSubmitEdit(entry.id, content)}
              onRequestDelete={() => setPendingDeleteId(entry.id)}
              onAddClarification={(question, answer) =>
                onAddClarification(entry.id, question, answer)
              }
              onRemoveClarification={onRemoveClarification}
              onConfirmThreadSuggestion={() => onConfirmThreadSuggestion(entry.id)}
              onDismissThreadSuggestion={() => onDismissThreadSuggestion(entry.id)}
              onSuggestQuestions={onSuggestQuestions}
            />
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条记录</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={confirmDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
