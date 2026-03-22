'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  ChevronLeft,
  Bell,
  Shield,
  Menu,
  ShoppingCart,
  HardHat,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserButton } from '@clerk/nextjs';
import { useAppStore } from '@/lib/store';
import { approvalsApi, projectsApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAppStore((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();

  const role = user?.role;
  // Only TAR Manager has admin access
  const isAdmin = role === 'tar_manager';
  // Contractor does not participate in approval workflow as approver
  const showApprovals = role === 'tar_manager' || role === 'procurement';

  // Pending approvals badge — refetches every 60s
  const { data: pendingApprovalsData } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalsApi.pending(),
    refetchInterval: 60000,
    enabled: showApprovals,
  });
  const pendingCount = (pendingApprovalsData?.data as any[])?.length ?? 0;

  const navItems = [
    { href: '/workspace',   label: 'Workspace',   icon: LayoutDashboard, show: role !== 'contractor', badge: 0 },
    { href: '/my-work',     label: 'My Work',     icon: HardHat,         show: role === 'contractor', badge: 0 },
    { href: '/approvals',   label: 'Approvals',   icon: CheckSquare,     show: showApprovals,         badge: pendingCount },
    { href: '/procurement', label: 'Procurement', icon: ShoppingCart,    show: role === 'procurement', badge: 0 },
    { href: '/admin',       label: 'Admin Panel', icon: Shield,          show: isAdmin,               badge: 0 },
  ];

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-app-border', collapsed && 'justify-center px-2')}>
        <div className="w-8 h-8 bg-accent-cyan rounded flex items-center justify-center flex-shrink-0">
          <img src="/favicon.svg" alt="Procon AI" className="w-5 h-5 object-contain" />
        </div>
        {!collapsed && <span className="text-lg font-extrabold tracking-tight uppercase text-app-text">Procon AI</span>}
      </div>

      {/* User Info */}
      {user && (
        <div className={cn('px-4 py-4 border-b border-app-border', collapsed && 'px-2 flex justify-center')}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-full bg-accent-cyan/20 border border-accent-cyan/30 flex items-center justify-center">
              <span className="text-accent-cyan text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-cyan/20 border border-accent-cyan/30 flex items-center justify-center flex-shrink-0">
                <span className="text-accent-cyan text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-app-text truncate">{user.name}</p>
                <p className="text-xs text-app-text-muted truncate capitalize">{user.role === 'tar_manager' ? 'Procon Manager' : user.role.replace('_', ' ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.filter(item => item.show).map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              onMouseEnter={() => {
                if (href === '/workspace') {
                  queryClient.prefetchQuery({ queryKey: ['projects'], queryFn: () => projectsApi.list() });
                } else if (href === '/approvals') {
                  queryClient.prefetchQuery({ queryKey: ['approvals', 'pending'], queryFn: () => approvalsApi.pending() });
                  queryClient.prefetchQuery({ queryKey: ['approvals', 'history'], queryFn: () => approvalsApi.history() });
                }
              }}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20'
                  : 'text-app-text-muted hover:text-app-text hover:bg-sidebar-alt'
              )}
              title={collapsed ? label : undefined}
            >
              {/* Icon with badge dot when collapsed */}
              <span className="relative flex-shrink-0">
                <Icon className="w-5 h-5" />
                {collapsed && badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </span>
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && badge > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold min-w-[18px] text-center leading-none">
                  {badge}
                </span>
              )}
              {!collapsed && active && badge === 0 && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — Clerk UserButton */}
      <div className={cn('px-3 py-4 border-t border-app-border', collapsed && 'flex justify-center px-2')}>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
            },
          }}
        />
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center w-full px-4 py-3 border-t border-app-border text-app-text-muted hover:text-app-text transition-colors"
      >
        <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
      </button>
    </>
  );

  return (
    <div className="flex h-screen bg-trust-blue text-app-text overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-sidebar-bg border-r border-app-border transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-sidebar-bg border-r border-app-border z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 lg:px-6 h-16 border-b border-app-border bg-sidebar-bg/50 backdrop-blur-sm flex-shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2 text-sm text-app-text-muted">
            <span className="text-app-text font-medium">Procon Platform</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button className="relative p-2 rounded-lg text-app-text-muted hover:text-app-text hover:bg-sidebar-alt transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
            </button>
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

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-trust-blue">
          {children}
        </main>
      </div>
    </div>
  );
}
