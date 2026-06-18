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
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import { EntryFeedItem } from './entry-feed-item';
import { EntryMergeDialog } from './entry-merge-dialog';
import type { ClarificationPrompt, Clarification, Entry } from '../types';

// Entries are newest-first, so each older row dims a little more, fading toward
// the empty bottom of the page — but never below the floor so it stays readable.
const FADE_STEP = 0.1;
const FADE_FLOOR = 0.45;
// Past this height the list scrolls inside its own container instead of pushing
// the composer and toolbar off the top of the (auto-sized) home window.
const FEED_MAX_HEIGHT = 280;

type EntryFeedProps = {
  entries: Entry[];
  clarificationsByEntry: Record<string, Clarification[]>;
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
  onMergeEntryExisting: (entryId: string, threadId: string) => void;
  onMergeEntryNew: (entryId: string, title: string) => void;
  onSuggestQuestions: (content: string) => Promise<ClarificationPrompt[]>;
};

export function EntryFeed({
  entries,
  clarificationsByEntry,
  focusedEntryId,
  isLoading,
  emptyHint,
  onUpdateEntry,
  onRemoveEntry,
  onAddClarification,
  onRemoveClarification,
  onMergeEntryExisting,
  onMergeEntryNew,
  onSuggestQuestions,
}: EntryFeedProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingMergeId, setPendingMergeId] = useState<string | null>(null);
  const mergeEntry = pendingMergeId
    ? (entries.find((entry) => entry.id === pendingMergeId) ?? null)
    : null;

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
        <TallyaScrollArea className="-mx-1 px-1" maxHeight={FEED_MAX_HEIGHT}>
          <ul className="grid gap-0">
            {entries.map((entry, index) => (
              <EntryFeedItem
                key={entry.id}
                entry={entry}
                clarifications={clarificationsByEntry[entry.id] ?? []}
                fadeOpacity={Math.max(FADE_FLOOR, 1 - index * FADE_STEP)}
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
                onRequestMerge={() => setPendingMergeId(entry.id)}
                onSuggestQuestions={onSuggestQuestions}
              />
            ))}
          </ul>
        </TallyaScrollArea>
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

      <EntryMergeDialog
        open={mergeEntry !== null}
        entryContent={mergeEntry?.content ?? ''}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMergeId(null);
          }
        }}
        onMergeExisting={(threadId) => {
          if (pendingMergeId) {
            onMergeEntryExisting(pendingMergeId, threadId);
          }

          setPendingMergeId(null);
        }}
        onMergeNew={(title) => {
          if (pendingMergeId) {
            onMergeEntryNew(pendingMergeId, title);
          }

          setPendingMergeId(null);
        }}
      />
    </section>
  );
}
