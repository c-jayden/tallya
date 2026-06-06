import type { AppTheme } from './app-settings-repository';

const appThemeClasses = ['light', 'dark'];
let appThemeRevision = 0;
let currentAppTheme: AppTheme = 'system';
let systemThemeQuery: MediaQueryList | null = null;
let removeSystemThemeListener: (() => void) | null = null;

export function getAppThemeRevision() {
  return appThemeRevision;
}

export function applyAppTheme(theme: AppTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  currentAppTheme = theme;
  appThemeRevision += 1;
  applyResolvedAppTheme(theme, resolveAppTheme(theme));
  syncSystemThemeListener(theme);
}

function applyResolvedAppTheme(theme: AppTheme, resolvedTheme: 'light' | 'dark') {
  const root = document.documentElement;
  const themeHosts = [root, document.body, document.getElementById('root')].filter(
    (element): element is HTMLElement => Boolean(element),
  );

  for (const element of themeHosts) {
    element.classList.remove(...appThemeClasses);
    element.classList.add(resolvedTheme);
    element.dataset.theme = theme;
    element.dataset.resolvedTheme = resolvedTheme;
  }

  root.style.colorScheme = resolvedTheme;
}

function resolveAppTheme(theme: AppTheme) {
  if (theme !== 'system') {
    return theme;
  }

  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncSystemThemeListener(theme: AppTheme) {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return;
  }

  if (!systemThemeQuery) {
    systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  }

  if (theme === 'system') {
    if (!removeSystemThemeListener) {
      removeSystemThemeListener = addSystemThemeListener(systemThemeQuery);
    }

    return;
  }

  removeSystemThemeListener?.();
  removeSystemThemeListener = null;
}

function addSystemThemeListener(query: MediaQueryList) {
  const handleSystemThemeChange = () => {
    if (currentAppTheme === 'system') {
      appThemeRevision += 1;
      applyResolvedAppTheme('system', resolveAppTheme('system'));
    }
  };

  if (query.addEventListener) {
    query.addEventListener('change', handleSystemThemeChange);

    return () => query.removeEventListener('change', handleSystemThemeChange);
  }

  if (query.addListener) {
    query.addListener(handleSystemThemeChange);

    return () => query.removeListener(handleSystemThemeChange);
  }

  return () => undefined;
}
