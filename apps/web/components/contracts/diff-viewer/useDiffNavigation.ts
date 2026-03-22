import { useState, useCallback, useEffect, useMemo } from 'react';
import type { DiffSegment } from '@/lib/api-client';
import type { DiffFilter } from './types';

interface UseDiffNavigationProps {
  segments: DiffSegment[];
  onNavigate: (segment: DiffSegment) => void;
}

export function useDiffNavigation({ segments, onNavigate }: UseDiffNavigationProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filter, setFilter] = useState<DiffFilter>('all');

  const filteredSegments = useMemo(() => {
    if (filter === 'all') return segments;
    return segments.filter((s) => s.type === filter);
  }, [segments, filter]);

  const navigateTo = useCallback(
    (index: number) => {
      if (filteredSegments.length === 0) return;
      const clamped = ((index % filteredSegments.length) + filteredSegments.length) % filteredSegments.length;
      setActiveIndex(clamped);
      onNavigate(filteredSegments[clamped]);
    },
    [filteredSegments, onNavigate]
  );

  const next = useCallback(() => navigateTo(activeIndex + 1), [activeIndex, navigateTo]);
  const prev = useCallback(() => navigateTo(activeIndex - 1), [activeIndex, navigateTo]);

  const changeFilter = useCallback(
    (newFilter: DiffFilter) => {
      setFilter(newFilter);
      setActiveIndex(-1);
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      switch (e.key) {
        case 'k':
        case 'ArrowDown':
          e.preventDefault();
          next();
          break;
        case 'j':
        case 'ArrowUp':
          e.preventDefault();
          prev();
          break;
        case '1':
          e.preventDefault();
          changeFilter('all');
          break;
        case '2':
          e.preventDefault();
          changeFilter('added');
          break;
        case '3':
          e.preventDefault();
          changeFilter('deleted');
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [next, prev, changeFilter]);

  const activeSegment = activeIndex >= 0 && activeIndex < filteredSegments.length
    ? filteredSegments[activeIndex]
    : null;

  return {
    activeIndex,
    activeSegment,
    filter,
    filteredSegments,
    totalFiltered: filteredSegments.length,
    next,
    prev,
    changeFilter,
  };
}
