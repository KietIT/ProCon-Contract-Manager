// ─── Enums ─────────────────────────────────────────────

export type OrgType = 'owner' | 'epc_contractor' | 'pmc';

export type ProjectStatus = 'planning' | 'active' | 'close_out' | 'complete';

export type ContractType = 'once_off' | 'frame';

export type SpendingType = 'opex' | 'capex';

export type Department = 'rotating' | 'instrument' | 'static_dept' | 'electrical' | 'process_control_automation';

export type ContractStatus = 'draft' | 'active' | 'at_risk' | 'complete' | 'disputed';

export type RagStatus = 'green' | 'amber' | 'red';

export type AiExtractionStatus = 'pending' | 'processing' | 'review' | 'confirmed' | 'failed';

export type CostCategory = 'labour' | 'materials' | 'equipment' | 'subcontract' | 'other';

// ─── DTOs ──────────────────────────────────────────────

export interface OrganisationDto {
  id: string;
  name: string;
  type: OrgType;
  slug: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  ownerOrgId: string;
  tarStartDate: string;
  tarEndDate: string;
  totalBudget: string;
  status: ProjectStatus;
  createdAt: string;
}

export interface ContractDto {
  id: string;
  projectId: string;
  contractorOrgId: string;
  contractNumber: string;
  type: ContractType;
  contractValue: string;
  approvedValue: string | null;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  ragStatus: RagStatus;
  aiExtractionStatus: AiExtractionStatus;
  currentVersion: number;
  createdAt: string;
}

export interface ContractVersionDto {
  id: string;
  contractId: string;
  versionNumber: number;
  fileKey: string;
  fileMimeType: string;
  changeNote: string | null;
  uploadedBy: { id: string; name: string; email: string };
  aiExtractionStatus: AiExtractionStatus;
  createdAt: string;
}

export interface CostEntryDto {
  id: string;
  contractId: string;
  entryDate: string;
  amount: string;
  category: CostCategory;
  approved: boolean;
}

// ─── Diff Types ───────────────────────────────────────────

export type DiffSegmentType = 'added' | 'deleted' | 'modified';

export interface DiffSegment {
  id: string;
  type: DiffSegmentType;
  oldText?: string;
  newText?: string;
  oldPage?: number;
  newPage?: number;
  oldOffset?: number;
  newOffset?: number;
  oldLength?: number;
  newLength?: number;
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  modifications: number;
}

export interface DiffResponse {
  segments: DiffSegment[];
  summary: DiffSummary;
  fileUrlA: string;
  fileUrlB: string;
  versionA: number;
  versionB: number;
}
