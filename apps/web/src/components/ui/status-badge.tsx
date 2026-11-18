import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock,
  Eye,
} from 'lucide-react';
import {
  PRIORITY_META,
  PROJECT_STATUS_META,
  TASK_STATUS_META,
  type Priority,
  type ProjectStatus,
  type TaskStatus,
} from '@flowboard/shared';
import { cn } from '@/lib/utils';

const STATUS_ICONS: Record<TaskStatus, typeof Circle> = {
  BACKLOG: CircleDashed,
  TODO: Circle,
  IN_PROGRESS: Clock,
  IN_REVIEW: Eye,
  DONE: CheckCircle2,
};

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const meta = TASK_STATUS_META[status];
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated/70 px-2 py-0.5 text-xs font-medium text-foreground',
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" style={{ color: meta.color }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

const PRIORITY_ICONS: Record<Priority, typeof ArrowRight> = {
  URGENT: AlertCircle,
  HIGH: ArrowUp,
  MEDIUM: ArrowRight,
  LOW: ArrowDown,
};

export function PriorityBadge({
  priority,
  compact = false,
  className,
}: {
  priority: Priority;
  compact?: boolean;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  const Icon = PRIORITY_ICONS[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
        className
      )}
      style={{
        color: meta.color,
        backgroundColor: `${meta.color}18`,
      }}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {!compact && meta.label}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{
        color: meta.color,
        borderColor: `${meta.color}35`,
        backgroundColor: `${meta.color}14`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}
