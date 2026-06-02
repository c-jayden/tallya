import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

const HOME_WINDOW_WIDTH = 720;
const HOME_MIN_HEIGHT = 542;
const HOME_MAX_HEIGHT = 700;
const HOME_VERTICAL_PADDING = 16;
const USER_RESIZE_TOLERANCE = 80;

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
    const contentHeight = Math.ceil(contentElement.scrollHeight + HOME_VERTICAL_PADDING);
    const targetHeight = clampHeight(contentHeight + chromeHeight);

    if (currentOuterSize.height > targetHeight + USER_RESIZE_TOLERANCE) {
      return;
    }

    if (Math.abs(currentOuterSize.height - targetHeight) < 2) {
      return;
    }

    await appWindow.setSize(
      new LogicalSize(currentOuterSize.width || HOME_WINDOW_WIDTH, targetHeight),
    );
  } catch (error) {
    console.warn('Failed to resize home window from content', error);
  }
}
