import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function organisationRoutes(app: FastifyInstance) {
  // List all organisations
  app.get('/organisations', async (request, reply) => {
    const orgs = await prisma.organisation.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        slug: true,
      },
      orderBy: { name: 'asc' },
    });
    return { data: orgs };
  });
}
