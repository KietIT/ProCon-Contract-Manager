import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { parsingQueue } from '../services/queue';
import { uploadToS3, downloadFromS3 } from '../services/storage';
import { extractTextFromFile, extractFromPdfWithPages, type PageTextInfo } from '../services/ai/file-extractor';
import { requirePermission, requireRole } from '../middleware/auth';
import { verifyProjectAccess, verifyContractAccess } from '../middleware/authorization';
import { logAudit, logContractCreated } from '../services/audit';
import { computeContractRag, computeContractStatus } from '../services/rag-computer';

const createContractSchema = z.object({
  contractorOrgId: z.string().uuid(),
  contractNumber: z.string().optional(),
  type: z.enum(['once_off', 'frame']),
  spendingType: z.enum(['opex', 'capex']),
  department: z.enum(['rotating', 'instrument', 'static_dept', 'electrical', 'process_control_automation']),
  contractValue: z.string(),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

const confirmSchema = z.object({
  milestones: z.array(z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['completion', 'payment_trigger', 'inspection', 'handover', 'penalty_threshold']),
    due_date: z.string().nullable(),
    confidence: z.number(),
    source_clause: z.string().optional(),
    relative_date_expression: z.string().nullable().optional(),
  })),
});

export async function contractRoutes(app: FastifyInstance) {
  // In-memory cache for extracted contract text (contractId → text + page info)
  const textCache = new Map<string, { text: string; fileName: string; pages: PageTextInfo[] }>();

  // List ALL contracts (admin overview — tar_manager only)
  app.get(
    '/contracts',
    { preHandler: requireRole('tar_manager') },
    async (request, reply) => {
      const contracts = await prisma.contract.findMany({
        where: { deletedAt: null },
        include: {
          project: { select: { id: true, name: true } },
          contractorOrg: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { data: contracts };
    }
  );

  // List contracts for a project
  app.get('/projects/:id/contracts', async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    const { orgId, userRole } = request;

    // Verify project access first (Sharing logic)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { ownerOrg: { include: { users: { select: { role: true } } } } }
    });

    if (!project) {
      reply.status(404);
      return { error: 'Project not found' };
    }

    const isStaff = ['tar_manager', 'pmo', 'contract_manager'].includes(userRole);
    const isAdminProject = project.ownerOrg.users.some(u => u.role === 'tar_manager');
    const hasProjectAccess = project.ownerOrgId === orgId || (isStaff && isAdminProject);

    if (!hasProjectAccess && userRole !== 'contractor') {
      reply.status(403);
      return { error: 'Forbidden' };
    }

    const contracts = await prisma.contract.findMany({
      where: {
        projectId,
        deletedAt: null,
        // Contractors only see their own contracts
        ...(userRole === 'contractor' ? { contractorOrgId: orgId } : {}),
      },
      include: {
        milestones: { select: { id: true, status: true, dueDate: true } },
        costEntries: { select: { amount: true } },
        contractorOrg: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = contracts.map((c) => {
      const totalSpent = c.costEntries.reduce((sum, e) => sum + Number(e.amount), 0);
      const computedRag = computeContractRag(c);
      const computedStatus = computeContractStatus(c, computedRag);

      // Fire-and-forget: sync RAG back to DB if changed
      if (c.ragStatus !== computedRag) {
        prisma.contract.update({ where: { id: c.id }, data: { ragStatus: computedRag } }).catch(() => {});
      }
      // Fire-and-forget: sync status back to DB if changed
      if (c.status !== computedStatus) {
        prisma.contract.update({ where: { id: c.id }, data: { status: computedStatus } }).catch(() => {});
      }

      return {
        ...c,
        ragStatus: computedRag,
        status: computedStatus,
        burnRate: Number(c.contractValue) > 0 ? totalSpent / Number(c.contractValue) : 0,
        totalSpent,
      };
    });

    return { data };
  });

  // Create contract + file upload (multipart) — owner-side roles
  app.post(
    '/projects/:id/contracts',
    { preHandler: requireRole('tar_manager', 'contract_manager') },
    async (request, reply) => {
      const { id: projectId } = request.params as { id: string };

      // Verify project access (Sharing logic)
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { ownerOrg: { include: { users: { select: { role: true } } } } }
      });

      if (!project) {
        reply.status(404);
        return { error: 'Project not found' };
      }

      const isStaff = ['tar_manager', 'pmo', 'contract_manager'].includes(request.userRole);
      const isAdminProject = project.ownerOrg.users.some(u => u.role === 'tar_manager');
      const hasProjectAccess = project.ownerOrgId === request.orgId || (isStaff && isAdminProject);

      if (!hasProjectAccess) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      const contentType = request.headers['content-type'] ?? '';

      let fields: Record<string, string> = {};
      let fileBuffer: Buffer | null = null;
      let fileName = '';
      let fileMimeType = '';

      if (contentType.includes('multipart/form-data')) {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file') {
            fileBuffer = await part.toBuffer();
            fileName = part.filename;
            fileMimeType = part.mimetype;
          } else {
            fields[part.fieldname] = part.value as string;
          }
        }
      } else {
        fields = request.body as Record<string, string>;
      }

      const body = createContractSchema.parse(fields);

      // Derive contract number from filename (without extension) if not provided
      const contractNumber = body.contractNumber
        || (fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ') : `Contract-${Date.now()}`);

      const contract = await prisma.contract.create({
        data: {
          projectId,
          contractorOrgId: body.contractorOrgId,
          contractNumber,
          type: body.type,
          spendingType: body.spendingType,
          department: body.department,
          contractValue: body.contractValue,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
        },
      });

      if (fileBuffer && fileName) {
        const fileKey = `contracts/${contract.id}/${fileName}`;
        await uploadToS3(fileKey, fileBuffer, fileMimeType);

        await prisma.contract.update({
          where: { id: contract.id },
          data: { fileKey, fileMimeType },
        });
      }

      const result = await prisma.contract.findUnique({ where: { id: contract.id } });
      reply.status(201);
      return { data: result };
    }
  );

  // Get contract detail
  app.get('/contracts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { orgId, userRole } = request;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        milestones: { orderBy: { dueDate: 'asc' } },
        costEntries: { orderBy: { entryDate: 'desc' } },
        contractorOrg: { select: { name: true, slug: true } },
        project: { 
          include: { 
            ownerOrg: { 
              include: { users: { select: { role: true } } } 
            } 
          } 
        },
      },
    });
    if (!contract) {
      reply.status(404);
      return { error: 'Contract not found' };
    }

    const isStaff = ['tar_manager', 'pmo', 'contract_manager'].includes(userRole);
    const isAdminProject = contract.project.ownerOrg.users.some(u => u.role === 'tar_manager');

    // Access check: owner org, contractor org, OR shared admin project for staff
    const hasAccess = contract.project.ownerOrgId === orgId || 
                     contract.contractorOrgId === orgId ||
                     (isStaff && isAdminProject);

    if (!hasAccess) {
      reply.status(403);
      return { error: 'Forbidden' };
    }

    // Compute RAG and Status realtime
    const computedRag = computeContractRag(contract);
    const computedStatus = computeContractStatus(contract, computedRag);

    // Fire-and-forget: sync back to DB if changed
    if (contract.ragStatus !== computedRag || contract.status !== computedStatus) {
      prisma.contract.update({
        where: { id: contract.id },
        data: {
          ...(contract.ragStatus !== computedRag ? { ragStatus: computedRag } : {}),
          ...(contract.status !== computedStatus ? { status: computedStatus } : {}),
        },
      }).catch(() => {});
    }

    return { data: { ...contract, ragStatus: computedRag, status: computedStatus } };
  });

  // Trigger AI extraction
  app.post('/contracts/:id/parse',
    { preHandler: [verifyContractAccess('id'), requirePermission('parse_contract')] },
    async (request, reply) => {
    const { id } = request.params as { id: string };

    console.log('[Parse] contractId:', id);
    console.log('[Parse] userId:', request.userId);
    console.log('[Parse] userRole:', request.userRole);
    console.log('[Parse] orgId:', request.orgId);

    try {
      const contract = await prisma.contract.findUnique({ where: { id } });

      console.log('[Parse] contract.fileKey:', contract?.fileKey);

      if (!contract) {
        reply.status(404);
        return { error: 'Contract not found' };
      }
      if (!contract.fileKey) {
        reply.status(400);
        return { error: 'No file uploaded for this contract' };
      }

      const job = await parsingQueue.add('parse-contract', {
        contractId: id,
        fileKey: contract.fileKey,
        mimeType: contract.fileMimeType ?? 'application/pdf',
      });

      console.log('[Parse] job queued:', job.id);
      return { data: { jobId: job.id } };
    } catch (err) {
      console.error('[Parse] Error:', err);
      reply.status(500);
      return { error: 'Failed to queue parse job' };
    }
  });

  // Poll job status
  app.get('/contracts/:id/parse/:jobId',
    { preHandler: verifyContractAccess('id') },
    async (request, reply) => {
    const { jobId } = request.params as { id: string; jobId: string };
    const job = await parsingQueue.getJob(jobId);

    if (!job) {
      reply.status(404);
      return { error: 'Job not found' };
    }

    const state = await job.getState();
    return {
      data: {
        jobId: job.id,
        status: state,
        progress: job.progress ?? 0,
      },
    };
  });

  // Get extraction results
  app.get('/contracts/:id/extraction',
    { preHandler: [verifyContractAccess('id'), requirePermission('read_extraction')] },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { aiExtractionStatus: true, aiExtractionData: true },
    });
    if (!contract) {
      reply.status(404);
      return { error: 'Contract not found' };
    }
    return { data: contract };
  });

  // Confirm extraction -> create milestones
  app.post(
    '/contracts/:id/extraction/confirm',
    { preHandler: requireRole('tar_manager', 'contract_manager') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = confirmSchema.parse(request.body);

      const milestones = await prisma.$transaction(
        body.milestones.map((m) =>
          prisma.milestone.create({
            data: {
              contractId: id,
              title: m.title,
              description: m.description,
              type: m.type,
              dueDate: m.due_date ? new Date(m.due_date) : new Date('2099-12-31'),
              source: 'ai_extracted',
              aiConfidence: m.confidence,
              requiresApproval: true,
            },
          })
        )
      );

      await prisma.contract.update({
        where: { id },
        data: {
          aiExtractionStatus: 'confirmed',
          status: 'active', // Auto-transition: milestones confirmed -> contract is active
        },
      });

      return { data: milestones };
    }
  );

  // Update contract
  app.patch(
    '/contracts/:id',
    { preHandler: requireRole('tar_manager', 'contract_manager') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, any>;

      // Verify the caller's org owns the project this contract belongs to
      const existing = await prisma.contract.findUnique({
        where: { id },
        select: { project: { select: { ownerOrgId: true } } },
      });
      if (!existing) {
        reply.status(404);
        return { error: 'Contract not found' };
      }
      if (process.env.SKIP_AUTH !== 'true' && existing.project.ownerOrgId !== request.orgId) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      const contract = await prisma.contract.update({
        where: { id },
        data: body,
      });
      return { data: contract };
    }
  );

  // Soft Delete contract
  app.delete(
    '/contracts/:id',
    { preHandler: requireRole('tar_manager', 'contract_manager') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Verify the caller's org owns the project this contract belongs to
      const existing = await prisma.contract.findUnique({
        where: { id },
        select: { project: { select: { ownerOrgId: true } } },
      });
      if (!existing) {
        reply.status(404);
        return { error: 'Contract not found' };
      }
      if (process.env.SKIP_AUTH !== 'true' && existing.project.ownerOrgId !== request.orgId) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      const contract = await prisma.contract.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { data: contract };
    }
  );

  // ── Contract Versioning ──────────────────────────────────

  // Upload new version of a contract (file only + optional change note)
  // Archives the current file as a ContractVersion, then replaces with new file.
  app.post(
    '/contracts/:id/versions',
    { preHandler: requireRole('tar_manager', 'contract_manager') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Verify contract exists and caller has access
      const existing = await prisma.contract.findUnique({
        where: { id },
        select: {
          id: true,
          fileKey: true,
          fileMimeType: true,
          currentVersion: true,
          aiExtractionStatus: true,
          aiExtractionData: true,
          project: { select: { ownerOrgId: true } },
        },
      });

      if (!existing) {
        reply.status(404);
        return { error: 'Contract not found' };
      }

      if (process.env.SKIP_AUTH !== 'true' && existing.project.ownerOrgId !== request.orgId) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      // Parse multipart: file (required) + changeNote (optional)
      const contentType = request.headers['content-type'] ?? '';
      if (!contentType.includes('multipart/form-data')) {
        reply.status(400);
        return { error: 'Multipart form data required' };
      }

      let fileBuffer: Buffer | null = null;
      let fileName = '';
      let fileMimeType = '';
      let changeNote: string | null = null;

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          fileBuffer = await part.toBuffer();
          fileName = part.filename;
          fileMimeType = part.mimetype;
        } else if (part.type === 'field' && part.fieldname === 'changeNote') {
          changeNote = (part.value as string) || null;
        }
      }

      if (!fileBuffer || !fileName) {
        reply.status(400);
        return { error: 'File is required for version update' };
      }

      // Archive current file as a ContractVersion before replacing
      // IMPORTANT: Copy old file to a versioned path to prevent overwrite
      // when the new file has the same filename as the old one.
      if (existing.fileKey) {
        const oldFileName = existing.fileKey.split('/').pop() ?? 'contract';
        const archivedFileKey = `contracts/${id}/versions/${existing.currentVersion}/${oldFileName}`;

        // Copy old file to versioned path
        const oldBuffer = await downloadFromS3(existing.fileKey);
        await uploadToS3(archivedFileKey, oldBuffer, existing.fileMimeType ?? 'application/octet-stream');

        await prisma.contractVersion.create({
          data: {
            contractId: id,
            versionNumber: existing.currentVersion,
            fileKey: archivedFileKey,
            fileMimeType: existing.fileMimeType ?? 'application/octet-stream',
            changeNote: changeNote,
            uploadedById: request.userId,
            aiExtractionStatus: existing.aiExtractionStatus,
            aiExtractionData: existing.aiExtractionData ?? undefined,
          },
        });
      }

      // Upload new file to S3 (safe now — old file is archived at versioned path)
      const newFileKey = `contracts/${id}/${fileName}`;
      await uploadToS3(newFileKey, fileBuffer, fileMimeType);

      // Update contract: new file, increment version, reset AI extraction
      const updated = await prisma.contract.update({
        where: { id },
        data: {
          fileKey: newFileKey,
          fileMimeType: fileMimeType,
          currentVersion: existing.currentVersion + 1,
          aiExtractionStatus: 'pending',
          aiExtractionData: null,
        },
        include: {
          milestones: { orderBy: { dueDate: 'asc' } },
          costEntries: { orderBy: { entryDate: 'desc' } },
          contractorOrg: { select: { name: true, slug: true } },
          project: {
            include: {
              ownerOrg: {
                include: { users: { select: { role: true } } },
              },
            },
          },
        },
      });

      // Clear text cache since file changed
      textCache.delete(id);

      // Audit log
      await logAudit({
        userId: request.userId,
        action: 'UPDATE',
        entityType: 'contract',
        entityId: id,
        changes: {
          type: 'file_replaced',
          newFileName: fileName,
          previousVersion: existing.currentVersion,
          newVersion: existing.currentVersion + 1,
          changeNote: changeNote,
        },
      });

      return { data: updated };
    }
  );

  // List all versions of a contract
  app.get(
    '/contracts/:id/versions',
    { preHandler: verifyContractAccess('id') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const contract = await prisma.contract.findUnique({
        where: { id },
        select: { id: true, currentVersion: true },
      });

      if (!contract) {
        reply.status(404);
        return { error: 'Contract not found' };
      }

      const versions = await prisma.contractVersion.findMany({
        where: { contractId: id },
        orderBy: { versionNumber: 'desc' },
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return {
        data: {
          currentVersion: contract.currentVersion,
          versions,
        },
      };
    }
  );

  // Revert current version — remove current file and restore previous version
  app.post(
    '/contracts/:id/versions/revert',
    { preHandler: requireRole('tar_manager', 'contract_manager') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const contract = await prisma.contract.findUnique({
        where: { id },
        select: {
          id: true,
          currentVersion: true,
          project: { select: { ownerOrgId: true } },
        },
      });

      if (!contract) {
        reply.status(404);
        return { error: 'Contract not found' };
      }

      if (process.env.SKIP_AUTH !== 'true' && contract.project.ownerOrgId !== request.orgId) {
        reply.status(403);
        return { error: 'Forbidden' };
      }

      if (contract.currentVersion <= 1) {
        reply.status(400);
        return { error: 'Cannot revert: this is the original version' };
      }

      // Find the most recent archived version
      const latestVersion = await prisma.contractVersion.findFirst({
        where: { contractId: id },
        orderBy: { versionNumber: 'desc' },
      });

      if (!latestVersion) {
        reply.status(400);
        return { error: 'No previous version found to revert to' };
      }

      // Restore the archived version's file and AI data onto the contract
      const updated = await prisma.contract.update({
        where: { id },
        data: {
          fileKey: latestVersion.fileKey,
          fileMimeType: latestVersion.fileMimeType,
          currentVersion: contract.currentVersion - 1,
          aiExtractionStatus: latestVersion.aiExtractionStatus,
          aiExtractionData: latestVersion.aiExtractionData ?? undefined,
        },
        include: {
          milestones: { orderBy: { dueDate: 'asc' } },
          costEntries: { orderBy: { entryDate: 'desc' } },
          contractorOrg: { select: { name: true, slug: true } },
          project: {
            include: {
              ownerOrg: {
                include: { users: { select: { role: true } } },
              },
            },
          },
        },
      });

      // Delete the version record we just restored
      await prisma.contractVersion.delete({
        where: { id: latestVersion.id },
      });

      // Clear text cache
      textCache.delete(id);

      // Audit log
      await logAudit({
        userId: request.userId,
        action: 'UPDATE',
        entityType: 'contract',
        entityId: id,
        changes: {
          type: 'version_reverted',
          revertedFromVersion: contract.currentVersion,
          revertedToVersion: contract.currentVersion - 1,
        },
      });

      return { data: updated };
    }
  );

  // ── Contract Diff ──────────────────────────────────

  const diffQuerySchema = z.object({
    versionA: z.coerce.number().int().min(1),
    versionB: z.coerce.number().int().min(1),
  });

  app.get(
    '/contracts/:id/diff',
    { preHandler: verifyContractAccess('id') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = diffQuerySchema.safeParse(request.query);

      if (!query.success) {
        reply.status(400);
        return { error: 'versionA and versionB query params required (integers)' };
      }

      const { versionA, versionB } = query.data;

      if (versionA === versionB) {
        reply.status(400);
        return { error: 'Cannot diff a version with itself' };
      }

      try {
        const { computeContractDiff } = await import('../services/diff/contract-differ');
        const result = await computeContractDiff(id, versionA, versionB);
        return { data: result };
      } catch (err) {
        const msg = (err as Error).message || 'Failed to compute diff';
        console.error('[diff] Failed:', msg);
        if (msg.includes('not found') || msg.includes('No file')) {
          reply.status(404);
        } else {
          reply.status(500);
        }
        return { error: msg };
      }
    }
  );

  // ── Source Verification ──────────────────────────────────

  async function getContractText(contractId: string): Promise<{ text: string; fileName: string; pages: PageTextInfo[] } | null> {
    if (textCache.has(contractId)) return textCache.get(contractId)!;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { fileKey: true, fileMimeType: true },
    });
    if (!contract?.fileKey) return null;

    const buffer = await downloadFromS3(contract.fileKey);
    const mime = contract.fileMimeType ?? 'application/pdf';
    const fileName = contract.fileKey.split('/').pop() ?? 'contract';

    let text: string;
    let pages: PageTextInfo[] = [];

    // For PDFs, extract with page info; for other types, just extract text
    if (mime === 'application/pdf') {
      try {
        const result = await extractFromPdfWithPages(buffer);
        text = result.text;
        pages = result.pages;
      } catch {
        // Fallback to flat extraction
        text = await extractTextFromFile(buffer, mime);
      }
    } else {
      text = await extractTextFromFile(buffer, mime);
    }

    const entry = { text, fileName, pages };
    textCache.set(contractId, entry);
    return entry;
  }

  // GET /contracts/:id/source-text — full extracted text
  app.get(
    '/contracts/:id/source-text',
    { preHandler: verifyContractAccess('id') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const result = await getContractText(id);
        if (!result) {
          reply.status(404);
          return { error: 'No file attached to this contract' };
        }

        return {
          data: {
            full_text: result.text,
            file_name: result.fileName,
            total_chars: result.text.length,
          },
        };
      } catch (err) {
        console.error('[source-text] Failed:', err);
        reply.status(500);
        return { error: 'Failed to extract text from contract file' };
      }
    }
  );

  const locateClauseSchema = z.object({
    source_clause: z.string().min(1),
  });

  // POST /contracts/:id/locate-clause — fuzzy find clause in contract text
  app.post(
    '/contracts/:id/locate-clause',
    { preHandler: verifyContractAccess('id') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = locateClauseSchema.parse(request.body);

      try {
        const result = await getContractText(id);
        if (!result) {
          reply.status(404);
          return { error: 'No file attached to this contract' };
        }

        const match = fuzzyLocate(result.text, body.source_clause);

        if (!match) {
          return { data: { found: false, match_start: 0, match_end: 0, context_start: 0, context_end: 0, context_text: '', matched_text: '', page_numbers: [] } };
        }

        const CONTEXT_PAD = 300;
        const contextStart = Math.max(0, match.start - CONTEXT_PAD);
        const contextEnd = Math.min(result.text.length, match.end + CONTEXT_PAD);
        const contextText = result.text.slice(contextStart, contextEnd);
        const matchedText = result.text.slice(match.start, match.end);

        // Determine which page(s) the match falls on
        const pageNumbers: number[] = [];
        if (result.pages.length > 0) {
          for (let i = 0; i < result.pages.length; i++) {
            const pageStart = result.pages[i].startOffset;
            const pageEnd = i < result.pages.length - 1 ? result.pages[i + 1].startOffset : result.text.length;
            // Match overlaps this page if match.start < pageEnd AND match.end > pageStart
            if (match.start < pageEnd && match.end > pageStart) {
              pageNumbers.push(result.pages[i].pageNum);
            }
          }
        }

        return {
          data: {
            found: true,
            match_start: match.start,
            match_end: match.end,
            context_start: contextStart,
            context_end: contextEnd,
            context_text: contextText,
            matched_text: matchedText,
            page_numbers: pageNumbers,
            highlight_offset_start: match.start - contextStart,
            highlight_offset_end: match.end - contextStart,
          },
        };
      } catch (err) {
        console.error('[locate-clause] Failed:', err);
        reply.status(500);
        return { error: 'Failed to locate clause in contract' };
      }
    }
  );
}

// ── Fuzzy text matching (Levenshtein-based) ──────────────

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Levenshtein distance between two strings.
 * For performance, bails out early if distance exceeds maxDist.
 */
function levenshtein(a: string, b: string, maxDist?: number): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row DP for memory efficiency
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    // Early exit if impossible to meet threshold
    if (maxDist !== undefined && rowMin > maxDist) return rowMin;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Levenshtein ratio: 0 (completely different) to 1 (identical) */
function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b, maxLen);
  return 1 - dist / maxLen;
}

function fuzzyLocate(fullText: string, clause: string): { start: number; end: number } | null {
  // 1. Exact match
  const exactIdx = fullText.indexOf(clause);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + clause.length };
  }

  // 2. Normalized exact match
  const normClause = normalize(clause);
  const normText = normalize(fullText);

  const normIdx = normText.indexOf(normClause);
  if (normIdx !== -1) {
    const origPos = mapNormToOrig(fullText, normIdx, normClause.length);
    if (origPos) return origPos;
  }

  // 3. Partial head match — try first 80 chars of normalized clause
  const headLen = Math.min(80, normClause.length);
  const head = normClause.slice(0, headLen);
  const headIdx = normText.indexOf(head);
  if (headIdx !== -1) {
    const origPos = mapNormToOrig(fullText, headIdx, Math.min(normClause.length, normText.length - headIdx));
    if (origPos) return origPos;
  }

  // 4. Sliding window with Levenshtein ratio (threshold 0.75)
  const windowSize = normClause.length;
  if (windowSize > 0 && windowSize <= normText.length) {
    const threshold = 0.75;
    const maxDist = Math.ceil(windowSize * (1 - threshold));
    let bestScore = 0;
    let bestIdx = -1;

    // Coarse scan: step by 1/4 window
    const step = Math.max(1, Math.floor(windowSize / 4));
    for (let i = 0; i <= normText.length - windowSize; i += step) {
      const window = normText.slice(i, i + windowSize);
      const score = levenshteinRatio(window, normClause);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // Fine scan: refine around best position
    if (bestIdx >= 0 && bestScore >= threshold * 0.9) {
      const refineStart = Math.max(0, bestIdx - step);
      const refineEnd = Math.min(normText.length - windowSize, bestIdx + step);
      for (let i = refineStart; i <= refineEnd; i++) {
        const window = normText.slice(i, i + windowSize);
        const score = levenshteinRatio(window, normClause);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }

    if (bestScore >= threshold && bestIdx !== -1) {
      const origPos = mapNormToOrig(fullText, bestIdx, windowSize);
      if (origPos) return origPos;
    }
  }

  // 5. Sentence-level fallback — split clause into sentences, find best matching sentence
  const sentences = clause.split(/(?<=[.;!?])\s+/).filter(s => s.length >= 20);
  if (sentences.length > 1) {
    let bestSentenceMatch: { start: number; end: number } | null = null;
    let lastEnd = 0;

    for (const sentence of sentences) {
      const normSent = normalize(sentence);
      const sentIdx = normText.indexOf(normSent, lastEnd > 0 ? mapOrigToNorm(fullText, lastEnd) : 0);
      if (sentIdx !== -1) {
        const origPos = mapNormToOrig(fullText, sentIdx, normSent.length);
        if (origPos) {
          if (!bestSentenceMatch) {
            bestSentenceMatch = origPos;
          } else {
            // Expand the match range to include all found sentences
            bestSentenceMatch = {
              start: Math.min(bestSentenceMatch.start, origPos.start),
              end: Math.max(bestSentenceMatch.end, origPos.end),
            };
          }
          lastEnd = origPos.end;
        }
      }
    }

    if (bestSentenceMatch) return bestSentenceMatch;
  }

  return null;
}

/** Map an original text position to approximate normalized position */
function mapOrigToNorm(original: string, origPos: number): number {
  let normPos = 0;
  let inWhitespace = false;
  for (let i = 0; i < Math.min(origPos, original.length); i++) {
    const isWs = /\s/.test(original[i]);
    if (isWs) {
      if (!inWhitespace && normPos > 0) normPos++;
      inWhitespace = true;
    } else {
      inWhitespace = false;
      normPos++;
    }
  }
  return normPos;
}

function mapNormToOrig(original: string, normStart: number, normLen: number): { start: number; end: number } | null {
  let normPos = 0;
  let origStart = -1;
  let inWhitespace = false;

  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    const isWs = /\s/.test(ch);

    if (isWs) {
      if (!inWhitespace && normPos > 0) {
        if (normPos === normStart) origStart = i;
        normPos++;
      }
      inWhitespace = true;
    } else {
      inWhitespace = false;
      if (normPos === normStart) origStart = i;
      normPos++;
    }

    if (origStart !== -1 && normPos >= normStart + normLen) {
      return { start: origStart, end: i + 1 };
    }
  }

  if (origStart !== -1) {
    return { start: origStart, end: original.length };
  }

  return null;
}
