import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'tar_manager' | 'procurement' | 'contractor' | 'contract_manager' | 'pmo';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgId: string;
  orgName: string;
  clerkId?: string;
}

interface AppState {
  user: AppUser | null;
  setUser: (user: AppUser) => void;
  clearUser: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    { name: 'tar-app-store' }
  )
);
