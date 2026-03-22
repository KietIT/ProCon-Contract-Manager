import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { requirePermission, requireRole } from '../middleware/auth';
import { verifyContractAccess } from '../middleware/authorization';
import { logAudit } from '../services/audit';

const createCostEntrySchema = z.object({
  contractId: z.string().uuid(),
  entryDate: z.string().date(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  category: z.enum(['labour', 'materials', 'equipment', 'subcontract', 'other']),
  description: z.string().optional(),
});

const updateCostEntrySchema = z.object({
  entryDate: z.string().date().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  category: z.enum(['labour', 'materials', 'equipment', 'subcontract', 'other']).optional(),
  description: z.string().optional(),
});

export async function costEntryRoutes(app: FastifyInstance) {
  // Create cost entry (only procurement, contractor, tar_manager)
  app.post('/cost-entries',
    { preHandler: requirePermission('create_cost_entry') },
    async (request, reply) => {
      const body = createCostEntrySchema.parse(request.body);

      // Verify contract access
      const contract = await prisma.contract.findUnique({
        where: { id: body.contractId },
        select: { project: { select: { ownerOrgId: true } }, contractorOrgId: true },
      });

      if (!contract) {
        reply.status(404);
        return { error: 'Contract not found' };
      }

      const hasAccess = contract.project.ownerOrgId === request.orgId || 
                       contract.contractorOrgId === request.orgId;
      if (!hasAccess) {
        reply.status(403);
        return { error: 'Forbidden — no access to this contract' };
      }

      const costEntry = await prisma.costEntry.create({
        data: {
          contractId: body.contractId,
          entryDate: new Date(body.entryDate),
          amount: parseFloat(body.amount),
          category: body.category,
          submittedByUserId: request.userId,
          approved: false,
        },
      });

      // Log creation
      await logAudit({
        userId: request.userId,
        action: 'CREATE',
        entityType: 'cost_entry',
        entityId: costEntry.id,
        changes: {
          contractId: body.contractId,
          amount: body.amount,
          category: body.category,
        },
      }).catch((err) => console.error('Failed to log cost entry creation:', err));

      reply.status(201);
      return { data: costEntry };
    }
  );

  // List cost entries for a contract
  app.get('/contracts/:contractId/cost-entries',
    { preHandler: verifyContractAccess('contractId') },
    async (request, reply) => {
      const { contractId } = request.params as { contractId: string };

      const costEntries = await prisma.costEntry.findMany({
        where: { contractId },
        include: {
          submittedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { entryDate: 'desc' },
      });

      return { data: costEntries };
    }
  );

  // Get cost entry detail
  app.get('/cost-entries/:id',
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const costEntry = await prisma.costEntry.findUnique({
        where: { id },
        include: {
          submittedBy: { select: { id: true, name: true, email: true } },
          contract: { 
            select: { 
              id: true, 
              contractNumber: true,
              project: { select: { ownerOrgId: true } },
              contractorOrgId: true,
            } 
          },
        },
      });

      if (!costEntry) {
        reply.status(404);
        return { error: 'Cost entry not found' };
      }

      // Check access
      const hasAccess = costEntry.contract.project.ownerOrgId === request.orgId || 
                       costEntry.contract.contractorOrgId === request.orgId;
      if (!hasAccess) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      return { data: costEntry };
    }
  );

  // Update cost entry (only if not approved)
  app.patch('/cost-entries/:id',
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateCostEntrySchema.parse(request.body);

      const existing = await prisma.costEntry.findUnique({
        where: { id },
        include: {
          contract: { 
            select: { 
              project: { select: { ownerOrgId: true } },
              contractorOrgId: true,
            } 
          },
        },
      });

      if (!existing) {
        reply.status(404);
        return { error: 'Cost entry not found' };
      }

      // Check access — must be submitter or tar_manager
      const isSubmitter = existing.submittedByUserId === request.userId;
      const isTarManager = request.userRole === 'tar_manager';
      if (!isSubmitter && !isTarManager) {
        reply.status(403);
        return { error: 'Only submitter or TAR manager can update' };
      }

      // Check org access
      const hasOrgAccess = existing.contract.project.ownerOrgId === request.orgId || 
                          existing.contract.contractorOrgId === request.orgId;
      if (!hasOrgAccess) {
        reply.status(403);
        return { error: 'Forbidden — no access to this contract' };
      }

      if (existing.approved) {
        reply.status(400);
        return { error: 'Cannot update approved cost entry' };
      }

      const updateData: Record<string, any> = {};
      if (body.entryDate) updateData.entryDate = new Date(body.entryDate);
      if (body.amount) updateData.amount = parseFloat(body.amount);
      if (body.category) updateData.category = body.category;

      const costEntry = await prisma.costEntry.update({
        where: { id },
        data: updateData,
      });

      // Log update
      await logAudit({
        userId: request.userId,
        action: 'UPDATE',
        entityType: 'cost_entry',
        entityId: id,
        changes: updateData,
      }).catch((err) => console.error('Failed to log cost entry update:', err));

      return { data: costEntry };
    }
  );

  // Approve cost entry (tar_manager only)
  app.patch('/cost-entries/:id/approve',
    { preHandler: requireRole('tar_manager') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await prisma.costEntry.findUnique({ where: { id } });

      if (!existing) {
        reply.status(404);
        return { error: 'Cost entry not found' };
      }

      if (existing.approved) {
        reply.status(400);
        return { error: 'Cost entry is already approved' };
      }

      const costEntry = await prisma.costEntry.update({
        where: { id },
        data: { 
          approved: true,
        },
      });

      // Log approval
      await logAudit({
        userId: request.userId,
        action: 'APPROVE',
        entityType: 'cost_entry',
        entityId: id,
        changes: { approved: true },
      }).catch((err) => console.error('Failed to log cost entry approval:', err));

      return { data: costEntry };
    }
  );

  // Delete cost entry (only if not approved and submitter/tar_manager)
  app.delete('/cost-entries/:id',
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await prisma.costEntry.findUnique({
        where: { id },
        include: {
          contract: { 
            select: { 
              project: { select: { ownerOrgId: true } },
              contractorOrgId: true,
            } 
          },
        },
      });

      if (!existing) {
        reply.status(404);
        return { error: 'Cost entry not found' };
      }

      // Check access — must be submitter or tar_manager
      const isSubmitter = existing.submittedByUserId === request.userId;
      const isTarManager = request.userRole === 'tar_manager';
      if (!isSubmitter && !isTarManager) {
        reply.status(403);
        return { error: 'Only submitter or TAR manager can delete' };
      }

      // Check org access
      const hasOrgAccess = existing.contract.project.ownerOrgId === request.orgId || 
                          existing.contract.contractorOrgId === request.orgId;
      if (!hasOrgAccess) {
        reply.status(403);
        return { error: 'Forbidden — no access to this contract' };
      }

      if (existing.approved) {
        reply.status(400);
        return { error: 'Cannot delete approved cost entry' };
      }

      await prisma.costEntry.delete({ where: { id } });

      // Log deletion
      await logAudit({
        userId: request.userId,
        action: 'DELETE',
        entityType: 'cost_entry',
        entityId: id,
      }).catch((err) => console.error('Failed to log cost entry deletion:', err));

      return { data: { success: true } };
    }
  );

  // Get cost summary for a project (by category)
  app.get('/projects/:projectId/cost-summary',
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };

      // Verify project access
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerOrgId: true },
      });

      if (!project) {
        reply.status(404);
        return { error: 'Project not found' };
      }

      const hasAccess = project.ownerOrgId === request.orgId;
      if (!hasAccess) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      const costEntries = await prisma.costEntry.findMany({
        where: {
          contract: { projectId },
        },
        select: {
          amount: true,
          category: true,
          approved: true,
        },
      });

      const total = costEntries.reduce((sum, e) => sum + Number(e.amount), 0);
      const approved = costEntries
        .filter(e => e.approved)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const pending = total - approved;

      const byCategory = costEntries.reduce((acc, e) => {
        const key = e.category;
        if (!acc[key]) {
          acc[key] = { total: 0, approved: 0, pending: 0 };
        }
        acc[key].total += Number(e.amount);
        if (e.approved) {
          acc[key].approved += Number(e.amount);
        } else {
          acc[key].pending += Number(e.amount);
        }
        return acc;
      }, {} as Record<string, any>);

      return { 
        data: { 
          total, 
          approved, 
          pending,
          byCategory,
        } 
      };
    }
  );

  // Get cost entries for a project (all across contracts)
  app.get('/projects/:projectId/cost-entries',
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerOrgId: true },
      });

      if (!project) {
        reply.status(404);
        return { error: 'Project not found' };
      }

      const hasAccess = project.ownerOrgId === request.orgId;
      if (!hasAccess) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      const costEntries = await prisma.costEntry.findMany({
        where: {
          contract: { projectId },
        },
        include: {
          contract: { select: { id: true, contractNumber: true } },
          submittedBy: { select: { name: true, email: true } },
        },
        orderBy: { entryDate: 'desc' },
      });

      return { data: costEntries };
    }
  );
}
