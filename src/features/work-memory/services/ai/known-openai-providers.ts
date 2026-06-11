import type { OpenAICompatibleApiMode } from './ai-provider';
import { normalizeOpenAICompatibleBaseUrl } from './openai-compatible-provider';

export type OpenAICompatibleProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  // Empty when the provider's model identifier is account-specific (e.g. an
  // endpoint id); the user fills it in. Otherwise a sensible, editable default.
  defaultModel: string;
  apiMode: OpenAICompatibleApiMode;
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
  },
  {
    id: 'qwen',
    label: '通义千问 Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    apiMode: 'chat-completions',
  },
  {
    id: 'moonshot',
    label: 'Kimi（Moonshot）',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    apiMode: 'chat-completions',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    apiMode: 'chat-completions',
  },
  {
    id: 'volcengine',
    label: '豆包（火山方舟）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: '',
    apiMode: 'chat-completions',
    hint: '模型处填火山方舟的接入点 ID（形如 ep-xxxxxx）。',
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: '',
    apiMode: 'chat-completions',
    hint: '模型用完整名，如 deepseek-ai/DeepSeek-V3。',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: '',
    apiMode: 'chat-completions',
    hint: '模型用 provider/model 形式，如 openai/gpt-4o-mini。',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    apiMode: 'chat-completions',
  },
];

export function getOpenAIProviderPreset(id: string): OpenAICompatibleProviderPreset | null {
  return openAICompatibleProviderPresets.find((preset) => preset.id === id) ?? null;
}

// Detects which preset the current Base URL belongs to (by normalized URL), so
// the selector reflects the saved config and falls back to 自定义.
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
