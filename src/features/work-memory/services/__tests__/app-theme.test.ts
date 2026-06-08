import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAppTheme, getAppThemeRevision } from '../app-theme';

describe('applyAppTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies the selected theme class immediately', () => {
    const root = createThemeElement(['dark']);
    const body = createThemeElement(['dark']);
    const appRoot = createThemeElement(['dark']);

    vi.stubGlobal('document', {
      body,
      documentElement: root,
      getElementById: vi.fn(() => appRoot),
    });

    applyAppTheme('dark');

    expect(root.classes).toEqual(['dark']);
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.resolvedTheme).toBe('dark');
    expect(body.classes).toEqual(['dark']);
    expect(body.dataset.theme).toBe('dark');
    expect(appRoot.classes).toEqual(['dark']);
    expect(appRoot.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');

    applyAppTheme('light');

    expect(root.classes).toEqual(['light']);
    expect(root.dataset.theme).toBe('light');
    expect(root.dataset.resolvedTheme).toBe('light');
    expect(body.classes).toEqual(['light']);
    expect(body.dataset.theme).toBe('light');
    expect(appRoot.classes).toEqual(['light']);
    expect(appRoot.dataset.theme).toBe('light');
    expect(root.style.colorScheme).toBe('light');
  });

  it('advances the theme revision when a theme is applied', () => {
    const root = createThemeElement();
    const revisionBefore = getAppThemeRevision();

    vi.stubGlobal('document', {
      body: createThemeElement(),
      documentElement: root,
      getElementById: vi.fn(() => createThemeElement()),
    });

    applyAppTheme('light');

    expect(getAppThemeRevision()).toBeGreaterThan(revisionBefore);
  });

  it('resolves the system theme from media preference', () => {
    const root = createThemeElement();

    vi.stubGlobal('document', {
      body: createThemeElement(),
      documentElement: root,
      getElementById: vi.fn(() => createThemeElement()),
    });
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    });

    applyAppTheme('system');

    expect(root.classes).toEqual(['dark']);
    expect(root.dataset.theme).toBe('system');
    expect(root.style.colorScheme).toBe('dark');
  });
});

function createThemeElement(initialClasses: string[] = []) {
  const classes = new Set<string>();

  for (const className of initialClasses) {
    classes.add(className);
  }

  return {
    classList: {
      add: (...values: string[]) => {
        for (const value of values) {
          classes.add(value);
        }
      },
      remove: (...values: string[]) => {
        for (const value of values) {
          classes.delete(value);
        }
      },
    },
    dataset: {} as Record<string, string>,
    get classes() {
      return Array.from(classes);
    },
    style: {
      colorScheme: '',
    },
  };
}
