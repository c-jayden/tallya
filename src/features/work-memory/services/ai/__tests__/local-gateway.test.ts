import { describe, expect, it } from 'vitest';
import { tauriMocks } from '@/test/tauri-mocks';
import { probeLocalGateway } from '../local-gateway';

describe('probeLocalGateway', () => {
  it('checks the normalized OpenAI-compatible models endpoint', async () => {
    tauriMocks.invoke.mockResolvedValue({ reachable: true });

    await expect(probeLocalGateway('http://localhost:8080')).resolves.toEqual({
      reachable: true,
    });

    expect(tauriMocks.invoke).toHaveBeenCalledWith('probe_openai_compatible_gateway', {
      url: 'http://localhost:8080/v1/models',
      timeoutMs: 1500,
    });
  });

  it('does not duplicate an existing version segment', async () => {
    tauriMocks.invoke.mockResolvedValue({ reachable: true });

    await probeLocalGateway('http://localhost:8787/v1/');

    expect(tauriMocks.invoke).toHaveBeenCalledWith('probe_openai_compatible_gateway', {
      url: 'http://localhost:8787/v1/models',
      timeoutMs: 1500,
    });
  });

  it('treats non-2xx responses as unavailable', async () => {
    tauriMocks.invoke.mockResolvedValue({ reachable: false, detail: 'HTTP 404' });

    await expect(probeLocalGateway('http://localhost:8080')).resolves.toMatchObject({
      reachable: false,
      detail: 'HTTP 404',
    });
  });

  it('requires a JSON response body to avoid misdetecting unrelated services', async () => {
    tauriMocks.invoke.mockResolvedValue({ reachable: false, detail: '响应不是 JSON' });

    await expect(probeLocalGateway('http://localhost:8080')).resolves.toMatchObject({
      reachable: false,
    });
  });

  it('returns unavailable for network errors without throwing', async () => {
    tauriMocks.invoke.mockRejectedValue(new Error('network down'));

    await expect(probeLocalGateway('http://localhost:8080')).resolves.toMatchObject({
      reachable: false,
    });
  });

  it('returns unavailable for empty gateway addresses without invoking Rust', async () => {
    await expect(probeLocalGateway('   ')).resolves.toMatchObject({
      reachable: false,
      detail: '网关地址为空',
    });

    expect(tauriMocks.invoke).not.toHaveBeenCalled();
  });
});
