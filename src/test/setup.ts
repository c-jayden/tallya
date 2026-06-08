import { afterEach, vi } from 'vitest';
import { resetTauriMocks } from './tauri-mocks';

Object.defineProperty(globalThis.navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: vi.fn(async () => undefined),
  },
});

afterEach(() => {
  resetTauriMocks();
  vi.mocked(globalThis.navigator.clipboard.writeText).mockReset();
  vi.mocked(globalThis.navigator.clipboard.writeText).mockResolvedValue(undefined);
  vi.clearAllMocks();
});
