import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { z } from 'zod';
import { requireRole, requirePermission } from '../middleware/auth';
import { verifyProjectAccess } from '../middleware/authorization';
import { logAudit } from '../services/audit';

const createProjectSchema = z.object({
  name: z.string().min(1),
  tarStartDate: z.string().date(),
  tarEndDate: z.string().date(),
  totalBudget: z.union([z.string(), z.number()]).transform(String),
  currency: z.enum(['USD', 'VND']).default('USD'),
});

export async function projectRoutes(app: FastifyInstance) {
  // List projects — filter based on user role and org
  app.get('/projects', async (request, reply) => {
    const { orgId, userRole } = request;

    let projects = [];

    if (userRole === 'contractor') {
      // Contractors see only projects they have contracts in
      projects = await prisma.project.findMany({
        where: {
          deletedAt: null,
          contracts: { some: { contractorOrgId: orgId } }
        },
        include: {
          contracts: {
            select: { id: true, status: true, ragStatus: true },
            where: { contractorOrgId: orgId }
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Staff (tar_manager, contract_manager, pmo, procurement) see:
      // 1. Projects they own (ownerOrgId = their org)
      // 2. Admin projects (owner org has tar_manager) — only if they are staff
      const isStaff = ['tar_manager', 'contract_manager', 'pmo', 'procurement'].includes(userRole);

      const contractInclude = {
        contracts: {
          select: { id: true, status: true, ragStatus: true },
          where: { deletedAt: null },
        },
      };

      if (isStaff) {
        // Get all projects from own org
        const ownProjects = await prisma.project.findMany({
          where: {
            deletedAt: null,
            ownerOrgId: orgId,
          },
          include: contractInclude,
        });

        // Get admin projects (owner org has tar_manager)
        const adminProjects = await prisma.project.findMany({
          where: {
            deletedAt: null,
            ownerOrg: {
              users: { some: { role: 'tar_manager' } }
            },
          },
          include: contractInclude,
        });

        // Dedupe by id
        const projectMap = new Map();
        [...ownProjects, ...adminProjects].forEach(p => projectMap.set(p.id, p));
        projects = Array.from(projectMap.values());
      } else {
        // Fallback for unknown roles
        projects = await prisma.project.findMany({
          where: {
            deletedAt: null,
            ownerOrgId: orgId,
          },
          include: contractInclude,
        });
      }
    }

    projects = projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { data: projects };
  });

  // Create project — only owner-side roles with permission
  app.post(
    '/projects',
    { preHandler: requirePermission('create_project') },
    async (request, reply) => {
      const body = createProjectSchema.parse(request.body);

      const project = await prisma.project.create({
        data: {
          name: body.name,
          ownerOrgId: request.orgId,
          tarStartDate: new Date(body.tarStartDate),
          tarEndDate: new Date(body.tarEndDate),
          totalBudget: body.totalBudget,
          currency: body.currency,
        },
      });

      // Log audit entry
      await logAudit({
        userId: request.userId,
        action: 'CREATE',
        entityType: 'project',
        entityId: project.id,
        changes: {
          name: body.name,
          ownerOrgId: request.orgId,
          tarStartDate: body.tarStartDate,
          tarEndDate: body.tarEndDate,
          totalBudget: body.totalBudget,
          currency: body.currency,
        },
      });

      reply.status(201);
      return { data: project };
    }
  );

  // Get project detail — with improved authorization
  app.get(
    '/projects/:id',
    { preHandler: verifyProjectAccess('id') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { userRole } = request;

      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          ownerOrg: {
            include: { users: { select: { role: true } } }
          },
          contracts: {
            include: {
              milestones: true,
              costEntries: true,
              contractorOrg: { select: { name: true } },
            },
            ...(userRole === 'contractor'
              ? { where: { contractorOrgId: request.orgId } }
              : {}),
          },
        },
      });

      if (!project) {
        reply.status(404);
        return { error: 'Project not found' };
      }

      return { data: project };
    }
  );

  // Update project — with permission check
  app.patch(
    '/projects/:id',
    { preHandler: [verifyProjectAccess('id'), requirePermission('update_project_own_org')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        name: z.string().min(1).optional(),
        status: z.enum(['planning', 'active', 'close_out', 'complete']).optional(),
      }).parse(request.body);

      const before = await prisma.project.findUnique({ where: { id } });

      const project = await prisma.project.update({
        where: { id },
        data: { ...body },
      });

      // Log audit entry
      if (before && body.name && before.name !== body.name) {
        await logAudit({
          userId: request.userId,
          action: 'UPDATE',
          entityType: 'project',
          entityId: id,
          changes: { name: { before: before.name, after: body.name } },
        });
      }

      return { data: project };
    }
  );

  // Dashboard KPIs — reads from Redis cache first, falls back to DB
  app.get('/projects/:id/dashboard', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { orgId, userRole } = request;

    // Try Redis cache first
    const cacheKey = `rag:project:${id}`;
    const cached = await redis.get(cacheKey).catch(() => null);

    // Always fetch full data from DB (cache only supplements RAG breakdown)
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        ownerOrg: {
          include: { users: { select: { role: true } } }
        },
        contracts: {
          where: {
            deletedAt: null,
            ...(userRole === 'contractor' ? { contractorOrgId: orgId } : {}),
          },
          include: {
            milestones: {
              select: { id: true, status: true, dueDate: true, title: true, completedAt: true },
            },
            costEntries: {
              select: { amount: true, entryDate: true },
            },
            contractorOrg: { select: { name: true } },
          },
        },
      },
    });

    if (!project) {
      reply.status(404);
      return { error: 'Project not found' };
    }

    const contracts = project.contracts;
    const allMilestones = contracts.flatMap((c) => c.milestones);
    const allCosts = contracts.flatMap((c) => c.costEntries);
    const now = new Date();

    const totalSpent = allCosts.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalBudget = Number(project.totalBudget);

    const overdueMilestones = allMilestones.filter((m) => {
      const dueDate = new Date(m.dueDate);
      // Still overdue: not complete/waived and past due
      if (m.status !== 'complete' && m.status !== 'waived' && dueDate < now) return true;
      // Completed late: approved after due date
      if (m.status === 'complete' && m.completedAt && new Date(m.completedAt) > dueDate) return true;
      return false;
    });
    const completedMilestones = allMilestones.filter((m) => m.status === 'complete');

    // Use cached RAG breakdown if available, else compute from DB
    let ragSummary = { green: 0, amber: 0, red: 0 };
    if (cached) {
      const cachedData = JSON.parse(cached);
      ragSummary = { green: cachedData.green, amber: cachedData.amber, red: cachedData.red };
    } else {
      for (const c of contracts) {
        ragSummary[c.ragStatus]++;
      }
    }

    // Contracts at risk — red and amber contracts with details
    const contractsAtRisk = contracts
      .filter((c) => c.ragStatus === 'red' || c.ragStatus === 'amber')
      .map((c) => {
        const contractEnd = new Date(c.endDate);
        const daysRemaining = Math.ceil(
          (contractEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const contractSpent = c.costEntries.reduce((sum, e) => sum + Number(e.amount), 0);
        const overdueCount = c.milestones.filter((m) => {
          const dueDate = new Date(m.dueDate);
          if (m.status !== 'complete' && m.status !== 'waived' && dueDate < now) return true;
          if (m.status === 'complete' && m.completedAt && new Date(m.completedAt) > dueDate) return true;
          return false;
        }).length;

        return {
          id: c.id,
          contractNumber: c.contractNumber,
          contractorName: c.contractorOrg.name,
          ragStatus: c.ragStatus,
          daysRemaining,
          burnRate: Number(c.contractValue) > 0 ? contractSpent / Number(c.contractValue) : 0,
          overdueCount,
        };
      })
      .sort((a, b) => {
        // Sort RED first, then by days remaining ascending
        if (a.ragStatus !== b.ragStatus) return a.ragStatus === 'red' ? -1 : 1;
        return a.daysRemaining - b.daysRemaining;
      });

    // Overdue milestones with contract info
    const overdueMilestoneDetails = overdueMilestones.map((m) => {
      const contract = contracts.find((c) => c.milestones.some((cm) => cm.id === m.id));
      const dueDate = new Date(m.dueDate);
      const completedLate = m.status === 'complete' && m.completedAt && new Date(m.completedAt) > dueDate;
      return {
        id: m.id,
        title: m.title,
        dueDate: m.dueDate,
        contractNumber: contract?.contractNumber ?? '',
        contractId: contract?.id ?? '',
        delayDays: Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        completedLate: !!completedLate,
        completedAt: m.completedAt,
      };
    }).sort((a, b) => b.delayDays - a.delayDays);

    // Daily cost burn data for chart — aggregate costs by day
    const tarStart = new Date(project.tarStartDate);
    const tarEnd = new Date(project.tarEndDate);
    const totalDays = Math.ceil((tarEnd.getTime() - tarStart.getTime()) / (1000 * 60 * 60 * 24));
    const dailyBudget = totalDays > 0 ? totalBudget / totalDays : 0;

    // Group costs by day number relative to TAR start
    const costsByDay: Record<number, number> = {};
    for (const cost of allCosts) {
      const costDate = new Date(cost.entryDate);
      const dayNum = Math.floor((costDate.getTime() - tarStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (dayNum >= 1) {
        costsByDay[dayNum] = (costsByDay[dayNum] ?? 0) + Number(cost.amount);
      }
    }

    // Build cumulative spend data points (full range: start to end)
    const currentDay = Math.min(
      Math.floor((now.getTime() - tarStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      totalDays
    );

    const dailyBurnData: Array<{ day: number; date: string; actualSpend: number | null; plannedBudget: number }> = [];
    let cumulativeSpend = 0;
    for (let d = 1; d <= totalDays; d++) {
      cumulativeSpend += costsByDay[d] ?? 0;
      const pointDate = new Date(tarStart);
      pointDate.setDate(pointDate.getDate() + d - 1);
      dailyBurnData.push({
        day: d,
        date: pointDate.toISOString().split('T')[0],
        actualSpend: d <= currentDay ? cumulativeSpend : null,
        plannedBudget: Math.round(dailyBudget * d),
      });
    }

    return {
      data: {
        totalContracts: contracts.length,
        activeContracts: contracts.filter((c) => c.status === 'active').length,
        overdueMilestones: overdueMilestones.length,
        completionRate: allMilestones.length > 0 ? completedMilestones.length / allMilestones.length : 0,
        totalBudget: totalBudget.toString(),
        totalSpent: totalSpent.toString(),
        burnRate: totalBudget > 0 ? totalSpent / totalBudget : 0,
        ragSummary,
        contractsAtRisk,
        overdueMilestoneDetails,
        dailyBurnData,
        tarStartDate: project.tarStartDate,
        tarEndDate: project.tarEndDate,
        lastUpdated: new Date().toISOString(),
      },
    };
  });

  // Gantt chart data — phases derived from contracts
  app.get('/projects/:id/gantt', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { orgId, userRole } = request;

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        tarStartDate: true,
        tarEndDate: true,
        contracts: {
          where: {
            deletedAt: null,
            ...(userRole === 'contractor' ? { contractorOrgId: orgId } : {}),
          },
          select: {
            id: true,
            contractNumber: true,
            type: true,
            startDate: true,
            endDate: true,
            status: true,
            ragStatus: true,
            contractorOrg: { select: { name: true } },
            milestones: {
              select: { id: true, status: true, dueDate: true },
            },
          },
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!project) {
      reply.status(404);
      return { error: 'Project not found' };
    }

    const PHASE_MAP: Record<string, string[]> = {
      once_off: ['Mobilisation', 'Execution', 'Completion', 'Demobilisation'],
      frame:    ['Call-off', 'Execution', 'Review', 'Close-out'],
    };

    // Seeded pseudo-random: consistent per contractId + phaseIndex
    function seededRandom(seed: string): number {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        const ch = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash |= 0;
      }
      // Map to 0–1
      return Math.abs(hash % 10000) / 10000;
    }

    const now = new Date();
    const tarStart = new Date(project.tarStartDate);
    const tarEnd = new Date(project.tarEndDate);

    const phases: Array<{
      id: string;
      contractId: string;
      contractNumber: string;
      contractorName: string;
      phase: string;
      phaseIndex: number;
      plannedStart: string;
      plannedEnd: string;
      plannedProgress: number;
      actualProgress: number;
      status: 'on_track' | 'at_risk' | 'behind';
      ragStatus: string;
    }> = [];

    for (const contract of project.contracts) {
      const phaseNames = PHASE_MAP[contract.type] ?? PHASE_MAP.once_off;
      const cStart = new Date(contract.startDate).getTime();
      const cEnd = new Date(contract.endDate).getTime();
      const cDuration = cEnd - cStart;

      for (let i = 0; i < phaseNames.length; i++) {
        const pStart = new Date(cStart + (cDuration * i) / phaseNames.length);
        const pEnd = new Date(cStart + (cDuration * (i + 1)) / phaseNames.length);

        // Planned progress: how far we should be based on current date
        let plannedProgress = 0;
        if (now >= pEnd) {
          plannedProgress = 100;
        } else if (now > pStart) {
          const elapsed = now.getTime() - pStart.getTime();
          const total = pEnd.getTime() - pStart.getTime();
          plannedProgress = Math.round((elapsed / total) * 100);
        }

        // Simulated actual progress — seeded by contractId + phase index
        const seed = `${contract.id}-phase-${i}`;
        const rng = seededRandom(seed);
        let actualProgress: number;

        if (plannedProgress === 0) {
          // Phase hasn't started yet — small chance of early start
          actualProgress = rng < 0.2 ? Math.round(rng * 15) : 0;
        } else if (plannedProgress === 100) {
          // Phase should be done — might be complete or slightly behind
          actualProgress = rng < 0.7 ? 100 : Math.round(85 + rng * 15);
        } else {
          // In progress — scatter around planned with some variance
          const variance = (rng - 0.4) * 30; // -12 to +18 range
          actualProgress = Math.round(Math.max(0, Math.min(100, plannedProgress + variance)));
        }

        // Status based on gap
        let status: 'on_track' | 'at_risk' | 'behind';
        if (plannedProgress === 0) {
          status = 'on_track';
        } else {
          const ratio = actualProgress / plannedProgress;
          if (ratio >= 0.95) status = 'on_track';
          else if (ratio >= 0.80) status = 'at_risk';
          else status = 'behind';
        }

        phases.push({
          id: `${contract.id}-${i}`,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          contractorName: contract.contractorOrg.name,
          phase: phaseNames[i],
          phaseIndex: i,
          plannedStart: pStart.toISOString(),
          plannedEnd: pEnd.toISOString(),
          plannedProgress,
          actualProgress,
          status,
          ragStatus: contract.ragStatus,
        });
      }
    }

    return {
      data: {
        tarStartDate: tarStart.toISOString(),
        tarEndDate: tarEnd.toISOString(),
        phases,
      },
    };
  });

  // Delete project (soft delete) — owner-side roles only
  app.delete(
    '/projects/:id',
    { preHandler: requireRole('tar_manager', 'contract_manager', 'pmo') },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await prisma.project.findUnique({
        where: { id },
        select: { ownerOrgId: true, deletedAt: true },
      });
      if (!existing || existing.ownerOrgId !== request.orgId) {
        reply.status(403);
        return { error: 'Forbidden' };
      }
      if (existing.deletedAt) {
        reply.status(404);
        return { error: 'Project not found' };
      }

      await prisma.project.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return { success: true };
    }
  );
}
