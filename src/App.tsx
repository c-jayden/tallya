import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Settings, Sparkles } from 'lucide-react';
import './App.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Textarea } from '@/components/ui/textarea';

const now = new Date();
const displayDate = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(now);

const displayWeekday = new Intl.DateTimeFormat('zh-CN', {
  weekday: 'long',
}).format(now);

const templateTags = ['项目', '明日计划', '遇到问题', '关键产出', '协作沟通'];

const supplementPlaceholders: Record<string, string> = {
  项目: '例如：LIS / 官网改版 / 客户A',
  明日计划: '例如：继续验收导出流程',
  遇到问题: '例如：权限策略还需确认',
  关键产出: '例如：完成接口联调清单',
  协作沟通: '例如：同步交付风险和排期',
};

const weeklySnapshot = {
  settledDays: 3,
  lastMemoryDate: '昨天',
  lastMemorySummary: '修复订单导出异常，补充回归用例。',
};

type OfficialMemoryStatus = 'notGenerated' | 'generated' | 'locked';
type ReportFreshness = 'fresh' | 'stale';

type TodayMemoryState = {
  officialStatus: OfficialMemoryStatus;
  hasDraft: boolean;
  referencedByWeeklyReport: boolean;
  reportFreshness: ReportFreshness;
};

function App() {
  const [workNote, setWorkNote] = useState('');
  const [activeSupplements, setActiveSupplements] = useState<string[]>([]);
  const [todayMemory, setTodayMemory] = useState<TodayMemoryState>({
    officialStatus: 'notGenerated',
    hasDraft: false,
    referencedByWeeklyReport: false,
    reportFreshness: 'fresh',
  });
  const [searchPulse, setSearchPulse] = useState(false);
  const [primaryPulse, setPrimaryPulse] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const pulseTimeoutsRef = useRef<number[]>([]);
  const commandKey =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
      ? 'Cmd'
      : 'Ctrl';
  const hasGeneratedToday = todayMemory.officialStatus !== 'notGenerated';
  const isLocked = todayMemory.officialStatus === 'locked';
  const primaryActionLabel = hasGeneratedToday ? '更新今日记录' : '整理成今日记录';
  const statusVariant = isLocked
    ? 'locked'
    : todayMemory.officialStatus === 'generated'
      ? 'settled'
      : todayMemory.hasDraft
        ? 'draft'
        : 'empty';

  const pulseAction = useCallback(
    (setter: (value: boolean) => void, button: HTMLButtonElement | null) => {
      setter(true);
      button?.focus({ preventScroll: true });
      const timeoutId = window.setTimeout(() => setter(false), 700);
      pulseTimeoutsRef.current.push(timeoutId);
    },
    [],
  );

  const settleTodayMemory = useCallback(() => {
    if (isLocked) {
      return;
    }

    pulseAction(setPrimaryPulse, primaryActionRef.current);
    setTodayMemory((current) => ({
      ...current,
      officialStatus: 'generated',
      hasDraft: false,
      reportFreshness: current.referencedByWeeklyReport ? 'stale' : current.reportFreshness,
    }));
  }, [isLocked, pulseAction]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const isCommandShortcut = event.ctrlKey || event.metaKey;

      if (!isCommandShortcut) {
        return;
      }

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        pulseAction(setSearchPulse, searchButtonRef.current);
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        settleTodayMemory();
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
      pulseTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      pulseTimeoutsRef.current = [];
    };
  }, [pulseAction, settleTodayMemory]);

  function toggleSupplement(tag: string) {
    setActiveSupplements((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }

      return [...current, tag];
    });
  }

  function saveDraft() {
    if (isLocked) {
      return;
    }

    setTodayMemory((current) => ({ ...current, hasDraft: true }));
  }

  function unlockMemory() {
    setTodayMemory((current) => ({
      ...current,
      officialStatus: 'generated',
      reportFreshness: 'stale',
    }));
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="工作记忆首页">
        <header className="topbar">
          <div className="topbar-actions">
            <Button
              ref={searchButtonRef}
              variant="ghost"
              type="button"
              className={`command-button ${searchPulse ? 'is-pulsing' : ''}`}
              aria-label={`搜索记忆，快捷键 ${commandKey} K`}
              onClick={() => pulseAction(setSearchPulse, searchButtonRef.current)}
            >
              <Search aria-hidden="true" />
              <span>搜索记忆</span>
              <KbdGroup className="command-kbd" aria-hidden="true">
                <Kbd>{commandKey}</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </Button>
            <Button variant="ghost" size="icon-sm" type="button" className="settings-button">
              <Settings aria-hidden="true" />
              <span className="sr-only">设置</span>
            </Button>
          </div>
        </header>

        <section className="hero-section" aria-labelledby="today-title">
          <time className="date-text" dateTime={now.toISOString()}>
            <span>{displayDate}</span>
            <span>{displayWeekday}</span>
          </time>
          <h1 id="today-title" className="page-title">
            今天做了什么？
          </h1>
          <p className="page-description">随便写几句，职迹会帮你整理和沉淀。</p>
        </section>

        <section className="entry-section" aria-label="记录今日工作">
          <Textarea
            className="work-textarea"
            value={workNote}
            onChange={(event) => setWorkNote(event.currentTarget.value)}
            placeholder="例如：推进客户需求评审，联调导出接口，修复权限问题，明天继续验收。"
            disabled={isLocked}
          />
          <div className="template-row" aria-label="补充记录项">
            {templateTags.map((tag) => (
              <Button
                key={tag}
                variant="ghost"
                size="xs"
                type="button"
                className={`template-chip ${activeSupplements.includes(tag) ? 'is-active' : ''}`}
                aria-label={`添加${tag}字段`}
                onClick={() => toggleSupplement(tag)}
                disabled={isLocked}
              >
                + {tag}
              </Button>
            ))}
          </div>
          {activeSupplements.length > 0 ? (
            <div className="supplement-panel" aria-label="已展开的补充项">
              {activeSupplements.map((tag) => (
                <label key={tag} className="supplement-item">
                  <span>{tag}</span>
                  <Input
                    type="text"
                    aria-label={`${tag}补充内容`}
                    placeholder={supplementPlaceholders[tag]}
                    disabled={isLocked}
                  />
                </label>
              ))}
            </div>
          ) : null}
          <div className="primary-actions">
            <Button
              type="button"
              variant="ghost"
              className="draft-action"
              onClick={saveDraft}
              disabled={isLocked}
            >
              保存草稿
            </Button>
            <Button
              ref={primaryActionRef}
              type="button"
              className={`primary-action ${primaryPulse ? 'is-pulsing' : ''}`}
              aria-label={`${primaryActionLabel}，快捷键 ${commandKey} Enter`}
              onClick={settleTodayMemory}
              disabled={isLocked}
            >
              <Sparkles aria-hidden="true" />
              {primaryActionLabel}
            </Button>
          </div>
        </section>

        <section className={`status-section status-${statusVariant}`} aria-label="工作记忆状态">
          <div className="status-copy">
            {isLocked ? (
              <>
                <strong>本周周报已生成</strong>
                <p>本周工作记忆已归档，修改历史记录需先解锁。</p>
                <small>该记录已被周报引用，修改后相关报告可能需要重新生成。</small>
              </>
            ) : todayMemory.officialStatus === 'generated' ? (
              <>
                <strong>今日记忆已沉淀</strong>
                <p>你可以继续补充内容并重新整理。</p>
                {todayMemory.reportFreshness === 'stale' ? (
                  <small>相关报告需要重新生成。</small>
                ) : null}
              </>
            ) : todayMemory.hasDraft ? (
              <>
                <strong>草稿已保存</strong>
                <p>还没有生成正式工作记忆，整理后会沉淀为今天唯一一条正式记录。</p>
              </>
            ) : (
              <>
                <strong>本周已沉淀 {weeklySnapshot.settledDays} 天</strong>
                <p>
                  上次记录：{weeklySnapshot.lastMemoryDate}，{weeklySnapshot.lastMemorySummary}
                </p>
              </>
            )}
          </div>
          <div className="status-actions">
            {isLocked ? (
              <Button
                type="button"
                variant="ghost"
                className="status-action"
                onClick={unlockMemory}
              >
                解锁修改
              </Button>
            ) : null}
            <Button type="button" variant="ghost" className="status-action">
              {isLocked
                ? '查看周报'
                : todayMemory.officialStatus === 'generated'
                  ? '查看今日记忆'
                  : '查看记忆'}
            </Button>
            <Button type="button" variant="ghost" className="status-action">
              {isLocked ? '查看记忆' : '生成报告'}
            </Button>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
