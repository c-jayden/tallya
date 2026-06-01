import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarRange,
  FileClock,
  FileText,
  Search,
  Settings,
  Sparkles,
  Trophy,
} from 'lucide-react';
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

const recentMemories = [
  {
    date: '今天',
    content: '推进客户需求评审，明确阶段交付范围，并同步风险事项。',
  },
  {
    date: '昨天',
    content: '修复订单导出异常，补充回归用例，整理发布说明。',
  },
  {
    date: '周一',
    content: '完成新人任务拆解，沉淀一份接口联调检查清单。',
  },
];

const quickGenerates = [
  {
    label: '本周周报',
    description: '汇总本周工作重点',
    icon: FileText,
  },
  {
    label: '本月月报',
    description: '整理阶段成果',
    icon: CalendarRange,
  },
  {
    label: '自定义范围',
    description: '按任意时间生成',
    icon: FileClock,
  },
  {
    label: '绩效素材',
    description: '提炼可证明的产出',
    icon: Trophy,
  },
];

function App() {
  const [workNote, setWorkNote] = useState('');
  const [activeSupplements, setActiveSupplements] = useState<string[]>([]);
  const [searchPulse, setSearchPulse] = useState(false);
  const [primaryPulse, setPrimaryPulse] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const pulseTimeoutsRef = useRef<number[]>([]);
  const commandKey =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
      ? 'Cmd'
      : 'Ctrl';

  const pulseAction = useCallback(
    (setter: (value: boolean) => void, button: HTMLButtonElement | null) => {
      setter(true);
      button?.focus({ preventScroll: true });
      const timeoutId = window.setTimeout(() => setter(false), 700);
      pulseTimeoutsRef.current.push(timeoutId);
    },
    [],
  );

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
        pulseAction(setPrimaryPulse, primaryActionRef.current);
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
      pulseTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      pulseTimeoutsRef.current = [];
    };
  }, [pulseAction]);

  function toggleSupplement(tag: string) {
    setActiveSupplements((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }

      return [...current, tag];
    });
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="工作记忆首页">
        <header className="topbar">
          <div className="brand-mark" aria-label="职迹">
            职迹
          </div>
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
                  />
                </label>
              ))}
            </div>
          ) : null}
          <div className="primary-actions">
            <Button
              ref={primaryActionRef}
              type="button"
              className={`primary-action ${primaryPulse ? 'is-pulsing' : ''}`}
              aria-label={`整理成今日记录，快捷键 ${commandKey} Enter`}
              onClick={() => pulseAction(setPrimaryPulse, primaryActionRef.current)}
            >
              <Sparkles aria-hidden="true" />
              整理成今日记录
            </Button>
            <Button type="button" variant="ghost" className="draft-action">
              保存草稿
            </Button>
          </div>
        </section>

        <section className="memory-section" aria-labelledby="recent-memory-title">
          <div className="section-heading">
            <h2 id="recent-memory-title" className="section-title">
              最近工作记忆
            </h2>
            <Button type="button" variant="ghost" size="xs" className="view-all-button">
              查看全部
            </Button>
          </div>
          <ol className="timeline-list">
            {recentMemories.map((memory) => (
              <li key={`${memory.date}-${memory.content}`} className="timeline-item">
                <span className="timeline-marker" aria-hidden="true" />
                <div className="timeline-content">
                  <div className="timeline-meta">{memory.date}</div>
                  <p>{memory.content}</p>
                  <div className="timeline-actions" aria-label={`${memory.date}记忆操作`}>
                    <Button type="button" variant="ghost" size="xs">
                      查看
                    </Button>
                    <Button type="button" variant="ghost" size="xs">
                      生成报告
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="quick-section" aria-labelledby="quick-generate-title">
          <h2 id="quick-generate-title" className="section-title">
            从记忆生成
          </h2>
          <div className="generate-grid">
            {quickGenerates.map(({ label, description, icon: Icon }) => (
              <Button key={label} variant="ghost" type="button" className="generate-card">
                <Icon aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </Button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
