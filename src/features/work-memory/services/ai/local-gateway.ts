import { invoke } from '@tauri-apps/api/core';
import { normalizeOpenAICompatibleBaseUrl } from './openai-compatible-provider';

export type GatewayProbeResult = {
  reachable: boolean;
  detail?: string;
};

type GatewayProbeRequest = {
  url: string;
  timeoutMs: number;
};

const LOCAL_GATEWAY_PROBE_TIMEOUT_MS = 1_500;

export async function probeLocalGateway(baseUrl: string): Promise<GatewayProbeResult> {
  const normalizedBaseUrl = normalizeOpenAICompatibleBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    return {
      reachable: false,
      detail: '网关地址为空',
    };
  }

  try {
    return await invoke<GatewayProbeResult>('probe_openai_compatible_gateway', {
      url: `${normalizedBaseUrl}/models`,
      timeoutMs: LOCAL_GATEWAY_PROBE_TIMEOUT_MS,
    } satisfies GatewayProbeRequest);
  } catch {
    return {
      reachable: false,
      detail: '无法连接',
    };
  }
}
