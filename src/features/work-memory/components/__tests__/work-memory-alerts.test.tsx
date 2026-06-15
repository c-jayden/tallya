import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkMemoryAlerts } from '../work-memory-alerts';

describe('WorkMemoryAlerts', () => {
  it('renders a persistent AI task alert with action and dismiss controls', () => {
    const html = renderToStaticMarkup(
      <WorkMemoryAlerts
        alert={{
          id: 'range-report-completed',
          tone: 'success',
          message: '整理好了，点击查看。',
          actionLabel: '查看',
          target: 'range-report',
        }}
        onAction={() => undefined}
        onDismiss={() => undefined}
      />,
    );

    expect(html).toContain('整理好了，点击查看。');
    expect(html).toContain('查看');
    expect(html).toContain('关闭提示');
  });

  it('renders nothing when there is no alert', () => {
    expect(
      renderToStaticMarkup(<WorkMemoryAlerts alert={null} onDismiss={() => undefined} />),
    ).toBe('');
  });
});
