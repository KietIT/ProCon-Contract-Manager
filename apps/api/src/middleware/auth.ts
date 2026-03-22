import { FastifyRequest, FastifyReply } from 'fastify';
import { clerkPlugin, getAuth } from '@clerk/fastify';
import { prisma } from '../lib/prisma';
import { hasPermission, type UserRole } from '../services/rbac';

// Extend Fastify request with auth context
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    orgId: string;
    userRole: UserRole;
    userEmail: string;
  }
}

/**
 * Auth middleware using Clerk.
 * Extracts userId from Clerk JWT, syncs user record, and attaches context to request.
 *
 * Dev mode (SKIP_AUTH=true): Uses x-dev-user-email header or first tar_manager
 * Prod mode: Auto-syncs new users from Clerk, respects ADMIN_EMAILS config
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Dev bypass: skip auth when SKIP_AUTH is set
  if (process.env.SKIP_AUTH === 'true') {
    const devEmail = request.headers['x-dev-user-email'] as string | undefined;

    let devUser;
    if (devEmail) {
      devUser = await prisma.user.findUnique({ where: { email: devEmail } });
      if (!devUser) {
        return reply.status(401).send({ error: `Dev user not found: ${devEmail}` });
      }
    } else {
      // Default to first tar_manager (admin)
      devUser = await prisma.user.findFirst({
        where: { role: 'tar_manager' },
        orderBy: { createdAt: 'asc' },
      });
      if (!devUser) {
        return reply.status(401).send({ error: 'No users in database. Run pnpm db:seed first.' });
      }
    }

    request.userId = devUser.id;
    request.orgId = devUser.orgId;
    request.userRole = devUser.role as UserRole;
    request.userEmail = devUser.email;
    return;
  }

  // Production: validate Clerk JWT
  const { userId: clerkId } = getAuth(request);

  if (!clerkId) {
    return reply.status(401).send({ error: 'Unauthorized — missing or invalid token' });
  }

  // Fetch from Clerk first
  let clerkUser;
  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });
    if (!response.ok) throw new Error(`Clerk API error: ${response.status}`);
    clerkUser = await response.json();
  } catch (error) {
    console.error('Clerk API error:', error);
    return reply.status(500).send({ error: 'Failed to fetch user from Clerk' });
  }

  const email = clerkUser.email_addresses?.[0]?.email_address || `${clerkId}@clerk.local`;
  const name = clerkUser.first_name
    ? `${clerkUser.first_name} ${clerkUser.last_name || ''}`.trim()
    : 'New User';

  // Determine role based on ADMIN_EMAILS config
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase())
    : [];
  const isConfiguredAdmin = adminEmails.includes(email.toLowerCase());
  const defaultRole: UserRole = isConfiguredAdmin ? 'tar_manager' : 'contractor';

  // Try to find existing user by clerkId first, then by email (for seeded/pre-existing users)
  let user = await prisma.user.findUnique({ where: { clerkId } });

  if (!user) {
    // Check if a user with this email already exists (e.g. seeded users)
    // Use case-insensitive match because Clerk may return lowercase email
    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existingByEmail) {
      // Link existing user to this Clerk account
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerkId },
      });
      console.log(`[AUTH] Linked existing user ${email} (${user.role}) to Clerk ID ${clerkId}`);
    } else {
      // Create brand new user + org
      try {
        const org = await prisma.organisation.create({
          data: {
            name: isConfiguredAdmin ? 'Main Organization' : `${name}'s Organization`,
            type: isConfiguredAdmin ? 'owner' : 'epc_contractor',
            slug: `org-${clerkId.substring(0, 8)}-${Date.now()}`,
          },
        });

        user = await prisma.user.create({
          data: {
            clerkId,
            email,
            name,
            role: defaultRole,
            orgId: org.id,
          },
        });

        console.log(`[AUTH] Created new user: ${email} (${defaultRole}) in org ${org.id}`);
      } catch (error) {
        console.error('[AUTH] User creation error:', error);
        return reply.status(500).send({ error: 'Failed to create user' });
      }
    }
  } else {
    // User exists: sync administrative role changes if email is in ADMIN_EMAILS
    if (isConfiguredAdmin && user.role !== 'tar_manager') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'tar_manager' },
      });
      console.log(`[AUTH] Promoted user to tar_manager: ${email}`);
    }
  }

  request.userId = user.id;
  request.orgId = user.orgId;
  request.userRole = user.role as UserRole;
  request.userEmail = user.email;
}

/**
 * Role guard factory — checks if user role is in allowedRoles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!allowedRoles.includes(request.userRole)) {
      return reply.status(403).send({
        error: `Forbidden — requires one of: ${allowedRoles.join(', ')}`,
      });
    }
  };
}

/**
 * Permission guard factory — checks RBAC permission matrix
 */
export function requirePermission(...permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.userRole;
    const hasAny = permissions.some((perm) => hasPermission(userRole, perm));

    if (!hasAny) {
      return reply.status(403).send({
        error: `Forbidden — requires permission: ${permissions.join(' or ')}`,
      });
    }
  };
}
