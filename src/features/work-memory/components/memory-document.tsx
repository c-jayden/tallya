import type { DailyMemoryGeneratedContent } from '../types';
import {
  getMemoryPreviewSections,
  getPreviewItems,
  getUnmentionedSectionTitles,
} from '../memory-view-model';

type MemoryDocumentProps = {
  content: DailyMemoryGeneratedContent | null;
};

export function MemoryDocument({ content }: MemoryDocumentProps) {
  const unmentionedFields = getUnmentionedSectionTitles(content);

  return (
    <div className="divide-y divide-app-border">
      {getMemoryPreviewSections(content)
        .filter((section) => getPreviewItems(section.content))
        .map((section) => {
          const previewItems = getPreviewItems(section.content);
          const usesList = section.title === '完成事项' || (previewItems?.length ?? 0) > 1;

          if (!previewItems) {
            return null;
          }

          return (
            <section key={section.title} className="py-3 first:pt-0 last:pb-0">
              <h3 className="text-sm leading-5 font-semibold text-app-ink">{section.title}</h3>
              {usesList ? (
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-[1.58] text-app-ink-muted">
                  {previewItems.map((item, index) => (
                    <li key={`${section.title}-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-sm leading-[1.62] text-app-ink-muted">
                  {previewItems[0]}
                </p>
              )}
            </section>
          );
        })}
      {unmentionedFields.length > 0 ? (
        <p className="py-3 text-[13px] leading-[1.5] text-app-ink-subtle">
          本次未提及：{unmentionedFields.join('、')}
        </p>
      ) : null}
    </div>
  );
}
