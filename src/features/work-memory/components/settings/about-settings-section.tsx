import { appVersion } from '@/lib/app-version';

export function AboutSettingsSection() {
  return (
    <section className="space-y-4 text-sm" aria-label="关于">
      <div>
        <div className="text-base font-semibold text-app-ink">Tallya / 职迹</div>
        <div className="mt-1 text-app-ink-muted">本地 AI 工作记忆库</div>
        <div className="mt-3 text-[13px] text-app-ink-muted">版本 {appVersion}</div>
      </div>

      <div className="space-y-1.5 leading-6">
        <p className="text-app-ink">你的工作记录默认保存在本机。</p>
        <p className="text-app-ink-muted">
          Tallya 会帮你把每天的工作沉淀成可搜索、可复盘的本地记忆。
        </p>
      </div>
    </section>
  );
}
