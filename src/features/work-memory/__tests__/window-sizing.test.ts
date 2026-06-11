import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resizeHomeWindowToContent } from '../window-sizing';

const setSize = vi.fn();
let currentLogicalHeight = 500;

vi.mock('@tauri-apps/api/window', () => {
  class LogicalSize {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  }

  return {
    getCurrentWindow: () => ({
      innerSize: () =>
        Promise.resolve({
          toLogical: () => ({ width: 750, height: currentLogicalHeight }),
        }),
      scaleFactor: () => Promise.resolve(2),
      setSize,
    }),
    LogicalSize,
  };
});

describe('resizeHomeWindowToContent', () => {
  beforeEach(() => {
    currentLogicalHeight = 500;
    setSize.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the scroll container height when it is taller than the measured child content', async () => {
    vi.stubGlobal('window', {
      getComputedStyle: () => ({
        paddingTop: '24px',
        paddingBottom: '24px',
      }),
    });

    const scrollContainer = {
      scrollHeight: 528,
    };
    const contentElement = {
      parentElement: scrollContainer,
      scrollHeight: 440,
      getBoundingClientRect: () => ({ height: 440 }),
    } as HTMLElement;

    await resizeHomeWindowToContent(contentElement);

    expect(setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 750, height: 528 }));
  });

  it('compensates when the browser viewport is shorter than the current native size', async () => {
    vi.stubGlobal('window', {
      innerHeight: 472,
      getComputedStyle: () => ({
        paddingTop: '24px',
        paddingBottom: '24px',
      }),
    });

    const scrollContainer = {
      scrollHeight: 504,
    };
    const contentElement = {
      parentElement: scrollContainer,
      scrollHeight: 456,
      getBoundingClientRect: () => ({ height: 456 }),
    } as HTMLElement;

    await resizeHomeWindowToContent(contentElement);

    expect(setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 750, height: 532 }));
  });
});
