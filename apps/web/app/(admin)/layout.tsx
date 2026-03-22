'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, FolderKanban, Users, FileText, LayoutDashboard, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAppStore } from '@/lib/store';
import { useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';

const adminNav = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/contracts', label: 'Contracts', icon: FileText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppStore((s) => s.user);

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== 'tar_manager') {
      router.replace('/workspace');
    }
  }, [user, router]);

  if (user && user.role !== 'tar_manager') {
    return (
      <div className="flex h-screen items-center justify-center bg-trust-blue text-gray-500">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-trust-blue text-white overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0a0e1a] border-r border-white/5 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="w-8 h-8 bg-purple-500/30 rounded flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-lg font-extrabold tracking-tight uppercase text-white">Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {adminNav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Clerk UserButton */}
        <div className="px-3 py-3 border-t border-white/5">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8',
              },
            }}
          />
        </div>

        {/* Back link */}
        <div className="px-2 py-4 border-t border-white/5">
          <Link
            href="/workspace"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Back to Workspace</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 h-16 border-b border-white/5 bg-[#0a0e1a]/50 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Shield className="w-4 h-4 text-purple-400" />
            <span>Admin Panel</span>
            {pathname !== '/admin' && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-white capitalize">{pathname.split('/').pop()}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8',
                },
              }}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-trust-blue">
          {children}
        </main>
      </div>
    </div>
  );
}
