import { normalizeOpenAICompatibleBaseUrl } from './openai-compatible-provider';

export type GatewayProbeResult = {
  reachable: boolean;
  detail?: string;
};

type FetchLike = typeof fetch;

const LOCAL_GATEWAY_PROBE_TIMEOUT_MS = 1_500;

export async function probeLocalGateway(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<GatewayProbeResult> {
  const normalizedBaseUrl = normalizeOpenAICompatibleBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    return {
      reachable: false,
      detail: 'Base URL 为空',
    };
  }

  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    abortController.abort();
  }, LOCAL_GATEWAY_PROBE_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${normalizedBaseUrl}/models`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      return {
        reachable: false,
        detail: `HTTP ${response.status}`,
      };
    }

    try {
      await response.json();
    } catch {
      return {
        reachable: false,
        detail: '响应不是 JSON',
      };
    }

    return { reachable: true };
  } catch (error) {
    return {
      reachable: false,
      detail: isAbortError(error) ? '检测超时' : '无法连接',
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  return error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message));
}
