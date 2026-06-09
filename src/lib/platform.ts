type PlatformSource = {
  platform?: string;
  userAgent?: string;
};

export function isMacPlatform(source: PlatformSource = getBrowserPlatformSource()) {
  const platform = source.platform ?? '';
  const userAgent = source.userAgent ?? '';

  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac|iPhone|iPad|iPod/i.test(userAgent);
}

export function getShortcutModifierLabel(source?: PlatformSource) {
  return isMacPlatform(source) ? '⌘' : 'Ctrl';
}

export function getCommandKeyLabel(source?: PlatformSource) {
  return isMacPlatform(source) ? 'Cmd' : 'Ctrl';
}

function getBrowserPlatformSource(): PlatformSource {
  if (typeof navigator === 'undefined') {
    return {};
  }

  return {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  };
}
