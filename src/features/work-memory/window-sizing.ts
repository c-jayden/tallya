import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

const HOME_WINDOW_WIDTH = 720;
// Floor sits just below the empty-state natural height (toolbar + hero +
// composer + empty hint ≈ 393px) so a short day fits snugly instead of leaving
// a blank band; the window still grows with the feed up to the max.
const HOME_MIN_HEIGHT = 360;
const HOME_MAX_HEIGHT = 700;
const MANUAL_RESIZE_TOLERANCE = 16;

let lastAutoHeight: number | null = null;

function clampHeight(height: number) {
  return Math.min(Math.max(height, HOME_MIN_HEIGHT), HOME_MAX_HEIGHT);
}

export async function resizeHomeWindowToContent(contentElement: HTMLElement | null) {
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

    await appWindow.setSize(new LogicalSize(HOME_WINDOW_WIDTH, targetHeight));
    lastAutoHeight = targetHeight;
  } catch (error) {
    console.warn('Failed to resize home window from content', error);
  }
}
