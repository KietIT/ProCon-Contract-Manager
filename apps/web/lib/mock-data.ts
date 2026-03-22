'use client';

import { useState } from 'react';

// ─── IDs ─────────────────────────────────────────────────────
export const PROJ_1 = 'proj-north-2026';
export const PROJ_2 = 'proj-beta-2025';

// ─── Mock Users per role (for role switcher) ─────────────────
export const MOCK_USERS_BY_ROLE = {
  tar_manager: {
    id: 'user-1',
    name: 'Tar Manager',
    email: 'tar.manager@aramco-tar.com',
    role: 'tar_manager' as const,
    orgId: 'org-aramco',
    orgName: 'Aramco TAR Division',
    clerkId: 'mock-clerk-id',
  },
  procurement: {
    id: 'user-4',
    name: 'Procurement',
    email: 'procurement@aramco-tar.com',
    role: 'procurement' as const,
    orgId: 'org-aramco',
    orgName: 'Aramco TAR Division',
    clerkId: 'mock-clerk-id-2',
  },
  contractor: {
    id: 'user-5',
    name: 'Contractor',
    email: 'contractor@gulf-eng.com',
    role: 'contractor' as const,
    orgId: 'org-1',
    orgName: 'Gulf Engineering Group',
    clerkId: 'mock-clerk-id-3',
  },
};

// Default mock user — starts as TAR Manager
export const MOCK_USER = MOCK_USERS_BY_ROLE.tar_manager;

// ─── Organisations ────────────────────────────────────────────
export const MOCK_ORGANISATIONS = [
  { id: 'org-1', name: 'Gulf Engineering Group', type: 'contractor' },
  { id: 'org-2', name: 'Petrochem Saudi Co.', type: 'contractor' },
  { id: 'org-3', name: 'Arabian MEP Services', type: 'contractor' },
  { id: 'org-4', name: 'Al-Majd Inspection LLC', type: 'contractor' },
  { id: 'org-5', name: 'Desert Supply Chain', type: 'supply_chain' },
];

// ─── Milestones per contract ──────────────────────────────────
const MILESTONES: Record<string, any[]> = {
  'con-001': [
    { id: 'ms-001-1', contractId: 'con-001', title: 'Site Mobilisation', description: 'Full contractor mobilisation and site setup complete.', type: 'completion', status: 'complete', dueDate: '2026-02-10', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.95, requiresApproval: false, assignedTo: { name: 'Khalid Hassan' } },
    { id: 'ms-001-2', contractId: 'con-001', title: 'Scaffolding Installation Phase 1', description: 'Erection of all scaffolding for vessel access areas.', type: 'completion', status: 'in_progress', dueDate: '2026-03-15', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.91, requiresApproval: false, assignedTo: { name: 'Khalid Hassan' } },
    { id: 'ms-001-3', contractId: 'con-001', title: 'Vessel Inspection Phase 1', description: 'Third-party inspection of all pressure vessels in zone A.', type: 'inspection', status: 'in_progress', dueDate: '2026-03-01', isOverdue: true, delayDays: 17, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.88, requiresApproval: true, assignedTo: null },
    { id: 'ms-001-4', contractId: 'con-001', title: 'First Payment Milestone', description: 'Payment released upon 40% physical completion verification.', type: 'payment_trigger', status: 'not_started', dueDate: '2026-04-01', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.97, requiresApproval: true, assignedTo: null },
    { id: 'ms-001-5', contractId: 'con-001', title: 'Final Handover & Commissioning', description: 'All systems commissioned and documentation submitted.', type: 'handover', status: 'not_started', dueDate: '2026-06-15', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: true, assignedTo: null },
  ],
  'con-002': [
    { id: 'ms-002-1', contractId: 'con-002', title: 'Project Kickoff Workshop', description: 'Kickoff meeting and alignment of project deliverables with client.', type: 'completion', status: 'complete', dueDate: '2026-02-20', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.90, requiresApproval: false, assignedTo: { name: 'Sara Malik' } },
    { id: 'ms-002-2', contractId: 'con-002', title: 'Process Engineering Review', description: 'Detailed process engineering review and HAZOP signoff.', type: 'inspection', status: 'in_progress', dueDate: '2026-03-10', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.85, requiresApproval: true, assignedTo: { name: 'Omar Farouq' } },
    { id: 'ms-002-3', contractId: 'con-002', title: 'Vendor Evaluation Complete', description: 'Short-listing of all critical vendors with technical scorecard.', type: 'completion', status: 'not_started', dueDate: '2026-03-25', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: false, assignedTo: null },
  ],
  'con-003': [
    { id: 'ms-003-1', contractId: 'con-003', title: 'Electrical Installation Zone A', description: 'Complete all HV/LV installation in process area zone A.', type: 'completion', status: 'not_started', dueDate: '2026-04-20', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: false, assignedTo: null },
    { id: 'ms-003-2', contractId: 'con-003', title: 'HVAC System Commissioning', description: 'Functional testing of all HVAC systems in control building.', type: 'inspection', status: 'not_started', dueDate: '2026-06-01', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: true, assignedTo: null },
  ],
  'con-004': [
    { id: 'ms-004-1', contractId: 'con-004', title: 'Equipment NDT Inspection Round 1', description: 'Non-destructive testing of all pressure-bearing equipment.', type: 'inspection', status: 'complete', dueDate: '2026-02-20', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.96, requiresApproval: false, assignedTo: { name: 'Faisal Qureshi' } },
    { id: 'ms-004-2', contractId: 'con-004', title: 'Structural Integrity Report', description: 'Full structural integrity assessment for aged units.', type: 'completion', status: 'in_progress', dueDate: '2026-02-28', isOverdue: true, delayDays: 18, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.89, requiresApproval: true, assignedTo: null },
    { id: 'ms-004-3', contractId: 'con-004', title: 'Safety Clearance Certificate', description: 'Authority having jurisdiction issues safety clearance.', type: 'completion', status: 'not_started', dueDate: '2026-03-10', isOverdue: true, delayDays: 8, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.82, requiresApproval: true, assignedTo: null },
    { id: 'ms-004-4', contractId: 'con-004', title: 'Final Inspection Sign-off', description: 'Client PMO and third-party sign all inspection closure docs.', type: 'handover', status: 'not_started', dueDate: '2026-05-15', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: true, assignedTo: null },
  ],
  'con-005': [
    { id: 'ms-005-1', contractId: 'con-005', title: 'Purchase Order Issuance', description: 'All bulk material POs raised and confirmed.', type: 'completion', status: 'complete', dueDate: '2026-03-20', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: false, assignedTo: { name: 'Nadia Al-Fahad' } },
    { id: 'ms-005-2', contractId: 'con-005', title: 'First Bulk Material Delivery', description: 'Delivery of piping, valves and fittings to laydown area.', type: 'completion', status: 'not_started', dueDate: '2026-04-30', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: false, assignedTo: null },
  ],
  'con-006': [
    { id: 'ms-006-1', contractId: 'con-006', title: 'Demolition Phase Complete', description: 'All agreed structures safely demolished and debris cleared.', type: 'completion', status: 'complete', dueDate: '2026-02-25', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.93, requiresApproval: false, assignedTo: { name: 'Tariq Basha' } },
    { id: 'ms-006-2', contractId: 'con-006', title: 'Civil Works Phase 1', description: 'Foundation and civil works for new equipment pads.', type: 'completion', status: 'complete', dueDate: '2026-03-20', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.90, requiresApproval: false, assignedTo: { name: 'Tariq Basha' } },
    { id: 'ms-006-3', contractId: 'con-006', title: 'Final Structural Sign-off', description: 'Structural engineer certifies all new steel and concrete.', type: 'inspection', status: 'in_progress', dueDate: '2026-04-15', isOverdue: false, delayDays: 0, pendingApproval: true, source: 'ai_extracted', aiConfidence: 0.87, requiresApproval: true, assignedTo: null },
  ],
  'con-007': [
    { id: 'ms-007-1', contractId: 'con-007', title: 'Scope of Work Completion', description: 'All contracted scope items verified by client.', type: 'completion', status: 'complete', dueDate: '2025-11-30', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.97, requiresApproval: false, assignedTo: { name: 'Hamad Al-Otaibi' } },
    { id: 'ms-007-2', contractId: 'con-007', title: 'Defects Liability Period Start', description: 'DLP commences upon practical completion acceptance.', type: 'handover', status: 'complete', dueDate: '2025-12-15', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.92, requiresApproval: true, assignedTo: { name: 'Hamad Al-Otaibi' } },
  ],
  'con-008': [
    { id: 'ms-008-1', contractId: 'con-008', title: 'Feasibility Study Submission', description: 'Technical feasibility study submitted for client review.', type: 'completion', status: 'complete', dueDate: '2025-09-01', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: false, assignedTo: null },
    { id: 'ms-008-2', contractId: 'con-008', title: 'FEED Package Delivery', description: 'Front-end engineering design package delivered to client.', type: 'completion', status: 'in_progress', dueDate: '2026-01-15', isOverdue: true, delayDays: 62, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: true, assignedTo: null },
  ],
  'con-009': [
    { id: 'ms-009-1', contractId: 'con-009', title: 'Pre-Shutdown Inspection', description: 'All inspection activities completed before plant shutdown.', type: 'inspection', status: 'complete', dueDate: '2025-09-30', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.98, requiresApproval: false, assignedTo: { name: 'Yousef Mansouri' } },
    { id: 'ms-009-2', contractId: 'con-009', title: 'Final Inspection Report', description: 'Comprehensive inspection closure report issued.', type: 'completion', status: 'complete', dueDate: '2025-10-31', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.96, requiresApproval: true, assignedTo: { name: 'Yousef Mansouri' } },
  ],
  'con-010': [
    { id: 'ms-010-1', contractId: 'con-010', title: 'Instrumentation Loop Check', description: 'All 450 instrument loops verified and signed off.', type: 'inspection', status: 'in_progress', dueDate: '2025-12-01', isOverdue: true, delayDays: 107, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.91, requiresApproval: true, assignedTo: null },
    { id: 'ms-010-2', contractId: 'con-010', title: 'DCS Configuration Complete', description: 'Distributed control system fully configured and tested.', type: 'completion', status: 'in_progress', dueDate: '2026-01-31', isOverdue: true, delayDays: 46, pendingApproval: false, source: 'ai_extracted', aiConfidence: 0.88, requiresApproval: false, assignedTo: null },
    { id: 'ms-010-3', contractId: 'con-010', title: 'Electrical Completion Certificate', description: 'Certified electrical completion by competent authority.', type: 'completion', status: 'not_started', dueDate: '2026-02-28', isOverdue: false, delayDays: 0, pendingApproval: false, source: 'manual', aiConfidence: null, requiresApproval: true, assignedTo: null },
  ],
};

// ─── AI Extraction data ────────────────────────────────────────
const AI_EXTRACTION: Record<string, any> = {
  'con-002': {
    aiExtractionStatus: 'review',
    aiExtractionData: {
      milestones: [
        { type: 'completion', title: 'Process Engineering Design Approval', description: 'Approval of all process engineering documents by client PMO per project specifications.', confidence: 0.92, due_date: '2026-03-30', source_clause: 'Clause 4.2 — Deliverable Schedule: "All process engineering documents shall be approved by Client within 14 days of submission."' },
        { type: 'payment_trigger', title: 'First Interim Payment Release', description: 'Payment released upon certification of 30% physical progress by Client Representative.', confidence: 0.88, due_date: '2026-04-15', source_clause: 'Clause 7.1 — Payment Terms: "First interim payment of 30% contract value released upon…"' },
        { type: 'inspection', title: 'Third Party Inspection Gate 1', description: 'Independent quality inspector to certify Phase 1 deliverables meet all specified standards.', confidence: 0.79, due_date: '2026-04-30', source_clause: 'Clause 5.3 — Quality Assurance Requirements' },
        { type: 'handover', title: 'Documentation Handover Package', description: 'All as-built drawings, O&M manuals, material certifications, and test certificates submitted to client.', confidence: 0.95, due_date: '2026-07-01', source_clause: 'Clause 8.1 — Handover Requirements: "Contractor shall submit complete documentation package not later than..."' },
        { type: 'penalty_threshold', title: 'Liquidated Damages Threshold Date', description: 'If final completion extends beyond this date, LD at the rate of USD 5,000 per calendar day applies.', confidence: 0.71, due_date: '2026-07-15', source_clause: 'Clause 9.4 — Delay Penalties and Liquidated Damages' },
      ],
    },
  },
};

// ─── Contract details ─────────────────────────────────────────
const CONTRACTS_DETAIL: Record<string, any> = {
  'con-001': { id: 'con-001', projectId: PROJ_1, contractNumber: 'TAR-2026-001', type: 'subcontract', contractValue: 8500000, status: 'active', ragStatus: 'red', burnRate: 0.94, startDate: '2026-02-01', endDate: '2026-06-30', contractorOrg: { id: 'org-1', name: 'Gulf Engineering Group' }, fileKey: 'contracts/tar-2026-001.pdf', fileMimeType: 'application/pdf', aiExtractionStatus: 'confirmed', costEntries: [{ id: 'ce-1', category: 'labour', amount: 3200000 }, { id: 'ce-2', category: 'materials', amount: 2100000 }, { id: 'ce-3', category: 'equipment', amount: 1800000 }] },
  'con-002': { id: 'con-002', projectId: PROJ_1, contractNumber: 'TAR-2026-002', type: 'service', contractValue: 3200000, status: 'active', ragStatus: 'amber', burnRate: 0.82, startDate: '2026-02-15', endDate: '2026-07-15', contractorOrg: { id: 'org-2', name: 'Petrochem Saudi Co.' }, fileKey: 'contracts/tar-2026-002.pdf', fileMimeType: 'application/pdf', aiExtractionStatus: 'review', costEntries: [{ id: 'ce-4', category: 'labour', amount: 1800000 }, { id: 'ce-5', category: 'overheads', amount: 820000 }] },
  'con-003': { id: 'con-003', projectId: PROJ_1, contractNumber: 'TAR-2026-003', type: 'mep', contractValue: 5750000, status: 'active', ragStatus: 'green', burnRate: 0.55, startDate: '2026-03-01', endDate: '2026-08-31', contractorOrg: { id: 'org-3', name: 'Arabian MEP Services' }, fileKey: null, fileMimeType: null, aiExtractionStatus: 'pending', costEntries: [] },
  'con-004': { id: 'con-004', projectId: PROJ_1, contractNumber: 'TAR-2026-004', type: 'inspection', contractValue: 1200000, status: 'active', ragStatus: 'red', burnRate: 1.02, startDate: '2026-02-01', endDate: '2026-05-31', contractorOrg: { id: 'org-4', name: 'Al-Majd Inspection LLC' }, fileKey: 'contracts/tar-2026-004.pdf', fileMimeType: 'application/pdf', aiExtractionStatus: 'confirmed', costEntries: [{ id: 'ce-6', category: 'inspection_fees', amount: 980000 }, { id: 'ce-7', category: 'overheads', amount: 242000 }] },
  'con-005': { id: 'con-005', projectId: PROJ_1, contractNumber: 'TAR-2026-005', type: 'supply', contractValue: 4100000, status: 'active', ragStatus: 'green', burnRate: 0.42, startDate: '2026-03-15', endDate: '2026-09-15', contractorOrg: { id: 'org-5', name: 'Desert Supply Chain' }, fileKey: null, fileMimeType: null, aiExtractionStatus: 'pending', costEntries: [] },
  'con-006': { id: 'con-006', projectId: PROJ_1, contractNumber: 'TAR-2026-006', type: 'subcontract', contractValue: 6800000, status: 'close_out', ragStatus: 'amber', burnRate: 0.88, startDate: '2026-01-15', endDate: '2026-05-15', contractorOrg: { id: 'org-1', name: 'Gulf Engineering Group' }, fileKey: 'contracts/tar-2026-006.pdf', fileMimeType: 'application/pdf', aiExtractionStatus: 'confirmed', costEntries: [{ id: 'ce-8', category: 'labour', amount: 3900000 }, { id: 'ce-9', category: 'materials', amount: 2100000 }] },
  'con-007': { id: 'con-007', projectId: PROJ_2, contractNumber: 'BETA-2025-001', type: 'subcontract', contractValue: 12000000, status: 'close_out', ragStatus: 'green', burnRate: 0.97, startDate: '2025-06-01', endDate: '2025-12-31', contractorOrg: { id: 'org-1', name: 'Gulf Engineering Group' }, fileKey: 'contracts/beta-2025-001.pdf', fileMimeType: 'application/pdf', aiExtractionStatus: 'confirmed', costEntries: [{ id: 'ce-10', category: 'labour', amount: 7200000 }, { id: 'ce-11', category: 'materials', amount: 4400000 }] },
  'con-008': { id: 'con-008', projectId: PROJ_2, contractNumber: 'BETA-2025-002', type: 'service', contractValue: 3500000, status: 'active', ragStatus: 'amber', burnRate: 0.79, startDate: '2025-07-01', endDate: '2026-01-31', contractorOrg: { id: 'org-2', name: 'Petrochem Saudi Co.' }, fileKey: null, fileMimeType: null, aiExtractionStatus: 'pending', costEntries: [] },
  'con-009': { id: 'con-009', projectId: PROJ_2, contractNumber: 'BETA-2025-003', type: 'inspection', contractValue: 850000, status: 'complete', ragStatus: 'green', burnRate: 1.0, startDate: '2025-06-15', endDate: '2025-10-31', contractorOrg: { id: 'org-4', name: 'Al-Majd Inspection LLC' }, fileKey: 'contracts/beta-2025-003.pdf', fileMimeType: 'application/pdf', aiExtractionStatus: 'confirmed', costEntries: [{ id: 'ce-12', category: 'inspection_fees', amount: 850000 }] },
  'con-010': { id: 'con-010', projectId: PROJ_2, contractNumber: 'BETA-2025-004', type: 'mep', contractValue: 5200000, status: 'active', ragStatus: 'red', burnRate: 0.91, startDate: '2025-08-01', endDate: '2026-02-28', contractorOrg: { id: 'org-3', name: 'Arabian MEP Services' }, fileKey: 'contracts/beta-2025-004.pdf', fileMimeType: 'application/pdf', aiExtractionStatus: 'confirmed', costEntries: [{ id: 'ce-13', category: 'labour', amount: 3100000 }, { id: 'ce-14', category: 'equipment', amount: 1600000 }] },
};

// ─── Contracts lists per project ──────────────────────────────
const CONTRACT_IDS_BY_PROJECT: Record<string, string[]> = {
  [PROJ_1]: ['con-001', 'con-002', 'con-003', 'con-004', 'con-005', 'con-006'],
  [PROJ_2]: ['con-007', 'con-008', 'con-009', 'con-010'],
};

// ─── Public API ───────────────────────────────────────────────
export function getMockContractsByProject(projectId: string): any[] {
  const ids = CONTRACT_IDS_BY_PROJECT[projectId] ?? [];
  return ids.map(id => ({
    ...CONTRACTS_DETAIL[id],
    milestones: MILESTONES[id] ?? [],
  }));
}

export function getMockContractDetail(contractId: string): any {
  const c = CONTRACTS_DETAIL[contractId];
  if (!c) return null;
  // Merge AI extraction data if available
  const aiMeta = AI_EXTRACTION[contractId] ?? {};
  return { ...c, ...aiMeta };
}

export function getMockMilestones(contractId: string): any[] {
  return MILESTONES[contractId] ?? [];
}

export function getMockAiExtraction(contractId: string): any {
  const c = CONTRACTS_DETAIL[contractId];
  const aiMeta = AI_EXTRACTION[contractId] ?? {};
  return { ...(c ?? {}), ...aiMeta };
}

// ─── Daily burn data helper ───────────────────────────────────
function generateBurnData(totalBudget: number, burnRate: number, days = 30) {
  const totalSpent = totalBudget * burnRate;
  return Array.from({ length: days }, (_, i) => {
    const pct = (i + 1) / days;
    const planned = totalBudget * pct * 0.95;
    const noise = (Math.sin(i * 1.3) * 0.04 + 1);
    const actual = Math.min(totalSpent * pct * noise, totalSpent);
    return { day: i + 1, actualSpend: Math.round(actual), plannedBudget: Math.round(planned) };
  });
}

// ─── Dashboard data ───────────────────────────────────────────
export function getMockDashboard(projectId: string): any {
  const contracts = getMockContractsByProject(projectId);
  const totalBudget = contracts.reduce((s, c) => s + c.contractValue, 0);
  const totalSpent = contracts.reduce((s, c) => s + c.contractValue * c.burnRate, 0);
  const ragSummary = contracts.reduce((acc, c) => { acc[c.ragStatus] = (acc[c.ragStatus] || 0) + 1; return acc; }, { green: 0, amber: 0, red: 0 } as Record<string, number>);
  const allMilestones = contracts.flatMap(c => getMockMilestones(c.id));
  const overdueMilestones = allMilestones.filter(m => m.isOverdue).length;
  const completedMilestones = allMilestones.filter(m => m.status === 'complete').length;
  const completionRate = allMilestones.length > 0 ? completedMilestones / allMilestones.length : 0;

  const contractsAtRisk = contracts
    .filter(c => c.ragStatus === 'red' || c.ragStatus === 'amber')
    .map(c => ({
      id: c.id,
      contractNumber: c.contractNumber,
      contractorName: c.contractorOrg?.name,
      overdueCount: getMockMilestones(c.id).filter((m: any) => m.isOverdue).length,
      burnRate: c.burnRate,
      daysRemaining: Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      ragStatus: c.ragStatus,
    }));

  const overdueMilestoneDetails = allMilestones
    .filter(m => m.isOverdue)
    .map(m => ({
      id: m.id,
      title: m.title,
      contractId: m.contractId,
      contractNumber: CONTRACTS_DETAIL[m.contractId]?.contractNumber,
      delayDays: m.delayDays,
    }));

  return {
    totalContracts: contracts.length,
    activeContracts: contracts.filter(c => c.status === 'active').length,
    overdueMilestones,
    completionRate,
    burnRate: totalBudget > 0 ? totalSpent / totalBudget : 0,
    totalSpent,
    totalBudget,
    ragSummary,
    contractsAtRisk,
    overdueMilestoneDetails,
    dailyBurnData: generateBurnData(totalBudget, totalBudget > 0 ? totalSpent / totalBudget : 0.6),
  };
}

// ─── Projects ─────────────────────────────────────────────────
export const MOCK_PROJECTS: any[] = [
  {
    id: PROJ_1,
    name: 'North Refinery TAR 2026',
    status: 'active',
    tarStartDate: '2026-02-01',
    tarEndDate: '2026-07-31',
    totalBudget: 45000000,
    contracts: getMockContractsByProject(PROJ_1),
  },
  {
    id: PROJ_2,
    name: 'Beta Facility Overhaul 2025',
    status: 'close_out',
    tarStartDate: '2025-06-01',
    tarEndDate: '2026-02-28',
    totalBudget: 28000000,
    contracts: getMockContractsByProject(PROJ_2),
  },
];

export function getMockProject(projectId: string): any {
  return MOCK_PROJECTS.find(p => p.id === projectId) ?? null;
}

// ─── Approvals ────────────────────────────────────────────────
export const MOCK_APPROVALS_PENDING: any[] = [
  {
    id: 'appr-1',
    milestoneId: 'ms-001-3',
    status: 'pending',
    milestone: { title: 'Vessel Inspection Phase 1', contract: { contractNumber: 'TAR-2026-001', project: { name: 'North Refinery TAR 2026' } } },
    requestedBy: { name: 'Khalid Hassan' },
    slaDeadline: new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    comments: null,
  },
  {
    id: 'appr-2',
    milestoneId: 'ms-004-2',
    status: 'pending',
    milestone: { title: 'Structural Integrity Report', contract: { contractNumber: 'TAR-2026-004', project: { name: 'North Refinery TAR 2026' } } },
    requestedBy: { name: 'Faisal Qureshi' },
    slaDeadline: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isOverdue: true,
    comments: null,
  },
  {
    id: 'appr-3',
    milestoneId: 'ms-006-3',
    status: 'pending',
    milestone: { title: 'Final Structural Sign-off', contract: { contractNumber: 'TAR-2026-006', project: { name: 'North Refinery TAR 2026' } } },
    requestedBy: { name: 'Tariq Basha' },
    slaDeadline: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    comments: null,
  },
];

export const MOCK_APPROVALS_HISTORY: any[] = [
  {
    id: 'appr-h1',
    milestoneId: 'ms-001-1',
    status: 'approved',
    milestone: { title: 'Site Mobilisation', contract: { contractNumber: 'TAR-2026-001', project: { name: 'North Refinery TAR 2026' } } },
    requestedBy: { name: 'Khalid Hassan' },
    slaDeadline: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    comments: 'All mobilisation checkpoints verified and signed off by HSE team.',
  },
  {
    id: 'appr-h2',
    milestoneId: 'ms-007-2',
    status: 'approved',
    milestone: { title: 'Defects Liability Period Start', contract: { contractNumber: 'BETA-2025-001', project: { name: 'Beta Facility Overhaul 2025' } } },
    requestedBy: { name: 'Hamad Al-Otaibi' },
    slaDeadline: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    comments: 'DLP commencement confirmed.',
  },
  {
    id: 'appr-h3',
    milestoneId: 'ms-002-2',
    status: 'rejected',
    milestone: { title: 'Process Engineering Review', contract: { contractNumber: 'TAR-2026-002', project: { name: 'North Refinery TAR 2026' } } },
    requestedBy: { name: 'Omar Farouq' },
    slaDeadline: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    comments: 'HAZOP documentation incomplete. Missing P&ID revision 3 sign-off. Resubmit after corrections.',
  },
];

// ─── Users for admin (only 3 roles) ──────────────────────────
export const MOCK_USERS: any[] = [
  { id: 'user-1', name: 'Tar Manager', email: 'tar.manager@aramco-tar.com', role: 'tar_manager', org: { name: 'Aramco TAR Division', type: 'owner' } },
  { id: 'user-4', name: 'Procurement', email: 'procurement@aramco-tar.com', role: 'procurement', org: { name: 'Aramco TAR Division', type: 'owner' } },
  { id: 'user-5', name: 'Contractor', email: 'contractor@gulf-eng.com', role: 'contractor', org: { name: 'Gulf Engineering Group', type: 'contractor' } },
  { id: 'user-6', name: 'Faisal Qureshi', email: 'faisal@almajd.com', role: 'contractor', org: { name: 'Al-Majd Inspection LLC', type: 'contractor' } },
  { id: 'user-7', name: 'Tariq Basha', email: 'tariq@gulf-eng.com', role: 'contractor', org: { name: 'Gulf Engineering Group', type: 'contractor' } },
  { id: 'user-8', name: 'Yousef Mansouri', email: 'yousef@almajd.com', role: 'contractor', org: { name: 'Al-Majd Inspection LLC', type: 'contractor' } },
];

// ─── useMockMutation ──────────────────────────────────────────
// Drop-in replacement for TanStack useMutation — simulates 700ms network latency
export function useMockMutation<TArg = void>(onSuccess?: (arg?: TArg) => void) {
  const [isPending, setIsPending] = useState(false);
  const [isError] = useState(false);
  return {
    mutate: (arg?: TArg) => {
      setIsPending(true);
      setTimeout(() => {
        setIsPending(false);
        onSuccess?.(arg);
      }, 700);
    },
    isPending,
    isError,
    reset: () => setIsPending(false),
  };
}
