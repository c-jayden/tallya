import { describe, expect, it } from 'vitest';
import { buildReportGapsPrompt } from '../openai-format';

describe('buildReportGapsPrompt', () => {
  it('asks the model to detect repeated topics even when thread titles are missing', () => {
    const prompt = buildReportGapsPrompt({
      entries: [
        {
          id: 'e1',
          occurredOn: '2026-06-10',
          content: '上午对接登录接口',
          clarificationCount: 0,
          threadId: null,
          threadTitle: null,
        },
        {
          id: 'e2',
          occurredOn: '2026-06-12',
          content: '上午完成登录接口',
          clarificationCount: 0,
          threadId: null,
          threadTitle: null,
        },
      ],
    });

    expect(prompt).toContain('即使 threadTitle 为空');
    expect(prompt).toContain('根据内容相似度判断是否属于同一条线索');
    expect(prompt).toContain('这段时间记录很少时');
  });
});
