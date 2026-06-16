import { useEffect, useRef } from 'react';
import { registerTrayEventHandlers } from '../services/window-service';

type UseTrayWindowEventsOptions = {
  onFocusEntry: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onCheckUpdate: () => void;
  onWindowHidden?: () => void;
  onCloseBlocked?: () => void;
};

export function useTrayWindowEvents(options: UseTrayWindowEventsOptions) {
  const handlersRef = useRef(options);

  useEffect(() => {
    handlersRef.current = options;
  }, [options]);

  useEffect(() => {
    let isMounted = true;
    let dispose = () => {};

    void registerTrayEventHandlers({
      onFocusEntry: () => handlersRef.current.onFocusEntry(),
      onOpenSearch: () => handlersRef.current.onOpenSearch(),
      onOpenSettings: () => handlersRef.current.onOpenSettings(),
      onCheckUpdate: () => handlersRef.current.onCheckUpdate(),
      onWindowHidden: () => handlersRef.current.onWindowHidden?.(),
      onCloseBlocked: () => handlersRef.current.onCloseBlocked?.(),
    }).then((unlisten) => {
      if (isMounted) {
        dispose = unlisten;
      } else {
        unlisten();
      }
    });

    return () => {
      isMounted = false;
      dispose();
    };
  }, []);
}
