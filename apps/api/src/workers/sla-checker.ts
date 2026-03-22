/**
 * SLA Checker — runs every 30 minutes.
 * Finds pending ApprovalRequests past their SLA deadline and escalates them.
 *
 * Run as a separate process: tsx src/workers/sla-checker.ts
 */
import { prisma } from '../lib/prisma';
import { resolveEscalationTarget } from '../services/approval';
import { sendEscalationEmail } from '../services/email';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function checkOverdueSlas() {
  const now = new Date();

  // Find all pending approvals past their SLA deadline
  const overdueApprovals = await prisma.approvalRequest.findMany({
    where: {
      status: 'pending',
      slaDeadline: { lt: now },
    },
    include: {
      approver: { select: { id: true, name: true, orgId: true } },
      milestone: {
        select: {
          title: true,
          contract: {
            select: {
              contractNumber: true,
              project: {
                select: { ownerOrgId: true },
              },
            },
          },
        },
      },
    },
  });

  if (overdueApprovals.length === 0) return;

  console.log(`[sla-checker] Found ${overdueApprovals.length} overdue approval(s)`);

  for (const approval of overdueApprovals) {
    const ownerOrgId = approval.milestone.contract.project.ownerOrgId;

    // Find escalation target
    const escalatedToUserId = await resolveEscalationTarget(
      approval.approver.id,
      ownerOrgId
    );

    // Update approval status to escalated
    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: 'escalated',
        escalatedToUserId,
      },
    });

    // If we found an escalation target, create a new pending approval for them
    if (escalatedToUserId) {
      const newSlaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

      await prisma.approvalRequest.create({
        data: {
          milestoneId: approval.milestoneId,
          requestedByUserId: approval.requestedByUserId,
          approverUserId: escalatedToUserId,
          slaDeadline: newSlaDeadline,
          status: 'pending',
        },
      });

      // Send escalation email
      const escalatedTo = await prisma.user.findUnique({
        where: { id: escalatedToUserId },
        select: { email: true, name: true },
      });

      if (escalatedTo) {
        await sendEscalationEmail({
          escalatedToEmail: escalatedTo.email,
          escalatedToName: escalatedTo.name,
          originalApproverName: approval.approver.name,
          milestoneTitle: approval.milestone.title,
          contractNumber: approval.milestone.contract.contractNumber,
          originalDeadline: approval.slaDeadline,
        }).catch((err) => console.error('Failed to send escalation email:', err));
      }

      console.log(
        `[sla-checker] Escalated approval ${approval.id} from ${approval.approver.name} to ${escalatedTo?.name ?? escalatedToUserId}`
      );
    } else {
      console.log(
        `[sla-checker] Approval ${approval.id} escalated but no further approver found`
      );
    }
  }
}

// Run immediately, then on interval
console.log('[sla-checker] Starting SLA checker (interval: 30 min)');
checkOverdueSlas().catch(console.error);

setInterval(() => {
  checkOverdueSlas().catch(console.error);
}, CHECK_INTERVAL_MS);
