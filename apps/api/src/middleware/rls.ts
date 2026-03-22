import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';

/**
 * Row-Level Security middleware.
 * Sets the Postgres session variable `app.current_org_id` so that
 * RLS policies can filter rows to the authenticated user's org.
 *
 * Must run AFTER authMiddleware (depends on request.orgId).
 */
export async function rlsMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (!request.orgId) return; // authMiddleware should have rejected already

  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.current_org_id', $1, true)`,
    request.orgId
  );
}
