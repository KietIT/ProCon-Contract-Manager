'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import {
  FolderKanban, Plus, Loader2, Trash2,
  Calendar, DollarSign, Edit2, X, AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api-client';

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  tarStartDate: string;
  tarEndDate: string;
  totalBudget: string | number;
  contracts?: Array<{ id: string; ragStatus: string }>;
}

export default function AdminProjectsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editStatus, setEditStatus] = useState<{ id: string; status: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: '', tarStartDate: '', tarEndDate: '', totalBudget: '', currency: 'USD' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => projectsApi.list(),
  });
  const projects = (data?.data ?? []) as ProjectRow[];

  const createMutation = useMutation({
    mutationFn: () => projectsApi.create({
      name: form.name,
      tarStartDate: form.tarStartDate,
      tarEndDate: form.tarEndDate,
      totalBudget: form.totalBudget,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      setShowCreate(false);
      setForm({ name: '', tarStartDate: '', tarEndDate: '', totalBudget: '', currency: 'USD' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => projectsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      setEditStatus(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      setDeleteTarget(null);
    },
  });

  const statusColors: Record<string, string> = {
    active: 'text-green-400', planning: 'text-blue-400', close_out: 'text-amber-400', complete: 'text-gray-400',
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-white/5 animate-pulse rounded mb-8" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Manage Projects</h1>
          <p className="text-gray-400 text-sm">{projects.length} projects across all organisations</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg font-bold text-sm hover:bg-purple-500/30 transition-all"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">No projects yet. Create one to get started.</div>
        ) : (
          projects.map((p) => {
            const contracts = p.contracts ?? [];
            return (
              <div key={p.id} className="flex items-center gap-4 p-5 rounded-xl bg-white/3 border border-white/10 hover:border-purple-500/20 transition-all">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <FolderKanban className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white">{p.name}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(p.tarStartDate)} — {formatDate(p.tarEndDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> {formatCurrency(Number(p.totalBudget))}
                    </span>
                    <span>{contracts.length} contracts</span>
                  </div>
                </div>
                <span className={`text-xs font-bold capitalize ${statusColors[p.status] || 'text-gray-400'}`}>
                  {p.status?.replace('_', ' ')}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditStatus({ id: p.id, status: p.status })}
                    className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    title="Edit Status"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                    className="p-2 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    href={`/workspace/${p.id}`}
                    className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-400 hover:text-accent-cyan hover:border-accent-cyan/30 transition-all flex items-center"
                  >
                    Dashboard
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-[#0a0e1a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">New Project</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Project Name</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  placeholder="e.g. North Refinery TAR 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">TAR Start</label>
                  <input type="date" value={form.tarStartDate} onChange={e => setForm({ ...form, tarStartDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">TAR End</label>
                  <input type="date" value={form.tarEndDate} onChange={e => setForm({ ...form, tarEndDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Budget</label>
                <div className="flex gap-2">
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                    className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="USD" className="bg-[#0a0e1a]">USD</option>
                    <option value="VND" className="bg-[#0a0e1a]">VND</option>
                  </select>
                  <input type="text" inputMode="numeric"
                    value={form.totalBudget ? Number(form.totalBudget).toLocaleString('en-US') : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                      setForm({ ...form, totalBudget: raw });
                    }}
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    placeholder={form.currency === 'VND' ? 'e.g. 120,000,000,000' : 'e.g. 5,000,000'}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.name || !form.tarStartDate || !form.tarEndDate}
                className="flex-1 py-2.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-sm hover:bg-purple-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {editStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditStatus(null)} />
          <div className="relative bg-[#0a0e1a] border border-white/10 rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Update Status</h2>
            <select
              value={editStatus.status}
              onChange={e => setEditStatus({ ...editStatus, status: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm mb-4 focus:outline-none focus:border-purple-500/50"
            >
              {['planning', 'active', 'close_out', 'complete'].map(s => (
                <option key={s} value={s} className="bg-[#0a0e1a] capitalize">{s.replace('_', ' ')}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setEditStatus(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white transition-all">Cancel</button>
              <button
                onClick={() => updateMutation.mutate({ id: editStatus.id, status: editStatus.status })}
                disabled={updateMutation.isPending}
                className="flex-1 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-sm hover:bg-purple-500/30 transition-all disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-[#0a0e1a] border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white text-center mb-1">Delete Project?</h2>
            <p className="text-sm text-gray-400 text-center mb-2"><span className="text-white font-semibold">{deleteTarget.name}</span></p>
            <p className="text-xs text-gray-600 text-center mb-5">This will soft-delete the project.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
