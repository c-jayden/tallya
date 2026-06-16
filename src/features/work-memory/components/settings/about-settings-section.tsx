import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appVersion } from '@/lib/app-version';
import type { AppSettings } from '../../services/app-settings-repository';
import { logger } from '../../services/logger/logger';
import { updateService } from '../../services/update-service';
import { SwitchField } from './settings-shared';
import type { Update } from '@tauri-apps/plugin-updater';

type AboutSettingsSectionProps = {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
};

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date' }
  | { kind: 'available'; version: string; notes: string | null; update: Update }
  | { kind: 'installing'; version: string }
  | { kind: 'error'; detail: string };

export function AboutSettingsSection({ settings, onUpdateSettings }: AboutSettingsSectionProps) {
  const [state, setState] = useState<UpdateState>({ kind: 'idle' });

  // Silent auto-check when opening 关于 (only when enabled): surfaces an available
  // update without a click, and stays quiet on "up to date" / transient failures
  // (e.g. no published release yet) so it never nags.
  useEffect(() => {
    if (!settings.autoCheckUpdates) {
      return;
    }

    let isMounted = true;

    void updateService
      .check()
      .then((result) => {
        if (isMounted && result.status === 'available') {
          setState({
            kind: 'available',
            version: result.version,
            notes: result.notes,
            update: result.update,
          });
        }
      })
      .catch(() => {
        // Silent: an auto-check failure must not surface an error.
      });

    return () => {
      isMounted = false;
    };
  }, [settings.autoCheckUpdates]);

  async function handleCheck() {
    setState({ kind: 'checking' });

    try {
      const result = await updateService.check();

      setState(
        result.status === 'available'
          ? { kind: 'available', version: result.version, notes: result.notes, update: result.update }
          : { kind: 'up-to-date' },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.warn('app', 'updater.check_failed', 'Manual update check failed', { detail });
      setState({ kind: 'error', detail });
    }
  }

  async function handleInstall() {
    if (state.kind !== 'available') {
      return;
    }

    const { update, version } = state;
    setState({ kind: 'installing', version });

    try {
      // On success the app relaunches, so this promise typically never resolves.
      await updateService.downloadAndInstall(update);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.warn('app', 'updater.install_failed', 'Update install failed', { detail });
      setState({ kind: 'error', detail });
    }
  }

  const isBusy = state.kind === 'checking' || state.kind === 'installing';
  const showCheckButton = state.kind !== 'available' && state.kind !== 'installing';

  return (
    <section className="space-y-5 text-sm" aria-label="关于">
      <div>
        <div className="text-base font-semibold text-app-ink">Tallya / 职迹</div>
        <div className="mt-1 text-app-ink-muted">本地 AI 工作记忆库</div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-[13px] text-app-ink-muted">版本 {appVersion}</span>
          {showCheckButton ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer rounded-lg px-2.5 text-[13px] text-app-ink-muted hover:bg-app-surface-muted hover:text-app-ink disabled:cursor-not-allowed [&_svg]:size-3.5"
              onClick={handleCheck}
              disabled={isBusy}
              aria-busy={state.kind === 'checking'}
            >
              {state.kind === 'checking' ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              检查更新
            </Button>
          ) : null}
        </div>

        {state.kind === 'up-to-date' ? (
          <p className="mt-2 text-[13px] text-app-ink-subtle">已是最新版本。</p>
        ) : null}

        {state.kind === 'error' ? (
          <div className="mt-2 space-y-1">
            <p className="text-[13px] text-app-ink-subtle">
              暂时没检查到更新，可能还没有发布新版本或网络不可用，稍后再试。
            </p>
            <p className="text-[12px] leading-[1.5] break-all text-app-ink-subtle/80">
              {state.detail}
            </p>
          </div>
        ) : null}

        {state.kind === 'available' ? (
          <div className="mt-2.5 rounded-lg bg-app-surface-muted px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-app-ink">发现新版本 v{state.version}</span>
              <Button
                type="button"
                variant="accent"
                size="sm"
                className="h-7 shrink-0 cursor-pointer rounded-lg px-3 text-[13px]"
                onClick={handleInstall}
              >
                下载并安装
              </Button>
            </div>
            {state.notes ? (
              <p className="mt-1.5 text-[12.5px] leading-[1.55] whitespace-pre-wrap text-app-ink-muted">
                {state.notes}
              </p>
            ) : null}
          </div>
        ) : null}

        {state.kind === 'installing' ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-app-ink-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            正在下载并安装 v{state.version}，完成后会自动重启。
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <SwitchField
          label="启动时自动检查更新"
          checked={settings.autoCheckUpdates}
          onCheckedChange={(checked) => onUpdateSettings({ autoCheckUpdates: checked })}
        />
        <p className="text-[13px] leading-5 text-app-ink-subtle">
          打开应用时静默检查 GitHub 上是否有新版本。
        </p>
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
