import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  const cleaned = name.replace(/\([^)]*\)/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatRelativeTime(isoDate: string): string {
  try {
    return formatDistanceToNow(new Date(isoDate), { addSuffix: true });
  } catch {
    return '';
  }
}

export function formatDueDate(isoDate: string | null | undefined): string {
  if (!isoDate) return 'No due date';
  const date = new Date(isoDate);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'MMM d, yyyy');
}

export function formatShortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  return format(new Date(isoDate), 'MMM d');
}

export function isTaskOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === 'DONE') return false;
  const d = new Date(dueDate);
  return isPast(d) && !isToday(d);
}
