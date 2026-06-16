import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appVersion } from '@/lib/app-version';
import { updateService } from '../../services/update-service';
import type { Update } from '@tauri-apps/plugin-updater';

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date' }
  | { kind: 'available'; version: string; update: Update }
  | { kind: 'installing'; version: string }
  | { kind: 'error'; message: string };

export function AboutSettingsSection() {
  const [state, setState] = useState<UpdateState>({ kind: 'idle' });

  const handleCheck = useCallback(async () => {
    setState({ kind: 'checking' });

    try {
      const result = await updateService.check();

      setState(
        result.status === 'available'
          ? { kind: 'available', version: result.version, update: result.update }
          : { kind: 'up-to-date' },
      );
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : '检查更新失败，请稍后再试。',
      });
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (state.kind !== 'available') {
      return;
    }

    const { update, version } = state;
    setState({ kind: 'installing', version });

    try {
      // On success the app relaunches, so this promise typically never resolves.
      await updateService.downloadAndInstall(update);
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : '更新安装失败，请稍后再试。',
      });
    }
  }, [state]);

  const isBusy = state.kind === 'checking' || state.kind === 'installing';

  return (
    <section className="space-y-4 text-sm" aria-label="关于">
      <div>
        <div className="text-base font-semibold text-app-ink">Tallya / 职迹</div>
        <div className="mt-1 text-app-ink-muted">本地 AI 工作记忆库</div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[13px] text-app-ink-muted">版本 {appVersion}</span>
          {state.kind === 'available' || state.kind === 'installing' ? null : (
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
          )}
        </div>

        {state.kind === 'up-to-date' ? (
          <p className="mt-2 text-[13px] text-app-ink-subtle">已是最新版本。</p>
        ) : null}

        {state.kind === 'error' ? (
          <p className="mt-2 text-[13px] text-[var(--app-danger,#dc2626)]">{state.message}</p>
        ) : null}

        {state.kind === 'available' ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[13px] text-app-ink">发现新版本 v{state.version}</span>
            <Button
              type="button"
              variant="accent"
              size="sm"
              className="h-7 cursor-pointer rounded-lg px-3 text-[13px]"
              onClick={handleInstall}
            >
              下载并安装
            </Button>
          </div>
        ) : null}

        {state.kind === 'installing' ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-app-ink-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            正在下载并安装 v{state.version}，完成后会自动重启。
          </p>
        ) : null}
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
