'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDate, statusColor } from '@/lib/utils';
import { useMockMutation } from '@/lib/mock-data';
import {
  FileText, CheckCircle, AlertTriangle, Clock, DollarSign,
  Plus, X, Loader2, ChevronRight, Package, Wrench,
  Building2, Calendar, TrendingUp, BadgeCheck, CircleDot,
  ReceiptText, HardHat,
} from 'lucide-react';

// ─── Contractor-scoped mock data ─────────────────────────────────────────────

const MY_CONTRACTS = [
  {
    id: 'con-001', contractNumber: 'TAR-2026-001', projectId: 'proj-north-2026',
    projectName: 'North Refinery TAR 2026', type: 'subcontract',
    contractValue: 8_500_000, status: 'active', ragStatus: 'red', burnRate: 0.94,
    startDate: '2026-02-01', endDate: '2026-06-30',
    milestoneTotal: 5, milestoneComplete: 1,
  },
  {
    id: 'con-006', contractNumber: 'TAR-2026-006', projectId: 'proj-north-2026',
    projectName: 'North Refinery TAR 2026', type: 'subcontract',
    contractValue: 6_800_000, status: 'close_out', ragStatus: 'amber', burnRate: 0.88,
    startDate: '2026-01-15', endDate: '2026-05-15',
    milestoneTotal: 3, milestoneComplete: 2,
  },
  {
    id: 'con-007', contractNumber: 'BETA-2025-001', projectId: 'proj-beta-2025',
    projectName: 'Beta Facility Overhaul 2025', type: 'subcontract',
    contractValue: 12_000_000, status: 'close_out', ragStatus: 'green', burnRate: 0.97,
    startDate: '2025-06-01', endDate: '2025-12-31',
    milestoneTotal: 2, milestoneComplete: 2,
  },
];

const MY_MILESTONES = [
  { id: 'ms-001-1', contractId: 'con-001', contractNumber: 'TAR-2026-001', title: 'Site Mobilisation',             type: 'completion',      status: 'complete',    dueDate: '2026-02-10', isOverdue: false, delayDays: 0,  pendingApproval: false, requiresApproval: false },
  { id: 'ms-001-2', contractId: 'con-001', contractNumber: 'TAR-2026-001', title: 'Scaffolding Installation Ph. 1',type: 'completion',      status: 'in_progress', dueDate: '2026-03-15', isOverdue: false, delayDays: 0,  pendingApproval: false, requiresApproval: false },
  { id: 'ms-001-3', contractId: 'con-001', contractNumber: 'TAR-2026-001', title: 'Vessel Inspection Phase 1',     type: 'inspection',      status: 'in_progress', dueDate: '2026-03-01', isOverdue: true,  delayDays: 17, pendingApproval: false, requiresApproval: true  },
  { id: 'ms-001-4', contractId: 'con-001', contractNumber: 'TAR-2026-001', title: 'First Payment Milestone',       type: 'payment_trigger', status: 'not_started', dueDate: '2026-04-01', isOverdue: false, delayDays: 0,  pendingApproval: false, requiresApproval: true  },
  { id: 'ms-001-5', contractId: 'con-001', contractNumber: 'TAR-2026-001', title: 'Final Handover & Commissioning',type: 'handover',        status: 'not_started', dueDate: '2026-06-15', isOverdue: false, delayDays: 0,  pendingApproval: false, requiresApproval: true  },
  { id: 'ms-006-1', contractId: 'con-006', contractNumber: 'TAR-2026-006', title: 'Demolition Phase Complete',     type: 'completion',      status: 'complete',    dueDate: '2026-02-25', isOverdue: false, delayDays: 0,  pendingApproval: false, requiresApproval: false },
  { id: 'ms-006-2', contractId: 'con-006', contractNumber: 'TAR-2026-006', title: 'Civil Works Phase 1',           type: 'completion',      status: 'complete',    dueDate: '2026-03-20', isOverdue: false, delayDays: 0,  pendingApproval: false, requiresApproval: false },
  { id: 'ms-006-3', contractId: 'con-006', contractNumber: 'TAR-2026-006', title: 'Final Structural Sign-off',     type: 'inspection',      status: 'in_progress', dueDate: '2026-04-15', isOverdue: false, delayDays: 0,  pendingApproval: true,  requiresApproval: true  },
  { id: 'ms-007-1', contractId: 'con-007', contractNumber: 'BETA-2025-001',title: 'Scope of Work Completion',      type: 'completion',      status: 'complete',    dueDate: '2025-11-30', isOverdue: false, delayDays: 0,  pendingApproval: false, requiresApproval: false },
  { id: 'ms-007-2', contractId: 'con-007', contractNumber: 'BETA-2025-001',title: 'Defects Liability Period Start',type: 'handover',        status: 'complete',    dueDate: '2025-12-15', isOverdue: false, delayDays: 0,  pendingApproval: false, requiresApproval: true  },
];

const INIT_EXPENSES: Expense[] = [
  { id: 'exp-1', contractId: 'con-001', contractNumber: 'TAR-2026-001', category: 'labour',     amount: 3_200_000, date: '2026-03-01', description: 'Site labour — February 2026' },
  { id: 'exp-2', contractId: 'con-001', contractNumber: 'TAR-2026-001', category: 'materials',  amount: 2_100_000, date: '2026-03-05', description: 'Scaffolding materials batch 1' },
  { id: 'exp-3', contractId: 'con-001', contractNumber: 'TAR-2026-001', category: 'equipment',  amount: 1_800_000, date: '2026-03-10', description: 'Crane hire & lifting gear' },
  { id: 'exp-4', contractId: 'con-006', contractNumber: 'TAR-2026-006', category: 'labour',     amount: 3_900_000, date: '2026-02-28', description: 'Civil works labour — Q1 2026' },
  { id: 'exp-5', contractId: 'con-006', contractNumber: 'TAR-2026-006', category: 'materials',  amount: 2_100_000, date: '2026-03-12', description: 'Concrete & rebar — Phase 1' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Expense = {
  id: string; contractId: string; contractNumber: string;
  category: string; amount: number; date: string; description: string;
};

type MilestoneFilter = 'all' | 'active' | 'overdue' | 'complete';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  completion:      { label: 'Completion',     color: 'text-accent-cyan  bg-cyan-500/10  border-cyan-500/20'   },
  inspection:      { label: 'Inspection',     color: 'text-violet-400   bg-violet-500/10 border-violet-500/20' },
  payment_trigger: { label: 'Payment',        color: 'text-green-400    bg-green-500/10  border-green-500/20'  },
  handover:        { label: 'Handover',       color: 'text-amber-400    bg-amber-500/10  border-amber-500/20'  },
  penalty_threshold:{ label: 'Penalty',       color: 'text-red-400      bg-red-500/10    border-red-500/20'    },
};

const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  labour:          Wrench,
  materials:       Package,
  equipment:       HardHat,
  overheads:       TrendingUp,
  inspection_fees: BadgeCheck,
};

const CATEGORIES = ['labour', 'materials', 'equipment', 'overheads', 'inspection_fees', 'subcontract', 'other'];

const RAG_PILL: Record<string, string> = {
  green: 'text-green-400 bg-green-500/10 border-green-500/20',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  red:   'text-red-400   bg-red-500/10   border-red-500/20',
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyWorkPage() {
  const { user } = useAppStore();

  // Milestones local state (simulate updates)
  const [milestones, setMilestones] = useState(MY_MILESTONES);
  const [msFilter, setMsFilter]     = useState<MilestoneFilter>('all');
  const [completing, setCompleting] = useState<string | null>(null); // milestoneId being confirmed

  // Expenses local state
  const [expenses, setExpenses]       = useState<Expense[]>(INIT_EXPENSES);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    contractId: 'con-001', category: 'labour', amount: '', date: '', description: '',
  });

  // Confirm complete modal
  const completeMutation = useMockMutation((id?: string) => {
    if (!id) return;
    setMilestones(prev =>
      prev.map(m => m.id === id ? { ...m, status: m.requiresApproval ? 'in_progress' : 'complete', pendingApproval: m.requiresApproval } : m)
    );
    setCompleting(null);
  });

  const addExpenseMutation = useMockMutation(() => {
    const contract = MY_CONTRACTS.find(c => c.id === expenseForm.contractId);
    setExpenses(prev => [...prev, {
      id: `exp-${Date.now()}`,
      contractId: expenseForm.contractId,
      contractNumber: contract?.contractNumber ?? '',
      category: expenseForm.category,
      amount: parseFloat(expenseForm.amount) || 0,
      date: expenseForm.date,
      description: expenseForm.description,
    }]);
    setShowAddExpense(false);
    setExpenseForm({ contractId: 'con-001', category: 'labour', amount: '', date: '', description: '' });
  });

  // Filtered milestones
  const filteredMilestones = milestones.filter(m => {
    if (msFilter === 'all')      return true;
    if (msFilter === 'active')   return m.status === 'in_progress' || m.status === 'not_started';
    if (msFilter === 'overdue')  return m.isOverdue;
    if (msFilter === 'complete') return m.status === 'complete';
    return true;
  });

  // KPIs
  const activeMs   = milestones.filter(m => m.status === 'in_progress' || m.status === 'not_started').length;
  const overdueMs  = milestones.filter(m => m.isOverdue).length;
  const totalValue = MY_CONTRACTS.reduce((s, c) => s + c.contractValue, 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <HardHat className="w-3.5 h-3.5 text-green-400" />
            </div>
            <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Contractor Portal</span>
          </div>
          <h1 className="text-2xl font-black text-white">My Work</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.orgName ?? 'Gulf Engineering Group'} · {user?.name}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-bold border bg-green-500/10 border-green-500/20 text-green-400">
          🏗️ Contractor / Supplier
        </span>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Contracts',    value: MY_CONTRACTS.length,      sub: 'Assigned to your org',    icon: FileText,       color: 'text-accent-cyan', border: 'border-white/10' },
          { label: 'Active Milestones',value: activeMs,                 sub: 'In progress / not started',icon: CircleDot,     color: 'text-white',       border: 'border-white/10' },
          { label: 'Overdue',         value: overdueMs,                 sub: overdueMs > 0 ? 'Need immediate action' : 'All on schedule', icon: AlertTriangle, color: overdueMs > 0 ? 'text-red-400' : 'text-green-400', border: overdueMs > 0 ? 'border-red-500/30' : 'border-white/10' },
          { label: 'Total Value',     value: formatCurrency(totalValue), sub: 'Combined contract value', icon: DollarSign,    color: 'text-green-400',   border: 'border-white/10' },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl bg-white/3 border ${k.border} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{k.label}</span>
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
            </div>
            <div className={`text-3xl font-black ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── My Contracts ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">My Contracts</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {MY_CONTRACTS.map(c => {
            const pct = Math.round((c.milestoneComplete / c.milestoneTotal) * 100);
            return (
              <div key={c.id} className="rounded-2xl bg-white/3 border border-white/10 p-5 hover:border-white/20 transition-colors group">
                {/* Contract header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-black text-white group-hover:text-accent-cyan transition-colors">
                      {c.contractNumber}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.projectName}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RAG_PILL[c.ragStatus]}`}>
                    {c.ragStatus.toUpperCase()}
                  </span>
                </div>

                {/* Contract meta */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <DollarSign className="w-3 h-3 text-gray-600 flex-shrink-0" />
                    {formatCurrency(c.contractValue)}
                    <span className="text-gray-600 ml-auto capitalize">{c.type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="w-3 h-3 text-gray-600 flex-shrink-0" />
                    {formatDate(c.startDate)} — {formatDate(c.endDate)}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusColor(c.status)}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                    <span className={`text-xs font-bold ml-auto ${c.burnRate > 1 ? 'text-red-400' : c.burnRate > 0.85 ? 'text-amber-400' : 'text-gray-400'}`}>
                      {Math.round(c.burnRate * 100)}% burn
                    </span>
                  </div>
                </div>

                {/* Milestone progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                    <span>Milestone Progress</span>
                    <span className="font-bold text-white">{c.milestoneComplete}/{c.milestoneTotal}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-accent-cyan transition-all duration-500"
                         style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Link */}
                <Link
                  href={`/workspace/${c.projectId}/contracts/${c.id}`}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-white/10 text-xs font-semibold text-gray-400 hover:text-accent-cyan hover:border-accent-cyan/30 transition-all"
                >
                  View Contract Details
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── My Milestones ─────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">My Milestones</h2>
          {/* Filter tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {([
              { key: 'all',      label: 'All',       count: milestones.length },
              { key: 'active',   label: 'Active',    count: activeMs },
              { key: 'overdue',  label: 'Overdue',   count: overdueMs },
              { key: 'complete', label: 'Completed', count: milestones.filter(m => m.status === 'complete').length },
            ] as { key: MilestoneFilter; label: string; count: number }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setMsFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  msFilter === f.key
                    ? 'bg-accent-cyan text-trust-blue'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f.label}
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                  msFilter === f.key ? 'bg-trust-blue/30' : 'bg-white/10'
                }`}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/3 border border-white/10 overflow-hidden">
          {filteredMilestones.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-600 text-sm gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" /> No milestones in this category
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredMilestones.map(m => {
                const typeInfo = TYPE_LABELS[m.type] ?? { label: m.type, color: 'text-gray-400 bg-white/5 border-white/10' };
                const canComplete = (m.status === 'in_progress' || m.status === 'not_started') && !m.pendingApproval;

                return (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors">
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      m.status === 'complete'    ? 'bg-green-400' :
                      m.isOverdue               ? 'bg-red-400' :
                      m.status === 'in_progress' ? 'bg-accent-cyan' :
                      'bg-white/20'
                    }`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white truncate">{m.title}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        {m.requiresApproval && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-violet-400 bg-violet-500/10 border-violet-500/20 flex-shrink-0">
                            Needs Approval
                          </span>
                        )}
                        {m.pendingApproval && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-amber-400 bg-amber-500/10 border-amber-500/20 flex-shrink-0 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> Awaiting Approval
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">{m.contractNumber}</span>
                        <span className="text-xs text-gray-600">·</span>
                        <span className={`text-xs flex items-center gap-1 ${m.isOverdue ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                          <Calendar className="w-3 h-3" />
                          Due {formatDate(m.dueDate)}
                          {m.isOverdue && ` · ${m.delayDays}d late`}
                        </span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 hidden sm:inline-flex ${statusColor(m.status)}`}>
                      {m.status.replace('_', ' ')}
                    </span>

                    {/* Action */}
                    {canComplete ? (
                      <button
                        onClick={() => setCompleting(m.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-xs font-bold text-accent-cyan hover:bg-accent-cyan/20 transition-all flex-shrink-0"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Mark Complete
                      </button>
                    ) : m.status === 'complete' ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-400 flex-shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" /> Done
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Expense Records ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Expense Records</h2>
            <p className="text-xs text-gray-600 mt-0.5">Cost entries submitted against your contracts</p>
          </div>
          <button
            onClick={() => setShowAddExpense(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-cyan text-trust-blue text-sm font-bold hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>

        <div className="rounded-2xl bg-white/3 border border-white/10 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <div className="col-span-1" />
            <div className="col-span-3">Description</div>
            <div className="col-span-2">Contract</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>
          {expenses.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-gray-600 text-sm">
              No expense records yet
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {expenses.map(e => {
                const CatIcon = CATEGORY_ICONS[e.category] ?? ReceiptText;
                return (
                  <div key={e.id} className="grid grid-cols-12 gap-4 items-center px-5 py-3.5 hover:bg-white/3 transition-colors">
                    <div className="col-span-1">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                        <CatIcon className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-white">{e.description}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-accent-cyan font-semibold">{e.contractNumber}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-gray-400 capitalize">{e.category.replace('_', ' ')}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-gray-400">{formatDate(e.date)}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-bold text-white">{formatCurrency(e.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Footer total */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-white/2">
            <span className="text-xs text-gray-500">{expenses.length} entries</span>
            <span className="text-sm font-black text-white">
              Total: {formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          MODAL — Confirm Mark Complete
      ══════════════════════════════════════════════════════════════ */}
      {completing && (() => {
        const ms = milestones.find(m => m.id === completing);
        if (!ms) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCompleting(null)} />
            <div className="relative bg-[#0d1525] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-white">Mark as Complete</h2>
                <button onClick={() => setCompleting(null)} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-5">
                <p className="text-sm font-semibold text-white mb-1">{ms.title}</p>
                <p className="text-xs text-gray-500">{ms.contractNumber} · Due {formatDate(ms.dueDate)}</p>
                {ms.requiresApproval && (
                  <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      This milestone requires <strong>TAR Manager approval</strong> before it is marked complete. Your request will be submitted for review.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCompleting(null)}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => completeMutation.mutate(completing)}
                  disabled={completeMutation.isPending}
                  className="flex-1 py-2.5 rounded-lg bg-accent-cyan text-trust-blue font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {completeMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    : <><CheckCircle className="w-4 h-4" /> {ms.requiresApproval ? 'Submit for Approval' : 'Confirm Complete'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════
          MODAL — Add Expense
      ══════════════════════════════════════════════════════════════ */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddExpense(false)} />
          <div className="relative bg-[#0d1525] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-white">Add Expense Record</h2>
                <p className="text-xs text-gray-500 mt-0.5">Submit a cost entry against your contract</p>
              </div>
              <button onClick={() => setShowAddExpense(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Contract */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contract</label>
                <select
                  value={expenseForm.contractId}
                  onChange={e => setExpenseForm({ ...expenseForm, contractId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
                >
                  {MY_CONTRACTS.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0d1525]">
                      {c.contractNumber} — {c.projectName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category + Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c} className="bg-[#0d1525] capitalize">{c.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Amount (USD)</label>
                  <input
                    type="number"
                    placeholder="e.g. 250000"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Date</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of this expense…"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddExpense(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => addExpenseMutation.mutate()}
                disabled={addExpenseMutation.isPending || !expenseForm.amount || !expenseForm.date || !expenseForm.description}
                className="flex-1 py-2.5 rounded-lg bg-accent-cyan text-trust-blue font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {addExpenseMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><ReceiptText className="w-4 h-4" /> Submit Expense</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
