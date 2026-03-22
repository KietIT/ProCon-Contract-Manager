const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let tokenGetter: (() => Promise<string | null>) | null = null;
let devUserEmail: string | null = null;

export function setTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

export function setDevUserEmail(email: string | null) {
  devUserEmail = email;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};

  // Only set Content-Type: application/json when there is a body.
  // Fastify 5 rejects empty bodies with this header (FST_ERR_CTP_EMPTY_JSON_BODY).
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  if (devUserEmail) {
    headers['x-dev-user-email'] = devUserEmail;
  }

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message ?? error.error ?? `API error: ${res.status}`);
  }

  return res.json();
}

// Multipart request — does NOT set Content-Type so the browser auto-sets the boundary
async function multipartRequest<T>(path: string, body: FormData): Promise<T> {
  const headers: Record<string, string> = {};

  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  if (devUserEmail) {
    headers['x-dev-user-email'] = devUserEmail;
  }

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message ?? error.error ?? `API error: ${res.status}`);
  }

  return res.json();
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  interceptors: { request: { use: () => 0, eject: () => {} } },
} as Record<string, unknown>;

export const projectsApi = {
  list: () => request<{ data: unknown[] }>('/projects'),
  get: (id: string) => request<{ data: unknown }>(`/projects/${id}`),
  getDashboard: (id: string) =>
    request<{ data: unknown }>(`/projects/${id}/dashboard`),
  getGantt: (id: string) =>
    request<{ data: GanttData }>(`/projects/${id}/gantt`),
  create: (data: unknown) =>
    request<{ data: unknown }>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: unknown) =>
    request<{ data: unknown }>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ data: unknown }>(`/projects/${id}`, { method: 'DELETE' }),
};

export const contractsApi = {
  list: (projectId: string) =>
    request<{ data: unknown[] }>(`/projects/${projectId}/contracts`),
  listAll: () => request<{ data: unknown[] }>('/contracts'),
  get: (id: string) => request<{ data: unknown }>(`/contracts/${id}`),
  create: (projectId: string, data: unknown) =>
    request<{ data: unknown }>(`/projects/${projectId}/contracts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  upload: (projectId: string, formData: FormData) =>
    multipartRequest<{ data: unknown }>(`/projects/${projectId}/contracts`, formData),
  parse: (id: string) =>
    request<{ data: unknown }>(`/contracts/${id}/parse`, { method: 'POST', body: JSON.stringify({}) }),
  getParsJobStatus: (id: string, jobId: string) =>
    request<{ data: unknown }>(`/contracts/${id}/parse/${jobId}`),
  getExtraction: (id: string) =>
    request<{ data: unknown }>(`/contracts/${id}/extraction`),
  confirmExtraction: (id: string, milestones: unknown[]) =>
    request<{ data: unknown }>(`/contracts/${id}/extraction/confirm`, {
      method: 'POST',
      body: JSON.stringify({ milestones }),
    }),
  update: (id: string, data: unknown) =>
    request<{ data: unknown }>(`/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ data: unknown }>(`/contracts/${id}`, { method: 'DELETE' }),
  getFileUrl: (id: string, version?: number) =>
    `${API_URL}/api/v1/contracts/${id}/file${version ? `?v=${version}` : `?t=${Date.now()}`}`,
  getSourceText: (id: string) =>
    request<{ data: { full_text: string; file_name: string; total_chars: number } }>(`/contracts/${id}/source-text`),
  locateClause: (id: string, sourceClause: string) =>
    request<{ data: LocateClauseResult }>(`/contracts/${id}/locate-clause`, {
      method: 'POST',
      body: JSON.stringify({ source_clause: sourceClause }),
    }),
  // Versioning
  uploadVersion: (id: string, formData: FormData) =>
    multipartRequest<{ data: unknown }>(`/contracts/${id}/versions`, formData),
  listVersions: (id: string) =>
    request<{ data: { currentVersion: number; versions: ContractVersionResponse[] } }>(`/contracts/${id}/versions`),
  getVersionFileUrl: (id: string, versionId: string) =>
    `${API_URL}/api/v1/contracts/${id}/versions/${versionId}/file`,
  revertCurrentVersion: (id: string) =>
    request<{ data: unknown }>(`/contracts/${id}/versions/revert`, { method: 'POST', body: JSON.stringify({}) }),
  getDiff: (id: string, versionA: number, versionB: number) =>
    request<{ data: DiffResponse }>(`/contracts/${id}/diff?versionA=${versionA}&versionB=${versionB}`),
};

export interface GanttPhase {
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
}

export interface GanttData {
  tarStartDate: string;
  tarEndDate: string;
  phases: GanttPhase[];
}

export interface ContractVersionResponse {
  id: string;
  contractId: string;
  versionNumber: number;
  fileKey: string;
  fileMimeType: string;
  changeNote: string | null;
  uploadedBy: { id: string; name: string; email: string };
  aiExtractionStatus: string;
  createdAt: string;
}

export interface LocateClauseResult {
  found: boolean;
  match_start: number;
  match_end: number;
  context_start: number;
  context_end: number;
  context_text: string;
  matched_text: string;
  page_numbers: number[];
  highlight_offset_start?: number;
  highlight_offset_end?: number;
}

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
  corrupted?: boolean;
}

export const milestonesApi = {
  list: (contractId: string) =>
    request<{ data: unknown[] }>(`/contracts/${contractId}/milestones`),
  create: (contractId: string, data: unknown) =>
    request<{ data: unknown }>(`/contracts/${contractId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: unknown) =>
    request<{ data: unknown }>(`/milestones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  complete: (id: string) =>
    request<{ data: unknown }>(`/milestones/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  overdue: (projectId: string) =>
    request<{ data: unknown[] }>(`/projects/${projectId}/milestones/overdue`),
};

export const approvalsApi = {
  pending: () => request<{ data: unknown[] }>('/approvals/pending'),
  history: () => request<{ data: unknown[] }>('/approvals/history'),
  decide: (id: string, data: unknown) =>
    request<{ data: unknown }>(`/approvals/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const organisationsApi = {
  list: () => request<{ data: unknown[] }>('/organisations'),
};

export const usersApi = {
  list: () => request<{ data: unknown[] }>('/users'),
  updateRole: (id: string, role: string) =>
    request<{ data: unknown }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  delete: (id: string) =>
    request<{ data: unknown }>(`/users/${id}`, { method: 'DELETE' }),
};
