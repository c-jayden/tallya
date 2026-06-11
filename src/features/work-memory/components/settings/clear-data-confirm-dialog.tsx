import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';

type ClearDataConfirmDialogProps = {
  open: boolean;
  isClearingData: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

const CLEAR_DATA_CONFIRM_TEXT = '清空本地数据';

export function ClearDataConfirmDialog({
  open,
  isClearingData,
  onOpenChange,
  onConfirm,
}: ClearDataConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const canConfirm = confirmText === CLEAR_DATA_CONFIRM_TEXT;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmText('');
    }

    onOpenChange(nextOpen);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>清空本地数据？</AlertDialogTitle>
          <AlertDialogDescription>
            这会删除已保存的工作记忆、草稿和报告。应用设置会保留，清理后无法恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor="clear-data-confirm-input" className="text-sm text-app-ink-muted">
            照着上面的文字输入一遍，以确认这是你想做的操作。
          </label>
          <Input
            id="clear-data-confirm-input"
            className="placeholder:text-[var(--app-placeholder)]"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="输入：清空本地数据"
            disabled={isClearingData}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={isClearingData}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isClearingData || !canConfirm}
            className="cursor-pointer disabled:cursor-not-allowed"
            onClick={(event) => {
              event.preventDefault();
              void onConfirm().then(() => setConfirmText(''));
            }}
          >
            {isClearingData && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            确认清空
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
