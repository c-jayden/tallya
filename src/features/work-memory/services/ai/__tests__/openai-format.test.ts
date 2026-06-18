import { describe, expect, it } from 'vitest';
import { buildReportGapsPrompt, parseSuggestedClarifications } from '../openai-format';

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

describe('parseSuggestedClarifications', () => {
  it('keeps structured options, trims/dedupes them, and caps at four', () => {
    const result = parseSuggestedClarifications(
      JSON.stringify({
        questions: [
          {
            question: '卡了多久？',
            options: [' 半天 ', '半天', '1-2天', '一周以上', '额外1', '额外2'],
          },
        ],
      }),
    );

    expect(result).toEqual([
      { question: '卡了多久？', options: ['半天', '1-2天', '一周以上', '额外1'] },
    ]);
  });

  it('treats open-ended questions (no options) as empty option lists', () => {
    const result = parseSuggestedClarifications(
      JSON.stringify({ questions: [{ question: '难点在哪？', options: [] }] }),
    );

    expect(result).toEqual([{ question: '难点在哪？', options: [] }]);
  });

  it('tolerates the legacy bare-string shape and caps questions at two', () => {
    const result = parseSuggestedClarifications(
      JSON.stringify({ questions: ['难点在哪？', '', '卡了多久？', '多余的问题'] }),
    );

    expect(result).toEqual([
      { question: '难点在哪？', options: [] },
      { question: '卡了多久？', options: [] },
    ]);
  });

  it('throws on invalid JSON so the panel can fall back to manual input', () => {
    expect(() => parseSuggestedClarifications('not json')).toThrow();
  });
});
