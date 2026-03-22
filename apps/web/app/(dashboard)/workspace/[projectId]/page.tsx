'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, milestonesApi } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RagTooltip } from '@/components/rag-tooltip';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  FileText, AlertTriangle, CheckCircle, TrendingUp,
  ChevronRight, ArrowLeft, Clock, ChevronDown,
} from 'lucide-react';

// ─── Gantt helpers ────────────────────────────────────────────────────────────

const G_COLORS = {
  on_track: { bar: '#4ade80', text: 'text-green-400', dot: 'bg-green-400' },
  at_risk:  { bar: '#fbbf24', text: 'text-amber-400', dot: 'bg-amber-400' },
  behind:   { bar: '#f87171', text: 'text-red-400',   dot: 'bg-red-400'   },
};

function buildMonthAxis(start: Date, end: Date) {
  const months: { label: string; pct: number }[] = [];
  const total = end.getTime() - start.getTime();
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    const pct = Math.max(0, Math.min(100, ((d.getTime() - start.getTime()) / total) * 100));
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), pct });
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

const MS_COLORS: Record<string, string> = {
  complete: 'bg-green-400', in_progress: 'bg-accent-cyan', not_started: 'bg-gray-600',
  overdue: 'bg-red-400', waived: 'bg-gray-500',
};

const RAG_COLORS = { green: '#4ade80', amber: '#fbbf24', red: '#f87171' };

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  totalContracts: number;
  activeContracts: number;
  overdueMilestones: number;
  completionRate: number;
  burnRate: number;
  totalSpent: number | string;
  totalBudget: number | string;
  ragSummary: { green: number; amber: number; red: number };
  contractsAtRisk: Array<{
    id: string;
    contractNumber: string;
    contractorName: string;
    overdueCount: number;
    burnRate: number;
    daysRemaining: number;
    ragStatus: string;
  }>;
  overdueMilestoneDetails: Array<{
    id: string;
    title: string;
    contractId: string;
    contractNumber: string;
    delayDays: number;
  }>;
  dailyBurnData: Array<{
    day: number;
    date: string;
    actualSpend: number | null;
    plannedBudget: number;
  }>;
}

interface ProjectData {
  id: string;
  name: string;
  tarStartDate: string;
  tarEndDate: string;
  totalBudget: number | string;
  [key: string]: unknown;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, highlight }: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>; highlight?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white/3 border p-5 flex flex-col gap-3 ${highlight || 'border-white/10'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${highlight ? 'bg-accent-cyan/10' : 'bg-white/5'}`}>
          <Icon className={`w-4 h-4 ${highlight ? 'text-accent-cyan' : 'text-gray-400'}`} />
        </div>
      </div>
      <div>
        <div className={`text-3xl font-black ${highlight || 'text-white'}`}>{value}</div>
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-64 bg-white/5 animate-pulse rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-white/5 animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <div key={i} className="h-64 bg-white/5 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Expanded Milestones Row ──────────────────────────────────────────────────

function GanttExpandedRow({ contractId, gStart, gTotal }: { contractId: string; gStart: number; gTotal: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['milestones', contractId],
    queryFn: () => milestonesApi.list(contractId),
  });
  const milestones = (data?.data ?? []) as Array<{
    id: string; title: string; status: string; dueDate: string;
  }>;

  if (isLoading) {
    return (
      <div className="px-5 pb-3 pt-2 bg-white/2 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-3 h-3 border-2 border-gray-600 border-t-accent-cyan rounded-full animate-spin" />
          Loading milestones…
        </div>
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="px-5 pb-3 pt-2 bg-white/2 border-t border-white/5">
        <p className="text-xs text-gray-600">No milestones for this contract.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pb-3 pt-2 bg-white/2 border-t border-white/5 space-y-1.5">
      <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-1">Milestones</p>
      {milestones.map((ms) => {
        const duePct = Math.max(0, Math.min(100, ((new Date(ms.dueDate).getTime() - gStart) / gTotal) * 100));
        return (
          <div key={ms.id} className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${MS_COLORS[ms.status] ?? 'bg-gray-500'}`} />
            <span className="text-xs text-gray-300 w-40 truncate">{ms.title}</span>
            <div className="flex-1 relative h-4">
              {/* Due date marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm border border-white/20 bg-white/10"
                style={{ left: `${duePct}%`, marginLeft: '-6px' }}
                title={`Due: ${new Date(ms.dueDate).toLocaleDateString()}`}
              />
            </div>
            <span className={`text-[10px] font-medium flex-shrink-0 ${
              ms.status === 'complete' ? 'text-green-400' :
              ms.status === 'overdue' ? 'text-red-400' :
              'text-gray-500'
            }`}>
              {ms.status.replace('_', ' ')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [ganttExpanded, setGanttExpanded] = useState<string | null>(null);

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const project = projectData?.data as ProjectData | undefined;

  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => projectsApi.getDashboard(projectId),
    refetchInterval: 5 * 60 * 1000,
  });
  const dashboard = dashboardData?.data as DashboardData | undefined;

  const { data: ganttRaw } = useQuery({
    queryKey: ['project-gantt', projectId],
    queryFn: () => projectsApi.getGantt(projectId),
    refetchInterval: 5 * 60 * 1000,
  });
  const gantt = ganttRaw?.data;

  // Derived Gantt axis values
  const gStart = gantt ? new Date(gantt.tarStartDate).getTime() : 0;
  const gEnd = gantt ? new Date(gantt.tarEndDate).getTime() : 1;
  const gTotal = gEnd - gStart;
  const gTodayPct = gTotal > 0 ? Math.max(0, Math.min(100, ((Date.now() - gStart) / gTotal) * 100)) : 0;
  const gMonths = useMemo(() => {
    if (!gantt) return [];
    return buildMonthAxis(new Date(gantt.tarStartDate), new Date(gantt.tarEndDate));
  }, [gantt]);

  function gPct(d: Date) {
    return Math.max(0, Math.min(100, ((d.getTime() - gStart) / gTotal) * 100));
  }

  if (projectLoading || dashLoading) {
    return <DashboardSkeleton />;
  }

  if (!dashboard) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Link
          href="/workspace"
          className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Workspace
        </Link>
        <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
          Unable to load dashboard data. Please try again later.
        </div>
      </div>
    );
  }

  const ragData = [
    { name: 'Green', value: dashboard.ragSummary.green, color: RAG_COLORS.green },
    { name: 'Amber', value: dashboard.ragSummary.amber, color: RAG_COLORS.amber },
    { name: 'Red', value: dashboard.ragSummary.red, color: RAG_COLORS.red },
  ].filter(r => r.value > 0);

  const burnChartData = (dashboard.dailyBurnData ?? []).map((pt) => ({
    date: new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Actual: pt.actualSpend != null ? Math.round(Number(pt.actualSpend) / 1000) : null,
    Expected: Math.round(Number(pt.plannedBudget) / 1000),
  }));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/workspace"
            className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors text-sm mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Workspace
          </Link>
          <h1 className="text-2xl font-bold text-white">{project?.name || 'Procon Command Dashboard'}</h1>
          {project && (
            <p className="text-gray-400 text-sm mt-1">
              {formatDate(project.tarStartDate)} — {formatDate(project.tarEndDate)} · Budget {formatCurrency(Number(project.totalBudget))}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Link
            href={`/workspace/${projectId}/contracts`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-gray-300 hover:border-accent-cyan/50 hover:text-accent-cyan transition-all"
          >
            <FileText className="w-4 h-4" />
            Contracts
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Contracts"
          value={dashboard.totalContracts}
          sub={`${dashboard.activeContracts} active`}
          icon={FileText}
          highlight="border-white/10"
        />
        <KpiCard
          label="Overdue Milestones"
          value={dashboard.overdueMilestones}
          sub="Need attention"
          icon={AlertTriangle}
          highlight={dashboard.overdueMilestones > 0 ? 'border-red-500/30 text-red-400' : 'border-white/10'}
        />
        <KpiCard
          label="Completion Rate"
          value={`${Math.round((dashboard.completionRate || 0) * 100)}%`}
          sub="Milestones done"
          icon={CheckCircle}
          highlight="border-white/10"
        />
        <KpiCard
          label="Budget Burn"
          value={`${Math.round((dashboard.burnRate || 0) * 100)}%`}
          sub={`${formatCurrency(Number(dashboard.totalSpent))} of ${formatCurrency(Number(dashboard.totalBudget))}`}
          icon={TrendingUp}
          highlight={dashboard.burnRate > 0.9 ? 'border-red-500/30 text-red-400' : dashboard.burnRate > 0.8 ? 'border-amber-500/30 text-amber-400' : 'border-white/10'}
        />
      </div>

      {/* Gantt Chart */}
      <div className="rounded-2xl bg-white/3 border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Phase Progress (Gantt)</h2>
          <div className="flex items-center gap-5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded-sm bg-white/10 inline-block" />Planned</span>
            <span className="flex items-center gap-1.5"><span className="w-5 h-2 rounded-sm bg-accent-cyan inline-block" />Actual</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-accent-cyan/70" />Today</span>
          </div>
        </div>

        {(!gantt || gantt.phases.length === 0) ? (
          <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
            No contracts to display. Add contracts to see the Gantt chart.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Month header */}
              <div className="flex border-b border-white/5">
                <div className="w-56 flex-shrink-0" />
                <div className="flex-1 relative h-7">
                  {gMonths.map((m, i) => (
                    <div key={i} className="absolute top-0 h-full flex items-center" style={{ left: `${m.pct}%` }}>
                      <span className="text-[10px] text-gray-600 pl-1 whitespace-nowrap">{m.label}</span>
                    </div>
                  ))}
                </div>
                <div className="w-24 flex-shrink-0" />
              </div>

              {/* Phase rows — scrollable, max 5 visible */}
              <div className="max-h-[280px] overflow-y-auto">
              {gantt.phases.map((phase) => {
                const colors   = G_COLORS[phase.status];
                const barLeft  = gPct(new Date(phase.plannedStart));
                const barWidth = Math.max(0.5, gPct(new Date(phase.plannedEnd)) - barLeft);
                const actualFill   = (phase.actualProgress / 100) * barWidth;
                const todayInBar   = Math.max(0, Math.min(barWidth, gTodayPct - barLeft));
                const plannedFill  = (phase.plannedProgress / 100) * todayInBar;
                const isExpanded   = ganttExpanded === phase.id;

                return (
                  <div key={phase.id} className="border-b border-white/5 last:border-0">
                    <div
                      className="flex items-center hover:bg-white/3 transition-colors cursor-pointer group"
                      onClick={() => setGanttExpanded(isExpanded ? null : phase.id)}
                    >
                      {/* Phase label */}
                      <div className="w-56 flex-shrink-0 flex items-center gap-2 px-4 py-2.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-accent-cyan transition-colors">{phase.phase}</p>
                          <p className="text-[10px] text-gray-600 truncate">{phase.contractNumber} · {phase.contractorName}</p>
                        </div>
                        <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>

                      {/* Bar track */}
                      <div className="flex-1 relative h-10 px-1">
                        {gMonths.map((m, i) => (
                          <div key={i} className="absolute top-0 bottom-0 w-px bg-white/3" style={{ left: `${m.pct}%` }} />
                        ))}
                        {/* Today line */}
                        <div className="absolute top-1 bottom-1 w-0.5 bg-accent-cyan/50 z-10 rounded-full"
                             style={{ left: `${gTodayPct}%` }} />
                        {/* Duration track */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-5 rounded bg-white/8 border border-white/10"
                          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                        >
                          {/* Planned ghost */}
                          {plannedFill > 0 && (
                            <div className="absolute top-0 left-0 h-full rounded bg-white/15"
                                 style={{ width: `${Math.min(100, (plannedFill / barWidth) * 100)}%` }} />
                          )}
                          {/* Actual fill */}
                          {actualFill > 0 && (
                            <div className="absolute top-0 left-0 h-full rounded transition-all duration-700"
                                 style={{ width: `${Math.min(100, (actualFill / barWidth) * 100)}%`, backgroundColor: colors.bar, opacity: 0.8 }} />
                          )}
                        </div>
                      </div>

                      {/* % stat */}
                      <div className="w-24 flex-shrink-0 text-right px-4">
                        <span className={`text-xs font-black ${colors.text}`}>{phase.actualProgress}%</span>
                        <p className="text-[10px] text-gray-600">of {phase.plannedProgress}%</p>
                      </div>
                    </div>

                    {/* Expanded row — stats + milestones */}
                    {isExpanded && (
                      <>
                        <div className="px-5 pb-2 pt-1 bg-white/2 border-t border-white/5">
                          <div className="flex items-center gap-6 text-xs">
                            {[
                              { label: 'Planned to Date', value: `${phase.plannedProgress}%`, color: 'text-white' },
                              { label: 'Actual',          value: `${phase.actualProgress}%`,   color: colors.text },
                              { label: 'Variance',
                                value: `${phase.actualProgress >= phase.plannedProgress ? '+' : ''}${phase.actualProgress - phase.plannedProgress}%`,
                                color: phase.actualProgress >= phase.plannedProgress ? 'text-green-400' : 'text-red-400' },
                              { label: 'Remaining', value: `${100 - phase.actualProgress}%`, color: 'text-gray-400' },
                            ].map(k => (
                              <div key={k.label}>
                                <p className="text-gray-600 uppercase tracking-wider text-[10px]">{k.label}</p>
                                <p className={`font-black text-sm ${k.color}`}>{k.value}</p>
                              </div>
                            ))}
                            <div className="flex-1 ml-4">
                              <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
                                <div className="absolute top-0 left-0 h-full rounded-full bg-white/15"
                                     style={{ width: `${phase.plannedProgress}%` }} />
                                <div className="absolute top-0 left-0 h-full rounded-full"
                                     style={{ width: `${phase.actualProgress}%`, backgroundColor: colors.bar, opacity: 0.85 }} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <GanttExpandedRow contractId={phase.contractId} gStart={gStart} gTotal={gTotal} />
                      </>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-2.5 border-t border-white/5 flex items-center justify-between">
          <div className="flex gap-4">
            {[
              { dot: 'bg-green-400', label: 'On Track' },
              { dot: 'bg-amber-400', label: 'At Risk' },
              { dot: 'bg-red-400',   label: 'Behind' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${l.dot}`} />
                <span className="text-[10px] text-gray-600">{l.label}</span>
              </div>
            ))}
          </div>
          <span className="text-[10px] text-gray-600">Click row to expand milestones · Simulated progress</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RAG Donut Chart */}
        <div className="rounded-2xl bg-white/3 border border-white/10 p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">Contract Health<RagTooltip /></h2>
          {ragData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={ragData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {ragData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {ragData.map(r => (
                  <div key={r.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-xs text-gray-400">{r.value} {r.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">No contract data</div>
          )}
        </div>

        {/* Cost Burn Chart */}
        <div className="lg:col-span-2 rounded-2xl bg-white/3 border border-white/10 p-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Cost Burn</h2>
          {burnChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={burnChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} interval={Math.max(0, Math.floor(burnChartData.length / 8) - 1)} angle={-30} textAnchor="end" height={45} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                  formatter={(v, name) => [v != null ? `$${Number(v)}k` : 'N/A', name]}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
                <Line type="monotone" dataKey="Actual" stroke="#25d1f4" strokeWidth={2} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="Expected" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">No cost data yet</div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contracts at Risk */}
        <div className="rounded-2xl bg-white/3 border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Contracts at Risk</h2>
            <Link href={`/workspace/${projectId}/contracts`} className="text-xs text-accent-cyan hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {dashboard.contractsAtRisk?.length > 0 ? (
            <div className="space-y-3">
              {dashboard.contractsAtRisk.slice(0, 5).map((c) => (
                <Link
                  key={c.id}
                  href={`/workspace/${projectId}/contracts/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.ragStatus === 'red' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-accent-cyan">{c.contractNumber}</p>
                    <p className="text-xs text-gray-500">{c.contractorName} · {c.overdueCount} overdue</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-bold ${c.ragStatus === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                      {Math.round(c.burnRate * 100)}% burn
                    </p>
                    <p className="text-xs text-gray-500">{c.daysRemaining}d left</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-600 text-sm">
              <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
              All contracts on track
            </div>
          )}
        </div>

        {/* Overdue Milestones */}
        <div className="rounded-2xl bg-white/3 border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Overdue Milestones</h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dashboard.overdueMilestones > 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
              {dashboard.overdueMilestones} total
            </span>
          </div>
          {dashboard.overdueMilestoneDetails?.length > 0 ? (
            <div className="space-y-3">
              {dashboard.overdueMilestoneDetails.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href={`/workspace/${projectId}/contracts/${m.contractId}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-accent-cyan">{m.title}</p>
                    <p className="text-xs text-gray-500">{m.contractNumber}</p>
                  </div>
                  <span className="text-xs font-bold text-red-400 flex-shrink-0">{m.delayDays}d late</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-600 text-sm">
              <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
              No overdue milestones
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
