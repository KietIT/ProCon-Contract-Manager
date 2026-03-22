import { prisma } from '../lib/prisma';

/**
 * Audit Logging Service
 * Tracks all important actions (create, update, delete, approve, reject)
 * for compliance and debugging purposes.
 */

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'ESCALATE';

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: Record<string, any>;
}

/**
 * Log an audit entry
 */
export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  changes,
}: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        changes: changes ? JSON.stringify(changes) : null,
      },
    });
  } catch (error) {
    console.error('[AUDIT] Failed to log audit entry:', error);
    // Don't throw — audit failures should not break business logic
  }
}

/**
 * Log a contract creation
 */
export async function logContractCreated(
  userId: string,
  contractId: string,
  contractData: Record<string, any>
): Promise<void> {
  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'contract',
    entityId: contractId,
    changes: contractData,
  });
}

/**
 * Log a contract update
 */
export async function logContractUpdated(
  userId: string,
  contractId: string,
  beforeData: Record<string, any>,
  afterData: Record<string, any>
): Promise<void> {
  const changes: Record<string, any> = {};
  
  Object.keys(afterData).forEach((key) => {
    if (JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])) {
      changes[key] = { before: beforeData[key], after: afterData[key] };
    }
  });

  if (Object.keys(changes).length > 0) {
    await logAudit({
      userId,
      action: 'UPDATE',
      entityType: 'contract',
      entityId: contractId,
      changes,
    });
  }
}

/**
 * Log a milestone completion
 */
export async function logMilestoneCompleted(
  userId: string,
  milestoneId: string,
  milestoneTitle: string
): Promise<void> {
  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'milestone_completion',
    entityId: milestoneId,
    changes: { title: milestoneTitle, status: 'complete' },
  });
}

/**
 * Log an approval decision
 */
export async function logApprovalDecision(
  userId: string,
  approvalId: string,
  decision: 'APPROVE' | 'REJECT',
  comments?: string,
  milestoneTitle?: string
): Promise<void> {
  await logAudit({
    userId,
    action: decision,
    entityType: 'approval_request',
    entityId: approvalId,
    changes: { decision, comments, milestone: milestoneTitle },
  });
}

/**
 * Log an escalation
 */
export async function logApprovalEscalated(
  userId: string,
  approvalId: string,
  fromApprover: string,
  toApprover: string
): Promise<void> {
  await logAudit({
    userId,
    action: 'ESCALATE',
    entityType: 'approval_request',
    entityId: approvalId,
    changes: { fromApprover, toApprover },
  });
}

/**
 * Log a cost entry
 */
export async function logCostEntryCreated(
  userId: string,
  costEntryId: string,
  costData: Record<string, any>
): Promise<void> {
  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'cost_entry',
    entityId: costEntryId,
    changes: costData,
  });
}

/**
 * Get audit logs for an entity
 */
export async function getAuditLogs(
  entityType: string,
  entityId: string,
  limit: number = 50
) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get all audit logs for a user
 */
export async function getUserAuditLogs(userId: string, limit: number = 100) {
  return prisma.auditLog.findMany({
    where: { userId },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get audit logs within a date range
 */
export async function getAuditLogsInRange(startDate: Date, endDate: Date, limit: number = 500) {
  return prisma.auditLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
