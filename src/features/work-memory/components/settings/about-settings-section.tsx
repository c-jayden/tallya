import { appVersion } from '@/lib/app-version';

export function AboutSettingsSection() {
  return (
    <section className="space-y-6 text-sm" aria-label="关于">
      <div>
        <div className="text-base font-semibold text-app-ink">Tallya / 职迹</div>
        <div className="mt-1 text-app-ink-muted">本地 AI 工作记忆库</div>
      </div>

      <div className="space-y-1.5">
        <div className="font-semibold text-app-ink">版本</div>
        <div className="text-app-ink-muted">{appVersion}</div>
      </div>

      <div className="space-y-1.5">
        <div className="font-semibold text-app-ink">数据与隐私</div>
        <p className="text-app-ink-muted">你的工作记录默认保存在本机。</p>
      </div>

      <div className="space-y-1.5">
        <div className="font-semibold text-app-ink">说明</div>
        <p className="leading-6 text-app-ink-muted">
          Tallya 会帮你把每天的工作沉淀成可搜索、可复盘的本地记忆。
        </p>
      </div>
    </section>
  );
}
