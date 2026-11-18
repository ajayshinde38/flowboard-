import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListTodo,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { analyticsApi, tasksApi, workspacesApi } from '@/services/api.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/avatar';
import { PriorityBadge, TaskStatusBadge } from '@/components/ui/status-badge';
import { cn, formatDueDate, formatRelativeTime, isTaskOverdue } from '@/lib/utils';

const StatusDistributionChart = lazy(() =>
  import('./DashboardCharts').then((m) => ({ default: m.StatusDistributionChart }))
);

export default function OverviewDashboardPage() {
  const { workspaceId, user, activeWorkspace } = useAuth();
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal);
  const setCreateProjectModalOpen = useUIStore((s) => s.setCreateProjectModalOpen);
  const openTaskDrawer = useUIStore((s) => s.openTaskDrawer);
  const qc = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ['analytics', 'overview', workspaceId],
    queryFn: () => analyticsApi.overview(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const progressQuery = useQuery({
    queryKey: ['analytics', 'project-progress', workspaceId],
    queryFn: () => analyticsApi.projectProgress(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const myTasksQuery = useQuery({
    queryKey: ['tasks', workspaceId, 'my-assigned'],
    queryFn: () =>
      tasksApi.list(workspaceId!, {
        assigneeId: 'me',
        limit: 6,
        sortBy: 'dueDate',
        sortDir: 'asc',
      }),
    enabled: Boolean(workspaceId),
  });

  const activityQuery = useQuery({
    queryKey: ['activity', workspaceId, 'recent'],
    queryFn: () => workspacesApi.listActivity(workspaceId!, { limit: 6 }),
    enabled: Boolean(workspaceId),
  });

  const markCompleteMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.update(taskId, { status: 'DONE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Task marked complete');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const kpis = overviewQuery.data?.kpis;
  const statusDist = overviewQuery.data?.statusDistribution ?? [];
  const inProgressCount =
    (statusDist.find((s) => s.status === 'IN_PROGRESS')?.count ?? 0) +
    (statusDist.find((s) => s.status === 'IN_REVIEW')?.count ?? 0);
  const pendingCount =
    (statusDist.find((s) => s.status === 'TODO')?.count ?? 0) +
    (statusDist.find((s) => s.status === 'BACKLOG')?.count ?? 0);

  const statCards = [
    {
      label: 'Total Projects',
      value: kpis?.totalProjects ?? 0,
      note: `${kpis?.activeProjects ?? 0} active`,
      icon: FolderKanban,
      iconStyle: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
    },
    {
      label: 'Active Tasks',
      value: inProgressCount,
      note: 'In Progress & Review',
      icon: Clock,
      iconStyle: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    },
    {
      label: 'Completed Tasks',
      value: kpis?.completedTasks ?? 0,
      note: `${kpis?.completionRate ?? 0}% of all tasks`,
      icon: CheckCircle2,
      iconStyle: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    },
    {
      label: 'Pending Tasks',
      value: pendingCount,
      note: kpis?.overdueTasks ? `${kpis.overdueTasks} overdue` : 'Waiting to start',
      icon: ListTodo,
      iconStyle: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    },
  ];

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Welcome back, {firstName}. Here is what is happening in{' '}
            <span className="font-medium text-foreground">{activeWorkspace?.name}</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCreateProjectModalOpen(true)}>
            <FolderKanban className="h-4 w-4" />
            New Project
          </Button>
          <Button size="sm" onClick={() => openCreateTaskModal()}>
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* 4 Primary Statistic Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewQuery.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-7 w-16" />
                <Skeleton className="mt-2 h-3 w-24" />
              </Card>
            ))
          : statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground-secondary">
                      {stat.label}
                    </span>
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md',
                        stat.iconStyle
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-foreground-secondary">{stat.note}</p>
                </Card>
              );
            })}
      </div>

      {/* My Tasks + Simple Task Progress Chart */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>My Tasks</CardTitle>
              <CardDescription>Tasks assigned to you, sorted by due date</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/app/tasks">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {myTasksQuery.isLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (myTasksQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No tasks assigned to you"
                description="Create a task or pick one up from the Board to get started."
                action={
                  <Button size="sm" onClick={() => openCreateTaskModal()}>
                    Add Task
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {myTasksQuery.data!.items.map((task) => {
                  const overdue = isTaskOverdue(task.dueDate, task.status);
                  const isDone = task.status === 'DONE';
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => openTaskDrawer(task.id)}
                        className="min-w-0 flex-1 text-left hover:text-accent transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-foreground-secondary">
                            {task.identifier}
                          </span>
                          <span
                            className={cn(
                              'truncate text-sm font-medium',
                              isDone && 'line-through text-foreground-secondary'
                            )}
                          >
                            {task.title}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-foreground-secondary">
                          <span>{task.project.name}</span>
                          {task.dueDate && (
                            <span className={cn(overdue && 'font-medium text-red-600 dark:text-red-400')}>
                              · Due {formatDueDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        <PriorityBadge priority={task.priority} compact />
                        <TaskStatusBadge status={task.status} className="hidden sm:inline-flex" />
                        {!isDone && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            title="Mark Complete"
                            aria-label={`Mark ${task.identifier} complete`}
                            disabled={markCompleteMutation.isPending}
                            onClick={() => markCompleteMutation.mutate(task.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline">Mark Complete</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Task Progress</CardTitle>
              <CardDescription>Number of tasks in each board stage</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/app/analytics">Reports</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {overviewQuery.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (kpis?.totalTasks ?? 0) === 0 ? (
              <EmptyState
                icon={ListTodo}
                title="No tasks yet"
                description="Add your first task to see progress by status."
                action={
                  <Button size="sm" onClick={() => openCreateTaskModal()}>
                    Add Task
                  </Button>
                }
              />
            ) : (
              <Suspense fallback={<Skeleton className="h-56 w-full" />}>
                <StatusDistributionChart data={statusDist} />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects + Upcoming Deadlines + Recent Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>Progress across your workspace</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/app/projects">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {progressQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (progressQuery.data?.projects.length ?? 0) === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="Create a project to start grouping tasks."
                className="py-8"
                action={
                  <Button size="sm" onClick={() => setCreateProjectModalOpen(true)}>
                    New Project
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {progressQuery.data!.projects.slice(0, 4).map((p) => (
                  <Link
                    key={p.id}
                    to={`/app/projects/${p.id}`}
                    className="block rounded-md border border-border bg-background/60 p-3 transition-colors hover:border-border-strong"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                        {p.progress}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${p.progress}%`, backgroundColor: p.color }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-foreground-secondary">
                      {p.completedTasks} of {p.totalTasks} tasks completed
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>Open tasks due soon</CardDescription>
          </CardHeader>
          <CardContent>
            {overviewQuery.isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (overviewQuery.data?.upcomingDeadlines.length ?? 0) === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No upcoming deadlines"
                description="All open tasks have plenty of time left."
                className="py-8"
              />
            ) : (
              <div className="space-y-2.5">
                {overviewQuery.data!.upcomingDeadlines.slice(0, 5).map((t) => {
                  const overdue = isTaskOverdue(t.dueDate, t.status);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTaskDrawer(t.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-left transition-colors hover:border-border-strong"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">{t.title}</p>
                        <p className="mt-0.5 text-[11px] text-foreground-secondary">
                          {t.project.name}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded px-2 py-0.5 text-[11px] font-medium tabular-nums',
                          overdue
                            ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                            : 'bg-elevated text-foreground-secondary'
                        )}
                      >
                        {formatDueDate(t.dueDate)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest team updates</CardDescription>
          </CardHeader>
          <CardContent>
            {activityQuery.isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (activityQuery.data?.items.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-xs text-foreground-secondary">
                No recent activity yet.
              </p>
            ) : (
              <div className="space-y-3">
                {activityQuery.data!.items.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 text-xs">
                    <UserAvatar name={a.actor.name} color={a.actor.avatarColor} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug text-foreground-secondary">
                        <span className="font-semibold text-foreground">{a.actor.name}</span>{' '}
                        {a.summary}
                      </p>
                      <p className="mt-0.5 text-[11px] text-foreground-muted">
                        {formatRelativeTime(a.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
