declare global {
  interface Window {
    __hpMessagePerfInstalled?: boolean;
  }
}

export function installDevMessagePerf() {
  if (!import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;
  const search = new URLSearchParams(window.location.search);
  if (search.get('debug') !== '1') return;
  if (window.__hpMessagePerfInstalled) return;
  window.__hpMessagePerfInstalled = true;

  const originalAdd = window.addEventListener.bind(window);
  const originalRemove = window.removeEventListener.bind(window);
  const wrappedMap = new WeakMap<EventListenerOrEventListenerObject, EventListener>();

  window.addEventListener = ((type: string, listener: any, options?: any) => {
    if (type !== 'message' || !listener) {
      return originalAdd(type as any, listener as any, options as any);
    }

    if (wrappedMap.has(listener)) {
      return originalAdd(type as any, wrappedMap.get(listener) as any, options as any);
    }

    const wrapped: EventListener = (event: Event) => {
      const start = performance.now();
      if (typeof listener === 'function') {
        listener(event);
      } else if (listener && typeof listener.handleEvent === 'function') {
        listener.handleEvent(event);
      }
      const duration = performance.now() - start;
      if (duration > 32) {
        // eslint-disable-next-line no-console
        console.warn('[debug/message] slow message handler', {
          duration_ms: Number(duration.toFixed(1)),
          listener_name: listener?.name || 'anonymous',
          stack: new Error().stack,
        });
      }
    };
    wrappedMap.set(listener, wrapped);
    return originalAdd(type as any, wrapped as any, options as any);
  }) as typeof window.addEventListener;

  window.removeEventListener = ((type: string, listener: any, options?: any) => {
    if (type !== 'message' || !listener) {
      return originalRemove(type as any, listener as any, options as any);
    }
    const wrapped = wrappedMap.get(listener);
    return originalRemove(type as any, (wrapped || listener) as any, options as any);
  }) as typeof window.removeEventListener;

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) {
            // eslint-disable-next-line no-console
            console.warn('[debug/longtask]', {
              duration_ms: Number(entry.duration.toFixed(1)),
              start_ms: Number(entry.startTime.toFixed(1)),
              name: entry.name,
            });
          }
        });
      });
      observer.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
    } catch {
      // Optional instrumentation only.
    }
  }
}
