import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function authRoutes(app: FastifyInstance) {
  app.get('/auth/me', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      include: { org: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return {
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        orgName: user.org.name,
      },
    };
  });
}
