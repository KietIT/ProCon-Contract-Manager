import { useRef, useCallback, useState, useEffect } from 'react';

interface UseScrollSyncProps {
  enabled: boolean;
}

export function useScrollSync({ enabled }: UseScrollSyncProps) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const [syncEnabled, setSyncEnabled] = useState(enabled);

  const handleScroll = useCallback(
    (source: 'left' | 'right') => {
      if (!syncEnabled || isScrollingRef.current) return;

      const sourceEl = source === 'left' ? leftRef.current : rightRef.current;
      const targetEl = source === 'left' ? rightRef.current : leftRef.current;

      if (!sourceEl || !targetEl) return;

      isScrollingRef.current = true;

      const sourceMaxScroll = sourceEl.scrollHeight - sourceEl.clientHeight;
      const targetMaxScroll = targetEl.scrollHeight - targetEl.clientHeight;

      if (sourceMaxScroll > 0 && targetMaxScroll > 0) {
        const scrollRatio = sourceEl.scrollTop / sourceMaxScroll;
        targetEl.scrollTop = scrollRatio * targetMaxScroll;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isScrollingRef.current = false;
        });
      });
    },
    [syncEnabled]
  );

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;

    if (!left || !right || !syncEnabled) return;

    const onLeftScroll = () => handleScroll('left');
    const onRightScroll = () => handleScroll('right');

    left.addEventListener('scroll', onLeftScroll, { passive: true });
    right.addEventListener('scroll', onRightScroll, { passive: true });

    return () => {
      left.removeEventListener('scroll', onLeftScroll);
      right.removeEventListener('scroll', onRightScroll);
    };
  }, [syncEnabled, handleScroll]);

  const toggleSync = useCallback(() => {
    setSyncEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 's') {
        e.preventDefault();
        toggleSync();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSync]);

  return {
    leftRef,
    rightRef,
    syncEnabled,
    toggleSync,
  };
}
