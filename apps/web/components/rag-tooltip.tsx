'use client';

export function RagTooltip() {
  return (
    <span className="relative group inline-flex ml-1 align-middle">
      <span className="w-4 h-4 rounded-full border border-app-border text-[10px] font-bold text-app-text-muted flex items-center justify-center cursor-help hover:text-app-text hover:border-app-text transition-colors">
        ?
      </span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 rounded-xl bg-app-card border border-app-border shadow-xl text-xs leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
        <p className="font-bold text-app-text mb-2">RAG Health Status</p>
        <div className="space-y-1.5">
          <p>
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle" />
            <span className="font-semibold text-red-400">RED:</span>
            <span className="text-app-text-muted"> Overdue or over budget (&gt;100%). Critical.</span>
          </p>
          <p>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1.5 align-middle" />
            <span className="font-semibold text-amber-400">AMBER:</span>
            <span className="text-app-text-muted"> Due soon (3 days) or budget &gt;80%. At risk.</span>
          </p>
          <p>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 align-middle" />
            <span className="font-semibold text-emerald-400">GREEN:</span>
            <span className="text-app-text-muted"> On track, budget normal. Safe.</span>
          </p>
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-app-card border-b border-r border-app-border rotate-45 -mt-1" />
      </div>
    </span>
  );
}
