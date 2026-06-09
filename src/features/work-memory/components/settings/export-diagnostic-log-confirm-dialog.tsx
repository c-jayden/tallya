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

type ExportDiagnosticLogConfirmDialogProps = {
  open: boolean;
  isExporting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ExportDiagnosticLogConfirmDialog({
  open,
  isExporting,
  onOpenChange,
  onConfirm,
}: ExportDiagnosticLogConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>导出诊断日志？</AlertDialogTitle>
          <AlertDialogDescription>
            诊断日志会包含错误信息、模型名称、接口地址和部分脱敏响应片段，不包含
            API Key。请只在需要排查问题时分享给开发者。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={isExporting}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            className="cursor-pointer"
            disabled={isExporting}
            onClick={onConfirm}
          >
            {isExporting ? '正在导出' : '导出'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
