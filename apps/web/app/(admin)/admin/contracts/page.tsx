'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { FileText, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { contractsApi } from '@/lib/api-client';

interface ContractRow {
  id: string;
  contractNumber: string;
  type: string;
  contractValue: string | number;
  status: string;
  ragStatus: string;
  startDate: string;
  endDate: string;
  projectId: string;
  project?: { id: string; name: string };
  contractorOrg?: { name: string };
}

export default function AdminContractsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-contracts'],
    queryFn: () => contractsApi.listAll(),
  });
  const contracts = (data?.data ?? []) as ContractRow[];

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-white/5 animate-pulse rounded mb-8" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-white/5 animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">All Contracts</h1>
          <p className="text-gray-400 text-sm">{contracts.length} contracts across all projects</p>
        </div>
      </div>

      {contracts.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No contracts found</p>
        </div>
      ) : (
        <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <div className="col-span-3">Contract</div>
            <div className="col-span-2">Project</div>
            <div className="col-span-2">Contractor</div>
            <div className="col-span-1">Value</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">RAG</div>
            <div className="col-span-1">Dates</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {contracts.map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/3 transition-all items-center">
              <div className="col-span-3 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{c.contractNumber}</p>
                <p className="text-xs text-gray-500 capitalize">{c.type?.replace('_', ' ')}</p>
              </div>
              <div className="col-span-2 text-sm text-gray-400 truncate">{c.project?.name || '—'}</div>
              <div className="col-span-2 text-sm text-gray-400 truncate">{c.contractorOrg?.name || '—'}</div>
              <div className="col-span-1 text-sm text-white font-medium">{formatCurrency(Number(c.contractValue))}</div>
              <div className="col-span-1">
                <span className={`text-xs font-bold capitalize px-2 py-1 rounded-lg ${
                  c.status === 'active' ? 'text-green-400 bg-green-500/10' :
                  c.status === 'draft' ? 'text-gray-400 bg-white/5' :
                  c.status === 'complete' ? 'text-blue-400 bg-blue-500/10' :
                  'text-gray-400 bg-white/5'
                }`}>
                  {c.status?.replace('_', ' ')}
                </span>
              </div>
              <div className="col-span-1">
                <span className={`inline-block w-3 h-3 rounded-full ${
                  c.ragStatus === 'green' ? 'bg-green-500' :
                  c.ragStatus === 'amber' ? 'bg-amber-500' :
                  c.ragStatus === 'red' ? 'bg-red-500' : 'bg-gray-600'
                }`} title={c.ragStatus} />
              </div>
              <div className="col-span-1 text-xs text-gray-500">{formatDate(c.startDate)}</div>
              <div className="col-span-1 flex justify-end">
                <Link
                  href={`/workspace/${c.projectId}/contracts/${c.id}`}
                  className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-accent-cyan hover:border-accent-cyan/30 transition-all"
                  title="View Details"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
