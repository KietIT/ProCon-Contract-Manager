'use client';

import {
  X, ChevronUp, ChevronDown, Link2, Unlink2, ArrowLeftRight,
} from 'lucide-react';
import type { DiffSummary, ContractVersionResponse } from '@/lib/api-client';
import type { DiffFilter } from './types';

interface DiffTopBarProps {
  versionA: number;
  versionB: number;
  versions: ContractVersionResponse[];
  currentVersion: number;
  summary: DiffSummary;
  filter: DiffFilter;
  activeIndex: number;
  totalFiltered: number;
  syncEnabled: boolean;
  onChangeVersionA: (v: number) => void;
  onChangeVersionB: (v: number) => void;
  onSwapVersions: () => void;
  onFilterChange: (f: DiffFilter) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleSync: () => void;
  onClose: () => void;
}

export default function DiffTopBar({
  versionA,
  versionB,
  versions,
  currentVersion,
  summary,
  filter,
  activeIndex,
  totalFiltered,
  syncEnabled,
  onChangeVersionA,
  onChangeVersionB,
  onSwapVersions,
  onFilterChange,
  onNext,
  onPrev,
  onToggleSync,
  onClose,
}: DiffTopBarProps) {
  const allVersions = [
    ...versions.map((v) => ({ num: v.versionNumber, label: `v${v.versionNumber}`, date: v.createdAt })),
    { num: currentVersion, label: `v${currentVersion} (current)`, date: '' },
  ].sort((a, b) => a.num - b.num);

  const filterLabel: Record<DiffFilter, string> = {
    all: 'All changes',
    added: 'Additions',
    deleted: 'Deletions',
    modified: 'Modifications',
  };

  const counterText = activeIndex >= 0
    ? `${activeIndex + 1}/${totalFiltered}`
    : `0/${totalFiltered}`;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-app-border bg-sidebar-alt shrink-0 flex-wrap">
      {/* Version selectors */}
      <div className="flex items-center gap-1.5">
        <select
          value={versionA}
          onChange={(e) => onChangeVersionA(Number(e.target.value))}
          className="text-xs font-medium bg-white/5 border border-app-border rounded-md px-2 py-1.5 text-app-text focus:outline-none focus:border-accent-cyan/50"
        >
          {allVersions.map((v) => (
            <option key={v.num} value={v.num} className="bg-app-bg text-app-text">
              {v.label}
            </option>
          ))}
        </select>

        <button
          onClick={onSwapVersions}
          className="p-1 rounded hover:bg-white/5 text-app-text-muted hover:text-app-text transition-colors"
          title="Swap versions"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>

        <select
          value={versionB}
          onChange={(e) => onChangeVersionB(Number(e.target.value))}
          className="text-xs font-medium bg-white/5 border border-app-border rounded-md px-2 py-1.5 text-app-text focus:outline-none focus:border-accent-cyan/50"
        >
          {allVersions.map((v) => (
            <option key={v.num} value={v.num} className="bg-app-bg text-app-text">
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-1.5">
        <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
          +{summary.additions}
        </span>
        <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
          -{summary.deletions}
        </span>
        <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          ~{summary.modifications}
        </span>
      </div>

      {/* Filter */}
      <select
        value={filter}
        onChange={(e) => onFilterChange(e.target.value as DiffFilter)}
        className="text-xs font-medium bg-white/5 border border-app-border rounded-md px-2 py-1.5 text-app-text focus:outline-none focus:border-accent-cyan/50"
      >
        {(Object.keys(filterLabel) as DiffFilter[]).map((f) => (
          <option key={f} value={f} className="bg-app-bg text-app-text">
            {filterLabel[f]}
          </option>
        ))}
      </select>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          disabled={totalFiltered === 0}
          className="p-1 rounded hover:bg-white/5 text-app-text-muted hover:text-app-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous change"
          title="Previous (J / Up)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono text-app-text-muted min-w-[40px] text-center">
          {counterText}
        </span>
        <button
          onClick={onNext}
          disabled={totalFiltered === 0}
          className="p-1 rounded hover:bg-white/5 text-app-text-muted hover:text-app-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next change"
          title="Next (K / Down)"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Sync toggle */}
      <button
        onClick={onToggleSync}
        className={`p-1.5 rounded-lg transition-colors ${
          syncEnabled
            ? 'text-accent-cyan bg-accent-cyan/10'
            : 'text-app-text-muted hover:text-app-text hover:bg-white/5'
        }`}
        title={`Scroll sync: ${syncEnabled ? 'ON' : 'OFF'} (S)`}
      >
        {syncEnabled ? <Link2 className="w-4 h-4" /> : <Unlink2 className="w-4 h-4" />}
      </button>

      <div className="flex-1" />

      <button
        onClick={onClose}
        className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-white/5 transition-colors"
        title="Close (Esc)"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
