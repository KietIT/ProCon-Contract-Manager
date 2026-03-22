import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { sendApprovalDecisionEmail } from '../services/email';
import { escalateApproval } from '../services/approval';
import { logAudit } from '../services/audit';
import { createCostEntryForMilestone } from '../services/cost-auto';

const decideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().optional(),
});

export async function approvalRoutes(app: FastifyInstance) {
  // Get pending approvals for the current user — ordered by SLA urgency
  app.get('/approvals/pending', async (request, reply) => {
    const skipAuth = process.env.SKIP_AUTH === 'true';
    const approvals = await prisma.approvalRequest.findMany({
      where: {
        status: 'pending',
        ...(skipAuth ? {} : { approverUserId: request.userId }),
      },
      include: {
        milestone: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            dueDate: true,
            contract: {
              select: {
                id: true,
                contractNumber: true,
                project: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        requestedBy: { select: { name: true, email: true } },
      },
      orderBy: { slaDeadline: 'asc' },
    });

    // Add computed SLA fields
    const now = new Date();
    const data = approvals.map((a) => ({
      ...a,
      slaRemainingMs: new Date(a.slaDeadline).getTime() - now.getTime(),
      isOverdue: new Date(a.slaDeadline) < now,
    }));

    return { data };
  });

  // Get all approvals for the current user (pending + decided)
  app.get('/approvals/history', async (request, reply) => {
    const skipAuth = process.env.SKIP_AUTH === 'true';
    const approvals = await prisma.approvalRequest.findMany({
      where: {
        ...(skipAuth ? {} : { approverUserId: request.userId }),
      },
      include: {
        milestone: {
          select: {
            title: true,
            contract: {
              select: { contractNumber: true },
            },
          },
        },
        requestedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { data: approvals };
  });

  // Decide on approval — approve or reject
  app.post('/approvals/:id/decide', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = decideSchema.parse(request.body);

    if (body.decision === 'rejected' && !body.comments) {
      reply.status(400);
      return { error: 'Comments are required when rejecting' };
    }

    // Verify this approval is assigned to the current user and is still pending
    const existing = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        milestone: {
          select: {
            id: true,
            title: true,
            contract: { select: { contractNumber: true } },
          },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
        approver: { select: { name: true } },
      },
    });

    if (!existing) {
      reply.status(404);
      return { error: 'Approval request not found' };
    }

    if (process.env.SKIP_AUTH !== 'true' && existing.approverUserId !== request.userId) {
      reply.status(403);
      return { error: 'Forbidden — this approval is not assigned to you' };
    }

    if (existing.status !== 'pending') {
      reply.status(400);
      return { error: `Approval has already been ${existing.status}` };
    }

    // Update the approval request
    const approval = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: body.decision,
        decidedAt: new Date(),
        comments: body.comments,
      },
    });

    // On approval: mark the milestone as complete with timestamp
    if (body.decision === 'approved') {
      await prisma.milestone.update({
        where: { id: existing.milestoneId },
        data: {
          status: 'complete',
          completedAt: new Date(),
        },
      });
      // Auto-generate cost entry for completed milestone
      createCostEntryForMilestone(existing.milestoneId, request.userId);
    }

    // On rejection: revert milestone to not_started so it can be reworked
    if (body.decision === 'rejected') {
      await prisma.milestone.update({
        where: { id: existing.milestoneId },
        data: {
          status: 'not_started',
        },
      });
    }

    // Send notification email to the requester
    sendApprovalDecisionEmail({
      requesterEmail: existing.requestedBy.email,
      requesterName: existing.requestedBy.name,
      approverName: existing.approver.name,
      milestoneTitle: existing.milestone.title,
      contractNumber: existing.milestone.contract.contractNumber,
      decision: body.decision,
      comments: body.comments,
    }).catch((err) => console.error('Failed to send decision email:', err));

    return { data: approval };
  });

  // Escalate approval to next person in chain (tar_manager only)
  app.post('/approvals/:id/escalate',
    { preHandler: requireRole('tar_manager') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const approval = await prisma.approvalRequest.findUnique({
        where: { id },
        include: {
          milestone: {
            select: {
              contract: {
                select: {
                  project: { select: { ownerOrgId: true } }
                }
              }
            }
          }
        }
      });

      if (!approval) {
        reply.status(404);
        return { error: 'Approval not found' };
      }

      if (approval.status !== 'pending') {
        reply.status(400);
        return { error: 'Can only escalate pending approvals' };
      }

      // Get next escalation target
      const nextApprover = await escalateApproval(
        approval.approverUserId,
        approval.milestone.contract.project.ownerOrgId
      );

      if (!nextApprover) {
        reply.status(400);
        return { error: 'No further escalation available' };
      }

      // Update approval
      const updated = await prisma.approvalRequest.update({
        where: { id },
        data: {
          approverUserId: nextApprover,
          escalatedToUserId: nextApprover,
        },
      });

      // Log escalation
      await logAudit({
        userId: request.userId,
        action: 'ESCALATE',
        entityType: 'approval_request',
        entityId: id,
        changes: {
          from: approval.approverUserId,
          to: nextApprover,
        },
      }).catch((err) => console.error('Failed to log escalation:', err));

      return { data: updated };
    }
  );
}
