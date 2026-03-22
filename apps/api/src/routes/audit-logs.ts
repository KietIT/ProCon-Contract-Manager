import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { requirePermission, requireRole } from '../middleware/auth';
import { verifyProjectAccess, verifyContractAccess } from '../middleware/authorization';

const querySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export async function auditLogsRoutes(app: FastifyInstance) {
  // Get audit logs for a specific entity
  app.get('/audit-logs',
    { preHandler: requirePermission('view_audit_log') },
    async (request, reply) => {
      const query = querySchema.parse(request.query);
      const { entityType, entityId, action, limit, offset } = query;

      if (!entityType || !entityId) {
        reply.status(400);
        return { error: 'Missing entityType or entityId query parameters' };
      }

      const take = Math.min(parseInt(limit || '50'), 500);
      const skip = parseInt(offset || '0');

      const logs = await prisma.auditLog.findMany({
        where: {
          entityType,
          entityId,
          ...(action ? { action } : {}),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });

      return { data: logs };
    }
  );

  // Get user's own audit logs
  app.get('/users/me/audit-logs',
    async (request, reply) => {
      const { limit, offset } = request.query as { limit?: string; offset?: string };
      const take = Math.min(parseInt(limit || '100'), 500);
      const skip = parseInt(offset || '0');

      const logs = await prisma.auditLog.findMany({
        where: { userId: request.userId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });

      return { data: logs };
    }
  );

  // Get audit logs by user (tar_manager only)
  app.get('/audit-logs/by-user/:userId',
    { preHandler: requireRole('tar_manager') },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const { limit, offset } = request.query as { limit?: string; offset?: string };
      const take = Math.min(parseInt(limit || '200'), 500);
      const skip = parseInt(offset || '0');

      const logs = await prisma.auditLog.findMany({
        where: { userId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });

      return { data: logs };
    }
  );

  // Get audit logs in date range (tar_manager only)
  app.get('/audit-logs/range',
    { preHandler: requireRole('tar_manager') },
    async (request, reply) => {
      const { startDate, endDate, limit, offset, action, entityType } = request.query as {
        startDate?: string;
        endDate?: string;
        limit?: string;
        offset?: string;
        action?: string;
        entityType?: string;
      };

      if (!startDate || !endDate) {
        reply.status(400);
        return { error: 'Missing startDate or endDate query parameters' };
      }

      try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
          reply.status(400);
          return { error: 'startDate must be before endDate' };
        }

        const take = Math.min(parseInt(limit || '500'), 5000);
        const skip = parseInt(offset || '0');

        const logs = await prisma.auditLog.findMany({
          where: {
            createdAt: { gte: start, lte: end },
            ...(action ? { action } : {}),
            ...(entityType ? { entityType } : {}),
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        });

        return { data: logs };
      } catch (error) {
        reply.status(400);
        return { error: 'Invalid date format. Use ISO format (YYYY-MM-DD)' };
      }
    }
  );

  // Get audit logs for a contract
  app.get('/contracts/:contractId/audit-logs',
    { preHandler: verifyContractAccess('contractId') },
    async (request, reply) => {
      const { contractId } = request.params as { contractId: string };
      const { limit, offset } = request.query as { limit?: string; offset?: string };
      const take = Math.min(parseInt(limit || '100'), 500);
      const skip = parseInt(offset || '0');

      const logs = await prisma.auditLog.findMany({
        where: { entityId: contractId, entityType: 'contract' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });

      return { data: logs };
    }
  );

  // Get audit logs for a project
  app.get('/projects/:projectId/audit-logs',
    { preHandler: verifyProjectAccess('projectId') },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { limit, offset } = request.query as { limit?: string; offset?: string };
      const take = Math.min(parseInt(limit || '100'), 500);
      const skip = parseInt(offset || '0');

      const logs = await prisma.auditLog.findMany({
        where: { entityId: projectId, entityType: 'project' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });

      return { data: logs };
    }
  );

  // Get audit logs for a milestone
  app.get('/milestones/:milestoneId/audit-logs',
    async (request, reply) => {
      const { milestoneId } = request.params as { milestoneId: string };
      const { limit, offset } = request.query as { limit?: string; offset?: string };
      const take = Math.min(parseInt(limit || '100'), 500);
      const skip = parseInt(offset || '0');

      // First verify milestone exists and user has access
      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: {
          contract: {
            select: {
              project: { select: { ownerOrgId: true } },
              contractorOrgId: true,
            },
          },
        },
      });

      if (!milestone) {
        reply.status(404);
        return { error: 'Milestone not found' };
      }

      const hasAccess = milestone.contract.project.ownerOrgId === request.orgId || 
                       milestone.contract.contractorOrgId === request.orgId;
      if (!hasAccess) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      const logs = await prisma.auditLog.findMany({
        where: { entityId: milestoneId, entityType: 'milestone' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });

      return { data: logs };
    }
  );

  // Get audit logs for an approval request
  app.get('/approvals/:approvalId/audit-logs',
    async (request, reply) => {
      const { approvalId } = request.params as { approvalId: string };
      const { limit, offset } = request.query as { limit?: string; offset?: string };
      const take = Math.min(parseInt(limit || '100'), 500);
      const skip = parseInt(offset || '0');

      // Verify approval exists and user has access
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: approvalId },
        select: {
          approverUserId: true,
          requestedByUserId: true,
          milestone: {
            select: {
              contract: {
                select: {
                  project: { select: { ownerOrgId: true } },
                  contractorOrgId: true,
                },
              },
            },
          },
        },
      });

      if (!approval) {
        reply.status(404);
        return { error: 'Approval not found' };
      }

      const isParty = approval.approverUserId === request.userId || 
                     approval.requestedByUserId === request.userId;
      const hasOrgAccess = approval.milestone.contract.project.ownerOrgId === request.orgId || 
                          approval.milestone.contract.contractorOrgId === request.orgId;

      if (!isParty && !hasOrgAccess) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      const logs = await prisma.auditLog.findMany({
        where: { entityId: approvalId, entityType: 'approval_request' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });

      return { data: logs };
    }
  );

  // Get audit summary dashboard (tar_manager only)
  app.get('/audit-logs/summary/dashboard',
    { preHandler: requireRole('tar_manager') },
    async (request, reply) => {
      const { days } = request.query as { days?: string };
      const numDays = parseInt(days || '7');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - numDays);

      // Get logs in the time range
      const logs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        select: {
          action: true,
          entityType: true,
          userId: true,
        },
      });

      // Aggregate stats
      const actionStats = logs.reduce((acc, log) => {
        const key = log.action;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const entityTypeStats = logs.reduce((acc, log) => {
        const key = log.entityType;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const userStats = logs.reduce((acc, log) => {
        const key = log.userId;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return { 
        data: {
          period: { days: numDays, startDate, endDate: new Date() },
          totalLogs: logs.length,
          byAction: actionStats,
          byEntityType: entityTypeStats,
          byUser: userStats,
        } 
      };
    }
  );
}
