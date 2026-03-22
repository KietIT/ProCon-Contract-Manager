'use client';

import { Shield, Edit2, X, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';

const ROLE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  tar_manager: { label: 'TAR Manager', color: 'text-red-400 bg-red-500/10 border-red-500/20', emoji: '🔴' },
  procurement: { label: 'Procurement', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', emoji: '🟣' },
  contractor: { label: 'Contractor', color: 'text-green-400 bg-green-500/10 border-green-500/20', emoji: '🟢' },
};

// The 3 core seeded dev accounts — protected from deletion
const PROTECTED_EMAILS = new Set([
  'tvktarmanager@gmail.com',
  'tvkprocurement@gmail.com',
  'tvkcontractor@gmail.com',
]);

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  org?: { id: string; name: string; type: string };
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user);
  const [editUser, setEditUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list(),
  });
  const users = (data?.data ?? []) as UserRow[];

  const updateMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteTarget(null);
    },
  });

  function canDelete(user: UserRow): boolean {
    // Cannot delete yourself
    if (user.id === currentUser?.id) return false;
    // Cannot delete the 3 core dev accounts
    if (PROTECTED_EMAILS.has(user.email.toLowerCase())) return false;
    return true;
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-white/5 animate-pulse rounded mb-8" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-white/5 animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Manage Users</h1>
          <p className="text-gray-400 text-sm">{users.length} users across all organisations</p>
        </div>
      </div>

      <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <div className="col-span-3">User</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Organisation</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {users.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No users found</div>
        ) : (
          users.map((user) => {
            const roleInfo = ROLE_LABELS[user.role] || { label: user.role, color: 'text-gray-400 bg-white/5 border-white/10', emoji: '⚪' };
            const isSelf = user.id === currentUser?.id;
            const deletable = canDelete(user);
            return (
              <div key={user.id} className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/3 transition-all items-center ${isSelf ? 'bg-accent-cyan/5' : ''}`}>
                <div className="col-span-3 flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isSelf ? 'bg-accent-cyan/20 border-2 border-accent-cyan/40' : 'bg-accent-cyan/10 border border-accent-cyan/20'}`}>
                    <span className="text-accent-cyan font-bold text-xs">{user.name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-white text-sm truncate block">{user.name}</span>
                    {isSelf && <span className="text-[10px] text-accent-cyan">You</span>}
                  </div>
                </div>
                <div className="col-span-3 text-sm text-gray-400 truncate">{user.email}</div>
                <div className="col-span-2">
                  <span className="text-sm text-gray-300">{user.org?.name || '—'}</span>
                  {user.org?.type && <span className="text-xs text-gray-600 ml-1 capitalize">({user.org.type.replace('_', ' ')})</span>}
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${roleInfo.color}`}>
                    {roleInfo.emoji} {roleInfo.label}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    onClick={() => setEditUser({ id: user.id, name: user.name, role: user.role })}
                    className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    title="Edit Role"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {deletable && (
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="p-2 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Role Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditUser(null)} />
          <div className="relative bg-[#0a0e1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Edit User Role</h2>
              <button onClick={() => setEditUser(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">User: <span className="text-white font-semibold">{editUser.name}</span></p>

            <div className="space-y-2 mb-5">
              {Object.entries(ROLE_LABELS).map(([value, info]) => (
                <button
                  key={value}
                  onClick={() => setEditUser({ ...editUser, role: value })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    editUser.role === value
                      ? 'border-accent-cyan/50 bg-accent-cyan/10'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <span className="text-lg">{info.emoji}</span>
                  <span className="text-sm font-semibold text-white">{info.label}</span>
                  {editUser.role === value && <div className="ml-auto w-2 h-2 rounded-full bg-accent-cyan" />}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
              <button
                onClick={() => updateMutation.mutate({ id: editUser.id, role: editUser.role })}
                disabled={updateMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-sm hover:bg-purple-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Save Role
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
            <h2 className="text-lg font-bold text-white text-center mb-1">Delete User?</h2>
            <p className="text-sm text-gray-400 text-center mb-1">
              <span className="text-white font-semibold">{deleteTarget.name}</span>
            </p>
            <p className="text-xs text-gray-500 text-center mb-1">{deleteTarget.email}</p>
            <p className="text-xs text-red-400/70 text-center mb-5">
              This will permanently remove the user and unassign their milestones.
            </p>
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
