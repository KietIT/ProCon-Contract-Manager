import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole } from '../middleware/auth';
import { z } from 'zod';

const updateUserSchema = z.object({
  role: z.enum(['tar_manager', 'contract_manager', 'pmo', 'procurement', 'contractor']).optional(),
  name: z.string().min(1).optional(),
});

export async function userRoutes(app: FastifyInstance) {
  // Get current user profile
  app.get('/users/me', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      include: {
        org: { select: { id: true, name: true, type: true } },
      },
    });
    return { data: user };
  });

  // List all users (admin only) — includes org info
  app.get(
    '/users',
    { preHandler: requireRole('tar_manager') },
    async (request, reply) => {
      const users = await prisma.user.findMany({
        include: {
          org: { select: { id: true, name: true, type: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return { data: users };
    }
  );

  // Update user role (admin only)
  app.patch(
    '/users/:id',
    { preHandler: requireRole('tar_manager') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateUserSchema.parse(request.body);

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(body.role && { role: body.role }),
          ...(body.name && { name: body.name }),
        },
        include: {
          org: { select: { id: true, name: true, type: true } },
        },
      });
      return { data: user };
    }
  );

  // Delete user (admin only) — cannot delete yourself
  app.delete(
    '/users/:id',
    { preHandler: requireRole('tar_manager') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (id === request.userId) {
        reply.status(400);
        return { error: 'Cannot delete your own account' };
      }

      const existing = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true },
      });

      if (!existing) {
        reply.status(404);
        return { error: 'User not found' };
      }

      // Remove all foreign key references before deleting

      // 1. Unassign milestones
      await prisma.milestone.updateMany({
        where: { assignedToUserId: id },
        data: { assignedToUserId: null },
      });

      // 2. Remove approval requests (requester, approver, or escalated)
      await prisma.approvalRequest.deleteMany({
        where: {
          OR: [
            { approverUserId: id },
            { requestedByUserId: id },
            { escalatedToUserId: id },
          ],
        },
      });

      // 3. Delete cost entries submitted by this user
      await prisma.costEntry.deleteMany({
        where: { submittedByUserId: id },
      });

      // 4. Delete audit logs for this user
      await prisma.auditLog.deleteMany({
        where: { userId: id },
      });

      // 5. Delete the user
      await prisma.user.delete({ where: { id } });

      return { data: { id, deleted: true } };
    }
  );
}
