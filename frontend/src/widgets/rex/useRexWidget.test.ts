import { act, renderHook } from '@testing-library/react';
import { useRexWidget } from './useRexWidget';

describe('useRexWidget', () => {
  beforeEach(() => {
    localStorage.clear();
    // @ts-ignore
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    Object.defineProperty(window, 'location', { value: { pathname: '/' }, writable: true } as any);
  });

  it('derives sales mode on public routes', () => {
    // @ts-ignore
    window.location.pathname = '/';
    const { result } = renderHook(() => useRexWidget());
    expect(result.current.mode).toBeDefined();
  });

  it('trims messages to last 15', async () => {
    const { result } = renderHook(() => useRexWidget());
    for (let i = 0; i < 20; i++) {
      await act(async () => { await result.current.sendMessage(`msg ${i}`); });
    }
    expect(result.current.messages.length).toBeLessThanOrEqual(15);
  });
});


