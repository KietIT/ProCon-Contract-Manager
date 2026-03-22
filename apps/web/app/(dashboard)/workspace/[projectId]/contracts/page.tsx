'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { formatCurrency, formatDate, ragColor, statusColor } from '@/lib/utils';
import {
  Plus, ChevronRight, FileText, AlertCircle, ArrowLeft,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '@/lib/api-client';
import NewContractModal from './new-contract-modal';
import { useAppStore } from '@/lib/store';
import { RagTooltip } from '@/components/rag-tooltip';

export default function ContractsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { user } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: contractsData, isLoading, error } = useQuery({
    queryKey: ['contracts', projectId],
    queryFn: () => contractsApi.list(projectId),
  });
  const contracts = (contractsData?.data ?? []) as Array<{
    id: string;
    contractNumber: string;
    type: string;
    status: string;
    ragStatus: string;
    contractValue: string | number;
    startDate: string;
    endDate: string;
    contractorOrg?: { id: string; name: string };
    milestones?: Array<{ status: string; dueDate: string }>;
    costEntries?: Array<{ amount: string | number }>;
  }>;

  // Only TAR Manager and Procurement can create contracts; contractors are read-only
  const canCreateContract = user?.role === 'tar_manager' || user?.role === 'procurement';

  const contractTypeLabel: Record<string, string> = {
    once_off: 'Once-off', frame: 'Frame',
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-sidebar-alt animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="text-center py-24">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-app-text mb-2">Failed to load contracts</h3>
          <p className="text-app-text-muted text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href={`/workspace/${projectId}`} className="flex items-center gap-1.5 text-app-text-muted hover:text-app-text text-sm mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> TAR Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-app-text">Contracts</h1>
          <p className="text-app-text-muted text-sm mt-1">{contracts.length} total contracts</p>
        </div>
        {canCreateContract && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-cyan text-trust-blue rounded-lg font-bold text-sm hover:brightness-110 transition-all glow-cyan"
          >
            <Plus className="w-4 h-4" /> New Contract
          </button>
        )}
      </div>

      {contracts.length === 0 && (
        <div className="text-center py-24">
          <FileText className="w-12 h-12 text-app-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-app-text mb-2">No contracts yet</h3>
          <p className="text-app-text-muted text-sm mb-6">Upload your first contract PDF to get started with AI parsing</p>
          {canCreateContract && (
            <button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-accent-cyan text-trust-blue rounded-lg font-bold text-sm">
              Upload Contract
            </button>
          )}
        </div>
      )}

      {contracts.length > 0 && (
        <div className="space-y-3">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1fr,1fr,auto] gap-4 px-4 py-2 text-xs font-bold text-app-text-muted uppercase tracking-wider">
            <span>Contract</span>
            <span>Type</span>
            <span>Value</span>
            <span>Status</span>
            <span className="flex items-center">Health<RagTooltip /></span>
            <span></span>
          </div>

          {contracts.map((c) => {
            const overdueCount = c.milestones?.filter((m) =>
              m.status !== 'complete' && m.status !== 'waived' && new Date(m.dueDate) < new Date()
            ).length || 0;

            const contractValue = Number(c.contractValue);
            const totalCost = c.costEntries?.reduce((sum, entry) => sum + Number(entry.amount), 0) ?? 0;
            const burnPct = contractValue > 0 ? Math.round((totalCost / contractValue) * 100) : null;

            return (
              <Link
                key={c.id}
                href={`/workspace/${projectId}/contracts/${c.id}`}
                className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,1fr,1fr,auto] gap-4 items-center px-4 py-4 rounded-xl bg-app-card border border-app-border hover:border-accent-cyan/30 hover:bg-sidebar-alt transition-all group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-app-text-muted flex-shrink-0" />
                    <span className="font-bold text-app-text group-hover:text-accent-cyan truncate">{c.contractNumber}</span>
                  </div>
                  <div className="text-xs text-app-text-muted flex items-center gap-3 ml-6">
                    <span>{c.contractorOrg?.name}</span>
                    {overdueCount > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertCircle className="w-3 h-3" /> {overdueCount} overdue
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm text-app-text-muted capitalize">{contractTypeLabel[c.type] || c.type}</span>
                <div>
                  <div className="text-sm font-semibold text-app-text">{formatCurrency(contractValue)}</div>
                  <div className="text-xs text-app-text-muted">{burnPct !== null ? `${burnPct}% burned` : 'N/A'}</div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border w-fit capitalize ${statusColor(c.status)}`}>
                  {c.status.replace('_', ' ')}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border w-fit uppercase ${ragColor(c.ragStatus)}`}>
                  {c.ragStatus}
                </span>
                <ChevronRight className="w-4 h-4 text-app-text-muted group-hover:text-accent-cyan transition-colors" />
              </Link>
            );
          })}
        </div>
      )}

      {showCreate && canCreateContract && (
        <NewContractModal
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['contracts', projectId] });
            queryClient.invalidateQueries({ queryKey: ['project-gantt', projectId] });
            queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
