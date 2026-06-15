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

type ReportRestoreConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: () => void;
  onDiscard: () => void;
};

export function ReportRestoreConfirmDialog({
  open,
  onOpenChange,
  onRestore,
  onDiscard,
}: ReportRestoreConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>恢复上次的整理进度？</AlertDialogTitle>
          <AlertDialogDescription>
            上次整理已经生成了结果但还没保存。可以接着上次的结果继续，或重新整理一份。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" onClick={onDiscard}>
            重新整理
          </AlertDialogCancel>
          <AlertDialogAction className="cursor-pointer" onClick={onRestore}>
            恢复上次进度
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
