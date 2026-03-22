import type { DiffSegment, DiffSegmentType, DiffSummary } from '@/lib/api-client';

export type DiffFilter = 'all' | 'added' | 'deleted' | 'modified';

export interface DiffHighlight {
  segmentId: string;
  type: DiffSegmentType;
  page: number;
  offset: number;
  length: number;
  text: string;
  isActive: boolean;
}

export type { DiffSegment, DiffSegmentType, DiffSummary };
