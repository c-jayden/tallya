import { appVersion } from '@/lib/app-version';
import { SectionHeader } from './settings-shared';

export function AboutSettingsSection() {
  return (
    <section className="space-y-4" aria-labelledby="about-settings-title">
      <SectionHeader id="about-settings-title" title="关于" />

      <div className="space-y-2 text-sm">
        <div>
          <div className="text-base font-semibold text-app-ink">Tallya / 职迹</div>
          <div className="mt-1 text-app-ink-muted">本地 AI 工作记忆库</div>
        </div>
        <div className="text-app-ink-muted">版本：{appVersion}</div>
        <p className="leading-6 text-app-ink-muted">
          你的工作记录默认保存在本机。Tallya 会帮你把每天的工作沉淀成可搜索、可复盘的本地记忆。
        </p>
      </div>
    </section>
  );
}
