import type { OpenAICompatibleApiMode, OpenAICompatibleParameters } from './ai-provider';
import { normalizeOpenAICompatibleBaseUrl } from './openai-compatible-provider';

export type OpenAICompatibleProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  // Empty when the provider's model identifier is account-specific (e.g. an
  // endpoint id); the user fills it in. Otherwise a sensible, editable default.
  defaultModel: string;
  apiMode: OpenAICompatibleApiMode;
  parameters?: Partial<OpenAICompatibleParameters>;
  hint?: string;
};

export const CUSTOM_OPENAI_PROVIDER_ID = 'custom';

// Rough popularity order (China + global). Base URLs are the stable part;
// default models are best-effort and stay editable in the form.
export const openAICompatibleProviderPresets: OpenAICompatibleProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    apiMode: 'chat-completions',
    // Sources: https://api-docs.deepseek.com/api/create-chat-completion
    // and https://api-docs.deepseek.com/guides/reasoning_model
    hint: 'DeepSeek Chat 支持 response_format json_object；reasoner/thinking 模式会忽略 temperature、top_p 和惩罚参数，reasoner 的 max_tokens 默认 32K、最大 64K。来源：DeepSeek 官方 Chat/Reasoning 文档。',
  },
  {
    id: 'qwen',
    label: '通义千问 Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    apiMode: 'chat-completions',
    // Sources: https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions
    // and https://help.aliyun.com/zh/model-studio/qwen-structured-output
    hint: 'DashScope OpenAI 兼容 Chat 支持 response_format json_object，提示词需包含 JSON；参数建议只调整 temperature 或 top_p 其中一个。来源：阿里云百炼 OpenAI 兼容 Chat / 结构化输出文档。',
  },
  {
    id: 'moonshot-cn',
    label: 'Kimi CN',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2.6',
    apiMode: 'chat-completions',
    parameters: {
      temperature: '1',
      topP: '0.95',
      presencePenalty: '0',
      frequencyPenalty: '0',
    },
    // Sources: https://platform.kimi.ai/docs/guide/use-kimi-vision-model
    // and https://platform.kimi.ai/docs/guide/faq
    hint: 'Kimi 国内开放平台使用 api.moonshot.cn；K2.7 Code / K2.6 / K2.5 要求 temperature fixed value 1.0、top_p 0.95、n 1、惩罚参数 0，其他值会报错；max_tokens 默认 32K，K2 系列最长 256K 减输入。来源：Kimi 官方参数差异/FAQ。',
  },
  {
    id: 'moonshot',
    label: 'Kimi',
    baseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2.6',
    apiMode: 'chat-completions',
    parameters: {
      temperature: '1',
      topP: '0.95',
      presencePenalty: '0',
      frequencyPenalty: '0',
    },
    // Sources: https://platform.kimi.ai/docs/guide/use-kimi-vision-model
    // and https://platform.kimi.ai/docs/guide/faq
    hint: 'Kimi 国际开放平台使用 api.moonshot.ai；K2.7 Code / K2.6 / K2.5 要求 temperature fixed value 1.0、top_p 0.95、n 1、惩罚参数 0，其他值会报错；max_tokens 默认 32K，K2 系列最长 256K 减输入。来源：Kimi 官方参数差异/FAQ。',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    apiMode: 'chat-completions',
    // Sources: https://docs.z.ai/guides/capabilities/struct-output
    // and https://docs.z.ai/guides/overview/concept-param
    hint: 'Z.AI 当前结构化输出文档列出 glm-5、glm-4.7、glm-4.6、glm-4.5 等支持 response_format json_object；旧 glm-4-flash 若拒绝 JSON mode 会自动降级重试。glm-4.5-flash max_tokens 默认 65K、最大 96K。来源：Z.AI 结构化输出/核心参数文档。',
  },
  {
    id: 'volcengine',
    label: '豆包（火山方舟）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: '',
    apiMode: 'chat-completions',
    // Sources: https://www.volcengine.com/docs/82379/1568221
    // and https://www.volcengine.com/docs/82379/1330310
    hint: '模型处填写火山方舟接入点 ID（形如 ep-xxxxxx）；方舟结构化输出通过 response_format，模型列表标注 json_object 能力，部分模型回答默认 4k、最大 32k。来源：火山方舟结构化输出/模型列表文档。',
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: '',
    apiMode: 'chat-completions',
    // Sources: https://docs.siliconflow.cn/cn/userguide/guides/json-mode
    // and https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions
    hint: '模型用完整名，如 deepseek-ai/DeepSeek-V3；除 VL 外主要语言模型支持 JSON 模式，官方建议合理设置 max_tokens 防止 JSON 被截断，并为输入保留约 10k token。来源：SiliconFlow JSON 模式/OpenAI Chat 文档。',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: '',
    apiMode: 'chat-completions',
    // Sources: https://openrouter.ai/docs/api/reference/parameters
    // and https://openrouter.ai/docs/guides/overview/models
    hint: '模型用 provider/model 形式，如 openai/gpt-4o-mini；OpenRouter 按目标模型转发参数，模型页 supported_parameters 会标明 max_tokens、response_format、structured_outputs 等能力。来源：OpenRouter 参数/模型文档。',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    apiMode: 'chat-completions',
    // Source: https://developers.openai.com/api/reference/resources/responses/methods/create
    hint: 'OpenAI 通常建议只调整 temperature 或 top_p 其中一个；/v1/responses 支持 max_output_tokens，不支持 presence_penalty / frequency_penalty。来源：OpenAI Responses API 文档。',
  },
];

export function getOpenAIProviderPreset(id: string): OpenAICompatibleProviderPreset | null {
  return openAICompatibleProviderPresets.find((preset) => preset.id === id) ?? null;
}

// Detects which preset the current Base URL belongs to (by normalized URL), so
// the selector reflects the saved config and falls back to custom.
export function matchOpenAIProviderPreset(baseUrl: string): string {
  const normalized = normalizeOpenAICompatibleBaseUrl(baseUrl);

  if (!normalized) {
    return CUSTOM_OPENAI_PROVIDER_ID;
  }

  const match = openAICompatibleProviderPresets.find(
    (preset) => normalizeOpenAICompatibleBaseUrl(preset.baseUrl) === normalized,
  );

  return match?.id ?? CUSTOM_OPENAI_PROVIDER_ID;
}
