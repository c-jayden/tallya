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
    hint: 'DeepSeek reasoner / thinking 模式会忽略 temperature、top_p 和惩罚参数；普通 chat 模型可按需留空或设置。',
  },
  {
    id: 'qwen',
    label: '通义千问 Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    apiMode: 'chat-completions',
    hint: 'DashScope OpenAI 兼容接口主要使用 Chat Completions；参数建议只调整 temperature 或 top_p 其中一个。',
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
    },
    hint: 'Kimi 国内开放平台使用 api.moonshot.cn；K2.6 / K2.5 对 temperature 与 top_p 有固定值要求。',
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
    },
    hint: 'Kimi 国际开放平台使用 api.moonshot.ai；K2.6 / K2.5 对 temperature 与 top_p 有固定值要求。',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    apiMode: 'chat-completions',
    hint: '智谱 OpenAI 兼容接口示例支持 temperature 与 top_p；通常只调整其中一个。',
  },
  {
    id: 'volcengine',
    label: '豆包（火山方舟）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: '',
    apiMode: 'chat-completions',
    hint: '模型处填写火山方舟的接入点 ID（形如 ep-xxxxxx）。',
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: '',
    apiMode: 'chat-completions',
    hint: '模型用完整名，如 deepseek-ai/DeepSeek-V3；参数支持度随模型不同可能不同。',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: '',
    apiMode: 'chat-completions',
    hint: '模型用 provider/model 形式，如 openai/gpt-4o-mini。OpenRouter 会按目标模型转发参数。',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    apiMode: 'chat-completions',
    hint: 'OpenAI 通常建议只调整 temperature 或 top_p 其中一个。',
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
