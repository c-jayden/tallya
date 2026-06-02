import { useEffect, useRef } from 'react';
import { resizeHomeWindowToContent } from '../window-sizing';

export function useHomeWindowSizing() {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const contentElement = contentRef.current;

    if (!contentElement || typeof ResizeObserver === 'undefined') {
      void resizeHomeWindowToContent(contentElement);
      return;
    }

    let animationFrameId = 0;
    const scheduleResize = () => {
      // Batch resize work to the next frame so textarea focus rings and dynamic
      // status content do not trigger multiple Tauri window measurements.
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        void resizeHomeWindowToContent(contentElement);
      });
    };
    const resizeObserver = new ResizeObserver(scheduleResize);

    resizeObserver.observe(contentElement);
    scheduleResize();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []);

  return contentRef;
}
