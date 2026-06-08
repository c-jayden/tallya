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

type ImportBackupConfirmDialogProps = {
  open: boolean;
  isImportingBackup: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export function ImportBackupConfirmDialog({
  open,
  isImportingBackup,
  onOpenChange,
  onConfirm,
}: ImportBackupConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>导入备份？</AlertDialogTitle>
          <AlertDialogDescription>
            导入备份会覆盖当前本地数据。建议先导出当前数据作为备份。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isImportingBackup}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isImportingBackup}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {isImportingBackup && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            确认导入
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
