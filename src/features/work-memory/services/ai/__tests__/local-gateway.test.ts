import { describe, expect, it, vi } from 'vitest';
import { probeLocalGateway } from '../local-gateway';

describe('probeLocalGateway', () => {
  it('checks the normalized OpenAI-compatible models endpoint', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ id: 'gpt-5' }],
      }),
    );

    await expect(probeLocalGateway('http://localhost:8080', fetch)).resolves.toEqual({
      reachable: true,
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:8080/v1/models', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: expect.any(AbortSignal),
    });
  });

  it('does not duplicate an existing version segment', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse({ data: [] }));

    await probeLocalGateway('http://localhost:8787/v1/', fetch);

    expect(fetch).toHaveBeenCalledWith('http://localhost:8787/v1/models', expect.any(Object));
  });

  it('treats non-2xx responses as unavailable', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      jsonResponse({ error: 'missing' }, 404),
    );

    await expect(probeLocalGateway('http://localhost:8080', fetch)).resolves.toMatchObject({
      reachable: false,
      detail: 'HTTP 404',
    });
  });

  it('requires a JSON response body to avoid misdetecting unrelated services', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    await expect(probeLocalGateway('http://localhost:8080', fetch)).resolves.toMatchObject({
      reachable: false,
    });
  });

  it('returns unavailable for network errors without throwing', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('network down'));

    await expect(probeLocalGateway('http://localhost:8080', fetch)).resolves.toMatchObject({
      reachable: false,
    });
  });

  it('times out slow probes without throwing', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn<typeof globalThis.fetch>(
        (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            });
          }),
      );

      const probe = expect(probeLocalGateway('http://localhost:8080', fetch)).resolves.toMatchObject({
        reachable: false,
      });

      await vi.advanceTimersByTimeAsync(1500);
      await probe;
    } finally {
      vi.useRealTimers();
    }
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
