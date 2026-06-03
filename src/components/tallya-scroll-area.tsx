import type { CSSProperties, ReactNode } from 'react';
import type { PartialOptions } from 'overlayscrollbars';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { cn } from '@/lib/utils';

type TallyaScrollAreaProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  height?: CSSProperties['height'];
  maxHeight?: CSSProperties['maxHeight'];
};

const tallyaScrollOptions: PartialOptions = {
  overflow: {
    x: 'hidden',
    y: 'scroll',
  },
  scrollbars: {
    theme: 'os-theme-tallya',
    autoHide: 'leave',
    autoHideDelay: 400,
    autoHideSuspend: false,
    dragScroll: true,
    clickScroll: false,
  },
};

export function TallyaScrollArea({
  children,
  className,
  style,
  height,
  maxHeight,
}: TallyaScrollAreaProps) {
  const resolvedStyle = {
    ...style,
    ...(height !== undefined ? { height } : {}),
    ...(maxHeight !== undefined ? { maxHeight } : {}),
  };

  return (
    <OverlayScrollbarsComponent
      defer
      options={tallyaScrollOptions}
      className={cn('tallya-scroll-area', className)}
      style={resolvedStyle}
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}
