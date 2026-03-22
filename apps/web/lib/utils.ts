import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency: 'USD' | 'VND' = 'USD'): string {
  if (currency === 'VND') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(amount));
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function daysFromNow(date: string | Date): number {
  const now = new Date();
  const target = new Date(date);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function ragColor(status: string) {
  switch (status) {
    case 'red': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'amber': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'green': return 'text-green-400 bg-green-500/10 border-green-500/20';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
}

export function statusColor(status: string) {
  switch (status) {
    case 'complete': return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'in_progress': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'overdue': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'waived': return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    case 'not_started': return 'text-gray-300 bg-white/5 border-white/10';
    case 'active': return 'text-accent-cyan bg-cyan-500/10 border-cyan-500/20';
    case 'draft': return 'text-gray-400 bg-white/5 border-white/10';
    case 'at_risk': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'disputed': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    default: return 'text-gray-400 bg-white/5 border-white/10';
  }
}
