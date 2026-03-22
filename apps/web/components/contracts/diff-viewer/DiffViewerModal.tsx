'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contractsApi, type ContractVersionResponse, type DiffSegment } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import DiffTopBar from './DiffTopBar';
import DiffPdfPanel from './DiffPdfPanel';
import { useScrollSync } from './useScrollSync';
import { useDiffNavigation } from './useDiffNavigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface DiffViewerModalProps {
  contractId: string;
  currentVersion: number;
  versions: ContractVersionResponse[];
  onClose: () => void;
}

export default function DiffViewerModal({
  contractId,
  currentVersion,
  versions,
  onClose,
}: DiffViewerModalProps) {
  const queryClient = useQueryClient();
  const [versionA, setVersionA] = useState(() => {
    const prev = versions.find((v) => v.versionNumber === currentVersion - 1);
    return prev ? prev.versionNumber : (versions[0]?.versionNumber ?? 1);
  });
  const [versionB, setVersionB] = useState(currentVersion);

  const { data: diffData, isLoading, error } = useQuery({
    queryKey: ['contract-diff', contractId, versionA, versionB],
    queryFn: () => contractsApi.getDiff(contractId, versionA, versionB),
    enabled: versionA !== versionB,
  });

  const diff = diffData?.data;
  const isCorrupted = diff?.corrupted === true;
  const segments = diff?.segments ?? [];
  const summary = diff?.summary ?? { additions: 0, deletions: 0, modifications: 0 };

  // When corrupted versions are auto-repaired, refresh parent data
  useEffect(() => {
    if (isCorrupted) {
      queryClient.invalidateQueries({ queryKey: ['contract-versions', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
    }
  }, [isCorrupted, contractId, queryClient]);

  const { leftRef, rightRef, syncEnabled, toggleSync } = useScrollSync({ enabled: true });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleNavigate = useCallback((_segment: DiffSegment) => {
    // Scroll handled by DiffPdfPanel's activeSegmentId effect
  }, []);

  const {
    activeIndex,
    activeSegment,
    filter,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    filteredSegments,
    totalFiltered,
    next,
    prev,
    changeFilter,
  } = useDiffNavigation({ segments, onNavigate: handleNavigate });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const swapVersions = useCallback(() => {
    setVersionA(versionB);
    setVersionB(versionA);
  }, [versionA, versionB]);

  const fileUrlA = diff?.fileUrlA ? `${API_URL}${diff.fileUrlA}` : '';
  const fileUrlB = diff?.fileUrlB ? `${API_URL}${diff.fileUrlB}` : '';

  const labelA = `Version ${versionA}${versionA === currentVersion ? ' (current)' : ''}`;
  const labelB = `Version ${versionB}${versionB === currentVersion ? ' (current)' : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app-bg">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative flex flex-col h-full w-full">
        <DiffTopBar
          versionA={versionA}
          versionB={versionB}
          versions={versions}
          currentVersion={currentVersion}
          summary={summary}
          filter={filter}
          activeIndex={activeIndex}
          totalFiltered={totalFiltered}
          syncEnabled={syncEnabled}
          onChangeVersionA={(v) => setVersionA(v)}
          onChangeVersionB={(v) => setVersionB(v)}
          onSwapVersions={swapVersions}
          onFilterChange={changeFilter}
          onNext={next}
          onPrev={prev}
          onToggleSync={toggleSync}
          onClose={onClose}
        />

        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-accent-cyan animate-spin mb-4" />
              <p className="text-sm text-app-text-muted">Analyzing changes between versions...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-sm text-red-400 mb-2">Failed to compute diff</p>
              <p className="text-xs text-app-text-muted">{(error as Error).message}</p>
            </div>
          ) : versionA === versionB ? (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-sm text-app-text-muted">Select two different versions to compare</p>
            </div>
          ) : isCorrupted ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-base font-semibold text-app-text mb-2">Version Data Repaired</h3>
              <p className="text-sm text-app-text-muted mb-4">
                A previous version&apos;s file was overwritten due to a system issue. The corrupted version record has been automatically cleaned up. Please upload the new version again to enable comparison.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-sm font-semibold hover:bg-accent-cyan/20 transition-colors"
              >
                Close &amp; Re-upload Version
              </button>
            </div>
          ) : segments.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-sm text-app-text-muted">No changes found between these two versions</p>
            </div>
          ) : (
            <div className="flex h-full">
              <div className="w-1/2 h-full border-r border-app-border">
                <DiffPdfPanel
                  ref={leftRef}
                  fileUrl={fileUrlA}
                  label={labelA}
                  side="old"
                  segments={segments}
                  activeSegmentId={activeSegment?.id ?? null}
                  scale={1.0}
                />
              </div>

              <div className="w-1/2 h-full">
                <DiffPdfPanel
                  ref={rightRef}
                  fileUrl={fileUrlB}
                  label={labelB}
                  side="new"
                  segments={segments}
                  activeSegmentId={activeSegment?.id ?? null}
                  scale={1.0}
                />
              </div>
            </div>
          )}
        </div>

        {diff && segments.length > 0 && (
          <div className="flex items-center justify-center px-4 py-1.5 border-t border-app-border bg-sidebar-alt text-xs text-app-text-muted shrink-0 gap-4">
            <span>
              {filter === 'all'
                ? `${segments.length} changes`
                : `${totalFiltered} ${filter} (${segments.length} total)`}
            </span>
            <span className="text-app-text-muted/50">|</span>
            <span>J/K navigate · S sync · 1-3 filter · Esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
