import { FastifyRequest, FastifyReply } from 'fastify';
import { canAccessProject, canAccessContract, canAccessMilestone } from '../services/rbac';

/**
 * Route authorization middleware
 * Provides reusable preHandlers to enforce resource-level access control
 */

/**
 * Verify user can access a specific project
 * Expects :id or :projectId in route params
 */
export function verifyProjectAccess(paramName: string = 'id') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.SKIP_AUTH === 'true') return;

    const projectId = (request.params as any)[paramName];
    if (!projectId) {
      return reply.status(400).send({ error: `Missing route parameter: ${paramName}` });
    }

    const canAccess = await canAccessProject(
      request.userId,
      request.orgId,
      request.userRole,
      projectId
    );

    if (!canAccess) {
      return reply.status(403).send({ error: 'Forbidden — no access to this project' });
    }
  };
}

/**
 * Verify user can access a specific contract
 * Expects :contractId in route params
 */
export function verifyContractAccess(paramName: string = 'contractId') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.SKIP_AUTH === 'true') return;

    const contractId = (request.params as any)[paramName];
    if (!contractId) {
      return reply.status(400).send({ error: `Missing route parameter: ${paramName}` });
    }

    const canAccess = await canAccessContract(
      request.userId,
      request.orgId,
      request.userRole,
      contractId
    );

    if (!canAccess) {
      return reply.status(403).send({ error: 'Forbidden — no access to this contract' });
    }
  };
}

/**
 * Verify user can access a specific milestone
 * Expects :milestoneId in route params
 */
export function verifyMilestoneAccess(paramName: string = 'milestoneId') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.SKIP_AUTH === 'true') return;

    const milestoneId = (request.params as any)[paramName];
    if (!milestoneId) {
      return reply.status(400).send({ error: `Missing route parameter: ${paramName}` });
    }

    const canAccess = await canAccessMilestone(
      request.userId,
      request.orgId,
      request.userRole,
      milestoneId
    );

    if (!canAccess) {
      return reply.status(403).send({ error: 'Forbidden — no access to this milestone' });
    }
  };
}
