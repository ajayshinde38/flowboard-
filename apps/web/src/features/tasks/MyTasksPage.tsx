import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  BOARD_STATUSES,
  PRIORITIES,
  PRIORITY_META,
  TASK_STATUS_META,
  type Priority,
  type TaskStatus,
} from '@flowboard/shared';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { useDebounce } from '@/hooks/useDebounce';
import { projectsApi, tasksApi, workspacesApi } from '@/services/api.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PriorityBadge, TaskStatusBadge } from '@/components/ui/status-badge';
import { UserAvatar } from '@/components/ui/avatar';
import { cn, formatShortDate, isTaskOverdue } from '@/lib/utils';

export default function MyTasksPage() {
  const { workspaceId } = useAuth();
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal);
  const openTaskDrawer = useUIStore((s) => s.openTaskDrawer);
  const qc = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebounce(searchInput, 220);

  const status = searchParams.get('status') ?? 'all';
  const priority = searchParams.get('priority') ?? 'all';
  const projectId = searchParams.get('projectId') ?? 'all';
  const assigneeId = searchParams.get('assigneeId') ?? 'all';
  const sortBy = searchParams.get('sortBy') ?? 'updatedAt';
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') ?? 'desc';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const setFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const queryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status === 'all' ? undefined : status,
      priority: priority === 'all' ? undefined : priority,
      projectId: projectId === 'all' ? undefined : projectId,
      assigneeId: assigneeId === 'all' ? undefined : assigneeId,
      sortBy,
      sortDir,
      page,
      limit: 50,
    }),
    [debouncedSearch, status, priority, projectId, assigneeId, sortBy, sortDir, page]
  );

  const tasksQuery = useQuery({
    queryKey: ['tasks', 'list', workspaceId, queryParams],
    queryFn: ({ signal }) => tasksApi.list(workspaceId!, queryParams, signal),
    enabled: Boolean(workspaceId),
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: () => projectsApi.list(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const membersQuery = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: { status?: TaskStatus; priority?: Priority }) =>
      tasksApi.bulkUpdate({
        workspaceId: workspaceId!,
        taskIds: selectedIds,
        ...payload,
      }),
    onSuccess: (res) => {
      toast.success(`Updated ${res.updatedCount} task(s)`);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Bulk update failed'),
  });

  const tasks = tasksQuery.data?.items ?? [];
  const pagination = tasksQuery.data?.pagination;

  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  const allSelected = tasks.length > 0 && selectedIds.length === tasks.length;

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.length === tasks.length ? [] : tasks.map((t) => t.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const hasFilters =
    Boolean(searchInput) ||
    status !== 'all' ||
    priority !== 'all' ||
    projectId !== 'all' ||
    assigneeId !== 'all';

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Search, filter, and update tasks across your projects.
          </p>
        </div>
        <Button size="sm" onClick={() => openCreateTaskModal()}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-surface p-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-foreground-muted" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tasks by title or key..."
            className="pl-8"
            aria-label="Search tasks"
          />
        </div>

        <Select value={status} onValueChange={(v) => setFilter('status', v)}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {BOARD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={(v) => setFilter('priority', v)}>
          <SelectTrigger className="w-[135px]" aria-label="Filter by priority">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_META[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectId} onValueChange={(v) => setFilter('projectId', v)}>
          <SelectTrigger className="w-[160px]" aria-label="Filter by project">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {(projectsQuery.data?.items ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.key} — {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assigneeId} onValueChange={(v) => setFilter('assigneeId', v)}>
          <SelectTrigger className="w-[155px]" aria-label="Filter by assignee">
            <SelectValue placeholder="All assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="me">Assigned to Me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {(membersQuery.data?.items ?? []).map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={() => setFilter('sortDir', sortDir === 'asc' ? 'desc' : 'asc')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortDir === 'asc' ? 'Oldest' : 'Newest'}
        </Button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('');
              setSearchParams({});
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Bulk task actions"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent-muted px-4 py-2.5"
        >
          <span className="text-xs font-semibold text-foreground">
            {selectedIds.length} task{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Select onValueChange={(val) => bulkMutation.mutate({ status: val as TaskStatus })}>
              <SelectTrigger className="h-8 w-[150px] bg-surface text-xs" aria-label="Bulk update status">
                <SelectValue placeholder="Set status..." />
              </SelectTrigger>
              <SelectContent>
                {BOARD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TASK_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={(val) => bulkMutation.mutate({ priority: val as Priority })}>
              <SelectTrigger className="h-8 w-[145px] bg-surface text-xs" aria-label="Bulk update priority">
                <SelectValue placeholder="Set priority..." />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Task List Table (Virtualized Container) */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {/* Table Header */}
        <div className="grid grid-cols-[36px_90px_minmax(180px,1fr)_130px_100px_110px_80px] items-center gap-3 border-b border-border bg-elevated/40 px-4 py-2.5 text-xs font-medium text-foreground-muted">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Select all visible tasks"
          />
          <span>ID</span>
          <span>Task</span>
          <span className="hidden md:block">Status</span>
          <span className="hidden sm:block">Priority</span>
          <span className="hidden lg:block">Due</span>
          <span className="text-right">Assignee</span>
        </div>

        {tasksQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CheckSquare}
              title="No matching tasks"
              description={
                hasFilters
                  ? 'Try adjusting or clearing your filters to see more tasks.'
                  : 'Create your first task to begin tracking work in this workspace.'
              }
              action={
                <Button size="sm" onClick={() => openCreateTaskModal()}>
                  Create Task
                </Button>
              }
            />
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="max-h-[600px] overflow-y-auto"
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
                width: '100%',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const task = tasks[vRow.index];
                const isSelected = selectedIds.includes(task.id);
                const overdue = isTaskOverdue(task.dueDate, task.status);

                return (
                  <div
                    key={task.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${vRow.size}px`,
                      transform: `translateY(${vRow.start}px)`,
                    }}
                    className={cn(
                      'grid grid-cols-[36px_90px_minmax(180px,1fr)_130px_100px_110px_80px] items-center gap-3 border-b border-border/70 px-4 text-sm transition-colors hover:bg-elevated/35',
                      isSelected && 'bg-accent-muted/40'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(task.id)}
                      aria-label={`Select ${task.identifier}`}
                    />
                    <span className="font-mono text-xs text-foreground-muted">
                      {task.identifier}
                    </span>
                    <button
                      type="button"
                      onClick={() => openTaskDrawer(task.id)}
                      className="flex min-w-0 items-center gap-2 text-left"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: task.project.color }}
                      />
                      <span className="truncate font-medium text-foreground hover:text-accent">
                        {task.title}
                      </span>
                      {task.commentCount > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-foreground-muted">
                          <MessageSquare className="h-3 w-3" />
                          {task.commentCount}
                        </span>
                      )}
                    </button>
                    <div className="hidden md:block">
                      <TaskStatusBadge status={task.status} />
                    </div>
                    <div className="hidden sm:block">
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <span
                      className={cn(
                        'hidden text-xs tabular-nums lg:block',
                        overdue ? 'font-medium text-red-500' : 'text-foreground-secondary'
                      )}
                    >
                      {formatShortDate(task.dueDate)}
                    </span>
                    <div className="flex justify-end">
                      {task.assignee ? (
                        <UserAvatar
                          name={task.assignee.name}
                          color={task.assignee.avatarColor}
                          size="sm"
                        />
                      ) : (
                        <span className="text-xs text-foreground-muted">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-border bg-elevated/25 px-4 py-2.5 text-xs text-foreground-secondary">
            <span>
              Showing <strong className="text-foreground">{tasks.length}</strong> of{' '}
              <strong className="text-foreground">{pagination.total}</strong> tasks
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page <= 1}
                onClick={() => setFilter('page', String(page - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <span className="px-2 font-mono tabular-nums">
                {page} / {Math.max(1, pagination.totalPages)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page >= pagination.totalPages}
                onClick={() => setFilter('page', String(page + 1))}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
