'use client';

import { useEffect, useCallback } from 'react';
import { X, FileText, Loader2, AlertTriangle, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { contractsApi, type LocateClauseResult } from '@/lib/api-client';

interface SourcePanelProps {
  contractId: string;
  sourceClause: string;
  confidence?: number;
  itemLabel?: string;
  onClose: () => void;
}

export default function SourcePanel({
  contractId,
  sourceClause,
  confidence,
  itemLabel,
  onClose,
}: SourcePanelProps) {
  // Fetch locate-clause result
  const { data, isLoading, error } = useQuery({
    queryKey: ['locate-clause', contractId, sourceClause],
    queryFn: () => contractsApi.locateClause(contractId, sourceClause),
    enabled: !!sourceClause,
    staleTime: 5 * 60 * 1000,
  });

  const result = data?.data as LocateClauseResult | undefined;

  // Escape key closes panel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Render the context text with the matched clause highlighted
  function renderHighlightedText() {
    if (!result || !result.found) return null;

    const text = result.context_text;
    const hStart = result.highlight_offset_start ?? 0;
    const hEnd = result.highlight_offset_end ?? 0;

    if (hStart === 0 && hEnd === 0) {
      return <p className="text-sm text-app-text-muted leading-relaxed whitespace-pre-wrap">{text}</p>;
    }

    const before = text.slice(0, hStart);
    const highlighted = text.slice(hStart, hEnd);
    const after = text.slice(hEnd);

    return (
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {before && <span className="text-app-text-muted">{before}</span>}
        <mark className="bg-[#FEF08A] text-gray-900 font-semibold px-0.5 rounded-sm">{highlighted}</mark>
        {after && <span className="text-app-text-muted">{after}</span>}
      </div>
    );
  }

  return (
    <>
      {/* Backdrop — only on mobile */}
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-sidebar-bg border-l border-app-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-app-text truncate">Source Verification</h3>
              {itemLabel && (
                <p className="text-xs text-app-text-muted truncate">{itemLabel}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Low confidence warning */}
        {confidence !== undefined && confidence < 0.7 && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400">
              Low confidence ({Math.round(confidence * 100)}%) — verify this extraction carefully against the original document.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="flex items-center gap-2 text-sm text-app-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching contract text...
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-4 bg-sidebar-alt rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-400">Failed to search contract text</p>
              <p className="text-xs text-red-400/60 mt-1">{(error as Error).message}</p>
            </div>
          )}

          {result && !result.found && (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-xl bg-sidebar-alt border border-app-border flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-app-text-muted" />
              </div>
              <p className="text-sm font-semibold text-app-text-muted mb-1">Source clause not found in document</p>
              <p className="text-xs text-app-text-muted">
                The extracted text could not be located in the original contract file.
                This may happen with scanned documents or OCR artifacts.
              </p>

              {/* Show the raw clause for reference */}
              <div className="mt-4 p-3 rounded-lg bg-sidebar-alt border border-app-border text-left">
                <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Extracted clause</p>
                <p className="text-xs text-app-text-muted italic leading-relaxed">&quot;{sourceClause}&quot;</p>
              </div>
            </div>
          )}

          {result && result.found && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <p className="text-xs font-semibold text-green-400">
                  Match found at position {result.match_start.toLocaleString()}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-app-card border border-app-border">
                {renderHighlightedText()}
              </div>

              {/* Source clause reference */}
              <div className="mt-4 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">AI Extracted Clause</p>
                <p className="text-xs text-purple-300/80 italic leading-relaxed">&quot;{sourceClause}&quot;</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-app-border shrink-0">
          <p className="text-xs text-app-text-muted text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-sidebar-alt border border-app-border text-app-text-muted text-[10px] font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </>
  );
}
