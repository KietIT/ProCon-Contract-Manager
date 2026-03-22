import { prisma } from '../lib/prisma';
import { sendApprovalRequestEmail } from './email';
import { resolvePrimaryApprover, resolveEscalationTarget } from './rbac';

const DEFAULT_SLA_HOURS = 24;

/**
 * Resolve the approver for a milestone based on the project's owner org.
 * Uses RBAC service for consistent approver resolution.
 */
export async function resolveApprover(milestoneId: string): Promise<string | null> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: {
      contract: {
        select: {
          project: {
            select: { ownerOrgId: true },
          },
        },
      },
    },
  });

  if (!milestone) return null;

  const ownerOrgId = milestone.contract.project.ownerOrgId;

  // Use RBAC service to resolve primary approver
  let approverId = await resolvePrimaryApprover(ownerOrgId);

  // Fallback: if no approver in owner org, find first tar_manager globally
  if (!approverId) {
    const fallback = await prisma.user.findFirst({
      where: { role: 'tar_manager' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    approverId = fallback?.id ?? null;
    if (approverId) {
      console.log(`[APPROVAL] Fallback approver resolved globally: ${approverId}`);
    }
  }

  if (!approverId) {
    console.warn(`No approver found for milestone ${milestoneId} in org ${ownerOrgId}`);
  }

  return approverId;
}

/**
 * Resolve the next approver in the escalation chain.
 * Uses RBAC service for consistent escalation logic.
 */
export async function escalateApproval(
  currentApproverUserId: string,
  ownerOrgId: string
): Promise<string | null> {
  return resolveEscalationTarget(currentApproverUserId, ownerOrgId);
}

/**
 * Compute SLA deadline from org settings or use default.
 */
function computeSlaDeadline(orgSettings: any): Date {
  const hours = orgSettings?.approvalSlaHours ?? DEFAULT_SLA_HOURS;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Create an approval request for a milestone completion.
 * Called when a milestone with requiresApproval=true is marked complete.
 * 
 * This now uses the RBAC service for approver resolution.
 */
export async function createApprovalRequest(
  milestoneId: string,
  requestedByUserId: string
): Promise<{ approvalId: string; approverUserId: string } | null> {
  // Resolve who should approve
  const approverUserId = await resolveApprover(milestoneId);
  if (!approverUserId) {
    console.warn(`No approver found for milestone ${milestoneId} — skipping approval`);
    return null;
  }

  // Get org settings for SLA computation
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: {
      title: true,
      contract: {
        select: {
          contractNumber: true,
          project: {
            select: {
              ownerOrg: {
                select: { id: true, settings: true },
              },
            },
          },
        },
      },
    },
  });

  if (!milestone) return null;

  const orgSettings = milestone.contract.project.ownerOrg.settings as any;
  const slaDeadline = computeSlaDeadline(orgSettings);

  // Create the approval request
  const approval = await prisma.approvalRequest.create({
    data: {
      milestoneId,
      requestedByUserId,
      approverUserId,
      slaDeadline,
      status: 'pending',
    },
  });

  // Send email notification to approver
  const [approver, requester] = await Promise.all([
    prisma.user.findUnique({ where: { id: approverUserId }, select: { email: true, name: true } }),
    prisma.user.findUnique({ where: { id: requestedByUserId }, select: { name: true } }),
  ]);

  if (approver && requester) {
    await sendApprovalRequestEmail({
      approverEmail: approver.email,
      approverName: approver.name,
      requesterName: requester.name,
      milestoneTitle: milestone.title,
      contractNumber: milestone.contract.contractNumber,
      slaDeadline,
    }).catch((err) => console.error('Failed to send approval email:', err));
  }

  return { approvalId: approval.id, approverUserId };
}
