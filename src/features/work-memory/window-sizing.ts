import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

const HOME_WINDOW_WIDTH = 720;
const HOME_MIN_HEIGHT = 542;
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
    const [innerSize, outerSize, scaleFactor] = await Promise.all([
      appWindow.innerSize(),
      appWindow.outerSize(),
      appWindow.scaleFactor(),
    ]);
    const currentInnerSize = innerSize.toLogical(scaleFactor);
    const currentOuterSize = outerSize.toLogical(scaleFactor);
    const chromeHeight = Math.max(0, currentOuterSize.height - currentInnerSize.height);
    const containerElement = contentElement.parentElement;
    const containerStyle = containerElement ? window.getComputedStyle(containerElement) : null;
    const containerVerticalPadding = containerStyle
      ? Number.parseFloat(containerStyle.paddingTop) +
        Number.parseFloat(containerStyle.paddingBottom)
      : 0;
    const contentHeight = Math.ceil(
      Math.max(contentElement.scrollHeight, contentElement.getBoundingClientRect().height) +
        containerVerticalPadding,
    );
    const targetHeight = clampHeight(contentHeight + chromeHeight);

    if (
      lastAutoHeight !== null &&
      currentOuterSize.height > Math.max(lastAutoHeight, targetHeight) + MANUAL_RESIZE_TOLERANCE
    ) {
      return;
    }

    if (Math.abs(currentOuterSize.height - targetHeight) < 2) {
      lastAutoHeight = targetHeight;
      return;
    }

    await appWindow.setSize(
      new LogicalSize(currentOuterSize.width || HOME_WINDOW_WIDTH, targetHeight),
    );
    lastAutoHeight = targetHeight;
  } catch (error) {
    console.warn('Failed to resize home window from content', error);
  }
}
