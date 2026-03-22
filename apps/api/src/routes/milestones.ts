import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth';
import { verifyMilestoneAccess, verifyContractAccess, verifyProjectAccess } from '../middleware/authorization';
import { createApprovalRequest } from '../services/approval';
import { logMilestoneCompleted, logApprovalDecision } from '../services/audit';
import { createCostEntryForMilestone } from '../services/cost-auto';

const createMilestoneSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  type: z.enum(['completion', 'payment_trigger', 'inspection', 'handover', 'penalty_threshold']),
  dueDate: z.string(),
  assignedToUserId: z.string().uuid().optional(),
  requiresApproval: z.boolean().optional(),
  source: z.enum(['manual', 'ai_extracted']).optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  sourceClause: z.string().optional(),
});

const updateMilestoneSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'complete', 'overdue', 'waived']).optional(),
  dueDate: z.string().date().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
});

export async function milestoneRoutes(app: FastifyInstance) {
  // List milestones for a contract — grouped by status
  app.get('/contracts/:id/milestones',
    { preHandler: verifyContractAccess('id') },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const milestones = await prisma.milestone.findMany({
      where: { contractId: id },
      include: {
        assignedTo: { select: { name: true, email: true } },
        approvalRequests: {
          where: { status: 'pending' },
          select: { id: true, status: true, slaDeadline: true },
          take: 1,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Compute overdue flag and delay days for each milestone
    const now = new Date();
    const data = milestones.map((m) => {
      const isOverdue =
        m.status !== 'complete' && m.status !== 'waived' && new Date(m.dueDate) < now;
      return {
        ...m,
        isOverdue,
        delayDays: isOverdue
          ? Math.floor((now.getTime() - new Date(m.dueDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        pendingApproval: m.approvalRequests.length > 0 ? m.approvalRequests[0] : null,
      };
    });

    return { data };
  });

  // Create milestone manually
  app.post('/contracts/:id/milestones',
    { preHandler: [verifyContractAccess('id'), requirePermission('create_milestone')] },
    async (request, reply) => {
    const { id: contractId } = request.params as { id: string };
    const body = createMilestoneSchema.parse(request.body);

    const milestone = await prisma.milestone.create({
      data: {
        contractId,
        title: body.title,
        description: body.description,
        type: body.type,
        dueDate: new Date(body.dueDate),
        source: body.source ?? 'manual',
        aiConfidence: body.aiConfidence,
        assignedToUserId: body.assignedToUserId,
        requiresApproval: body.requiresApproval ?? true,
      },
    });

    reply.status(201);
    return { data: milestone };
  });

  // Update milestone — only assigned user or contract_manager can update
  app.patch('/milestones/:id',
    { preHandler: verifyMilestoneAccess('id') },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateMilestoneSchema.parse(request.body);

    // Verify authorization: assigned user or contract_manager role
    const existing = await prisma.milestone.findUnique({
      where: { id },
      select: { assignedToUserId: true },
    });

    if (!existing) {
      reply.status(404);
      return { error: 'Milestone not found' };
    }

    const isAssignee = existing.assignedToUserId === request.userId;
    const isManager = request.userRole === 'contract_manager' || request.userRole === 'tar_manager';

    if (!isAssignee && !isManager) {
      reply.status(403);
      return { error: 'Only the assigned user or a contract/TAR manager can update this milestone' };
    }

    const updateData: Record<string, any> = {};
    if (body.status) updateData.status = body.status;
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    if (body.assignedToUserId !== undefined) updateData.assignedToUserId = body.assignedToUserId;

    const milestone = await prisma.milestone.update({
      where: { id },
      data: updateData,
    });
    return { data: milestone };
  });

  // Mark milestone complete — triggers approval workflow if requiresApproval is true
  app.post('/milestones/:id/complete',
    { preHandler: requirePermission('complete_milestone') },
    async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.milestone.findUnique({
      where: { id },
      select: {
        requiresApproval: true,
        status: true,
        assignedToUserId: true,
      },
    });

    if (!existing) {
      reply.status(404);
      return { error: 'Milestone not found' };
    }

    if (existing.status === 'complete') {
      reply.status(400);
      return { error: 'Milestone is already complete' };
    }

    // If approval required, create an approval request instead of completing directly
    if (existing.requiresApproval) {
      // Set status to in_progress (pending approval)
      await prisma.milestone.update({
        where: { id },
        data: { status: 'in_progress' },
      });

      const result = await createApprovalRequest(id, request.userId);

      if (!result) {
        // No approver found — complete directly as fallback
        const milestone = await prisma.milestone.update({
          where: { id },
          data: { status: 'complete', completedAt: new Date() },
        });
        // Auto-generate cost entry for completed milestone
        createCostEntryForMilestone(id, request.userId);
        return { data: { ...milestone, approvalSkipped: true } };
      }

      return {
        data: {
          milestoneId: id,
          status: 'pending_approval',
          approvalId: result.approvalId,
          message: 'Approval request created. Milestone will be completed upon approval.',
        },
      };
    }

    // No approval required — complete directly
    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        status: 'complete',
        completedAt: new Date(),
      },
    });
    // Auto-generate cost entry for completed milestone
    createCostEntryForMilestone(id, request.userId);

    return { data: milestone };
  });

  // Overdue milestones for a project (includes completed-late milestones)
  app.get('/projects/:id/milestones/overdue',
    { preHandler: verifyProjectAccess('id') },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const { orgId, userRole } = request;
    const now = new Date();

    const contractFilter = {
      projectId: id,
      ...(userRole === 'contractor' ? { contractorOrgId: orgId } : {}),
    };

    // Still overdue: not complete/waived and past due
    const stillOverdue = await prisma.milestone.findMany({
      where: {
        contract: contractFilter,
        status: { notIn: ['complete', 'waived'] },
        dueDate: { lt: now },
      },
      include: {
        contract: { select: { contractNumber: true } },
        assignedTo: { select: { name: true } },
      },
    });

    // Completed late: completed after due date (use raw query to compare columns in DB)
    const contractorClause = userRole === 'contractor'
      ? Prisma.sql`AND c.contractor_org_id = ${orgId}`
      : Prisma.empty;

    const completedLateIds = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT m.id
        FROM milestones m
        JOIN contracts c ON c.id = m.contract_id
        WHERE c.project_id = ${id}
          ${contractorClause}
          AND m.status = 'complete'
          AND m.completed_at IS NOT NULL
          AND m.completed_at > m.due_date
      `
    );

    const completedLate = completedLateIds.length > 0
      ? await prisma.milestone.findMany({
          where: { id: { in: completedLateIds.map((r) => r.id) } },
          include: {
            contract: { select: { contractNumber: true } },
            assignedTo: { select: { name: true } },
          },
        })
      : [];

    // Merge and deduplicate
    const allOverdue = [...stillOverdue, ...completedLate];
    const seen = new Set<string>();
    const unique = allOverdue.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    const data = unique
      .map((m) => ({
        ...m,
        delayDays: Math.floor((now.getTime() - new Date(m.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
        completedLate: m.status === 'complete' && m.completedAt && new Date(m.completedAt) > new Date(m.dueDate),
      }))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return { data };
  });
}
