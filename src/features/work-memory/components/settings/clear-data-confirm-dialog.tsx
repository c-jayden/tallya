import { Loader2 } from 'lucide-react';
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

type ClearDataConfirmDialogProps = {
  open: boolean;
  isClearingData: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export function ClearDataConfirmDialog({
  open,
  isClearingData,
  onOpenChange,
  onConfirm,
}: ClearDataConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确定要清空本地数据吗？</AlertDialogTitle>
          <AlertDialogDescription>
            此操作会删除已保存的工作记忆和草稿，无法恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClearingData}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isClearingData}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
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
