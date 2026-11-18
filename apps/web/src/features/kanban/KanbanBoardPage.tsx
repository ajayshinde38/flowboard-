import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Kanban as KanbanIcon, Plus, Search, X } from 'lucide-react';
import { PRIORITIES, PRIORITY_META } from '@flowboard/shared';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { useDebounce } from '@/hooks/useDebounce';
import { projectsApi, tasksApi, workspacesApi } from '@/services/api.service';
import { KanbanBoard } from './KanbanBoard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

export default function KanbanBoardPage() {
  const { workspaceId } = useAuth();
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal);

  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('all');
  const [priority, setPriority] = useState('all');
  const [assigneeId, setAssigneeId] = useState('all');
  const debouncedSearch = useDebounce(search, 200);

  const queryParams = useMemo(
    () => ({
      projectId: projectId === 'all' ? undefined : projectId,
      priority: priority === 'all' ? undefined : priority,
      assigneeId: assigneeId === 'all' ? undefined : assigneeId,
      search: debouncedSearch || undefined,
      limit: 200,
    }),
    [projectId, priority, assigneeId, debouncedSearch]
  );

  const queryKey = useMemo(
    () => ['tasks', 'kanban', workspaceId, queryParams] as const,
    [workspaceId, queryParams]
  );

  const tasksQuery = useQuery({
    queryKey,
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

  const hasFilters =
    Boolean(search) || projectId !== 'all' || priority !== 'all' || assigneeId !== 'all';

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Board</h1>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Drag tasks across To Do, In Progress, Review, and Done. Changes save automatically.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            openCreateTaskModal({
              projectId: projectId === 'all' ? undefined : projectId,
            })
          }
        >
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-surface p-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-foreground-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search board tasks..."
            className="pl-8"
            aria-label="Search board tasks"
          />
        </div>

        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[175px]" aria-label="Filter by project">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {(projectsQuery.data?.items ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by priority">
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

        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="w-[165px]" aria-label="Filter by assignee">
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

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setProjectId('all');
              setPriority('all');
              setAssigneeId('all');
            }}
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Board */}
      {tasksQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-border bg-sidebar/75 p-3"
            >
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (projectsQuery.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={KanbanIcon}
          title="No projects yet"
          description="Create a project first so you can add tasks to the board."
        />
      ) : (
        <KanbanBoard
          tasks={tasksQuery.data?.items ?? []}
          queryKey={queryKey}
          projectId={projectId === 'all' ? undefined : projectId}
        />
      )}
    </div>
  );
}
