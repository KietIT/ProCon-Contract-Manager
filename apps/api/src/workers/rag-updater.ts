/**
 * RAG Status Updater — runs every hour.
 * Iterates all active contracts, computes RAG status, updates DB,
 * and caches aggregated project-level RAG data in Redis.
 *
 * Run as a separate process: tsx src/workers/rag-updater.ts
 */
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { computeContractRag } from '../services/rag-computer';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_TTL_SECONDS = 3600; // 1 hour

async function updateRagStatuses() {
  console.log('[rag-updater] Computing RAG statuses...');

  // Fetch all non-deleted contracts with milestones and costs
  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null },
    include: {
      milestones: { select: { status: true, dueDate: true } },
      costEntries: { select: { amount: true } },
    },
  });

  // Track per-project aggregates
  const projectAggregates: Record<string, {
    green: number;
    amber: number;
    red: number;
    contractIds: string[];
  }> = {};

  let updated = 0;

  for (const contract of contracts) {
    const newRag = computeContractRag(contract);

    // Only write to DB if RAG changed
    if (contract.ragStatus !== newRag) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { ragStatus: newRag },
      });
      updated++;
    }

    // Aggregate by project
    if (!projectAggregates[contract.projectId]) {
      projectAggregates[contract.projectId] = { green: 0, amber: 0, red: 0, contractIds: [] };
    }
    projectAggregates[contract.projectId][newRag]++;
    projectAggregates[contract.projectId].contractIds.push(contract.id);
  }

  // Cache per-project RAG breakdown in Redis
  const pipeline = redis.pipeline();
  for (const [projectId, agg] of Object.entries(projectAggregates)) {
    const cacheKey = `rag:project:${projectId}`;
    pipeline.set(
      cacheKey,
      JSON.stringify({
        green: agg.green,
        amber: agg.amber,
        red: agg.red,
        totalContracts: agg.contractIds.length,
        updatedAt: new Date().toISOString(),
      }),
      'EX',
      CACHE_TTL_SECONDS
    );
  }
  await pipeline.exec();

  console.log(
    `[rag-updater] Done: ${contracts.length} contracts evaluated, ${updated} updated, ${Object.keys(projectAggregates).length} project caches refreshed`
  );
}

// Run immediately, then on interval
console.log('[rag-updater] Starting RAG updater (interval: 1 hour)');
updateRagStatuses().catch(console.error);

setInterval(() => {
  updateRagStatuses().catch(console.error);
}, CHECK_INTERVAL_MS);
