import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ReportStyleExtractDialogProps = {
  open: boolean;
  isExtracting: boolean;
  onOpenChange: (open: boolean) => void;
  onExtractReportStylePrompt: (sampleText: string) => Promise<string>;
  onApplyPromptHint: (promptHint: string) => void;
};

export function ReportStyleExtractDialog({
  open,
  isExtracting,
  onOpenChange,
  onExtractReportStylePrompt,
  onApplyPromptHint,
}: ReportStyleExtractDialogProps) {
  const [sampleText, setSampleText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  function handleOpenChange(nextOpen: boolean) {
    if (isExtracting && !nextOpen) {
      return;
    }

    if (!nextOpen) {
      setSampleText('');
      setErrorMessage('');
    }

    onOpenChange(nextOpen);
  }

  async function handleExtract() {
    const trimmedSampleText = sampleText.trim();

    if (!trimmedSampleText) {
      setErrorMessage('先粘贴样本');
      return;
    }

    setErrorMessage('');

    try {
      const promptHint = (await onExtractReportStylePrompt(trimmedSampleText)).trim();

      if (!promptHint) {
        setErrorMessage('没有提取到可用风格，请换一段样本再试。');
        return;
      }

      onApplyPromptHint(promptHint);
      setSampleText('');
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : '风格提取失败，请稍后重试';
      setErrorMessage(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="tallya-memory-overlay"
        closeButtonDisabled={isExtracting}
        className="tallya-dialog-content flex w-[min(520px,calc(100vw-3rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(520px,calc(100vw-3rem))]"
      >
        <DialogHeader className="shrink-0 gap-1.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg leading-6 font-semibold tracking-normal text-app-ink">
            从样本提取风格
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.5] text-app-ink-muted">
            粘贴你过去提交过的日报或周报。Tallya
            会提取常用表达和结构，并回填到风格偏好中。原文不会被保存。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-6 pb-5">
          <textarea
            value={sampleText}
            disabled={isExtracting}
            placeholder="粘贴几段你过去提交过的日报或周报。内容越接近你真实写法，提取结果越有参考价值。"
            className="min-h-40 w-full resize-none rounded-lg border border-app-border bg-white px-3 py-2 text-sm leading-5 text-app-ink placeholder:text-slate-400 focus:border-app-ink/30 focus:ring-2 focus:ring-app-ink/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => {
              setSampleText(event.target.value);
              if (errorMessage) {
                setErrorMessage('');
              }
            }}
          />
          {errorMessage && (
            <p className="text-[13px] leading-5 text-destructive">{errorMessage}</p>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t border-app-border bg-white px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={isExtracting}
            className="cursor-pointer disabled:cursor-not-allowed"
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={isExtracting}
            className="cursor-pointer disabled:cursor-not-allowed"
            onClick={() => void handleExtract()}
          >
            {isExtracting && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {isExtracting ? '提取中' : '提取'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
