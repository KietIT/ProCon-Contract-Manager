'use client';

import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Plus, FolderKanban, ChevronRight, Calendar, Coins, FileText, Loader2, X,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api-client';

export default function WorkspacePage() {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', tarStartDate: '', tarEndDate: '', totalBudget: '', currency: 'USD' });

  const { data: projectsData, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });
  const projects = (projectsData?.data ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    tarStartDate: string;
    tarEndDate: string;
    totalBudget: string | number;
    currency?: 'USD' | 'VND';
    contracts: Array<{
      id: string;
      ragStatus: 'green' | 'amber' | 'red';
    }>;
  }>;

  const createProject = useMutation({
    mutationFn: (data: { name: string; tarStartDate: string; tarEndDate: string; totalBudget: number; currency: string; status: string }) =>
      projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setForm({ name: '', tarStartDate: '', tarEndDate: '', totalBudget: '', currency: 'USD' });
    },
  });

  const canCreate = user?.role === 'tar_manager';

  const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-500/10 border-green-500/20',
    planning: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    close_out: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    complete: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-7 w-48 rounded bg-sidebar-alt animate-pulse" />
            <div className="h-4 w-32 rounded bg-sidebar-alt animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-sidebar-alt animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="text-center py-20">
          <p className="text-red-400 text-lg font-semibold mb-2">Failed to load projects</p>
          <p className="text-app-text-muted text-sm">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-app-text mb-1">
            {user ? `Welcome, ${user.name.split(' ')[0]}` : 'Workspace'}
          </h1>
          <p className="text-app-text-muted text-sm">
            {user ? `${user.orgName} · ${user.role === 'tar_manager' ? 'Procon Manager' : user.role.replace('_', ' ')}` : 'Your Procon projects'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-cyan text-trust-blue rounded-lg font-bold text-sm hover:brightness-110 transition-all glow-cyan"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map((project) => {
          const ragCounts = project.contracts?.reduce(
            (acc: Record<string, number>, c) => { acc[c.ragStatus] = (acc[c.ragStatus] || 0) + 1; return acc; },
            { green: 0, amber: 0, red: 0 }
          ) || { green: 0, amber: 0, red: 0 };
          const totalContracts = project.contracts?.length || 0;

          return (
            <div
              key={project.id}
              className="group rounded-2xl bg-app-card border border-app-border hover:border-accent-cyan/30 transition-all duration-300 overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="w-5 h-5 text-accent-cyan" />
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${statusColors[project.status] || 'text-app-text-muted bg-sidebar-alt border-app-border'}`}>
                    {project.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-app-text font-bold text-lg mb-1 group-hover:text-accent-cyan transition-colors">{project.name}</h3>
                <div className="flex items-center gap-2 text-xs text-app-text-muted mb-4">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(project.tarStartDate)} — {formatDate(project.tarEndDate)}
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-sm mb-4">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-app-text-muted" />
                    <span className="text-app-text font-medium">{totalContracts}</span>
                    <span className="text-app-text-muted">contracts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-app-text-muted" />
                    <span className="text-app-text font-medium">{formatCurrency(Number(project.totalBudget), project.currency ?? 'USD')}</span>
                  </div>
                </div>

                {/* RAG Pills */}
                {totalContracts > 0 && (
                  <div className="flex items-center gap-2">
                    {ragCounts.green > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20">
                        {ragCounts.green} Green
                      </span>
                    )}
                    {ragCounts.amber > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                        {ragCounts.amber} Amber
                      </span>
                    )}
                    {ragCounts.red > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20">
                        {ragCounts.red} Red
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="px-6 pb-6">
                <Link
                  href={`/workspace/${project.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:border-accent-cyan/50 hover:text-accent-cyan hover:bg-accent-cyan/5 transition-all"
                >
                  View Dashboard
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-sidebar-bg border border-app-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-app-text">New Project</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Project Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. North Refinery Procon 2026"
                  className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm placeholder-app-text-muted focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Procon Start</label>
                  <input
                    type="date"
                    value={form.tarStartDate}
                    onChange={e => setForm({ ...form, tarStartDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Procon End</label>
                  <input
                    type="date"
                    value={form.tarEndDate}
                    onChange={e => setForm({ ...form, tarEndDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Total Budget</label>
                <div className="flex gap-2">
                  <select
                    value={form.currency}
                    onChange={e => setForm({ ...form, currency: e.target.value })}
                    className="px-3 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
                  >
                    <option value="USD" className="bg-sidebar-bg">USD</option>
                    <option value="VND" className="bg-sidebar-bg">VND</option>
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.totalBudget ? Number(form.totalBudget).toLocaleString('en-US') : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                      setForm({ ...form, totalBudget: raw });
                    }}
                    placeholder={form.currency === 'VND' ? 'e.g. 120,000,000,000' : 'e.g. 5,000,000'}
                    className="flex-1 px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm placeholder-app-text-muted focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-lg border border-app-border text-sm font-semibold text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-all">
                Cancel
              </button>
              <button
                onClick={() => createProject.mutate({
                  name: form.name,
                  tarStartDate: form.tarStartDate,
                  tarEndDate: form.tarEndDate,
                  totalBudget: parseFloat(form.totalBudget) || 0,
                  currency: form.currency,
                  status: 'planning',
                })}
                disabled={createProject.isPending || !form.name || !form.tarStartDate || !form.tarEndDate || !form.totalBudget}
                className="flex-1 py-2.5 rounded-lg bg-accent-cyan text-trust-blue font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
