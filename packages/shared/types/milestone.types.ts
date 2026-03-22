export type MilestoneType = 'completion' | 'payment_trigger' | 'inspection' | 'handover' | 'penalty_threshold';

export type MilestoneStatus = 'not_started' | 'in_progress' | 'complete' | 'overdue' | 'waived';

export type MilestoneSource = 'ai_extracted' | 'manual';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';

export interface MilestoneDto {
  id: string;
  contractId: string;
  title: string;
  description: string;
  type: MilestoneType;
  dueDate: string;
  status: MilestoneStatus;
  source: MilestoneSource;
  aiConfidence: number | null;
  requiresApproval: boolean;
  completedAt: string | null;
  assignedToUserId: string | null;
}

export interface ApprovalRequestDto {
  id: string;
  milestoneId: string;
  requestedByUserId: string;
  approverUserId: string;
  status: ApprovalStatus;
  slaDeadline: string;
  decidedAt: string | null;
  comments: string | null;
}

// ─── AI Extraction Types ───────────────────────────────

export interface ExtractedMilestone {
  title: string;
  description: string;
  type: string;
  due_date: string | null;
  relative_date_expression: string | null;
  confidence: number;
  source_clause: string;
}

export interface ExtractedObligation {
  party: string;
  description: string;
  deadline: string | null;
  confidence: number;
}

export interface ExtractedPenalty {
  trigger: string;
  amount_or_rate: string;
  cap: string | null;
  confidence: number;
}

export interface ExtractedPaymentTrigger {
  description: string;
  amount_or_percentage: string;
  confidence: number;
}

export interface ExtractedKeyDate {
  label: string;
  date: string | null;
  relative_expression: string | null;
  confidence: number;
}

export interface ExtractedEquipmentItem {
  item_no: string;
  equipment_tag_no: string;
  equipment_description: string;
  manufacturer: string | null;
  model_no: string | null;
  serial_no: string | null;
  quantity: string;
  unit: string;
  location: string | null;
  remarks: string | null;
  confidence: number;
  source_clause: string;
}

export interface ExtractionResult {
  milestones: ExtractedMilestone[];
  obligations: ExtractedObligation[];
  penalty_clauses: ExtractedPenalty[];
  payment_triggers: ExtractedPaymentTrigger[];
  key_dates: ExtractedKeyDate[];
  equipment_list: ExtractedEquipmentItem[];
  chunks_processed: number;
  low_confidence_count: number;
}
