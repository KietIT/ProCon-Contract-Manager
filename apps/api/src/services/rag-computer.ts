import type { RagStatus, ContractStatus } from '@tar/shared';

interface ContractWithMilestones {
  milestones: Array<{
    status: string;
    dueDate: Date;
  }>;
  costEntries: Array<{
    amount: number | string | { toNumber(): number };
  }>;
  contractValue: number | string | { toNumber(): number };
}

interface ContractForStatus extends ContractWithMilestones {
  status: string;
  aiExtractionStatus: string;
}

export function computeContractRag(contract: ContractWithMilestones): RagStatus {
  const today = new Date();
  const overdueMilestones = contract.milestones.filter(
    (m) => m.status !== 'complete' && m.status !== 'waived' && new Date(m.dueDate) < today
  );
  const burnRate = computeBurnRate(contract);

  // RED: any overdue milestone OR burn > 100%
  if (overdueMilestones.length > 0 || burnRate > 1.0) return 'red';

  // AMBER: burn > 80% OR milestone due within 3 days
  const imminentMilestones = contract.milestones.filter((m) => {
    const daysUntilDue = (new Date(m.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return m.status !== 'complete' && daysUntilDue <= 3 && daysUntilDue >= 0;
  });

  if (burnRate > 0.8 || imminentMilestones.length > 0) return 'amber';

  return 'green';
}

/**
 * Compute contract lifecycle status based on milestones, RAG, and extraction state.
 * Only auto-escalates severity — never downgrades a manual user decision.
 *
 * Severity order: draft < active < at_risk < complete/disputed (manual)
 * - 'disputed' and 'complete' are always preserved (user decisions)
 * - 'at_risk' is preserved even if RAG improves (user must manually change)
 * - 'draft' -> 'active' when milestones exist or extraction confirmed
 * - 'active' -> 'at_risk' when RAG turns red
 * - Any status -> 'complete' when all milestones are done
 */
export function computeContractStatus(
  contract: ContractForStatus,
  computedRag?: RagStatus
): ContractStatus {
  const currentStatus = contract.status as ContractStatus;

  // Never override manual user decisions
  if (currentStatus === 'disputed') return 'disputed';
  if (currentStatus === 'complete') return 'complete';

  const milestones = contract.milestones;
  const hasMilestones = milestones.length > 0;

  // All milestones complete/waived -> auto-escalate to complete from any status
  if (hasMilestones && milestones.every((m) => m.status === 'complete' || m.status === 'waived')) {
    return 'complete';
  }

  // RAG red -> escalate to at_risk
  const rag = computedRag ?? computeContractRag(contract);
  if (rag === 'red') return 'at_risk';

  // Already at_risk but RAG no longer red -> keep at_risk (user must manually downgrade)
  if (currentStatus === 'at_risk') return 'at_risk';

  // Has milestones or extraction confirmed -> active (only from draft)
  if (hasMilestones || contract.aiExtractionStatus === 'confirmed') {
    return 'active';
  }

  // Default
  return 'draft';
}

function computeBurnRate(contract: ContractWithMilestones): number {
  const totalSpent = contract.costEntries.reduce((sum, e) => sum + Number(e.amount), 0);
  return Number(contract.contractValue) > 0 ? totalSpent / Number(contract.contractValue) : 0;
}
