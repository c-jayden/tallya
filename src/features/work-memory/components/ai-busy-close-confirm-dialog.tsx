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

type AiBusyCloseConfirmDialogProps = {
  open: boolean;
  isAppCloseRequest: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function AiBusyCloseConfirmDialog({
  open,
  isAppCloseRequest,
  onOpenChange,
  onConfirm,
}: AiBusyCloseConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>正在整理，要关闭吗？</AlertDialogTitle>
          <AlertDialogDescription>
            {isAppCloseRequest
              ? '关闭应用会停止这次整理。确认后会退出 Tallya。'
              : '关闭后这次整理仍会继续，完成后可以再回到整理窗口查看当前结果。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">继续等待</AlertDialogCancel>
          <AlertDialogAction className="cursor-pointer" onClick={onConfirm}>
            {isAppCloseRequest ? '关闭应用' : '关闭窗口'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
