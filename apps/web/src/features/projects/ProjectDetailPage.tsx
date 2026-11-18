import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  Edit3,
  Kanban as KanbanIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  PRIORITIES,
  PRIORITY_META,
  PROJECT_STATUS_META,
  PROJECT_STATUSES,
  type Priority,
  type ProjectStatus,
} from '@flowboard/shared';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { projectsApi, tasksApi, workspacesApi } from '@/services/api.service';
import { KanbanBoard } from '@/features/kanban/KanbanBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  PriorityBadge,
  ProjectStatusBadge,
  TaskStatusBadge,
} from '@/components/ui/status-badge';
import { UserAvatar } from '@/components/ui/avatar';
import { formatDueDate, formatRelativeTime, formatShortDate } from '@/lib/utils';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal);
  const openTaskDrawer = useUIStore((s) => s.openTaskDrawer);
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('ACTIVE');
  const [editPriority, setEditPriority] = useState<Priority>('MEDIUM');
  const [editDue, setEditDue] = useState('');

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: Boolean(id),
  });

  const tasksQueryKey = useMemo(
    () => ['tasks', 'project', workspaceId, id] as const,
    [workspaceId, id]
  );

  const tasksQuery = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => tasksApi.list(workspaceId!, { projectId: id!, limit: 200 }),
    enabled: Boolean(workspaceId) && Boolean(id),
  });

  const activityQuery = useQuery({
    queryKey: ['activity', workspaceId, id],
    queryFn: () => workspacesApi.listActivity(workspaceId!, { projectId: id!, limit: 20 }),
    enabled: Boolean(workspaceId) && Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      projectsApi.update(id!, {
        name: editName.trim(),
        description: editDesc || null,
        status: editStatus,
        priority: editPriority,
        dueDate: editDue ? new Date(`${editDue}T17:00:00.000Z`).toISOString() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
      setEditOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project deleted');
      navigate('/app/projects');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const project = projectQuery.data?.project;
  const tasks = tasksQuery.data?.items ?? [];

  const openEditDialog = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description ?? '');
    setEditStatus(project.status);
    setEditPriority(project.priority);
    setEditDue(project.dueDate ? project.dueDate.slice(0, 10) : '');
    setEditOpen(true);
  };

  if (projectQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="Project not found"
        description="This project may have been deleted or belongs to another workspace."
        action={
          <Button asChild size="sm">
            <Link to="/app/projects">Back to Projects</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app/projects"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Projects
        </Link>

        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold text-white"
              style={{ backgroundColor: project.color }}
            >
              {project.key}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                <ProjectStatusBadge status={project.status} />
                <PriorityBadge priority={project.priority} />
              </div>
              <p className="mt-1 max-w-2xl text-sm text-foreground-secondary">
                {project.description || 'No description added yet.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openEditDialog}>
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button size="sm" onClick={() => openCreateTaskModal({ projectId: project.id })}>
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Delete project" className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All tasks and comments inside this project will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                    Delete Project
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Progress & Metadata Bar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground-secondary">Delivery Progress</span>
            <span className="font-mono font-semibold tabular-nums">{project.progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${project.progress}%`, backgroundColor: project.color }}
            />
          </div>
          <p className="mt-2 text-xs text-foreground-muted">
            {project.completedTaskCount} of {project.taskCount} tasks completed
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-foreground-secondary">Timeline</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
            <Calendar className="h-4 w-4 text-accent" />
            {project.dueDate ? `Target: ${formatDueDate(project.dueDate)}` : 'No target deadline'}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Started {formatShortDate(project.startDate || project.createdAt)}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-foreground-secondary">
            Project Team ({project.members.length})
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {project.members.map((m) => (
              <span
                key={m.userId}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated/50 py-0.5 pl-1 pr-2 text-xs"
              >
                <UserAvatar name={m.user.name} color={m.user.avatarColor} size="xs" />
                <span>{m.user.name.split(' ')[0]}</span>
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Tabs: Board, List, Activity */}
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board" className="gap-1.5">
            <KanbanIcon className="h-3.5 w-3.5" />
            Kanban Board
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" />
            Task List ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <KanbanBoard tasks={tasks} queryKey={tasksQueryKey} projectId={project.id} />
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardContent className="pt-5">
              {tasks.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="No tasks in this project yet"
                  description="Add your first task to start tracking progress."
                  action={
                    <Button
                      size="sm"
                      onClick={() => openCreateTaskModal({ projectId: project.id })}
                    >
                      Add Task
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-border">
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTaskDrawer(t.id)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-elevated/35 rounded-md px-2 -mx-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="font-mono text-xs text-foreground-muted">
                          {t.identifier}
                        </span>
                        <span className="truncate text-sm font-medium">{t.title}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <PriorityBadge priority={t.priority} compact />
                        <TaskStatusBadge status={t.status} />
                        {t.assignee && (
                          <UserAvatar
                            name={t.assignee.name}
                            color={t.assignee.avatarColor}
                            size="xs"
                          />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Project Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(activityQuery.data?.items.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-xs text-foreground-muted">
                  No project activity yet.
                </p>
              ) : (
                activityQuery.data!.items.map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 text-xs">
                    <UserAvatar name={a.actor.name} color={a.actor.avatarColor} size="xs" />
                    <div>
                      <span className="font-semibold">{a.actor.name}</span>{' '}
                      <span className="text-foreground-secondary">{a.summary}</span>
                      <p className="mt-0.5 text-[11px] text-foreground-muted">
                        {formatRelativeTime(a.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Project Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground-secondary">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground-secondary">Description</label>
              <Textarea rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground-secondary">Status</label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ProjectStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PROJECT_STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground-secondary">Priority</label>
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground-secondary">Due Date</label>
              <Input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
