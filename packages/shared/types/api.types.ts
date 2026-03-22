// ─── API Response Wrappers ─────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ─── Dashboard KPIs ────────────────────────────────────

export interface DashboardKpis {
  totalContracts: number;
  activeContracts: number;
  overdueMilestones: number;
  completionRate: number;
  totalBudget: string;
  totalSpent: string;
  burnRate: number;
  ragSummary: {
    green: number;
    amber: number;
    red: number;
  };
}

// ─── Request Payloads ──────────────────────────────────

export interface CreateProjectPayload {
  name: string;
  tarStartDate: string;
  tarEndDate: string;
  totalBudget: string;
  currency?: 'USD' | 'VND';
}

export interface CreateContractPayload {
  contractorOrgId: string;
  contractNumber: string;
  type: string;
  contractValue: string;
  startDate: string;
  endDate: string;
}

export interface CreateMilestonePayload {
  title: string;
  description: string;
  type: string;
  dueDate: string;
  assignedToUserId?: string;
  requiresApproval?: boolean;
}

export interface UpdateMilestonePayload {
  status?: string;
  dueDate?: string;
  assignedToUserId?: string;
}

export interface ApprovalDecisionPayload {
  decision: 'approved' | 'rejected';
  comments?: string;
}

export interface CreateCostEntryPayload {
  entryDate: string;
  amount: string;
  category: string;
}

// ─── Job Status ────────────────────────────────────────

export interface ParseJobStatus {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
}
