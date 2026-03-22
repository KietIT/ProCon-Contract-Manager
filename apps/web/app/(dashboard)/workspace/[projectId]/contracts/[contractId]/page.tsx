'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { formatCurrency, formatDate, ragColor, statusColor, daysFromNow } from '@/lib/utils';
import {
  ArrowLeft, ArrowLeftRight, AlertCircle, FileText, Zap, CheckSquare,
  CheckCircle2, Clock, Plus, X, Trash2, Loader2, Eye,
  ChevronDown, ChevronUp, Edit2, Upload, Download, History, Undo2,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi, milestonesApi, usersApi, type ContractVersionResponse } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import SourcePanel from '@/components/contracts/source-panel';
import UpdateContractModal from '@/components/contracts/update-contract-modal';
import { RagTooltip } from '@/components/rag-tooltip';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(() => import('@/components/contracts/pdf-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
    </div>
  ),
});

const DiffViewerModal = dynamic(
  () => import('@/components/contracts/diff-viewer/DiffViewerModal'),
  { ssr: false }
);

const TABS = ['Overview', 'Document', 'AI Extraction', 'Milestones'];

const milestoneTypeIcon: Record<string, string> = {
  completion: '🏁', payment_trigger: '💰', inspection: '🔍', handover: '🤝', penalty_threshold: '⚠️',
};

interface EquipmentItem {
  item_no: string;
  equipment_tag_no: string;
  equipment_description: string;
  manufacturer: string | null;
  model_no: string | null;
  serial_no: string | null;
  quantity: string;
  unit: string;
  location: string | null;
  remarks: string | null;
  confidence: number;
  source_clause: string;
}

interface SourcePanelState {
  clause: string;
  confidence?: number;
  label: string;
  itemKey: string;
}

interface EnrichedMilestone {
  [key: string]: unknown;
  isOverdue: boolean;
  delayDays: number;
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  dueDate: string;
  source: string;
  aiConfidence: number | null;
  assignedTo: { name: string } | null;
  pendingApproval: { id: string; status: string; slaDeadline: string } | null;
}

function enrichMilestone(m: Record<string, unknown>): EnrichedMilestone {
  const dueDate = m.dueDate as string;
  const status = m.status as string;
  const isOverdue = new Date(dueDate) < new Date() && status !== 'complete' && status !== 'waived';
  const delayDays = isOverdue ? Math.ceil((Date.now() - new Date(dueDate).getTime()) / 86400000) : 0;
  return { ...m, isOverdue, delayDays } as EnrichedMilestone;
}

// ── MilestoneCard ─────────────────────────────────────────

function MilestoneCard({
  milestone, onComplete, canComplete, canEdit, onEdit,
}: {
  milestone: EnrichedMilestone;
  onComplete: () => void;
  canComplete: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const days = daysFromNow(milestone.dueDate);
  const isPending = !!milestone.pendingApproval;
  const status = milestone.status;

  const borderClass = milestone.isOverdue && !isPending
    ? 'border-red-500/20 bg-red-500/5'
    : isPending
    ? 'border-amber-500/20 bg-amber-500/5'
    : 'border-app-border bg-app-card hover:bg-sidebar-alt';

  return (
    <div className={`rounded-xl border transition-all ${borderClass}`}>
      <div className="flex items-start gap-3 p-4">
        <span className="text-lg flex-shrink-0 mt-0.5">{milestoneTypeIcon[milestone.type] || '📋'}</span>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-semibold text-app-text">{milestone.title}</h4>

            {/* Status badge */}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border capitalize ${statusColor(isPending ? 'pending_approval' : status)}`}>
              {isPending ? 'Pending Approval' : status.replace(/_/g, ' ')}
            </span>

            {/* Type badge */}
            <span className="px-2 py-0.5 rounded-full text-xs border border-app-border text-app-text-muted capitalize">
              {milestone.type.replace(/_/g, ' ')}
            </span>

            {/* AI confidence badge */}
            {milestone.source === 'ai_extracted' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold border text-purple-400 bg-purple-500/10 border-purple-500/20">
                AI {milestone.aiConfidence ? `${Math.round(milestone.aiConfidence * 100)}%` : ''}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs text-app-text-muted mb-1 flex-wrap">
            <span className={`flex items-center gap-1 ${milestone.isOverdue ? 'text-red-400' : days <= 3 && days >= 0 ? 'text-amber-400' : ''}`}>
              <Clock className="w-3 h-3" />
              {milestone.isOverdue
                ? `${milestone.delayDays}d overdue`
                : days === 0
                ? 'Due today'
                : `Due ${formatDate(milestone.dueDate)}`}
            </span>
            <span>{milestone.assignedTo?.name || 'Unassigned'}</span>
            {isPending && <span className="text-amber-400">⏳ Awaiting approval</span>}
          </div>

          {/* Collapsible description */}
          {milestone.description && (
            <>
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-xs text-app-text-muted hover:text-app-text transition-colors mt-1"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? 'Hide details' : 'View details'}
              </button>
              {expanded && (
                <p className="text-xs text-app-text-muted mt-2 p-2 rounded-lg bg-sidebar-alt border border-app-border italic leading-relaxed">
                  {milestone.description}
                </p>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-1">
          {canEdit && (
            <button
              onClick={onEdit}
              title="Edit milestone"
              className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canComplete && status !== 'complete' && status !== 'waived' && !isPending && (
            <button
              onClick={onComplete}
              className="px-3 py-1.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-xs font-semibold hover:bg-accent-cyan/20 transition-all whitespace-nowrap"
            >
              Mark Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
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

// ── ConfidenceDot ─────────────────────────────────────────

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color = confidence >= 0.8 ? 'bg-green-400' : confidence >= 0.7 ? 'bg-amber-400' : 'bg-red-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color} flex-shrink-0`} />;
}

// ── EquipmentTable ────────────────────────────────────────

function EquipmentTable({
  items, activeItemKey, onRowClick,
}: {
  items: EquipmentItem[];
  activeItemKey: string | null;
  onRowClick: (item: EquipmentItem, index: number) => void;
}) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-10 rounded-2xl bg-app-card border border-app-border">
        <p className="text-app-text-muted text-sm">No equipment list found in this contract</p>
      </div>
    );
  }

  const highConf = items.filter(e => e.confidence >= 0.8).length;
  const needsReview = items.filter(e => e.confidence < 0.7).length;

  const COLS = [
    { key: 'item_no', label: 'Item No', w: 'w-16' },
    { key: 'equipment_tag_no', label: 'Equipment Tag No', w: 'w-32' },
    { key: 'equipment_description', label: 'Equipment Description', w: 'w-64' },
    { key: 'manufacturer', label: 'Manufacturer', w: 'w-32' },
    { key: 'model_no', label: 'Model No', w: 'w-28' },
    { key: 'serial_no', label: 'Serial No', w: 'w-28' },
    { key: 'quantity', label: 'Qty', w: 'w-16' },
    { key: 'unit', label: 'Unit', w: 'w-16' },
    { key: 'location', label: 'Location', w: 'w-32' },
    { key: 'remarks', label: 'Remarks', w: 'w-40' },
  ] as const;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-app-text">Equipment List</h2>
      </div>
      <div className="flex items-center gap-4 mb-4 px-1 text-sm text-app-text-muted">
        <span>{items.length} equipment items extracted</span>
        <span>·</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> {highConf} high confidence</span>
        <span>·</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {needsReview} need review</span>
      </div>
      <div className="rounded-xl border border-app-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar-alt sticky top-0 z-10">
                <th className="px-3 py-3 text-left text-xs font-bold text-app-text-muted uppercase tracking-wider w-8" />
                {COLS.map(col => (
                  <th key={col.key} className={`px-3 py-3 text-left text-xs font-bold text-app-text-muted uppercase tracking-wider ${col.w} whitespace-nowrap`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const itemKey = `equip-${i}`;
                const isActive = activeItemKey === itemKey;
                return (
                  <tr
                    key={i}
                    onClick={() => onRowClick(item, i)}
                    title="Click to verify source in contract"
                    className={`border-t border-app-border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-accent-cyan/10 border-l-2 border-l-accent-cyan'
                        : `hover:bg-sidebar-alt ${i % 2 === 1 ? 'bg-app-card' : ''}`
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center"><ConfidenceDot confidence={item.confidence} /></td>
                    {COLS.map(col => (
                      <td key={col.key} className={`px-3 py-2.5 text-app-text ${col.w} whitespace-nowrap`}>
                        {(item[col.key as keyof EquipmentItem] as string | null) || '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── LoadingSkeleton ───────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-pulse">
      <div className="mb-6">
        <div className="h-4 w-24 bg-sidebar-alt rounded mb-4" />
        <div className="h-8 w-64 bg-sidebar-alt rounded mb-2" />
        <div className="h-4 w-96 bg-sidebar-alt rounded" />
      </div>
      <div className="flex gap-1 mb-6 border-b border-app-border pb-2">
        {[1, 2, 3].map(i => <div key={i} className="h-8 w-28 bg-sidebar-alt rounded-t-lg" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-app-card border border-app-border p-6 space-y-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex justify-between py-2 border-b border-app-border">
              <div className="h-4 w-28 bg-sidebar-alt rounded" />
              <div className="h-4 w-32 bg-sidebar-alt rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-app-card border border-app-border p-8 h-40" />
          <div className="rounded-2xl bg-app-card border border-app-border p-6 h-32" />
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export default function ContractDetailPage() {
  const router = useRouter();
  const { projectId, contractId } = useParams<{ projectId: string; contractId: string }>();
  const { user } = useAppStore();
  const role = user?.role;
  const queryClient = useQueryClient();

  // Role-based permissions
  // !role covers the window before AuthSync async fetch completes (dev mode)
  const canDelete = role === 'tar_manager';
  const canParseAI = !role || role === 'tar_manager' || role === 'procurement';
  const canAddMilestone = !role || role === 'tar_manager' || role === 'contract_manager';
  const canCompleteMilestone = role === 'tar_manager' || role === 'contractor';
  const canEdit = role === 'tar_manager' || role === 'contract_manager';

  // ── Tab + parse state ──
  const [activeTab, setActiveTab] = useState('Overview');
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Source verification → PDF navigation ──
  const [sourcePanel, setSourcePanel] = useState<SourcePanelState | null>(null);
  const [pdfSearch, setPdfSearch] = useState<{ text: string; label: string; pageHints?: number[] } | null>(null);
  const contractRef = useRef<Record<string, unknown> | undefined>(undefined);

  const openSourcePanel = useCallback(async (clause: string, label: string, itemKey: string, confidence?: number) => {
    if (!clause) return;
    const mime = contractRef.current?.fileMimeType as string | undefined;
    if (mime?.includes('pdf')) {
      // Call server-side locate-clause for better matching — returns matched_text + page_numbers
      try {
        const res = await contractsApi.locateClause(contractId, clause);
        const result = res?.data;
        if (result?.found && result.matched_text) {
          setPdfSearch({
            text: result.matched_text,
            label,
            pageHints: result.page_numbers?.length > 0 ? result.page_numbers : undefined,
          });
        } else {
          setPdfSearch({ text: clause, label });
        }
      } catch {
        setPdfSearch({ text: clause, label });
      }
      setActiveTab('Document');
    } else {
      setSourcePanel({ clause, label, itemKey, confidence });
    }
  }, [contractId]);
  const closeSourcePanel = useCallback(() => setSourcePanel(null), []);
  const clearPdfSearch = useCallback(() => setPdfSearch(null), []);

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  // ── Milestone modals ──
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    title: '', description: '', type: 'completion', dueDate: '',
    assignedToUserId: '', requiresApproval: false,
  });

  const [editingMilestone, setEditingMilestone] = useState<EnrichedMilestone | null>(null);
  const [editForm, setEditForm] = useState({ dueDate: '', assignedToUserId: '', status: '' });

  // ── Accept/Reject extraction flow ──
  const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(new Set());
  const [rejectedIndices, setRejectedIndices] = useState<Set<number>>(new Set());
  const [rejectingIndex, setRejectingIndex] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acceptingIndex, setAcceptingIndex] = useState<number | null>(null);

  // ── Update Contract (versioning) ──
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Open edit modal pre-filled with milestone data
  const openEdit = useCallback((m: EnrichedMilestone) => {
    setEditingMilestone(m);
    setEditForm({
      dueDate: m.dueDate ? m.dueDate.split('T')[0] : '',
      assignedToUserId: (m.assignedTo as any)?.id ?? '',
      status: m.status,
    });
  }, []);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Queries ──

  const { data: contractData, isLoading: contractLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => contractsApi.get(contractId),
  });
  const contract = contractData?.data as Record<string, unknown> | undefined;
  contractRef.current = contract;

  const { data: milestonesData, isLoading: milestonesLoading } = useQuery({
    queryKey: ['milestones', contractId],
    queryFn: () => milestonesApi.list(contractId),
  });
  const rawMilestones = (milestonesData?.data ?? []) as Record<string, unknown>[];
  const milestones = rawMilestones.map(enrichMilestone);

  // Users list — for assignment dropdown (managers only)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: canEdit || canAddMilestone,
  });
  const users = (usersData?.data ?? []) as Record<string, unknown>[];

  // Contract versions
  const { data: versionsData } = useQuery({
    queryKey: ['contract-versions', contractId],
    queryFn: () => contractsApi.listVersions(contractId),
    enabled: !!contract,
  });
  const currentVersion = (contract?.currentVersion as number) ?? 1;
  const versions = (versionsData?.data?.versions ?? []) as ContractVersionResponse[];

  // AI extraction data
  const aiExtractionStatus = contract?.aiExtractionStatus as string | undefined;
  const aiData = contract?.aiExtractionData as {
    milestones: Record<string, unknown>[];
    obligations?: Record<string, unknown>[];
    penalty_clauses?: Record<string, unknown>[];
    payment_triggers?: Record<string, unknown>[];
    key_dates?: Record<string, unknown>[];
    equipment_list?: EquipmentItem[];
  } | null;

  // ── Mutations ──

  const completeMilestone = useMutation({
    mutationFn: (id: string) => milestonesApi.complete(id),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      if (res?.data?.status === 'pending_approval') {
        queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
        showToast('Sent for approval ✓');
      } else {
        showToast('Milestone marked complete ✓');
      }
    },
    onError: () => showToast('Failed to complete milestone', 'error'),
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      milestonesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', contractId] });
      setEditingMilestone(null);
      showToast('Milestone updated ✓');
    },
    onError: () => showToast('Failed to update milestone', 'error'),
  });

  // Kept for backward compatibility — batch confirm all milestones at once
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const confirmExtraction = useMutation({
    mutationFn: (extractedMilestones: Record<string, unknown>[]) =>
      contractsApi.confirmExtraction(contractId, extractedMilestones),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['milestones', contractId] });
      setActiveTab('Milestones');
    },
  });

  // Accept a single AI-extracted milestone
  const acceptMilestoneMutation = useMutation({
    mutationFn: async ({ milestone, index }: { milestone: Record<string, unknown>; index: number }) => {
      setAcceptingIndex(index);
      const dueDate = milestone.due_date
        ? new Date(milestone.due_date as string).toISOString().split('T')[0]
        : '2099-12-31';
      return milestonesApi.create(contractId, {
        title: milestone.title,
        description: milestone.description,
        type: milestone.type,
        dueDate,
        requiresApproval: true,
        source: 'ai_extracted',
        aiConfidence: Number(milestone.confidence) || 0,
      });
    },
    onSuccess: (_res, { index }) => {
      setAcceptedIndices(prev => new Set(prev).add(index));
      setAcceptingIndex(null);
      queryClient.invalidateQueries({ queryKey: ['milestones', contractId] });
      showToast('Milestone accepted and created ✓');
    },
    onError: () => {
      setAcceptingIndex(null);
      showToast('Failed to accept milestone', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => contractsApi.delete(contractId),
    onSuccess: () => { router.push(`/workspace/${projectId}/contracts`); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: string) => contractsApi.update(contractId, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      showToast('Contract status updated');
    },
    onError: () => showToast('Failed to update status', 'error'),
  });

  const addMilestoneMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => milestonesApi.create(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', contractId] });
      setShowAddMilestone(false);
      setMilestoneForm({ title: '', description: '', type: 'completion', dueDate: '', assignedToUserId: '', requiresApproval: false });
      showToast('Milestone added ✓');
    },
    onError: () => showToast('Failed to add milestone', 'error'),
  });

  const revertVersionMutation = useMutation({
    mutationFn: () => contractsApi.revertCurrentVersion(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contract-versions', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts', projectId] });
      showToast(`Reverted to version ${currentVersion - 1}`);
    },
    onError: (err: Error) => showToast(err.message || 'Failed to revert version', 'error'),
  });

  // ── AI Parse with polling ──
  async function handleParse() {
    console.log('[Parse] contract.fileKey:', contract?.fileKey);
    console.log('[Parse] contractId:', contractId);
    console.log('[Parse] user role:', role);
    if (!contract?.fileKey) return;
    setParsing(true);
    setParseProgress(0);
    try {
      const { data } = await contractsApi.parse(contractId) as { data: { jobId: string } };
      const jobId = data.jobId;

      pollRef.current = setInterval(async () => {
        try {
          const status = await contractsApi.getParsJobStatus(contractId, jobId) as {
            data: { progress?: number; status?: string };
          };
          const progress = status.data?.progress ?? 0;
          setParseProgress(progress);

          if (progress >= 100 || status.data?.status === 'completed') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setParsing(false);
            queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
            setActiveTab('AI Extraction');
          }
          if (status.data?.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setParsing(false);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setParsing(false);
        }
      }, 2000);
    } catch {
      setParsing(false);
    }
  }

  // Restore accepted indices on page load by matching AI milestones to existing milestones
  useEffect(() => {
    if (!aiData?.milestones || !milestones.length) return;
    const restored = new Set<number>();
    aiData.milestones.forEach((extracted, i) => {
      const titleMatch = milestones.some(
        m => m.title === extracted.title && m.source === 'ai_extracted'
      );
      if (titleMatch) restored.add(i);
    });
    if (restored.size > 0 && restored.size !== acceptedIndices.size) {
      setAcceptedIndices(restored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiData?.milestones, milestones]);

  // Auto-confirm extraction when all milestones have been accepted or rejected
  const aiExtractionStatusRef = useRef(aiExtractionStatus);
  aiExtractionStatusRef.current = aiExtractionStatus;
  useEffect(() => {
    if (aiExtractionStatusRef.current !== 'review') return;
    if (!aiData?.milestones?.length) return;
    const total = aiData.milestones.length;
    const processed = acceptedIndices.size + rejectedIndices.size;
    if (processed >= total && total > 0) {
      contractsApi.update(contractId, { aiExtractionStatus: 'confirmed' }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      });
    }
  }, [acceptedIndices.size, rejectedIndices.size, aiData?.milestones?.length, contractId, queryClient]);

  // ── Loading ──
  if (contractLoading || milestonesLoading) return <LoadingSkeleton />;

  if (!contract) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center gap-3 p-6 rounded-2xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <p className="text-red-400">Contract not found</p>
        </div>
      </div>
    );
  }

  // ── Grouped milestones ──
  const groupedMilestones = {
    pending_approval: milestones.filter(m => !!m.pendingApproval),
    overdue: milestones.filter(m => m.isOverdue && !m.pendingApproval),
    in_progress: milestones.filter(m => !m.isOverdue && m.status === 'in_progress' && !m.pendingApproval),
    not_started: milestones.filter(m => m.status === 'not_started'),
    complete: milestones.filter(m => m.status === 'complete'),
    waived: milestones.filter(m => m.status === 'waived'),
  };

  const needsReview = aiExtractionStatus === 'review';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="mb-6">
        <Link href={`/workspace/${projectId}/contracts`} className="flex items-center gap-1.5 text-app-text-muted hover:text-app-text text-sm mb-2 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Contracts
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-app-text mb-1">{contract.contractNumber as string}</h1>
            <div className="flex items-center gap-3 flex-wrap text-sm text-app-text-muted">
              <span>{(contract.contractorOrg as Record<string, unknown>)?.name as string}</span>
              <span>·</span>
              <span className="capitalize">{contract.type as string}</span>
              <span>·</span>
              <span>{formatCurrency(Number(contract.contractValue))}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${ragColor(contract.ragStatus as string)}`}>
                {(contract.ragStatus as string)?.toUpperCase()}
              </span>
              <RagTooltip />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canEdit && (
              <button
                onClick={() => setShowUpdateModal(true)}
                disabled={parsing}
                className="flex items-center gap-2 px-4 py-2.5 bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan rounded-lg font-semibold text-sm hover:bg-accent-cyan/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Update Contract
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this contract?')) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending || parsing}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg font-semibold text-sm hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            )}

            {canParseAI && !!contract.fileKey && (
              <>
                {!parsing && (aiExtractionStatus === 'pending' || aiExtractionStatus === 'failed') && (
                  <div className="relative group">
                    <button
                      onClick={handleParse}
                      className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg font-semibold text-sm hover:bg-purple-500/30 transition-all"
                    >
                      <Zap className="w-4 h-4" />
                      Parse with AI
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-sidebar-bg border border-app-border text-xs text-app-text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                      Extract milestones, equipment list, and clauses with AI
                    </div>
                  </div>
                )}
                {parsing && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg min-w-[260px]">
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-purple-300 mb-1">AI is analyzing your contract... {parseProgress}%</p>
                      <div className="h-1.5 bg-purple-500/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-500" style={{ width: `${parseProgress}%` }} />
                      </div>
                    </div>
                  </div>
                )}
                {!parsing && aiExtractionStatus === 'review' && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      AI Extraction Complete
                    </span>
                    <button onClick={handleParse} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-border text-app-text-muted text-xs font-semibold hover:text-app-text hover:bg-sidebar-alt transition-all">
                      <Zap className="w-3 h-3" /> Re-parse
                    </button>
                  </div>
                )}
                {!parsing && aiExtractionStatus === 'confirmed' && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sidebar-alt border border-app-border text-app-text-muted text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Extraction Confirmed
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-app-border mb-6 gap-1">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
              activeTab === tab
                ? 'text-accent-cyan border-b-2 border-accent-cyan bg-accent-cyan/5'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {tab}
            {tab === 'Document' && !!contract?.fileKey && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded-full">PDF</span>
            )}
            {tab === 'AI Extraction' && needsReview && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">Review</span>
            )}
            {tab === 'Milestones' && milestones.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-sidebar-alt text-app-text-muted rounded-full">{milestones.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-app-card border border-app-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-app-text-muted uppercase tracking-wider">Contract Details</h2>
            {[
              { label: 'Contract Number', value: contract.contractNumber as string },
              { label: 'Type', value: (contract.type as string)?.replace('_', ' ') },
              { label: 'Spending Type', value: (contract.spendingType as string)?.toUpperCase() },
              { label: 'Department', value: ({ rotating: 'Rotating', instrument: 'Instrument', static_dept: 'Static', electrical: 'Electrical', process_control_automation: 'Process Control Automation' } as Record<string, string>)[contract.department as string] || (contract.department as string) },
              { label: 'Contractor', value: (contract.contractorOrg as Record<string, unknown>)?.name as string },
              { label: 'Contract Value', value: formatCurrency(Number(contract.contractValue)) },
              { label: 'Start Date', value: formatDate(contract.startDate as string) },
              { label: 'End Date', value: formatDate(contract.endDate as string) },
              { label: 'AI Status', value: aiExtractionStatus },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-app-border">
                <span className="text-sm text-app-text-muted">{label}</span>
                <span className="text-sm text-app-text font-medium capitalize">{value || '—'}</span>
              </div>
            ))}
            {/* Status row with editable dropdown for managers */}
            <div className="flex justify-between items-center py-2 border-b border-app-border">
              <span className="text-sm text-app-text-muted">Status</span>
              {canEdit ? (
                <select
                  value={contract.status as string}
                  onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                  disabled={updateStatusMutation.isPending}
                  className={`text-sm font-medium capitalize rounded-lg px-2.5 py-1 border cursor-pointer bg-transparent focus:outline-none focus:ring-1 focus:ring-accent-cyan ${statusColor(contract.status as string)}`}
                >
                  {['draft', 'active', 'at_risk', 'complete', 'disputed'].map((s) => (
                    <option key={s} value={s} className="bg-app-bg text-app-text">
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${statusColor(contract.status as string)}`}>
                  {(contract.status as string)?.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {!contract.fileKey ? (
              <div className="rounded-2xl bg-app-card border border-dashed border-app-border p-8 text-center">
                <FileText className="w-10 h-10 text-app-text-muted mx-auto mb-3" />
                <p className="text-app-text-muted text-sm font-semibold mb-1">No Contract File Uploaded</p>
                <p className="text-app-text-muted text-xs">Upload a PDF/DOCX to enable AI parsing</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-purple-500/5 border border-purple-500/20 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-app-text">Contract File Attached</p>
                    <p className="text-xs text-app-text-muted capitalize">{contract.fileMimeType as string}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className={`w-2 h-2 rounded-full ${aiExtractionStatus === 'confirmed' ? 'bg-green-400' : aiExtractionStatus === 'review' ? 'bg-amber-400 animate-pulse' : 'bg-app-text-muted'}`} />
                  <span className="text-xs text-app-text-muted capitalize">AI Status: {aiExtractionStatus}</span>
                </div>
              </div>
            )}

            {(contract.costEntries as Record<string, unknown>[] | undefined)?.length ? (
              <div className="rounded-2xl bg-app-card border border-app-border p-6">
                <h3 className="text-sm font-bold text-app-text-muted uppercase tracking-wider mb-4">Cost Entries</h3>
                <div className="space-y-2">
                  {(contract.costEntries as Record<string, unknown>[]).slice(0, 5).map((e) => (
                    <div key={e.id as string} className="flex justify-between text-sm">
                      <span className="text-app-text-muted capitalize">{e.category as string}</span>
                      <span className="text-app-text font-medium">{formatCurrency(Number(e.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Version History */}
            <div className="rounded-2xl bg-app-card border border-app-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-app-text-muted" />
                  <h3 className="text-sm font-bold text-app-text-muted uppercase tracking-wider">Version History</h3>
                </div>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
                  v{currentVersion}
                </span>
              </div>

              {versions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-app-text-muted">
                    {currentVersion === 1
                      ? 'Original version — no previous versions'
                      : 'No previous versions found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Current version indicator */}
                  <div className="flex items-start gap-3 pb-3 border-b border-app-border">
                    <div className="w-6 h-6 rounded-full bg-accent-cyan/20 border border-accent-cyan/40 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-accent-cyan">v{currentVersion}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-app-text">Current Version</p>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500/20 text-green-400 border border-green-500/20">
                            CURRENT
                          </span>
                        </div>
                        {currentVersion > 1 && (
                          <button
                            onClick={() => setShowDiffModal(true)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-accent-cyan hover:bg-accent-cyan/10 border border-accent-cyan/20 hover:border-accent-cyan/30 transition-all shrink-0"
                            title="Compare versions"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                            View Diff
                          </button>
                        )}
                        {canEdit && currentVersion > 1 && (
                          <button
                            onClick={() => {
                              if (window.confirm(
                                `Revert to version ${currentVersion - 1}? The current file (v${currentVersion}) will be removed and the previous version will be restored.`
                              )) {
                                revertVersionMutation.mutate();
                              }
                            }}
                            disabled={revertVersionMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                            title="Remove current version and restore previous"
                          >
                            {revertVersionMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Undo2 className="w-3 h-3" />
                            )}
                            Revert
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-app-text-muted mt-0.5">Active contract document</p>
                    </div>
                  </div>

                  {/* Previous versions */}
                  {versions.map((v) => (
                    <div key={v.id} className="flex items-start gap-3 pb-3 border-b border-app-border last:border-0 last:pb-0">
                      <div className="w-6 h-6 rounded-full bg-sidebar-alt border border-app-border flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-app-text-muted">v{v.versionNumber}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-app-text truncate">
                            {v.changeNote || `Version ${v.versionNumber}`}
                          </p>
                          <a
                            href={contractsApi.getVersionFileUrl(contractId, v.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-sidebar-alt text-app-text-muted hover:text-app-text transition-colors shrink-0"
                            title="Download this version"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-app-text-muted">
                            {new Date(v.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-xs text-app-text-muted">·</span>
                          <span className="text-xs text-app-text-muted truncate">
                            {v.uploadedBy.name}
                          </span>
                          {v.aiExtractionStatus !== 'pending' && (
                            <>
                              <span className="text-xs text-app-text-muted">·</span>
                              <span className={`text-xs capitalize ${
                                v.aiExtractionStatus === 'confirmed' ? 'text-green-400' :
                                v.aiExtractionStatus === 'review' ? 'text-amber-400' :
                                v.aiExtractionStatus === 'failed' ? 'text-red-400' :
                                'text-app-text-muted'
                              }`}>
                                AI: {v.aiExtractionStatus}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Document Tab ── */}
      {activeTab === 'Document' && (
        <div>
          {!contract.fileKey ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-sidebar-alt border border-app-border flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-app-text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-app-text mb-2">No Document Uploaded</h3>
              <p className="text-app-text-muted text-sm">Upload a PDF or DOCX file to view it here</p>
            </div>
          ) : (contract.fileMimeType as string)?.includes('pdf') ? (
            <PdfViewer
              fileUrl={contractsApi.getFileUrl(contractId)}
              contractId={contractId}
              highlightText={pdfSearch?.text}
              searchLabel={pdfSearch?.label}
              pageHints={pdfSearch?.pageHints}
              onClearSearch={clearPdfSearch}
            />
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-sidebar-alt border border-app-border flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-app-text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-app-text mb-2">Document Preview Not Available</h3>
              <p className="text-app-text-muted text-sm mb-4">
                PDF viewer only supports PDF files. This file is: {contract.fileMimeType as string}
              </p>
              <a
                href={contractsApi.getFileUrl(contractId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan rounded-lg font-semibold text-sm hover:bg-accent-cyan/20 transition-all"
              >
                <FileText className="w-4 h-4" /> Download File
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── AI Extraction Tab ── */}
      {activeTab === 'AI Extraction' && (
        <div>
          {!contract.fileKey ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-sidebar-alt border border-app-border flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-app-text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-app-text mb-2">No file uploaded</h3>
              <p className="text-app-text-muted text-sm">Upload a contract file first to use AI extraction</p>
            </div>
          ) : !aiData ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-app-text mb-2">Ready to Parse</h3>
              <p className="text-app-text-muted text-sm mb-6">Click &quot;Parse with AI&quot; above to extract milestones from this contract</p>
            </div>
          ) : (
            <div>
              <EquipmentTable
                items={aiData.equipment_list ?? []}
                activeItemKey={sourcePanel?.itemKey ?? null}
                onRowClick={(item, i) =>
                  openSourcePanel(item.source_clause, `Equipment: ${item.equipment_tag_no || item.equipment_description}`, `equip-${i}`, item.confidence)
                }
              />

              {(aiData.penalty_clauses?.length ?? 0) > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-app-text mb-4">Penalty Clauses</h2>
                  <div className="space-y-3">
                    {(aiData.penalty_clauses ?? []).map((p, i) => {
                      const itemKey = `penalty-${i}`;
                      const isActive = sourcePanel?.itemKey === itemKey;
                      const clause = (p.trigger as string) || '';
                      const conf = Number(p.confidence) || 0;
                      return (
                        <div key={i} className={`p-4 rounded-xl border transition-all ${isActive ? 'border-accent-cyan/40 bg-accent-cyan/5' : 'border-app-border bg-app-card hover:border-purple-500/30'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm">⚠️</span>
                                <h4 className="text-sm font-semibold text-app-text">{p.trigger as string}</h4>
                                <ConfidenceDot confidence={conf} />
                              </div>
                              <p className="text-xs text-app-text-muted ml-6 mb-1">
                                Amount: <span className="text-amber-400">{p.amount_or_rate as string}</span>
                                {(p.cap as string) && <> · Cap: <span className="text-app-text">{p.cap as string}</span></>}
                              </p>
                            </div>
                            {clause && (
                              <button onClick={() => openSourcePanel(clause, `Penalty: ${(p.trigger as string).slice(0, 40)}`, itemKey, conf)} title="Click to verify source in contract" className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-app-text-muted hover:text-purple-300 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all shrink-0">
                                <Eye className="w-3 h-3" /> Source
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const totalMilestones = aiData.milestones?.length || 0;
                const pendingCount = totalMilestones - acceptedIndices.size - rejectedIndices.size;
                return (
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-app-text">AI Extracted Milestones</h2>
                      <p className="text-sm text-app-text-muted mt-1">
                        {totalMilestones} milestones found
                        {needsReview && pendingCount > 0 && <> — {pendingCount} pending review, accept or reject individually</>}
                        {needsReview && pendingCount === 0 && <> — all milestones reviewed</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {acceptedIndices.size > 0 && (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {acceptedIndices.size} accepted
                        </span>
                      )}
                      {rejectedIndices.size > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <X className="w-3.5 h-3.5" /> {rejectedIndices.size} rejected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-3">
                {(aiData.milestones || []).map((m, i) => {
                  // Hide rejected items
                  if (rejectedIndices.has(i)) return null;
                  const isAccepted = acceptedIndices.has(i);
                  const itemKey = `milestone-${i}`;
                  const isActive = sourcePanel?.itemKey === itemKey;
                  const clause = (m.source_clause as string) || '';
                  const conf = Number(m.confidence) || 0;
                  const isAccepting = acceptingIndex === i;
                  const isRejecting = rejectingIndex === i;
                  return (
                    <div key={i} className={`rounded-xl border transition-all ${
                      isAccepted ? 'border-green-500/30 bg-green-500/5 opacity-60' :
                      isActive ? 'border-accent-cyan/40 bg-accent-cyan/5' :
                      'border-app-border bg-app-card hover:border-purple-500/30'
                    }`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm">{milestoneTypeIcon[m.type as string] || '📋'}</span>
                              <h4 className="text-sm font-semibold text-app-text">{m.title as string}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${conf > 0.8 ? 'text-green-400 bg-green-500/10 border border-green-500/20' : conf > 0.6 ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-app-text-muted bg-sidebar-alt border border-app-border'}`}>
                                {Math.round(conf * 100)}% confident
                              </span>
                              {isAccepted && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Accepted
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-app-text-muted ml-6 mb-2">{m.description as string}</p>
                            {!!m.due_date && <p className="text-xs text-accent-cyan ml-6">Due: {formatDate(m.due_date as string)}</p>}
                            {!!m.source_clause && <p className="text-xs text-app-text-muted ml-6 mt-1 italic line-clamp-2">&quot;{m.source_clause as string}&quot;</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {clause && (
                              <button onClick={() => openSourcePanel(clause, `Milestone: ${(m.title as string).slice(0, 40)}`, itemKey, conf)} title="Click to verify source in contract" className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-app-text-muted hover:text-purple-300 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all">
                                <Eye className="w-3.5 h-3.5" /> View source
                              </button>
                            )}
                            {needsReview && !isAccepted && (
                              <>
                                <button
                                  onClick={() => acceptMilestoneMutation.mutate({ milestone: m, index: i })}
                                  disabled={isAccepting}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50"
                                >
                                  {isAccepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  Accept
                                </button>
                                <button
                                  onClick={() => { setRejectingIndex(i); setRejectReason(''); }}
                                  disabled={isAccepting}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                                >
                                  <X className="w-3.5 h-3.5" /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Inline Reject Panel */}
                      {isRejecting && (
                        <div className="px-4 pb-4 pt-2 border-t border-red-500/20 bg-red-500/5 rounded-b-xl">
                          <label className="block text-xs font-semibold text-red-400 mb-2">Reason for rejection</label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter reason for rejecting this milestone..."
                            className="w-full px-3 py-2 rounded-lg bg-app-bg border border-red-500/20 text-sm text-app-text placeholder:text-app-text-muted/50 focus:outline-none focus:border-red-500/40 resize-none"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => {
                                if (!rejectReason.trim()) return;
                                setRejectedIndices(prev => new Set(prev).add(i));
                                setRejectingIndex(null);
                                setRejectReason('');
                                showToast('Milestone rejected');
                              }}
                              disabled={!rejectReason.trim()}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <X className="w-3 h-3" /> Confirm Reject
                            </button>
                            <button
                              onClick={() => { setRejectingIndex(null); setRejectReason(''); }}
                              className="px-3 py-1.5 rounded-lg text-xs text-app-text-muted hover:text-app-text border border-app-border hover:border-app-border/80 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Milestones Tab ── */}
      {activeTab === 'Milestones' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-app-text">
              Milestones <span className="text-app-text-muted font-normal text-base ml-2">({milestones.length})</span>
            </h2>
            {canAddMilestone && (
              <button
                onClick={() => setShowAddMilestone(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-accent-cyan text-trust-blue rounded-lg font-bold text-sm hover:brightness-110 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Milestone
              </button>
            )}
          </div>

          {milestones.length === 0 ? (
            <div className="text-center py-16">
              <CheckSquare className="w-12 h-12 text-app-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-app-text mb-2">No milestones yet</h3>
              <p className="text-app-text-muted text-sm">Use AI extraction or add milestones manually</p>
            </div>
          ) : (
            <div className="space-y-6">
              {(
                [
                  ['pending_approval', '⏳ Pending Approval', 'amber'],
                  ['overdue',          '🔴 Overdue',          'red'],
                  ['in_progress',      '🔵 In Progress',      'blue'],
                  ['not_started',      '⚪ Not Started',      'gray'],
                  ['complete',         '🟢 Complete',         'green'],
                  ['waived',           '⚫ Waived',           'gray'],
                ] as const
              ).map(([groupKey, label]) => {
                const items = groupedMilestones[groupKey as keyof typeof groupedMilestones];
                if (!items.length) return null;
                return (
                  <div key={groupKey}>
                    <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-3">
                      {label} ({items.length})
                    </h3>
                    <div className="space-y-2">
                      {items.map(m => (
                        <MilestoneCard
                          key={m.id}
                          milestone={m}
                          canComplete={canCompleteMilestone}
                          canEdit={canEdit}
                          onComplete={() => completeMilestone.mutate(m.id)}
                          onEdit={() => openEdit(m)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Add Milestone Modal ── */}
          {showAddMilestone && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddMilestone(false)} />
              <div className="relative bg-sidebar-bg border border-app-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-app-text">Add Milestone</h2>
                  <button onClick={() => setShowAddMilestone(false)} className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-sidebar-alt">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Title *</label>
                    <input
                      type="text"
                      value={milestoneForm.title}
                      onChange={e => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                      className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm placeholder-app-text-muted focus:outline-none focus:border-accent-cyan/50"
                      placeholder="e.g. Foundation completion inspection"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Description</label>
                    <textarea
                      value={milestoneForm.description}
                      onChange={e => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm placeholder-app-text-muted focus:outline-none focus:border-accent-cyan/50 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Type *</label>
                      <select
                        value={milestoneForm.type}
                        onChange={e => setMilestoneForm({ ...milestoneForm, type: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50"
                      >
                        {['completion', 'payment_trigger', 'inspection', 'handover', 'penalty_threshold'].map(t => (
                          <option key={t} value={t} className="bg-sidebar-bg">{t.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Due Date *</label>
                      <input
                        type="date"
                        value={milestoneForm.dueDate}
                        onChange={e => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Assign To</label>
                    <select
                      value={milestoneForm.assignedToUserId}
                      onChange={e => setMilestoneForm({ ...milestoneForm, assignedToUserId: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50"
                    >
                      <option value="" className="bg-sidebar-bg">Unassigned</option>
                      {users.map(u => (
                        <option key={u.id as string} value={u.id as string} className="bg-sidebar-bg">
                          {u.name as string} ({u.role as string})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-semibold text-app-text">Requires Approval</p>
                      <p className="text-xs text-app-text-muted">Marking complete will trigger an approval workflow</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMilestoneForm({ ...milestoneForm, requiresApproval: !milestoneForm.requiresApproval })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${milestoneForm.requiresApproval ? 'bg-accent-cyan' : 'bg-sidebar-alt border border-app-border'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${milestoneForm.requiresApproval ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowAddMilestone(false)} className="flex-1 py-2.5 rounded-lg border border-app-border text-sm font-semibold text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-all">Cancel</button>
                  <button
                    onClick={() => addMilestoneMutation.mutate({
                      title: milestoneForm.title,
                      description: milestoneForm.description,
                      type: milestoneForm.type,
                      dueDate: milestoneForm.dueDate,
                      ...(milestoneForm.assignedToUserId && { assignedToUserId: milestoneForm.assignedToUserId }),
                      requiresApproval: milestoneForm.requiresApproval,
                    })}
                    disabled={addMilestoneMutation.isPending || !milestoneForm.title || !milestoneForm.dueDate}
                    className="flex-1 py-2.5 rounded-lg bg-accent-cyan text-trust-blue font-bold text-sm hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {addMilestoneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Add Milestone
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Edit Milestone Modal ── */}
          {editingMilestone && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingMilestone(null)} />
              <div className="relative bg-sidebar-bg border border-app-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-app-text">Edit Milestone</h2>
                    <p className="text-xs text-app-text-muted mt-0.5 truncate max-w-xs">{editingMilestone.title}</p>
                  </div>
                  <button onClick={() => setEditingMilestone(null)} className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-sidebar-alt">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Status</label>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50"
                    >
                      {['not_started', 'in_progress', 'complete', 'waived'].map(s => (
                        <option key={s} value={s} className="bg-sidebar-bg">{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Due Date</label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Assign To</label>
                    <select
                      value={editForm.assignedToUserId}
                      onChange={e => setEditForm({ ...editForm, assignedToUserId: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50"
                    >
                      <option value="" className="bg-sidebar-bg">Unassigned</option>
                      {users.map(u => (
                        <option key={u.id as string} value={u.id as string} className="bg-sidebar-bg">
                          {u.name as string} ({u.role as string})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setEditingMilestone(null)} className="flex-1 py-2.5 rounded-lg border border-app-border text-sm font-semibold text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-all">Cancel</button>
                  <button
                    onClick={() => updateMilestoneMutation.mutate({
                      id: editingMilestone.id,
                      data: {
                        status: editForm.status,
                        dueDate: editForm.dueDate,
                        assignedToUserId: editForm.assignedToUserId || null,
                      },
                    })}
                    disabled={updateMilestoneMutation.isPending}
                    className="flex-1 py-2.5 rounded-lg bg-accent-cyan text-trust-blue font-bold text-sm hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updateMilestoneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Source Verification Panel ── */}
      {sourcePanel && (
        <SourcePanel
          contractId={contractId}
          sourceClause={sourcePanel.clause}
          confidence={sourcePanel.confidence}
          itemLabel={sourcePanel.label}
          onClose={closeSourcePanel}
        />
      )}

      {/* ── Update Contract Modal ── */}
      {showUpdateModal && (
        <UpdateContractModal
          contractId={contractId}
          contractNumber={contract.contractNumber as string}
          currentVersion={currentVersion}
          projectId={projectId}
          onClose={() => setShowUpdateModal(false)}
          onSuccess={() => {
            showToast(`Contract updated to version ${currentVersion + 1}`);
          }}
        />
      )}

      {showDiffModal && versions.length > 0 && (
        <DiffViewerModal
          contractId={contractId}
          currentVersion={currentVersion}
          versions={versions}
          onClose={() => setShowDiffModal(false)}
        />
      )}
    </div>
  );
}
