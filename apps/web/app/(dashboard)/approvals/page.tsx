'use client';

import {
  Clock, CheckCircle2, XCircle, Loader2,
  FileText, User, X, AlertCircle,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalsApi } from '@/lib/api-client';

// ── Helpers ───────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Realtime SLA countdown ────────────────────────────────

function SlaTimer({ slaDeadline }: { slaDeadline: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const ms = new Date(slaDeadline).getTime() - now;
  const isOverdue = ms < 0;
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const secs = Math.floor((abs % 60000) / 1000);

  const colorClass = isOverdue
    ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : hours < 2
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-green-400 bg-green-500/10 border-green-500/20';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>
      <Clock className="w-3 h-3 flex-shrink-0" />
      {isOverdue
        ? `Overdue ${hours}h ${mins}m ${secs}s`
        : `${hours}h ${mins}m ${secs}s left`}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl ${
      type === 'success'
        ? 'bg-green-500/20 border-green-500/30 text-green-300'
        : 'bg-red-500/20 border-red-500/30 text-red-300'
    }`}>
      {type === 'success'
        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  // ── Queries ──

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalsApi.pending(),
    refetchInterval: 60000,
  });
  const pending = (pendingData?.data ?? []) as any[];

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['approvals', 'history'],
    queryFn: () => approvalsApi.history(),
    enabled: activeTab === 'history',
  });
  const history = ((historyData?.data ?? []) as any[]).filter(a => a.status !== 'pending');

  // ── Decide mutation ──

  const decideMutation = useMutation({
    mutationFn: ({ id, decision, comments }: { id: string; decision: 'approved' | 'rejected'; comments: string }) =>
      approvalsApi.decide(id, { decision, comments }),
    onSuccess: (_, variables) => {
      setFadingIds(prev => new Set(Array.from(prev).concat(variables.id)));
      const msg = variables.decision === 'approved'
        ? 'Approved ✓'
        : 'Rejected — contractor notified';
      showToast(msg);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
        queryClient.invalidateQueries({ queryKey: ['approvals', 'history'] });
        setFadingIds(prev => { const s = new Set(prev); s.delete(variables.id); return s; });
        setRejectingId(null);
        setComment('');
      }, 400);
    },
    onError: () => showToast('Action failed. Please try again.', 'error'),
  });

  const isLoading = activeTab === 'pending' ? pendingLoading : historyLoading;
  const activeItems = activeTab === 'pending' ? pending : history;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-app-text mb-1">Approvals</h1>
          <p className="text-app-text-muted text-sm">Milestone completion approvals assigned to you</p>
        </div>
        {pending.length > 0 && (
          <span className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold">
            {pending.length} pending
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-app-border mb-6 gap-1">
        {(['pending', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all capitalize ${
              activeTab === tab
                ? 'text-accent-cyan border-b-2 border-accent-cyan bg-accent-cyan/5'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {tab}
            {tab === 'pending' && pending.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent-cyan animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && activeItems.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-app-text mb-2">
            {activeTab === 'pending' ? 'All caught up!' : 'No history yet'}
          </h3>
          <p className="text-app-text-muted text-sm">
            {activeTab === 'pending'
              ? 'No pending approvals assigned to you.'
              : 'Your approval decisions will appear here.'}
          </p>
        </div>
      )}

      {/* ── Pending Tab ── */}
      {!isLoading && activeTab === 'pending' && pending.length > 0 && (
        <div className="space-y-4">
          {pending.map((a: any) => {
            const isFading = fadingIds.has(a.id);
            const isRejecting = rejectingId === a.id;
            const isThisDeciding = decideMutation.isPending && (decideMutation.variables as any)?.id === a.id;

            return (
              <div
                key={a.id}
                className={`rounded-2xl border p-5 ${
                  a.isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-app-border bg-app-card'
                }`}
                style={{
                  opacity: isFading ? 0 : 1,
                  transform: isFading ? 'translateY(-4px)' : 'translateY(0)',
                  transition: 'opacity 0.4s ease, transform 0.4s ease',
                }}
              >
                {/* Milestone info */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-accent-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-app-text font-semibold text-sm leading-snug">{a.milestone?.title}</p>
                    <p className="text-xs text-app-text-muted mt-0.5">
                      {a.milestone?.contract?.contractNumber}
                      {a.milestone?.contract?.project?.name && (
                        <> · {a.milestone.contract.project.name}</>
                      )}
                    </p>
                  </div>
                </div>

                {/* Requester + SLA */}
                <div className="flex items-center gap-3 flex-wrap mb-4 ml-12">
                  <span className="flex items-center gap-1.5 text-xs text-app-text-muted">
                    <User className="w-3 h-3" />
                    {a.requestedBy?.name} · {timeAgo(a.createdAt)}
                  </span>
                  <SlaTimer slaDeadline={a.slaDeadline} />
                </div>

                {/* Inline reject textarea */}
                {isRejecting && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                    <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                      Rejection reason <span className="normal-case font-normal">*required</span>
                    </label>
                    <textarea
                      autoFocus
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      rows={3}
                      placeholder="Explain why this milestone is being rejected..."
                      className="w-full px-3 py-2.5 bg-sidebar-alt border border-red-500/20 rounded-lg text-app-text text-sm placeholder-app-text-muted focus:outline-none focus:border-red-500/50 resize-none"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {!isRejecting ? (
                    <>
                      <button
                        onClick={() => { setRejectingId(a.id); setComment(''); }}
                        disabled={isThisDeciding}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm font-semibold disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() => decideMutation.mutate({ id: a.id, decision: 'approved', comments: '' })}
                        disabled={isThisDeciding}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-all text-sm font-semibold disabled:opacity-50"
                      >
                        {isThisDeciding
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setRejectingId(null); setComment(''); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-app-border text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-all text-sm font-semibold"
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                      <button
                        onClick={() => decideMutation.mutate({ id: a.id, decision: 'rejected', comments: comment })}
                        disabled={isThisDeciding || comment.trim().length === 0}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isThisDeciding
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <XCircle className="w-4 h-4" />}
                        Confirm Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── History Tab ── */}
      {!isLoading && activeTab === 'history' && history.length > 0 && (
        <div className="space-y-3">
          {history.map((a: any) => (
            <div
              key={a.id}
              className={`rounded-2xl border p-4 ${
                a.status === 'approved'
                  ? 'border-green-500/20 bg-green-500/5'
                  : 'border-red-500/20 bg-red-500/5'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-sidebar-alt border border-app-border flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-app-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-app-text font-semibold text-sm">{a.milestone?.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                      a.status === 'approved'
                        ? 'text-green-400 bg-green-500/10 border-green-500/20'
                        : 'text-red-400 bg-red-500/10 border-red-500/20'
                    }`}>
                      {a.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
                    </span>
                  </div>
                  <p className="text-xs text-app-text-muted mb-1">
                    {a.milestone?.contract?.contractNumber}
                    {a.requestedBy?.name && <> · Requested by {a.requestedBy.name}</>}
                  </p>
                  {a.decidedAt && (
                    <p className="text-xs text-app-text-muted">{formatDateTime(a.decidedAt)}</p>
                  )}
                  {a.comments && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-sidebar-alt border border-app-border">
                      <p className="text-xs text-app-text-muted italic">"{a.comments}"</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
