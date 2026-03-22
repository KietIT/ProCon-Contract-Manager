'use client';

import { X, Loader2, Upload, AlertCircle, FileText } from 'lucide-react';
import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '@/lib/api-client';

interface Props {
  contractId: string;
  contractNumber: string;
  currentVersion: number;
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UpdateContractModal({
  contractId,
  contractNumber,
  currentVersion,
  projectId,
  onClose,
  onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [changeNote, setChangeNote] = useState('');

  const uploadVersion = useMutation({
    mutationFn: async (formData: FormData) => {
      return contractsApi.uploadVersion(contractId, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contract-versions', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts', projectId] });
      onSuccess();
      onClose();
    },
  });

  function handleSubmit() {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (changeNote.trim()) {
      formData.append('changeNote', changeNote.trim());
    }
    uploadVersion.mutate(formData);
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
          <div>
            <h2 className="text-lg font-bold text-app-text">Update Contract</h2>
            <p className="text-sm text-app-text-muted mt-1">
              {contractNumber} — uploading as version {currentVersion + 1}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {uploadVersion.isError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">
              {uploadVersion.error?.message || 'Failed to upload new version. Please try again.'}
            </p>
          </div>
        )}

        {/* Info banner */}
        <div className="mb-4 p-3 rounded-lg bg-accent-cyan/5 border border-accent-cyan/20 flex items-start gap-2">
          <FileText className="w-4 h-4 text-accent-cyan mt-0.5 shrink-0" />
          <p className="text-xs text-app-text-muted">
            The current file will be saved as version {currentVersion}. AI extraction will be reset and you can re-run it on the new file.
          </p>
        </div>

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
              New Contract File (PDF / DOCX) *
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-accent-cyan bg-accent-cyan/10'
                  : file
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-app-border hover:border-accent-cyan/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-4 h-4 text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-green-400">{file.name}</p>
                  <p className="text-xs text-app-text-muted mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-app-text-muted mx-auto mb-2" />
                  <p className="text-sm text-app-text-muted">
                    Drop PDF or DOCX here, or click to browse
                  </p>
                  <p className="text-xs text-app-text-muted mt-1">Up to 50 MB</p>
                </>
              )}
            </div>
          </div>

          {/* Change Note */}
          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
              Change Note (optional)
            </label>
            <textarea
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Describe what changed in this version..."
              rows={3}
              className="w-full px-4 py-2.5 bg-sidebar-alt border border-app-border rounded-lg text-app-text text-sm placeholder-app-text-muted focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-app-border text-sm font-semibold text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploadVersion.isPending || !file}
            className="flex-1 py-2.5 rounded-lg bg-accent-cyan text-trust-blue font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploadVersion.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Upload Version {currentVersion + 1}
          </button>
        </div>
      </div>
    </div>
  );
}
