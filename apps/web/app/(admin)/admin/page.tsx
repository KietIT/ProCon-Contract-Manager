'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import {
  FolderKanban, Users, FileText, Shield,
  TrendingUp, AlertTriangle, CheckCircle, Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, contractsApi, usersApi } from '@/lib/api-client';

export default function AdminPage() {
  const { data: projectsData, isLoading: pLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => projectsApi.list(),
  });
  const { data: contractsData, isLoading: cLoading } = useQuery({
    queryKey: ['admin-contracts'],
    queryFn: () => contractsApi.listAll(),
  });
  const { data: usersData, isLoading: uLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list(),
  });

  const projects = (projectsData?.data ?? []) as Array<{
    id: string; name: string; status: string; totalBudget: string | number;
    contracts?: Array<{ ragStatus: string }>;
  }>;
  const allContracts = (contractsData?.data ?? []) as Array<{ id: string; ragStatus: string }>;
  const users = (usersData?.data ?? []) as Array<{ id: string }>;
  const isLoading = pLoading || cLoading || uLoading;

  const totalBudget = projects.reduce((sum, p) => sum + Number(p.totalBudget || 0), 0);
  const atRisk = projects.filter(p =>
    (p.contracts ?? []).some(c => c.ragStatus === 'red' || c.ragStatus === 'amber')
  ).length;

  const stats = [
    { label: 'Total Projects', value: projects.length, icon: FolderKanban, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10 border-accent-cyan/20' },
    { label: 'Total Contracts', value: allContracts.length, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Total Budget', value: formatCurrency(totalBudget), icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    { label: 'Projects at Risk', value: atRisk, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-gray-400 text-sm">Platform-wide overview and management · {users.length} users</p>
        </div>
      </div>

      {/* Quick Nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Manage Projects', href: '/admin/projects', icon: FolderKanban },
          { label: 'Manage Users', href: '/admin/users', icon: Users },
          { label: 'All Contracts', href: '/admin/contracts', icon: FileText },
          { label: 'Workspace', href: '/workspace', icon: CheckCircle },
        ].map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 p-4 rounded-xl bg-white/3 border border-white/10 hover:border-accent-cyan/30 hover:bg-white/5 transition-all group"
          >
            <Icon className="w-5 h-5 text-gray-400 group-hover:text-accent-cyan transition-colors" />
            <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">{label}</span>
          </Link>
        ))}
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white/5 animate-pulse rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl bg-white/3 border border-white/10 p-5">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className={`text-2xl font-black mb-1 ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Projects Table */}
      <div className="rounded-2xl bg-white/3 border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">All Projects</h2>
          <Link href="/admin/projects" className="text-xs text-accent-cyan hover:underline">Manage →</Link>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : projects.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No projects yet</div>
        ) : (
          <div className="divide-y divide-white/5">
            {projects.map((p) => {
              const pContracts = p.contracts ?? [];
              const rag = pContracts.reduce((acc: Record<string, number>, c) => {
                acc[c.ragStatus] = (acc[c.ragStatus] || 0) + 1;
                return acc;
              }, { green: 0, amber: 0, red: 0 } as Record<string, number>);
              return (
                <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-white/3 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{p.status?.replace('_', ' ')} · {pContracts.length} contracts</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(rag.red || 0) > 0 && <span className="px-2 py-0.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full">{rag.red} red</span>}
                    {(rag.amber || 0) > 0 && <span className="px-2 py-0.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full">{rag.amber} amber</span>}
                    {(rag.green || 0) > 0 && <span className="px-2 py-0.5 text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full">{rag.green} green</span>}
                  </div>
                  <div className="text-sm text-gray-400 text-right flex-shrink-0 hidden md:block">
                    {formatCurrency(Number(p.totalBudget))}
                  </div>
                  <Link href={`/workspace/${p.id}`} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-400 hover:text-accent-cyan hover:border-accent-cyan/30 transition-all">
                    View
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
