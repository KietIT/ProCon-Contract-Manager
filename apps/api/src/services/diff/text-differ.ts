import { diffWords } from 'diff';
import type { PageTextInfo } from '../ai/file-extractor';

export interface DiffSegment {
  id: string;
  type: 'added' | 'deleted' | 'modified';
  oldText?: string;
  newText?: string;
  oldPage?: number;
  newPage?: number;
  oldOffset?: number;
  newOffset?: number;
  oldLength?: number;
  newLength?: number;
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  modifications: number;
}

interface TextWithPages {
  text: string;
  pages: PageTextInfo[];
}

interface DiffResult {
  segments: DiffSegment[];
  summary: DiffSummary;
}

/**
 * Normalize text for diffing: collapse whitespace, remove invisible characters,
 * standardize line endings. This eliminates false-positive diffs caused by
 * non-deterministic PDF text extraction.
 */
function normalizeForDiff(text: string): string {
  return text
    .replace(/\r\n/g, '\n')                 // Normalize line endings
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Remove zero-width chars
    .replace(/\u00A0/g, ' ')                // Non-breaking space → regular space
    .replace(/[ \t]+/g, ' ')                // Collapse horizontal whitespace
    .replace(/ *\n */g, '\n')               // Trim spaces around newlines
    .replace(/\n{3,}/g, '\n\n')             // Collapse multiple blank lines
    .trim();
}

/**
 * Normalize text and rebuild page offset arrays so findPage() still works
 * correctly with the normalized text positions.
 */
function normalizeWithPages(text: string, pages: PageTextInfo[]): TextWithPages {
  const normText = normalizeForDiff(text);

  // Rebuild page boundaries by normalizing each page's text and finding
  // their positions in the full normalized text
  const normPages: PageTextInfo[] = [];
  let searchFrom = 0;
  for (const page of pages) {
    const normPageText = normalizeForDiff(page.text);
    if (normPageText.length === 0) continue;
    const idx = normText.indexOf(normPageText, searchFrom);
    normPages.push({
      pageNum: page.pageNum,
      text: normPageText,
      startOffset: idx >= 0 ? idx : searchFrom,
    });
    if (idx >= 0) searchFrom = idx + normPageText.length;
  }

  return { text: normText, pages: normPages.length > 0 ? normPages : pages };
}

function findPage(pages: PageTextInfo[], offset: number): number {
  for (let i = pages.length - 1; i >= 0; i--) {
    if (offset >= pages[i].startOffset) {
      return pages[i].pageNum;
    }
  }
  return pages.length > 0 ? pages[0].pageNum : 1;
}

export function computeTextDiff(oldDoc: TextWithPages, newDoc: TextWithPages): DiffResult {
  // Normalize texts to eliminate false-positive diffs from PDF extraction inconsistencies
  const normOld = normalizeWithPages(oldDoc.text, oldDoc.pages);
  const normNew = normalizeWithPages(newDoc.text, newDoc.pages);

  const changes = diffWords(normOld.text, normNew.text);

  const segments: DiffSegment[] = [];
  let oldOffset = 0;
  let newOffset = 0;
  let segId = 0;

  let pendingRemoved: { value: string; added?: boolean; removed?: boolean } | null = null;

  for (const change of changes) {
    if (change.removed) {
      if (pendingRemoved) {
        segments.push({
          id: `d${segId++}`,
          type: 'deleted',
          oldText: pendingRemoved.value,
          oldPage: findPage(normOld.pages, oldOffset - pendingRemoved.value.length),
          oldOffset: oldOffset - pendingRemoved.value.length,
          oldLength: pendingRemoved.value.length,
        });
      }
      pendingRemoved = change;
      oldOffset += change.value.length;
      continue;
    }

    if (change.added) {
      if (pendingRemoved) {
        segments.push({
          id: `d${segId++}`,
          type: 'modified',
          oldText: pendingRemoved.value,
          newText: change.value,
          oldPage: findPage(normOld.pages, oldOffset - pendingRemoved.value.length),
          newPage: findPage(normNew.pages, newOffset),
          oldOffset: oldOffset - pendingRemoved.value.length,
          newOffset: newOffset,
          oldLength: pendingRemoved.value.length,
          newLength: change.value.length,
        });
        pendingRemoved = null;
      } else {
        segments.push({
          id: `d${segId++}`,
          type: 'added',
          newText: change.value,
          newPage: findPage(normNew.pages, newOffset),
          newOffset: newOffset,
          newLength: change.value.length,
        });
      }
      newOffset += change.value.length;
      continue;
    }

    // Unchanged text
    if (pendingRemoved) {
      segments.push({
        id: `d${segId++}`,
        type: 'deleted',
        oldText: pendingRemoved.value,
        oldPage: findPage(normOld.pages, oldOffset - pendingRemoved.value.length),
        oldOffset: oldOffset - pendingRemoved.value.length,
        oldLength: pendingRemoved.value.length,
      });
      pendingRemoved = null;
    }

    oldOffset += change.value.length;
    newOffset += change.value.length;
  }

  if (pendingRemoved) {
    segments.push({
      id: `d${segId++}`,
      type: 'deleted',
      oldText: pendingRemoved.value,
      oldPage: findPage(normOld.pages, oldOffset - pendingRemoved.value.length),
      oldOffset: oldOffset - pendingRemoved.value.length,
      oldLength: pendingRemoved.value.length,
    });
  }

  // Enhanced meaningful filter: reject empty segments AND modifications
  // where old/new text are equivalent after normalization (whitespace-only diffs)
  const meaningful = segments.filter((s) => {
    const oldText = (s.oldText || '').trim();
    const newText = (s.newText || '').trim();
    // Skip completely empty segments
    if (oldText.length === 0 && newText.length === 0) return false;
    // For modifications: skip if old and new are the same after normalization
    if (s.type === 'modified') {
      const normOldText = oldText.replace(/\s+/g, ' ').toLowerCase();
      const normNewText = newText.replace(/\s+/g, ' ').toLowerCase();
      if (normOldText === normNewText) return false;
    }
    return true;
  });

  const summary: DiffSummary = {
    additions: meaningful.filter((s) => s.type === 'added').length,
    deletions: meaningful.filter((s) => s.type === 'deleted').length,
    modifications: meaningful.filter((s) => s.type === 'modified').length,
  };

  return { segments: meaningful, summary };
}
