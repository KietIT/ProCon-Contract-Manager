'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Loader2,
  AlertTriangle,
  FileText,
  Search,
  X,
  ExternalLink,
} from 'lucide-react';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  fileUrl: string;
  contractId?: string;
  highlightText?: string;
  searchLabel?: string;
  /** Server-provided page numbers where the match was found */
  pageHints?: number[];
  onClearSearch?: () => void;
}

const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export default function PdfViewer({
  fileUrl,
  contractId,
  highlightText,
  searchLabel,
  pageHints,
  onClearSearch,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [visiblePage, setVisiblePage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState(0);
  const [jumpInput, setJumpInput] = useState('1');

  // Highlight state — pages where match was found
  const [foundOnPages, setFoundOnPages] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const searchIdRef = useRef(0);
  const isUserScrolling = useRef(true);

  // ── Container width ──
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── IntersectionObserver: track which page is currently visible ──
  useEffect(() => {
    if (numPages === 0 || !scrollRef.current) return;

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
        if (maxRatio > 0) {
          setVisiblePage(maxPage);
          if (isUserScrolling.current) {
            setJumpInput(String(maxPage));
          }
        }
      },
      {
        root: scrollRef.current,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [numPages, visiblePage]);

  // ── Fullscreen ──
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ── Scroll to page ──
  const scrollToPage = useCallback((pageNum: number) => {
    const target = pageRefs.current[pageNum - 1];
    if (!target) return;
    isUserScrolling.current = false;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { isUserScrolling.current = true; }, 600);
  }, []);

  const handleJumpSubmit = useCallback(() => {
    const val = parseInt(jumpInput, 10);
    if (val >= 1 && val <= numPages) scrollToPage(val);
  }, [jumpInput, numPages, scrollToPage]);

  // ── Helper: extract text from a pdfjs page ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function extractPageText(pdf: any, pageNum: number): Promise<string> {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      return textContent.items
        .map((item: Record<string, unknown>) => ('str' in item ? item.str : ''))
        .join(' ');
    } catch {
      return '';
    }
  }

  // ── Search: use server pageHints when available, else fallback to client search ──
  useEffect(() => {
    if (!highlightText || !pdfReady || !pdfDocRef.current) return;

    const currentSearchId = ++searchIdRef.current;
    setSearching(true);
    setFoundOnPages([]);

    const searchNorm = normalize(highlightText);
    const pdf = pdfDocRef.current;

    (async () => {
      // Strategy 1: If server gave us pageHints, verify match on those pages using CLIENT pdfjs
      if (pageHints && pageHints.length > 0) {
        const verifiedPages: number[] = [];

        for (const pg of pageHints) {
          if (searchIdRef.current !== currentSearchId) return;
          if (pg < 1 || pg > pdf.numPages) continue;

          const pageText = await extractPageText(pdf, pg);
          const pageNorm = normalize(pageText);

          // Check if clause (or meaningful prefix) exists on this page
          const found = pageNorm.includes(searchNorm)
            || pageNorm.includes(searchNorm.slice(0, Math.min(120, searchNorm.length)))
            || pageNorm.includes(searchNorm.slice(0, Math.min(60, searchNorm.length)));

          if (found) verifiedPages.push(pg);
        }

        // Even if single-page search failed, for cross-page: try joining hinted pages
        if (verifiedPages.length === 0 && pageHints.length >= 2) {
          const texts: string[] = [];
          for (const pg of pageHints) {
            if (pg >= 1 && pg <= pdf.numPages) {
              texts.push(await extractPageText(pdf, pg));
            }
          }
          const joinedNorm = normalize(texts.join(' '));
          if (joinedNorm.includes(searchNorm) ||
              joinedNorm.includes(searchNorm.slice(0, Math.min(120, searchNorm.length)))) {
            // Clause spans these pages — mark all as found
            verifiedPages.push(...pageHints.filter(pg => pg >= 1 && pg <= pdf.numPages));
          }
        }

        if (verifiedPages.length > 0) {
          if (searchIdRef.current !== currentSearchId) return;
          setFoundOnPages(verifiedPages);
          setSearching(false);
          setTimeout(() => scrollToPage(verifiedPages[0]), 300);
          return;
        }
      }

      // Strategy 2: Fallback — scan all pages (no server hints or verification failed)
      const searchVariants = [
        searchNorm,
        searchNorm.slice(0, Math.min(120, searchNorm.length)),
        searchNorm.slice(0, Math.min(60, searchNorm.length)),
      ].filter((v, i, arr) => v.length > 10 && arr.indexOf(v) === i);

      // Single-page scan
      for (const variant of searchVariants) {
        for (let i = 1; i <= pdf.numPages; i++) {
          if (searchIdRef.current !== currentSearchId) return;
          const pageText = await extractPageText(pdf, i);
          if (normalize(pageText).includes(variant)) {
            setFoundOnPages([i]);
            setSearching(false);
            setTimeout(() => scrollToPage(i), 300);
            return;
          }
        }
      }

      // Cross-page fallback scan (adjacent pages)
      for (const variant of searchVariants) {
        for (let i = 1; i < pdf.numPages; i++) {
          if (searchIdRef.current !== currentSearchId) return;
          const t1 = await extractPageText(pdf, i);
          const t2 = await extractPageText(pdf, i + 1);
          if (normalize(t1 + ' ' + t2).includes(variant)) {
            setFoundOnPages([i, i + 1]);
            setSearching(false);
            setTimeout(() => scrollToPage(i), 300);
            return;
          }
        }
      }

      if (searchIdRef.current === currentSearchId) setSearching(false);
    })();
  }, [highlightText, pageHints, pdfReady, scrollToPage]);

  // ── Highlight text on a specific page's rendered text layer ──
  const applyHighlightOnPage = useCallback(
    (pageNum: number) => {
      const pageDiv = pageRefs.current[pageNum - 1];
      if (!pageDiv) return;

      const textLayer = pageDiv.querySelector('.react-pdf__Page__textContent');
      if (!textLayer) return;

      // Clear previous highlights
      textLayer.querySelectorAll('[data-src-hl]').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.backgroundColor = '';
        htmlEl.style.borderRadius = '';
        htmlEl.style.boxShadow = '';
        htmlEl.removeAttribute('data-src-hl');
      });

      if (!highlightText || !foundOnPages.includes(pageNum)) return;

      // Build text + span map from the RENDERED text layer (same pdfjs instance)
      const spans = Array.from(textLayer.querySelectorAll('span'));
      if (!spans.length) return;

      let fullText = '';
      const spanMap: { start: number; end: number; el: HTMLElement }[] = [];
      for (const span of spans) {
        const text = span.textContent || '';
        spanMap.push({ start: fullText.length, end: fullText.length + text.length, el: span as HTMLElement });
        fullText += text + ' ';
      }

      const searchNorm = normalize(highlightText);
      const fullNorm = normalize(fullText);

      // Progressive match: full → 120 → 60 chars
      const variants = [
        searchNorm,
        searchNorm.slice(0, Math.min(120, searchNorm.length)),
        searchNorm.slice(0, Math.min(60, searchNorm.length)),
      ].filter((v, i, arr) => v.length > 10 && arr.indexOf(v) === i);

      let matchIdx = -1;
      let matchEnd = -1;

      // For single-page match: search full clause in page text
      if (foundOnPages.length === 1) {
        for (const variant of variants) {
          // Find ALL positions where this variant matches, pick the best one
          const positions: number[] = [];
          let searchFrom = 0;
          while (searchFrom < fullNorm.length) {
            const idx = fullNorm.indexOf(variant, searchFrom);
            if (idx === -1) break;
            positions.push(idx);
            searchFrom = idx + 1;
          }

          if (positions.length === 0) continue;

          if (variant === searchNorm) {
            // Full clause matched — use first position, extend to full length
            matchIdx = positions[0];
            matchEnd = positions[0] + Math.min(searchNorm.length, fullNorm.length - positions[0]);
            break;
          }

          // Partial variant matched — pick position where surrounding text best matches full clause
          let bestPos = positions[0];
          let bestScore = 0;

          for (const pos of positions) {
            // Extract candidate text at this position with full clause length
            const candidateEnd = Math.min(pos + searchNorm.length, fullNorm.length);
            const candidate = fullNorm.slice(pos, candidateEnd);
            // Score: count matching chars between candidate and full search
            let score = 0;
            const compareLen = Math.min(candidate.length, searchNorm.length);
            for (let c = 0; c < compareLen; c++) {
              if (candidate[c] === searchNorm[c]) score++;
            }
            if (score > bestScore) {
              bestScore = score;
              bestPos = pos;
            }
          }

          matchIdx = bestPos;
          // Only extend to full clause length if the text at bestPos actually matches well
          const extendedEnd = Math.min(bestPos + searchNorm.length, fullNorm.length);
          const extendedCandidate = fullNorm.slice(bestPos, extendedEnd);
          const matchRatio = bestScore / Math.max(1, searchNorm.length);

          if (matchRatio >= 0.5) {
            // Good match — extend highlight to full clause length
            matchEnd = extendedEnd;
          } else {
            // Poor match — only highlight the matched variant portion
            matchEnd = bestPos + variant.length;
          }
          break;
        }
      } else if (foundOnPages.length >= 2) {
        // Cross-page: highlight whatever part of the clause appears on THIS page
        // Since both search and text layer use the SAME pdfjs instance, we can match directly
        const pageIndex = foundOnPages.indexOf(pageNum);

        if (pageIndex === 0) {
          // First page: find where clause starts, highlight to end of page
          // Use best-position strategy to avoid matching too early
          const anchor = searchNorm.slice(0, Math.min(60, searchNorm.length));
          let bestPos = -1;
          let bestScore = 0;
          let searchFrom = 0;
          while (searchFrom < fullNorm.length) {
            const idx = fullNorm.indexOf(anchor, searchFrom);
            if (idx === -1) break;
            // Score: how much of the clause after anchor also matches
            const candidateEnd = Math.min(idx + searchNorm.length, fullNorm.length);
            const candidate = fullNorm.slice(idx, candidateEnd);
            let score = 0;
            for (let c = 0; c < Math.min(candidate.length, searchNorm.length); c++) {
              if (candidate[c] === searchNorm[c]) score++;
            }
            if (score > bestScore) {
              bestScore = score;
              bestPos = idx;
            }
            searchFrom = idx + 1;
          }
          if (bestPos !== -1) {
            matchIdx = bestPos;
            matchEnd = fullNorm.length; // highlight to end of page
          }
        } else {
          // Subsequent pages: clause continues from the top
          // Find the longest prefix of remaining clause that matches start of this page
          // We search progressively shorter chunks of the clause at position 0 of page
          for (let len = Math.min(searchNorm.length, fullNorm.length); len >= 15; len = Math.floor(len * 0.7)) {
            const tail = searchNorm.slice(searchNorm.length - len);
            const idx = fullNorm.indexOf(tail.slice(0, Math.min(60, tail.length)));
            if (idx !== -1 && idx < 30) {
              // Found near start of page — highlight from here to end of matched portion
              matchIdx = idx;
              matchEnd = Math.min(idx + tail.length, fullNorm.length);
              break;
            }
          }

          // Fallback: just highlight beginning of page up to a reasonable length
          if (matchIdx === -1) {
            matchIdx = 0;
            matchEnd = Math.min(searchNorm.length / 2, fullNorm.length);
          }
        }
      }

      if (matchIdx === -1 || matchEnd <= matchIdx) return;

      let firstHighlighted = false;

      for (const { start, end, el } of spanMap) {
        if (end > matchIdx && start < matchEnd) {
          el.style.backgroundColor = 'rgba(250, 204, 21, 0.45)';
          el.style.borderRadius = '2px';
          el.style.boxShadow = '0 0 0 1px rgba(250, 204, 21, 0.3)';
          el.setAttribute('data-src-hl', '1');

          if (!firstHighlighted && foundOnPages[0] === pageNum) {
            firstHighlighted = true;
            setTimeout(() => {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
          }
        }
      }
    },
    [highlightText, foundOnPages]
  );

  // ── Re-apply highlight when foundOnPages changes (fixes race with text layer render) ──
  useEffect(() => {
    if (foundOnPages.length === 0) return;
    const timer = setTimeout(() => {
      for (const pageNum of foundOnPages) {
        applyHighlightOnPage(pageNum);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [foundOnPages, applyHighlightOnPage]);

  // ── Document callbacks ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onDocumentLoadSuccess(pdf: any) {
    setNumPages(pdf.numPages);
    setIsLoading(false);
    setLoadError(null);
    pdfDocRef.current = pdf;
    pageRefs.current = new Array(pdf.numPages).fill(null);
    setPdfReady(true);
  }

  function onDocumentLoadError(error: Error) {
    setLoadError(error.message || 'Failed to load PDF');
    setIsLoading(false);
  }

  // ── Controls ──
  const zoomIn = () => setScale((s) => Math.min(ZOOM_MAX, s + ZOOM_STEP));
  const zoomOut = () => setScale((s) => Math.max(ZOOM_MIN, s - ZOOM_STEP));
  const resetZoom = () => setScale(1.0);

  const pageWidth = containerWidth > 0 ? Math.min(containerWidth - 48, 900) * scale : undefined;

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages]
  );

  const foundPageDisplay = foundOnPages.length > 0
    ? foundOnPages.length === 1
      ? `page ${foundOnPages[0]}`
      : `pages ${foundOnPages[0]}–${foundOnPages[foundOnPages.length - 1]}`
    : null;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col rounded-2xl border border-app-border overflow-hidden ${
        isFullscreen
          ? 'bg-[#0B1120] fixed inset-0 z-[100] rounded-none'
          : 'bg-app-card h-[calc(100vh-260px)] min-h-[500px]'
      }`}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-app-border bg-sidebar-alt shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-app-text-muted">Page</span>
          <input
            type="number"
            min={1}
            max={numPages || 1}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJumpSubmit(); }}
            onBlur={handleJumpSubmit}
            className="w-12 text-center text-sm font-medium bg-white/5 border border-app-border rounded-md py-1 text-app-text focus:outline-none focus:border-accent-cyan/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-app-text-muted">of {numPages || '—'}</span>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={zoomOut} disabled={scale <= ZOOM_MIN}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={resetZoom}
            className="px-2.5 py-1 rounded-md text-xs font-medium text-app-text-muted hover:text-app-text hover:bg-white/5 transition-colors min-w-[52px] text-center" title="Reset zoom">
            {Math.round(scale * 100)}%
          </button>
          <button onClick={zoomIn} disabled={scale >= ZOOM_MAX}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-app-text-muted hover:text-app-text hover:bg-white/5 transition-colors" title="Open in new tab">
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open</span>
          </a>
          <button onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-white/5 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Search indicator ── */}
      {highlightText && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
          <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-400 flex-1 min-w-0 truncate">
            <span className="font-semibold">{searchLabel || 'Source verification'}</span>
            {searching && <span className="ml-1.5 text-amber-400/70">— searching pages...</span>}
            {foundPageDisplay && !searching && (
              <span className="ml-1.5 text-amber-400/70">— highlighted on {foundPageDisplay}</span>
            )}
            {!searching && !foundPageDisplay && pdfReady && (
              <span className="ml-1.5 text-amber-400/70">— not found in document</span>
            )}
          </p>
          {onClearSearch && (
            <button onClick={onClearSearch}
              className="p-1 rounded text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0" title="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ── Document area ── */}
      <div ref={scrollRef} className="flex-1 overflow-auto" style={{ background: 'rgba(0,0,0,0.2)' }}>
        {loadError ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-app-text mb-2">Failed to load document</h3>
            <p className="text-sm text-app-text-muted max-w-sm mb-4">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); setIsLoading(true); }}
              className="px-4 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-sm font-semibold hover:bg-accent-cyan/20 transition-colors">
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 px-4 gap-4">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-accent-cyan animate-spin mb-4" />
                  <p className="text-sm text-app-text-muted">Loading document...</p>
                </div>
              }
              noData={
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileText className="w-10 h-10 text-app-text-muted mb-3" />
                  <p className="text-sm text-app-text-muted">No document to display</p>
                </div>
              }
            >
              {pageNumbers.map((pageNum) => (
                <div
                  key={pageNum}
                  ref={(el) => { pageRefs.current[pageNum - 1] = el; }}
                  data-page={pageNum}
                  className="mb-4 last:mb-0 shadow-2xl rounded-lg overflow-hidden bg-white"
                >
                  <Page
                    pageNumber={pageNum}
                    width={pageWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    onRenderTextLayerSuccess={() => applyHighlightOnPage(pageNum)}
                    loading={
                      <div className="flex items-center justify-center py-32 px-20">
                        <Loader2 className="w-6 h-6 text-accent-cyan animate-spin" />
                      </div>
                    }
                  />
                </div>
              ))}
            </Document>
          </div>
        )}
      </div>

      {/* ── Bottom status bar ── */}
      {!loadError && numPages > 0 && (
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-app-border bg-sidebar-alt text-xs text-app-text-muted shrink-0">
          <span>Page {visiblePage} of {numPages}</span>
          <span>{Math.round(scale * 100)}%</span>
        </div>
      )}
    </div>
  );
}
