import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

const HOME_WINDOW_WIDTH = 720;
// Floor sits just below the empty-state natural height (toolbar + hero +
// composer + empty hint ≈ 393px) so a short day fits snugly instead of leaving
// a blank band; the window still grows with the feed up to the max.
const HOME_MIN_HEIGHT = 360;
const HOME_MAX_HEIGHT = 700;
// Dialogs/popovers (settings, report generate, date picker) need vertical room
// the content-hugging home height doesn't provide, so overlays temporarily grow
// the window to this height.
const HOME_OVERLAY_HEIGHT = 600;
const MANUAL_RESIZE_TOLERANCE = 16;
const RESIZE_ANIMATION_MS = 160;

let lastAutoHeight: number | null = null;
// Bumped whenever a new sizing op starts so an in-flight tween cancels itself.
let resizeToken = 0;

function clampHeight(height: number) {
  return Math.min(Math.max(height, HOME_MIN_HEIGHT), HOME_MAX_HEIGHT);
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

type AppWindow = ReturnType<typeof getCurrentWindow>;

// Tween the window height over a few frames so overlay open/close reads as a
// smooth grow/shrink rather than a jump. A newer sizing op supersedes this one.
function tweenWindowHeight(appWindow: AppWindow, fromHeight: number, toHeight: number) {
  resizeToken += 1;
  const token = resizeToken;
  const start = performance.now();

  return new Promise<void>((resolve) => {
    const step = (now: number) => {
      if (token !== resizeToken) {
        resolve();
        return;
      }

      const progress = Math.min(1, (now - start) / RESIZE_ANIMATION_MS);
      const height = Math.round(fromHeight + (toHeight - fromHeight) * easeInOutQuad(progress));
      void appWindow.setSize(new LogicalSize(HOME_WINDOW_WIDTH, height));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}

async function applyHeight(
  appWindow: AppWindow,
  fromHeight: number,
  toHeight: number,
  animate: boolean,
) {
  if (animate && Math.abs(toHeight - fromHeight) > 2) {
    await tweenWindowHeight(appWindow, fromHeight, toHeight);
    return;
  }

  // Instant path also bumps the token so it cancels any running tween.
  resizeToken += 1;
  await appWindow.setSize(new LogicalSize(HOME_WINDOW_WIDTH, toHeight));
}

// Grow the window so an open overlay (and any popover inside it) isn't clipped
// by the short, content-hugging home window. No-op if already tall enough.
export async function ensureHomeWindowHeightForOverlay() {
  try {
    const appWindow = getCurrentWindow();
    const [innerSize, scaleFactor] = await Promise.all([
      appWindow.innerSize(),
      appWindow.scaleFactor(),
    ]);
    const currentHeight = innerSize.toLogical(scaleFactor).height;

    if (currentHeight >= HOME_OVERLAY_HEIGHT - 1) {
      return;
    }

    await applyHeight(appWindow, currentHeight, HOME_OVERLAY_HEIGHT, true);
    lastAutoHeight = HOME_OVERLAY_HEIGHT;
  } catch (error) {
    console.warn('Failed to expand home window for overlay', error);
  }
}

type ResizeOptions = {
  // Overlay-close refits animate; the content observer resizes instantly so
  // typing/feed growth stays snappy.
  animate?: boolean;
};

export async function resizeHomeWindowToContent(
  contentElement: HTMLElement | null,
  { animate = false }: ResizeOptions = {},
) {
  if (!contentElement) {
    return;
  }

  try {
    const appWindow = getCurrentWindow();
    const [innerSize, scaleFactor] = await Promise.all([
      appWindow.innerSize(),
      appWindow.scaleFactor(),
    ]);
    const currentSize = innerSize.toLogical(scaleFactor);
    const containerElement = contentElement.parentElement;
    const containerStyle = containerElement ? window.getComputedStyle(containerElement) : null;
    const containerVerticalPadding = containerStyle
      ? Number.parseFloat(containerStyle.paddingTop) +
        Number.parseFloat(containerStyle.paddingBottom)
      : 0;
    const measuredContentHeight =
      Math.max(contentElement.scrollHeight, contentElement.getBoundingClientRect().height) +
      containerVerticalPadding;
    const scrollContainerHeight = containerElement?.scrollHeight ?? 0;
    const contentHeight = Math.ceil(Math.max(measuredContentHeight, scrollContainerHeight));
    const targetViewportHeight = clampHeight(contentHeight);
    const viewportHeight =
      Number.isFinite(window.innerHeight) && window.innerHeight > 0
        ? window.innerHeight
        : currentSize.height;
    const targetHeight = Math.ceil(
      currentSize.height + (targetViewportHeight - viewportHeight),
    );

    if (
      lastAutoHeight !== null &&
      currentSize.height > Math.max(lastAutoHeight, targetHeight) + MANUAL_RESIZE_TOLERANCE
    ) {
      return;
    }

    if (Math.abs(currentSize.height - targetHeight) < 2) {
      lastAutoHeight = targetHeight;
      return;
    }

    await applyHeight(appWindow, currentSize.height, targetHeight, animate);
    lastAutoHeight = targetHeight;
  } catch (error) {
    console.warn('Failed to resize home window from content', error);
  }
}
