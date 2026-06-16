import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TallyaScrollArea } from '@/components/tallya-scroll-area';
import { threadService } from '../services/thread-service';
import type { ThreadSummary } from '../types';

type EntryMergeDialogProps = {
  open: boolean;
  entryContent: string;
  onOpenChange: (open: boolean) => void;
  onMergeExisting: (threadId: string) => void;
  onMergeNew: (title: string) => void;
};

function summarizeContent(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();

  return normalized.length <= 24 ? normalized : `${normalized.slice(0, 24)}…`;
}

// Manual merge fallback: pick an existing thread to join, or start a new one. The
// thread list is loaded here (not via the panel) so it works without ever opening
// the threads hub.
export function EntryMergeDialog({
  open,
  entryContent,
  onOpenChange,
  onMergeExisting,
  onMergeNew,
}: EntryMergeDialogProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [newTitle, setNewTitle] = useState('');
  const [wasOpen, setWasOpen] = useState(open);

  // Reset to the list and seed the new-thread title each time it opens fresh.
  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setMode('list');
      setNewTitle(summarizeContent(entryContent));
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;

    void threadService.listThreadSummaries().then((summaries) => {
      if (isMounted) {
        setThreads(summaries);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [open]);

  function handleCreate() {
    const trimmed = newTitle.trim();

    if (trimmed) {
      onMergeNew(trimmed);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="tallya-memory-overlay"
        className="tallya-dialog-content flex max-h-[calc(100vh-72px)] w-[min(460px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(460px,calc(100vw-48px))]"
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
            归并到线索
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            「{summarizeContent(entryContent)}」
          </DialogDescription>
        </DialogHeader>

        {mode === 'list' ? (
          <TallyaScrollArea className="min-h-0 flex-1 px-2 pb-2">
            <div className="grid gap-1">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] bg-transparent px-3.5 py-2.5 text-left text-[14px] leading-[1.5] text-app-ink transition-colors duration-150 hover:bg-app-surface-muted focus-visible:bg-app-surface-muted focus-visible:outline-none"
                onClick={() => setMode('new')}
              >
                <Plus className="size-4 shrink-0 text-app-ink-subtle" aria-hidden="true" />
                新建线索
              </button>
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className="block w-full cursor-pointer truncate rounded-[10px] bg-transparent px-3.5 py-2.5 text-left text-[14px] leading-[1.5] text-app-ink transition-colors duration-150 hover:bg-app-surface-muted focus-visible:bg-app-surface-muted focus-visible:outline-none"
                  onClick={() => onMergeExisting(thread.id)}
                >
                  {thread.title}
                </button>
              ))}
              {threads.length === 0 ? (
                <p className="px-3.5 py-3 text-[13px] leading-[1.5] text-app-ink-subtle">
                  还没有线索，新建一条吧。
                </p>
              ) : null}
            </div>
          </TallyaScrollArea>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-5">
            <Input
              autoFocus
              value={newTitle}
              onChange={(event) => {
                const { value } = event.target;
                setNewTitle(value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="给这条线索起个名字"
              className="h-9 text-sm"
            />
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink"
                onClick={() => setMode('list')}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                返回
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={handleCreate}
                disabled={!newTitle.trim()}
              >
                <Check className="size-4" aria-hidden="true" />
                新建并归并
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
