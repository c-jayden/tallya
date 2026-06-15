import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AiTaskAlert } from '../hooks/use-ai-task-coordinator';
import { preventReportDialogDismissWhenBusy } from './report-dialog-state';
import { TallyaDialogFooter } from './tallya-dialog-footer';
import { WorkMemoryAlerts } from './work-memory-alerts';

type DailyReportDialogProps = {
  open: boolean;
  dateLabel: string;
  reportText: string;
  isGenerating: boolean;
  aiAlert: AiTaskAlert | null;
  onOpenChange: (open: boolean) => void;
  onForceClose: () => void;
  onTextChange: (text: string) => void;
  onGenerateWithAI: () => void;
  onCopy: () => void;
};

export function DailyReportDialog({
  open,
  dateLabel,
  reportText,
  isGenerating,
  aiAlert,
  onOpenChange,
  onForceClose,
  onTextChange,
  onGenerateWithAI,
  onCopy,
}: DailyReportDialogProps) {
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  function requestClose() {
    if (isGenerating) {
      setIsCloseConfirmOpen(true);
      return;
    }

    onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    requestClose();
  }

  function handleBusyDismiss(event: { preventDefault: () => void }) {
    preventReportDialogDismissWhenBusy(isGenerating, event);

    if (isGenerating) {
      setIsCloseConfirmOpen(true);
    }
  }

  function handleForceClose() {
    setIsCloseConfirmOpen(false);
    onForceClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          overlayClassName="tallya-memory-overlay"
          onEscapeKeyDown={handleBusyDismiss}
          onPointerDownOutside={handleBusyDismiss}
          className="tallya-dialog-content flex max-h-[calc(100vh-56px)] w-[min(560px,calc(100vw-48px))] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_70px_rgb(15_23_42/0.18)] dark:shadow-[0_28px_80px_rgb(0_0_0/0.5)] sm:max-w-[min(560px,calc(100vw-48px))]"
        >
          <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
            <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
              {dateLabel}整理
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
              可直接编辑后复制，用在需要同步的一段文字里。
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 px-6 pb-5">
            <WorkMemoryAlerts alert={aiAlert} />
            <Textarea
              className="block field-sizing-content max-h-[calc(100vh-300px)] min-h-40 w-full resize-none rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-sm leading-[1.6] text-app-ink shadow-none outline-none focus-visible:border-app-border-strong focus-visible:ring-0"
              value={reportText}
              onChange={(event) => onTextChange(event.currentTarget.value)}
              placeholder="这天还没有可整理的内容。"
            />
          </div>

          <TallyaDialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed"
              onClick={requestClose}
            >
              关闭
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer gap-1.5 text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed [&_svg]:size-3.5"
              onClick={onGenerateWithAI}
              disabled={isGenerating || !reportText.trim()}
              aria-busy={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {isGenerating ? '整理中' : '用 AI 整理'}
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={onCopy}
              disabled={!reportText.trim()}
            >
              复制
            </Button>
          </TallyaDialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>正在整理，要关闭吗？</AlertDialogTitle>
            <AlertDialogDescription>
              关闭后这次整理仍会继续，完成后可以再回到整理窗口查看当前结果。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">继续等待</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={handleForceClose}>
              关闭窗口
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
