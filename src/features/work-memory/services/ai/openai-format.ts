// Domain request/response mapping for the OpenAI Compatible provider: how
// Tallya's inputs become prompts, and how raw model output becomes structured
// results. Kept separate from the transport/diagnostics so each file stays
// focused. All functions here are pure.
import type {
  AnalyzeReportStyleInput,
  AnalyzedReportStyle,
  GenerateDailyMemoryInput,
  GenerateRangeReportInput,
  GeneratedDailyMemory,
  GeneratedReportContent,
  ReportGap,
  SuggestClarificationsInput,
  SuggestReportGapsInput,
  SuggestThreadLinkInput,
  ThreadLinkSuggestion,
} from '../../types';
import { normalizeReportText } from '../report-text';

const MAX_CLARIFICATION_QUESTIONS = 2;
const MAX_REPORT_GAPS = 3;

export function buildDailyMemoryPrompt(input: GenerateDailyMemoryInput) {
  return [
    '把输入整理为中文工作记忆。',
    '只输出合法 JSON，不要 markdown、解释、代码块或工具调用。',
    'JSON keys: summary:string, completedItems:string[], keyOutcome?:string, problems?:string, tomorrowPlan?:string, extraNote?:string, dailyReportText?:string.',
    '不要编造输入中不存在的事实；可以做温和归纳和合并。',
    'dailyReportText 是适合复制到企业微信、飞书或其他同步场景的一段整理文本；基于输入和结构化结果轻度整理，不要照抄原文，不要写成复盘报告或领导评价。',
    'dailyReportText 默认优先一段自然文本；信息明显分为完成事项、问题、计划时可分点，但最多 3 个分组，不要为了分点而分点。',
    'dailyReportText 总体控制在 80-300 字；不要使用 Markdown 标题符号；不要输出“本次未提及”；不要暴露 AI 分析痕迹。',
    `输入：${JSON.stringify(input)}`,
  ].join('\n');
}

export function buildRangeReportPrompt(input: GenerateRangeReportInput) {
  const reportName = input.reportType === 'custom' ? '自定义范围工作总结' : '本周回顾';
  const promptInput = {
    reportType: input.reportType,
    startDate: input.startDate,
    endDate: input.endDate,
    entries: input.entries,
    reportLength: input.reportLength,
    reportTone: input.reportTone,
    reportFocus: input.reportFocus,
    reportStyleHint: input.reportStyleHint,
  };

  return [
    `请根据输入中的 entries（工作记录）整理一份中文${reportName}。`,
    '只输出合法 JSON，不要 markdown code fence、解释、代码块或工具调用。',
    'JSON keys: title:string, summary:string, highlights:string[], completedItems:string[], problems?:string, nextWeekPlan?:string.',
    '不要编造 entries 中不存在的事实；可以做归纳、合并和润色。',
    '按线索聚合脉络：threadTitle 相同的 entries 归为同一条线索（跨天进展串起来讲），threadTitle 为 null 的各自独立；clarifications 是对该条记录的补充细节，可用来展开。',
    reportLengthInstruction(input.reportLength, input.entries.length),
    reportToneInstruction(input.reportTone),
    reportFocusInstruction(input.reportFocus),
    reportStyleInstruction(input),
    '只输出上述结构化字段，不要再附带整段 markdown 正文（复制用的文本由客户端拼装）。内容不要互相重复：highlights、completedItems 不要逐字重述 summary。',
    `输入：${JSON.stringify(promptInput)}`,
  ].join('\n');
}

export function buildReportStyleAnalysisPrompt(input: AnalyzeReportStyleInput) {
  return [
    '请分析用户粘贴的历史整理样本或工作总结，只输出合法 JSON，不要输出解释或 markdown。',
    'JSON keys: summary:string, promptHint:string.',
    '分析目标：',
    '- 只分析写作风格、表达习惯、结构倾向、语气、篇幅和信息组织方式。',
    '- 不提取具体业务内容。',
    '- 不提取具体项目名、公司名、客户名、人名、系统名、模块名、任务编号。',
    '- 不要把样本中的具体业务场景、字段结构或一次性表达直接复制到 promptHint。',
    '- 不要保存原始样本文本。',
    'summary 要求：',
    '- 用一句话概括样本的写作风格。',
    '- 可以写成“风格偏简洁、克制，重视进展、原因和结果”这类分析总结。',
    'promptHint 要求：',
    '- 必须写成可直接回填到“风格偏好”输入框的长期整理写作提示。',
    '- promptHint 应适用于单日整理、本周回顾和自定义范围总结，不要只适用于某一次工作进展说明。',
    '- promptHint 应描述“后续整理应该怎么写”，不要写成“你的风格是……”这类分析总结。',
    '- promptHint 只能影响表达方式、结构、语气和篇幅，不能要求模型编造事实。',
    '- promptHint 不要包含具体业务名词。',
    '- promptHint 不要绑定过细的栏目，例如“页面/交互/结果”；可以抽象成“先概括主要进展，再按事项说明动作、原因和结果”。',
    '- promptHint 建议控制在 80-160 个中文字符之间。',
    '- 使用克制、清晰、可执行的中文表达。',
    `样本文本：${input.sampleText}`,
  ].join('\n');
}

export function buildClarificationsPrompt(input: SuggestClarificationsInput) {
  return [
    '用户记下了一条很简短的工作记录，你要追问 1-2 个问题，帮他之后整理阶段总结时能把这件事展开。',
    '只输出合法 JSON，不要解释或 markdown。',
    'JSON keys: questions:string[]。',
    '要求：',
    '- 最多 2 个问题，每个一句话、口语化、容易回答。',
    '- 问题围绕：难点、原因、卡了多久、和谁协作、产出或结果。',
    '- 只追问这条记录本身，不要扩展到无关的事，也不要替用户编造答案。',
    '- 如果记录已经足够清楚、没什么可追问的，questions 返回空数组。',
    '- 用中文，避免重复用户已经写过的信息。',
    `工作记录：${input.content}`,
  ].join('\n');
}

export function parseSuggestedClarifications(rawOutput: string): string[] {
  const parsed = parseStrictJSON<{ questions?: unknown }>(rawOutput);

  return normalizeStringList(parsed.questions).slice(0, MAX_CLARIFICATION_QUESTIONS);
}

export function buildThreadLinkPrompt(input: SuggestThreadLinkInput) {
  const candidates = input.candidates.map((candidate) => ({
    id: candidate.id,
    content: candidate.content,
    occurredOn: candidate.occurredOn,
    threadTitle: candidate.threadTitle,
  }));

  return [
    '用户刚记下一条新的工作记录。下面给出最近的若干历史记录作为候选。',
    '判断这条新记录是不是在延续候选里的某一件事（同一个任务/问题/项目的后续进展）。',
    '只输出合法 JSON，不要解释或 markdown。',
    'JSON keys: relatedEntryId:string|null, threadTitle:string。',
    '要求：',
    '- 命中时 relatedEntryId 必须是候选里某条的 id（原样返回），threadTitle 给一个简短中文线索名（≤14字，概括这件事）。',
    '- 如果候选里那条已有 threadTitle，threadTitle 就沿用它，不要另起新名。',
    '- 不确定、只是话题相近但不是同一件事、或没有匹配时，relatedEntryId 返回 null。',
    '- 宁可漏判也不要误判；不要为了凑结果硬连。',
    `新记录：${input.content}`,
    `候选记录：${JSON.stringify(candidates)}`,
  ].join('\n');
}

export function buildReportGapsPrompt(input: SuggestReportGapsInput) {
  const entries = input.entries.map((entry) => ({
    id: entry.id,
    occurredOn: entry.occurredOn,
    content: entry.content,
    clarificationCount: entry.clarificationCount,
    threadTitle: entry.threadTitle,
  }));

  return [
    '下面是用户这段时间的工作记录（含所属线索 threadTitle 和已有补充数 clarificationCount）。',
    '在整理前，挑出"重点但信息不足"的线索：跨多条/跨天反复出现、但内容简略、补充很少的那种。',
    '即使 threadTitle 为空，也要根据内容相似度判断是否属于同一条线索；不要只依赖已有线索标题。',
    '对每条这样的线索给一个候选 entryId（从输入里选一条代表记录）和一句口语化的追问，帮用户补全后写进整理结果。',
    '只输出合法 JSON，不要解释或 markdown。',
    'JSON keys: gaps: { entryId: string, threadTitle: string, question: string }[]。',
    '要求：',
    `- 最多 ${MAX_REPORT_GAPS} 条，挑最值得补的；entryId 必须是输入里某条的 id（原样返回）。`,
    '- question 一句话、容易回答，围绕：难点、原因、产出/结果、和谁协作、卡了多久。',
    '- 信息已经足够、或这段时间记录很少时，gaps 返回空数组；不要为了凑数而追问。',
    '- 不要编造，不要重复记录里已经写过的信息。',
    `工作记录：${JSON.stringify(entries)}`,
  ].join('\n');
}

export function parseReportGaps(rawOutput: string, input: SuggestReportGapsInput): ReportGap[] {
  const parsed = parseStrictJSON<{ gaps?: unknown }>(rawOutput);
  const validIds = new Set(input.entries.map((entry) => entry.id));
  const seen = new Set<string>();
  const gaps: ReportGap[] = [];

  if (!Array.isArray(parsed.gaps)) {
    return gaps;
  }

  for (const item of parsed.gaps) {
    if (!isRecord(item)) {
      continue;
    }

    const entryId = typeof item.entryId === 'string' ? item.entryId : '';
    const question = typeof item.question === 'string' ? item.question.trim() : '';
    const threadTitle = typeof item.threadTitle === 'string' ? item.threadTitle.trim() : '';

    if (!entryId || !question || !validIds.has(entryId) || seen.has(entryId)) {
      continue;
    }

    seen.add(entryId);
    gaps.push({ entryId, threadTitle, question });

    if (gaps.length >= MAX_REPORT_GAPS) {
      break;
    }
  }

  return gaps;
}

export function parseThreadLinkSuggestion(
  rawOutput: string,
  input: SuggestThreadLinkInput,
): ThreadLinkSuggestion {
  const parsed = parseStrictJSON<{ relatedEntryId?: unknown; threadTitle?: unknown }>(rawOutput);
  const candidateIds = new Set(input.candidates.map((candidate) => candidate.id));
  const relatedEntryId =
    typeof parsed.relatedEntryId === 'string' && candidateIds.has(parsed.relatedEntryId)
      ? parsed.relatedEntryId
      : null;
  const threadTitle = typeof parsed.threadTitle === 'string' ? parsed.threadTitle.trim() : '';

  return { relatedEntryId, threadTitle };
}

function reportStyleInstruction(input: GenerateRangeReportInput) {
  const instructions = [
    '风格提示只影响表达方式，不允许改变事实内容，也不允许加入样本里的具体业务信息。',
  ];
  const reportStyleHint = input.reportStyleHint.trim();

  if (reportStyleHint) {
    instructions.push(`用户风格偏好：${reportStyleHint}`);
  }

  return instructions.join('\n');
}

function reportLengthInstruction(reportLength: string, memoryCount: number) {
  if (reportLength === 'brief') {
    return [
      '整理详略：精简。',
      'summary 1 句话；highlights 2-3 条；completedItems 2-3 条；problems 最多 1 句话；nextWeekPlan 最多 1 句话。',
      memoryCount === 1
        ? '当前只有 1 条工作记忆，整体进一步压缩：highlights 最多 2 条，completedItems 最多 2 条，不要把同一条记忆拆成过多项目。'
        : '合并相近事项，不要为了凑结构强行扩写。',
    ].join('\n');
  }

  if (reportLength === 'detailed') {
    return '整理详略：详细。summary 2-3 句话；highlights 4-6 条；completedItems 5-8 条。';
  }

  return '整理详略：标准。summary 1-2 句话；highlights 3-5 条；completedItems 3-6 条。';
}

function reportToneInstruction(reportTone: string) {
  if (reportTone === 'formal') {
    return '表达语气：正式。表达规范但不要官样化。';
  }

  if (reportTone === 'retrospective') {
    return '表达语气：复盘型。关注阶段进展、问题和下一步计划，但不要编造反思。';
  }

  return '表达语气：自然。表达清楚、克制，不要过度正式。';
}

function reportFocusInstruction(reportFocus: string) {
  if (reportFocus === 'completed-items') {
    return '整理重点：完成事项优先。优先突出具体完成事项。';
  }

  if (reportFocus === 'risks') {
    return '整理重点：问题风险优先。优先突出问题、风险、阻塞和后续跟进。';
  }

  return '整理重点：关键产出优先。优先突出关键产出和阶段进展。';
}

export function parseGeneratedDailyMemory(rawOutput: string, input: GenerateDailyMemoryInput) {
  const parsed = parseStrictJSON<GeneratedDailyMemory>(rawOutput);
  const summary = parsed.summary?.trim() || summarizeRawContent(input.rawContent);

  if (!summary) {
    throw new Error('AI 没有返回有效内容，请稍后重试。');
  }

  return {
    summary,
    completedItems: normalizeStringList(parsed.completedItems),
    keyOutcome: normalizeOptionalString(parsed.keyOutcome),
    problems: normalizeOptionalString(parsed.problems),
    tomorrowPlan: normalizeOptionalString(parsed.tomorrowPlan),
    extraNote: normalizeOptionalString(parsed.extraNote),
    dailyReportText: normalizeOptionalString(parsed.dailyReportText),
  };
}

export function parseGeneratedRangeReport(rawOutput: string, input: GenerateRangeReportInput) {
  const parsed = parseStrictJSON<GeneratedReportContent>(rawOutput);
  const report: GeneratedReportContent = {
    title: parsed.title?.trim() || defaultReportTitle(input),
    summary: parsed.summary?.trim() ?? '',
    highlights: normalizeStringList(parsed.highlights).slice(0, 6),
    completedItems: normalizeStringList(parsed.completedItems),
    problems: normalizeOptionalString(parsed.problems),
    nextWeekPlan: normalizeOptionalString(parsed.nextWeekPlan),
    markdown: normalizeReportText(parsed.markdown ?? ''),
  };

  if (!report.markdown) {
    report.markdown = buildRangeReportMarkdown(report);
  }

  if (
    !report.summary &&
    report.highlights.length === 0 &&
    report.completedItems.length === 0 &&
    !report.markdown
  ) {
    throw new Error('AI 没有返回有效整理内容，请稍后重试。');
  }

  return report;
}

export function parseAnalyzedReportStyle(rawOutput: string): AnalyzedReportStyle {
  const parsed = parseStrictJSON<AnalyzedReportStyle>(rawOutput);
  const style = {
    summary: parsed.summary?.trim() ?? '',
    promptHint: parsed.promptHint?.trim() ?? '',
  };

  if (!style.summary && !style.promptHint) {
    throw new Error('AI 没有返回有效风格分析结果，请稍后重试。');
  }

  return style;
}

export function parseStrictJSON<T>(
  rawOutput: string,
  invalidJSONMessage = '服务返回内容不是有效 JSON，可能是输出被截断；可尝试设置 max_tokens 或缩小报告范围。',
): T {
  const normalized = stripMarkdownFence(rawOutput.trim());

  if (!normalized) {
    throw new Error('AI 没有返回有效内容，请稍后重试。');
  }

  try {
    return JSON.parse(normalized) as T;
  } catch {
    throw new Error(invalidJSONMessage);
  }
}

function stripMarkdownFence(value: string) {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return (match?.[1] ?? value).trim();
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function summarizeRawContent(rawContent: string) {
  const normalized = rawContent.split(/\s+/).filter(Boolean).join(' ');

  return normalized.length <= 72 ? normalized : `${normalized.slice(0, 72)}...`;
}

function defaultReportTitle(input: GenerateRangeReportInput) {
  return input.reportType === 'custom'
    ? `${input.startDate}-${input.endDate}工作总结`
    : '本周回顾';
}

function buildRangeReportMarkdown(report: GeneratedReportContent) {
  const sections = [`# ${report.title}`];

  if (report.summary) {
    sections.push('## 总结', report.summary);
  }

  pushMarkdownList(sections, '重点', report.highlights);
  pushMarkdownList(sections, '完成事项', report.completedItems);

  if (report.problems) {
    sections.push('## 问题与风险', report.problems);
  }

  if (report.nextWeekPlan) {
    sections.push('## 后续计划', report.nextWeekPlan);
  }

  return normalizeReportText(sections.join('\n\n'));
}

function pushMarkdownList(sections: string[], title: string, items: string[]) {
  if (items.length === 0) {
    return;
  }

  sections.push(`## ${title}`, items.map((item) => `- ${item}`).join('\n'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
