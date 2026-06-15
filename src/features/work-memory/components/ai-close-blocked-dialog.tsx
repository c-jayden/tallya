import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type AiCloseBlockedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AiCloseBlockedDialog({ open, onOpenChange }: AiCloseBlockedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>正在整理，暂时不能关闭应用</AlertDialogTitle>
          <AlertDialogDescription>
            可以先留在当前窗口等待，整理完成后再关闭。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="cursor-pointer">继续等待</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
