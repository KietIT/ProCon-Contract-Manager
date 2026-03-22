/**
 * Auto-generate a CostEntry when a milestone is marked complete.
 *
 * MVP logic: each milestone's cost = contractValue / totalMilestones.
 * The entry is created with `approved: true` (auto-generated, no manual approval needed).
 * Waived milestones do NOT generate cost entries.
 */
import { prisma } from '../lib/prisma';

export async function createCostEntryForMilestone(
  milestoneId: string,
  userId: string
): Promise<void> {
  try {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { contractId: true },
    });

    if (!milestone) return;

    const contract = await prisma.contract.findUnique({
      where: { id: milestone.contractId },
      select: { contractValue: true },
    });

    if (!contract) return;

    const totalMilestones = await prisma.milestone.count({
      where: { contractId: milestone.contractId },
    });

    if (totalMilestones === 0) return;

    const costPerMilestone = Number(contract.contractValue) / totalMilestones;

    if (costPerMilestone <= 0) return;

    await prisma.costEntry.create({
      data: {
        contractId: milestone.contractId,
        entryDate: new Date(),
        amount: costPerMilestone,
        category: 'subcontract',
        submittedByUserId: userId,
        approved: true,
      },
    });

    console.log(
      `[cost-auto] Created cost entry for milestone ${milestoneId}: $${costPerMilestone.toFixed(2)}`
    );
  } catch (err) {
    // Fire-and-forget — don't block milestone completion if cost entry fails
    console.error('[cost-auto] Failed to create cost entry:', err);
  }
}
