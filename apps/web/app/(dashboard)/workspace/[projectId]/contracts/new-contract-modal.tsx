'use client';

import { X, Loader2, Upload, Building2, AlertCircle } from 'lucide-react';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi, organisationsApi } from '@/lib/api-client';
import CurrencyInput, { type Currency } from '@/components/currency-input';

interface Props {
  projectId: string;
  onClose: () => void;
  onSuccess: (newContract: unknown) => void;
}

export default function NewContractModal({ projectId, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => organisationsApi.list(),
  });
  const organisations = (orgsData?.data ?? []) as Array<{
    id: string;
    name: string;
    type: string;
  }>;

  const [form, setForm] = useState({
    contractorOrgId: '',
    type: 'once_off',
    spendingType: 'opex',
    department: 'rotating',
    contractValue: '',
    contractCurrency: 'USD' as Currency,
    startDate: '',
    endDate: '',
  });

  // Set default org once loaded
  const defaultOrgSet = useRef(false);
  if (organisations.length > 0 && !defaultOrgSet.current && !form.contractorOrgId) {
    defaultOrgSet.current = true;
    setForm((prev) => ({ ...prev, contractorOrgId: organisations[0].id }));
  }

  const createContract = useMutation({
    mutationFn: async (formData: FormData) => {
      return contractsApi.upload(projectId, formData);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contracts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-gantt', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] });
      onSuccess(result.data);
      onClose();
    },
  });

  function handleSubmit() {
    const formData = new FormData();
    formData.append('type', form.type);
    formData.append('spendingType', form.spendingType);
    formData.append('department', form.department);
    formData.append('contractorOrgId', form.contractorOrgId);
    formData.append('contractValue', form.contractValue);
    formData.append('contractCurrency', form.contractCurrency);
    formData.append('startDate', form.startDate);
    formData.append('endDate', form.endDate);
    if (file) {
      formData.append('file', file);
    }
    createContract.mutate(formData);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type.includes('pdf') || dropped.name.endsWith('.docx'))) {
      setFile(dropped);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-sidebar-bg border border-app-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-app-text">New Contract</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createContract.isError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">
              {createContract.error?.message || 'Failed to create contract. Please try again.'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Contract File (PDF / DOCX)</label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragging ? 'border-accent-cyan bg-accent-cyan/10' : file ? 'border-green-500/50 bg-green-500/5' : 'border-app-border hover:border-accent-cyan/50'}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-4 h-4 text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-green-400">{file.name}</p>
                  <p className="text-xs text-app-text-muted mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-app-text-muted mx-auto mb-2" />
                  <p className="text-sm text-app-text-muted">Drop PDF or DOCX here, or click to browse</p>
                  <p className="text-xs text-app-text-muted mt-1">Up to 50 MB</p>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Contractor Organisation</label>
            <div className="relative">
              <select
                value={form.contractorOrgId}
                onChange={e => setForm({ ...form, contractorOrgId: e.target.value })}
                className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20 appearance-none"
              >
                {organisations.map((org) => (
                  <option key={org.id} value={org.id} className="bg-sidebar-bg">
                    {org.name} ({org.type.replace('_', ' ')})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-app-text-muted">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Contract Type</label>
            <select
              value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
            >
              {[{ value: 'once_off', label: 'Once-off' }, { value: 'frame', label: 'Frame' }].map(t => (
                <option key={t.value} value={t.value} className="bg-sidebar-bg">{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Type of Spending</label>
            <select
              value={form.spendingType} onChange={e => setForm({ ...form, spendingType: e.target.value })}
              className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
            >
              {[{ value: 'opex', label: 'OPEX' }, { value: 'capex', label: 'CAPEX' }].map(t => (
                <option key={t.value} value={t.value} className="bg-sidebar-bg">{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Department</label>
            <select
              value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
              className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
            >
              {[
                { value: 'rotating', label: 'Rotating' },
                { value: 'instrument', label: 'Instrument' },
                { value: 'static_dept', label: 'Static' },
                { value: 'electrical', label: 'Electrical' },
                { value: 'process_control_automation', label: 'Process Control Automation' },
              ].map(t => (
                <option key={t.value} value={t.value} className="bg-sidebar-bg">{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Contract Value</label>
            <CurrencyInput
              value={form.contractValue}
              currency={form.contractCurrency}
              onChange={(value, currency) => setForm({ ...form, contractValue: value, contractCurrency: currency })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">End Date</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20"
              />
            </div>
          </div>

        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-app-border text-sm font-semibold text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-all">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={createContract.isPending || !file || !form.contractorOrgId || !form.contractValue || !form.startDate || !form.endDate}
            className="flex-1 py-2.5 rounded-lg bg-accent-cyan text-trust-blue font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {createContract.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create Contract
          </button>
        </div>
      </div>
    </div>
  );
}
