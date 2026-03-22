import { prisma } from '../lib/prisma';

/**
 * RBAC Service - Centralized authorization logic
 * 
 * Consolidates all permission checks to avoid code duplication
 * and ensure consistency across the API.
 */

export type UserRole = 'tar_manager' | 'contract_manager' | 'pmo' | 'procurement' | 'contractor';

/**
 * Permission matrix: who can do what
 */
const PERMISSIONS: Record<UserRole, Set<string>> = {
  tar_manager: new Set([
    'create_project',
    'read_all_projects',
    'read_project_own_org',
    'update_project_own_org',
    'delete_project_own_org',
    'create_contract',
    'read_all_contracts',
    'read_contract_own_org',
    'update_contract_own_org',
    'parse_contract',
    'read_extraction',
    'confirm_extraction',
    'create_milestone',
    'update_milestone_own_org',
    'complete_milestone',
    'approve_milestone',
    'create_cost_entry',
    'read_all_cost_entries',
    'read_cost_entry_own_org',
    'manage_users_own_org',
    'escalate_approval',
    'view_audit_log',
    'generate_reports',
  ]),

  contract_manager: new Set([
    'create_project',
    'read_project_own_org',
    'update_project_own_org',
    'create_contract',
    'read_contract_own_org',
    'update_contract_own_org',
    'parse_contract',
    'read_extraction',
    'confirm_extraction',
    'create_milestone',
    'update_milestone_own_org',
    'complete_milestone',
    'approve_milestone', // Can approve pending
    'create_cost_entry',
    'read_cost_entry_own_org',
    'view_audit_log',
    'generate_reports',
  ]),

  pmo: new Set([
    'read_project_own_org',
    'read_contract_own_org',
    'read_extraction',
    'read_milestone_own_org',
    'read_cost_entry_own_org',
    'view_audit_log',
    'generate_reports',
    'read_rag_status',
  ]),

  procurement: new Set([
    'read_cost_entry_own_org',
    'create_cost_entry',
    'read_contract_own_org',
    'read_milestone_own_org',
    'parse_contract',
    'read_extraction',
    'confirm_extraction',
    'create_milestone',
  ]),

  contractor: new Set([
    'read_contract_own_org',
    'read_milestone_own_org',
    'update_milestone_assigned',
    'read_cost_entry_own_org',
  ]),
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Check if user can access a project
 */
export async function canAccessProject(
  userId: string,
  userOrgId: string,
  userRole: UserRole,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerOrgId: true,
      ownerOrg: { select: { users: { select: { role: true } } } },
    },
  });

  if (!project) return false;

  // Owner org users always have access
  if (project.ownerOrgId === userOrgId) return true;

  // Staff (tar_manager, contract_manager, pmo) can access admin projects (owner org has tar_manager)
  const isStaff = ['tar_manager', 'contract_manager', 'pmo'].includes(userRole);
  const isAdminProject = project.ownerOrg.users.some((u) => u.role === 'tar_manager');
  
  if (isStaff && isAdminProject) return true;

  // Contractors can access if they have contracts in the project
  if (userRole === 'contractor') {
    const hasContract = await prisma.contract.findFirst({
      where: { projectId, contractorOrgId: userOrgId },
    });
    return !!hasContract;
  }

  return false;
}

/**
 * Check if user can access a contract
 */
export async function canAccessContract(
  userId: string,
  userOrgId: string,
  userRole: UserRole,
  contractId: string
): Promise<boolean> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      contractorOrgId: true,
      project: {
        select: {
          ownerOrgId: true,
          ownerOrg: { select: { users: { select: { role: true } } } },
        },
      },
    },
  });

  if (!contract) return false;

  // Owner org users always have access
  if (contract.project.ownerOrgId === userOrgId) return true;

  // Contractor can see own contracts
  if (userRole === 'contractor' && contract.contractorOrgId === userOrgId) return true;

  // Staff can access contracts in admin projects (owner org has tar_manager)
  const isStaff = ['tar_manager', 'contract_manager', 'pmo'].includes(userRole);
  const isAdminProject = contract.project.ownerOrg.users.some((u) => u.role === 'tar_manager');
  
  if (isStaff && isAdminProject) return true;

  return false;
}

/**
 * Check if user can access a milestone
 */
export async function canAccessMilestone(
  userId: string,
  userOrgId: string,
  userRole: UserRole,
  milestoneId: string
): Promise<boolean> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: {
      assignedToUserId: true,
      contract: {
        select: {
          contractorOrgId: true,
          project: {
            select: {
              ownerOrgId: true,
              ownerOrg: { select: { users: { select: { role: true } } } },
            },
          },
        },
      },
    },
  });

  if (!milestone) return false;

  // Owner org users can access
  if (milestone.contract.project.ownerOrgId === userOrgId) return true;

  // Assigned contractor can view (and update if has permission)
  if (
    userRole === 'contractor' &&
    milestone.assignedToUserId === userId &&
    milestone.contract.contractorOrgId === userOrgId
  ) {
    return true;
  }

  // Staff can access milestones in admin projects
  const isStaff = ['tar_manager', 'contract_manager', 'pmo'].includes(userRole);
  const isAdminProject = milestone.contract.project.ownerOrg.users.some((u) => u.role === 'tar_manager');
  
  if (isStaff && isAdminProject) return true;

  return false;
}

/**
 * Get all possible approvers in an organization
 * Returns {role, users} for approval chain resolution
 */
export async function getApproversInOrg(orgId: string) {
  const users = await prisma.user.findMany({
    where: { orgId },
    select: { id: true, role: true, name: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  const approverChain = {
    tar_manager: users.filter((u) => u.role === 'tar_manager'),
  };

  return approverChain;
}

/**
 * Resolve primary approver based on role priority
 * Priority: tar_manager only
 */
export async function resolvePrimaryApprover(ownerOrgId: string): Promise<string | null> {
  const approvers = await getApproversInOrg(ownerOrgId);

  // Return first tar_manager
  if (approvers.tar_manager.length > 0) {
    return approvers.tar_manager[0].id;
  }

  return null;
}

/**
 * Resolve next escalation target
 * All roles escalate to tar_manager
 */
export async function resolveEscalationTarget(
  currentApproverId: string,
  ownerOrgId: string
): Promise<string | null> {
  const currentApprover = await prisma.user.findUnique({
    where: { id: currentApproverId },
    select: { role: true, orgId: true },
  });

  if (!currentApprover || currentApprover.orgId !== ownerOrgId) return null;

  const role = currentApprover.role as UserRole;
  const escalationChain: Record<UserRole, UserRole[]> = {
    tar_manager: [],
    procurement: ['tar_manager'],
    contractor: ['tar_manager'],
    contract_manager: ['tar_manager'],
    pmo: ['tar_manager'],
  };

  const nextRoles = escalationChain[role] ?? ['tar_manager'];

  for (const nextRole of nextRoles) {
    const target = await prisma.user.findFirst({
      where: {
        orgId: ownerOrgId,
        role: nextRole,
        id: { not: currentApproverId },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (target) return target.id;
  }

  return null;
}

/**
 * Validate that a user can approve a milestone
 */
export async function canApproveMilestone(
  userId: string,
  userRole: UserRole,
  milestoneId: string
): Promise<boolean> {
  if (!hasPermission(userRole, 'approve_milestone')) {
    return false;
  }

  // User must be assigned as the approver for this milestone
  const approval = await prisma.approvalRequest.findFirst({
    where: {
      milestoneId,
      approverUserId: userId,
      status: 'pending',
    },
  });

  return !!approval;
}

/**
 * Check if user is assigned to a milestone
 */
export async function isAssignedToMilestone(
  userId: string,
  milestoneId: string
): Promise<boolean> {
  const assignment = await prisma.milestone.findFirst({
    where: { id: milestoneId, assignedToUserId: userId },
  });
  return !!assignment;
}
