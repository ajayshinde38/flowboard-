import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Archive,
  Calendar,
  FolderKanban,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  PRIORITIES,
  PRIORITY_META,
  PROJECT_STATUS_META,
  PROJECT_STATUSES,
  type ProjectDTO,
} from '@flowboard/shared';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { useDebounce } from '@/hooks/useDebounce';
import { projectsApi } from '@/services/api.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PriorityBadge, ProjectStatusBadge } from '@/components/ui/status-badge';
import { UserAvatar } from '@/components/ui/avatar';
import { formatShortDate } from '@/lib/utils';

export default function ProjectsPage() {
  const { workspaceId } = useAuth();
  const setCreateProjectModalOpen = useUIStore((s) => s.setCreateProjectModalOpen);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDTO | null>(null);
  const debouncedSearch = useDebounce(search, 200);

  const projectsQuery = useQuery({
    queryKey: ['projects', workspaceId, { debouncedSearch, status, priority, showArchived }],
    queryFn: () =>
      projectsApi.list(workspaceId!, {
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
        priority: priority === 'all' ? undefined : priority,
        includeArchived: showArchived,
      }),
    enabled: Boolean(workspaceId),
  });

  const archiveMutation = useMutation({
    mutationFn: (proj: ProjectDTO) =>
      projectsApi.update(proj.id, {
        status: proj.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED',
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      toast.success(
        res.project.status === 'ARCHIVED'
          ? `Archived "${res.project.name}"`
          : `Restored "${res.project.name}"`
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      toast.success('Project deleted');
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const projects = projectsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Manage roadmaps, assign teammates, and track delivery progress across initiatives.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateProjectModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-surface p-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-foreground-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="pl-8"
            aria-label="Search projects"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]" aria-label="Filter projects by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Active</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PROJECT_STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[140px]" aria-label="Filter projects by priority">
            <SelectValue placeholder="Priority" />
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

        <Button
          variant={showArchived ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setShowArchived((v) => !v)}
          className="text-xs"
        >
          <Archive className="h-3.5 w-3.5" />
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </Button>
      </div>

      {/* Projects Grid */}
      {projectsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="space-y-4 p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-2 w-full" />
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Create a new project to organize tasks, deadlines, and team collaboration."
          action={
            <Button size="sm" onClick={() => setCreateProjectModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Create Project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((proj) => (
            <Card
              key={proj.id}
              className="group flex flex-col justify-between p-5 transition-all hover:border-border-strong"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/app/projects/${proj.id}`}
                    className="flex min-w-0 items-center gap-2.5"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white"
                      style={{ backgroundColor: proj.color }}
                    >
                      {proj.key}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                        {proj.name}
                      </h2>
                      <p className="text-[11px] text-foreground-muted">
                        Owner: {proj.owner.name}
                      </p>
                    </div>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Project actions for ${proj.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/app/projects/${proj.id}`}>Open Project</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => archiveMutation.mutate(proj)}>
                        <Archive className="h-3.5 w-3.5" />
                        {proj.status === 'ARCHIVED' ? 'Restore Project' : 'Archive Project'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => setDeleteTarget(proj)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="mt-3 line-clamp-2 min-h-[36px] text-xs leading-relaxed text-foreground-secondary">
                  {proj.description || 'No project description provided.'}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ProjectStatusBadge status={proj.status} />
                  <PriorityBadge priority={proj.priority} />
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t border-border pt-4">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground-secondary">
                      {proj.completedTaskCount} / {proj.taskCount} tasks completed
                    </span>
                    <span className="font-mono font-semibold tabular-nums">{proj.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${proj.progress}%`, backgroundColor: proj.color }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {proj.members.slice(0, 4).map((m) => (
                      <UserAvatar
                        key={m.userId}
                        name={m.user.name}
                        color={m.user.avatarColor}
                        size="xs"
                        className="ring-2 ring-surface"
                      />
                    ))}
                    {proj.members.length > 4 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-elevated text-[10px] font-medium text-foreground-secondary ring-2 ring-surface">
                        +{proj.members.length - 4}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                    <Calendar className="h-3 w-3" />
                    {proj.dueDate ? `Due ${formatShortDate(proj.dueDate)}` : 'No deadline'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project and all {deleteTarget?.taskCount ?? 0} tasks
              inside it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
