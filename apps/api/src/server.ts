import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { clerkPlugin } from '@clerk/fastify';
import { projectRoutes } from './routes/projects';
import { contractRoutes } from './routes/contracts';
import { milestoneRoutes } from './routes/milestones';
import { approvalRoutes } from './routes/approvals';
import { userRoutes } from './routes/users';
import { organisationRoutes } from './routes/organisations';
import { costEntryRoutes } from './routes/cost-entries';
import { auditLogsRoutes } from './routes/audit-logs';
import { authRoutes } from './routes/auth';
import { authMiddleware } from './middleware/auth';
import { rlsMiddleware } from './middleware/rls';
import { prisma } from './lib/prisma';
import { downloadFromS3 } from './services/storage';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

async function start() {
  // Plugins
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-dev-user-email'],
  });
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
    },
  });
  await app.register(import('@fastify/compress'), { global: true });

  // Clerk auth plugin
  if (process.env.SKIP_AUTH !== 'true') {
    await app.register(clerkPlugin, {
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
    });
  }

  // Health check (no auth)
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // File download — outside protected scope so iframe/embed can access without auth headers
  // Supports ?key= param to serve a specific file (used by diff viewer for archived versions)
  app.get('/api/v1/contracts/:id/file', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { key } = request.query as { key?: string };

    let fileKey: string;
    let fileMimeType: string;

    if (key) {
      // Serve a specific file by key (must belong to this contract for security)
      if (!key.startsWith(`contracts/${id}/`)) {
        reply.status(403);
        return { error: 'File key does not belong to this contract' };
      }
      fileKey = key;
      fileMimeType = key.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
    } else {
      // Default: serve current contract file
      const contract = await prisma.contract.findUnique({
        where: { id },
        select: { fileKey: true, fileMimeType: true },
      });

      if (!contract?.fileKey) {
        reply.status(404);
        return { error: 'No file attached to this contract' };
      }
      fileKey = contract.fileKey;
      fileMimeType = contract.fileMimeType ?? 'application/octet-stream';
    }

    try {
      const buffer = await downloadFromS3(fileKey);
      const fileName = fileKey.split('/').pop() ?? 'contract';
      const mimeType = fileMimeType;

      reply
        .header('Content-Type', mimeType)
        .header('Content-Disposition', `inline; filename="${fileName}"`)
        .header('Content-Length', buffer.length)
        .header('Cache-Control', 'private, no-cache');

      return reply.send(buffer);
    } catch (err) {
      console.error('[file-download] Failed:', err);
      reply.status(500);
      return { error: 'Failed to download contract file' };
    }
  });

  // Version file download — outside protected scope so iframe/embed can access
  app.get('/api/v1/contracts/:id/versions/:versionId/file', async (request, reply) => {
    const { versionId } = request.params as { id: string; versionId: string };

    const version = await prisma.contractVersion.findUnique({
      where: { id: versionId },
      select: { fileKey: true, fileMimeType: true },
    });

    if (!version?.fileKey) {
      reply.status(404);
      return { error: 'Version file not found' };
    }

    try {
      const buffer = await downloadFromS3(version.fileKey);
      const fileName = version.fileKey.split('/').pop() ?? 'contract';
      const mimeType = version.fileMimeType ?? 'application/octet-stream';

      reply
        .header('Content-Type', mimeType)
        .header('Content-Disposition', `inline; filename="${fileName}"`)
        .header('Content-Length', buffer.length)
        .header('Cache-Control', 'private, no-cache');

      return reply.send(buffer);
    } catch (err) {
      console.error('[version-file-download] Failed:', err);
      reply.status(500);
      return { error: 'Failed to download version file' };
    }
  });

  // Protected API routes — auth + RLS applied to all /api/v1 routes
  await app.register(
    async function protectedRoutes(instance) {
      instance.addHook('preHandler', authMiddleware);
      instance.addHook('preHandler', rlsMiddleware);

      await instance.register(projectRoutes);
      await instance.register(contractRoutes);
      await instance.register(milestoneRoutes);
      await instance.register(approvalRoutes);
      await instance.register(userRoutes);
      await instance.register(organisationRoutes);
      await instance.register(costEntryRoutes);
      await instance.register(auditLogsRoutes);
      await instance.register(authRoutes);
    },
    { prefix: '/api/v1' }
  );

  // Start server
  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API server running on http://localhost:${port}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
