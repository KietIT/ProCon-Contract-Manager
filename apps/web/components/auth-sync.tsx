'use client';

import { useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useAppStore } from '@/lib/store';
import { setTokenGetter } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function AuthSync() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const setUser = useAppStore((s) => s.setUser);
  const clearUser = useAppStore((s) => s.clearUser);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      clearUser();
      return;
    }

    // Wire token getter so all API calls include the Bearer token
    setTokenGetter(getToken);

    async function syncUser() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch user');
        const { data } = await res.json();

        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          orgId: data.orgId,
          orgName: data.orgName,
        });
      } catch (err) {
        console.error('[AuthSync] Failed to sync user:', err);
      }
    }

    syncUser();
  }, [isLoaded, isSignedIn, user, getToken, setUser, clearUser]);

  return null;
}
