'use client';

import { useState, useEffect, useRef, useCallback, useMemo, forwardRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, FileText } from 'lucide-react';
import type { DiffSegment, DiffSegmentType } from '@/lib/api-client';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DiffPdfPanelProps {
  fileUrl: string;
  label: string;
  side: 'old' | 'new';
  segments: DiffSegment[];
  activeSegmentId: string | null;
  scale: number;
}

const HIGHLIGHT_STYLES: Record<DiffSegmentType, { bg: string; border: string; extra?: string }> = {
  added: {
    bg: 'rgba(34, 197, 94, 0.25)',
    border: '3px solid #22c55e',
  },
  deleted: {
    bg: 'rgba(239, 68, 68, 0.25)',
    border: '3px solid #ef4444',
    extra: 'line-through',
  },
  modified: {
    bg: 'rgba(250, 204, 21, 0.3)',
    border: '3px solid #eab308',
  },
};

const ACTIVE_SHADOW: Record<DiffSegmentType, string> = {
  added: '0 0 0 2px #16a34a',
  deleted: '0 0 0 2px #dc2626',
  modified: '0 0 0 2px #ca8a04',
};

const DiffPdfPanel = forwardRef<HTMLDivElement, DiffPdfPanelProps>(
  function DiffPdfPanel({ fileUrl, label, side, segments, activeSegmentId, scale }, scrollRef) {
    const [numPages, setNumPages] = useState(0);
    const [visiblePage, setVisiblePage] = useState(1);
    const [containerWidth, setContainerWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

    const sideSegments = useMemo(() => {
      return segments.filter((s) => {
        if (side === 'old') return s.type === 'deleted' || s.type === 'modified';
        return s.type === 'added' || s.type === 'modified';
      });
    }, [segments, side]);

    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver((entries) => {
        setContainerWidth(entries[0].contentRect.width);
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const scrollEl = (scrollRef as React.RefObject<HTMLDivElement>)?.current;
      if (numPages === 0 || !scrollEl) return;

      const observer = new IntersectionObserver(
        (entries) => {
          let maxRatio = 0;
          let maxPage = visiblePage;
          for (const entry of entries) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '1', 10);
            if (entry.intersectionRatio > maxRatio) {
              maxRatio = entry.intersectionRatio;
              maxPage = pageNum;
            }
          }
          if (maxRatio > 0) setVisiblePage(maxPage);
        },
        { root: scrollEl, threshold: [0, 0.25, 0.5, 0.75, 1] }
      );

      for (const el of pageRefs.current) {
        if (el) observer.observe(el);
      }
      return () => observer.disconnect();
    }, [numPages, scrollRef, visiblePage]);

    const applyHighlightsOnPage = useCallback(
      (pageNum: number) => {
        const pageDiv = pageRefs.current[pageNum - 1];
        if (!pageDiv) return;

        const textLayer = pageDiv.querySelector('.react-pdf__Page__textContent');
        if (!textLayer) return;

        textLayer.querySelectorAll('[data-diff-hl]').forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.backgroundColor = '';
          htmlEl.style.borderLeft = '';
          htmlEl.style.boxShadow = '';
          htmlEl.style.textDecoration = '';
          htmlEl.removeAttribute('data-diff-hl');
        });

        const spans = Array.from(textLayer.querySelectorAll('span'));
        if (!spans.length) return;

        let fullText = '';
        const spanMap: { start: number; end: number; el: HTMLElement }[] = [];
        for (const span of spans) {
          const text = span.textContent || '';
          spanMap.push({ start: fullText.length, end: fullText.length + text.length, el: span as HTMLElement });
          fullText += text + ' ';
        }

        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const fullNorm = normalize(fullText);

        for (const seg of sideSegments) {
          const segPage = side === 'old' ? seg.oldPage : seg.newPage;
          if (segPage !== pageNum) continue;

          const segText = side === 'old' ? seg.oldText : seg.newText;
          if (!segText) continue;

          const segNorm = normalize(segText);
          // Strategy 1: exact full match
          let matchIdx = fullNorm.indexOf(segNorm);

          // Strategy 2: prefix match (30 chars)
          if (matchIdx === -1 && segNorm.length > 30) {
            matchIdx = fullNorm.indexOf(segNorm.slice(0, 30));
          }

          // Strategy 3: suffix match (30 chars)
          if (matchIdx === -1 && segNorm.length > 30) {
            const suffixIdx = fullNorm.indexOf(segNorm.slice(-30));
            if (suffixIdx !== -1) {
              matchIdx = Math.max(0, suffixIdx - segNorm.length + 30);
            }
          }

          // Strategy 4: word-based match for short segments
          if (matchIdx === -1 && segNorm.length > 3 && segNorm.length <= 60) {
            const words = segNorm.split(/\s+/).filter(w => w.length > 2);
            if (words.length >= 1) {
              const keyword = words.reduce((a, b) => a.length >= b.length ? a : b);
              const kwIdx = fullNorm.indexOf(keyword);
              if (kwIdx !== -1) {
                matchIdx = Math.max(0, kwIdx - Math.floor(segNorm.length / 2));
              }
            }
          }

          if (matchIdx === -1) continue;

          const matchEnd = matchIdx + segNorm.length;
          const style = HIGHLIGHT_STYLES[seg.type];
          const isActive = seg.id === activeSegmentId;

          let firstHighlighted = false;

          for (const { start, end, el } of spanMap) {
            if (end > matchIdx && start < matchEnd) {
              el.style.backgroundColor = style.bg;
              el.style.borderLeft = style.border;
              if (style.extra) {
                el.style.textDecoration = style.extra;
                el.style.textDecorationColor = 'rgba(239, 68, 68, 0.5)';
              }
              if (isActive) {
                el.style.boxShadow = ACTIVE_SHADOW[seg.type];
              }
              el.setAttribute('data-diff-hl', seg.id);

              if (isActive && !firstHighlighted) {
                firstHighlighted = true;
                setTimeout(() => {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }
            }
          }
        }
      },
      [sideSegments, activeSegmentId, side]
    );

    useEffect(() => {
      if (numPages === 0) return;
      const timer = setTimeout(() => {
        for (let p = 1; p <= numPages; p++) {
          applyHighlightsOnPage(p);
        }
      }, 200);
      return () => clearTimeout(timer);
    }, [activeSegmentId, numPages, applyHighlightsOnPage]);

    function onDocumentLoadSuccess(pdf: { numPages: number }) {
      setNumPages(pdf.numPages);
      pageRefs.current = new Array(pdf.numPages).fill(null);
    }

    const pageWidth = containerWidth > 0 ? Math.min(containerWidth - 32, 800) * scale : undefined;
    const pageNumbers = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

    return (
      <div ref={containerRef} className="flex flex-col h-full min-w-0" aria-label={`${side === 'old' ? 'Old' : 'New'} version`}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-app-border bg-sidebar-alt shrink-0">
          <span className="text-xs font-semibold text-app-text truncate">{label}</span>
          <span className="text-xs text-app-text-muted">
            {numPages > 0 ? `Page ${visiblePage} of ${numPages}` : ''}
          </span>
        </div>

        <div
          ref={scrollRef as React.RefObject<HTMLDivElement>}
          className="flex-1 overflow-auto"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          <div className="flex flex-col items-center py-4 px-2 gap-3">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 text-accent-cyan animate-spin mb-3" />
                  <p className="text-xs text-app-text-muted">Loading PDF...</p>
                </div>
              }
              noData={
                <div className="flex flex-col items-center justify-center py-20">
                  <FileText className="w-8 h-8 text-app-text-muted mb-2" />
                  <p className="text-xs text-app-text-muted">No document</p>
                </div>
              }
            >
              {pageNumbers.map((pageNum) => (
                <div
                  key={pageNum}
                  ref={(el) => { pageRefs.current[pageNum - 1] = el; }}
                  data-page={pageNum}
                  className="mb-3 last:mb-0 shadow-lg rounded overflow-hidden bg-white"
                >
                  <Page
                    pageNumber={pageNum}
                    width={pageWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    onRenderTextLayerSuccess={() => applyHighlightsOnPage(pageNum)}
                    loading={
                      <div className="flex items-center justify-center py-24 px-16">
                        <Loader2 className="w-5 h-5 text-accent-cyan animate-spin" />
                      </div>
                    }
                  />
                </div>
              ))}
            </Document>
          </div>
        </div>
      </div>
    );
  }
);

export default DiffPdfPanel;
