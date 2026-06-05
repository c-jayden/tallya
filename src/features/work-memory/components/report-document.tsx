import type { GeneratedReportContent } from '../types';

type ReportDocumentProps = {
  content: GeneratedReportContent | null;
  fallbackTitle?: string;
  showTitle?: boolean;
};

export function ReportDocument({
  content,
  fallbackTitle = '本周周报',
  showTitle = true,
}: ReportDocumentProps) {
  if (!content) {
    return null;
  }

  const title = content.title || fallbackTitle;

  return (
    <article className="divide-y divide-app-border text-app-ink">
      {showTitle || content.summary ? (
        <header className="py-3 first:pt-0 last:pb-0">
          {showTitle ? (
            <h2 className="text-lg leading-6 font-semibold tracking-normal">{title}</h2>
          ) : null}
          {content.summary ? (
            <p className="text-[14px] leading-[1.62] text-app-ink-muted">{content.summary}</p>
          ) : null}
        </header>
      ) : null}
      <ReportTextList title="本周重点" items={content.highlights} />
      <ReportTextList title="完成事项" items={content.completedItems} />
      <ReportTextBlock title="问题与风险" content={content.problems} />
      <ReportTextBlock title="下周计划" content={content.nextWeekPlan} />
    </article>
  );
}

function ReportTextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="py-3 first:pt-0 last:pb-0">
      <h3 className="text-[14px] leading-5 font-semibold text-app-ink">{title}</h3>
      <ul className="mt-1.5 space-y-1 text-[13.5px] leading-[1.58] text-app-ink-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[0.65em] size-1 shrink-0 rounded-full bg-app-ink-subtle" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReportTextBlock({ title, content }: { title: string; content?: string }) {
  if (!content) {
    return null;
  }

  return (
    <section className="py-3 first:pt-0 last:pb-0">
      <h3 className="text-[14px] leading-5 font-semibold text-app-ink">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-[1.62] text-app-ink-muted">{content}</p>
    </section>
  );
}
