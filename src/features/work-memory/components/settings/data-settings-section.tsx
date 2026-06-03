import { Button } from '@/components/ui/button';

export function DataSettingsSection({ onRequestClear }: { onRequestClear: () => void }) {
  return (
    <section className="space-y-6" aria-label="数据管理">
      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-app-ink">本地数据</div>
        <p className="text-sm text-app-ink-subtle">你的工作记忆默认保存在本机。</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-app-ink">清空本地数据</div>
          <p className="mt-1 text-sm text-app-ink-subtle">删除已保存的工作记忆和草稿。</p>
        </div>
        <Button type="button" variant="destructive" onClick={onRequestClear}>
          清空本地数据
        </Button>
      </div>
    </section>
  );
}
