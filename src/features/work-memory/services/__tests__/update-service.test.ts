import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted so the mock fn exists when the hoisted vi.mock factory runs.
const { mockCheck } = vi.hoisted(() => ({ mockCheck: vi.fn() }));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: mockCheck,
}));

import { updateService } from '../update-service';

describe('updateService.check', () => {
  beforeEach(() => {
    mockCheck.mockReset();
  });

  it('maps the "no build for this platform" error to unsupported-platform', async () => {
    mockCheck.mockRejectedValue(
      new Error(
        'None of the fallback platforms `["darwin-aarch64-app", "darwin-aarch64"]` were found in the response `platforms` object',
      ),
    );

    await expect(updateService.check()).resolves.toEqual({ status: 'unsupported-platform' });
  });

  it('rethrows genuine transport/parse failures so the UI can show a retry', async () => {
    mockCheck.mockRejectedValue(new Error('error sending request'));

    await expect(updateService.check()).rejects.toThrow('error sending request');
  });

  it('resolves up-to-date when no update is returned', async () => {
    mockCheck.mockResolvedValue(null);

    await expect(updateService.check()).resolves.toEqual({ status: 'up-to-date' });
  });

  it('reports an available update with version and notes', async () => {
    mockCheck.mockResolvedValue({ version: '0.3.0', body: '修了点东西' });

    await expect(updateService.check()).resolves.toMatchObject({
      status: 'available',
      version: '0.3.0',
      notes: '修了点东西',
    });
  });
});
