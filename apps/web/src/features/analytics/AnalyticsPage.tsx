import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { analyticsApi } from '@/services/api.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectStatusBadge } from '@/components/ui/status-badge';
import { formatShortDate } from '@/lib/utils';

const StatusDistributionChart = lazy(() =>
  import('@/features/dashboard/DashboardCharts').then((m) => ({
    default: m.StatusDistributionChart,
  }))
);
const WeeklyCompletionChart = lazy(() =>
  import('@/features/dashboard/DashboardCharts').then((m) => ({
    default: m.WeeklyCompletionChart,
  }))
);

export default function AnalyticsPage() {
  const { workspaceId } = useAuth();

  const overviewQuery = useQuery({
    queryKey: ['analytics', 'overview', workspaceId],
    queryFn: () => analyticsApi.overview(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const trendsQuery = useQuery({
    queryKey: ['analytics', 'trends', workspaceId],
    queryFn: () => analyticsApi.taskTrends(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const progressQuery = useQuery({
    queryKey: ['analytics', 'project-progress', workspaceId],
    queryFn: () => analyticsApi.projectProgress(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const isLoading = overviewQuery.isLoading || trendsQuery.isLoading || progressQuery.isLoading;
  const kpis = overviewQuery.data?.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="mt-0.5 text-sm text-foreground-secondary">
          Track completed tasks, pending work, and project progress.
        </p>
      </div>

      {/* 4 Summary Statistics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Completed Tasks', value: kpis?.completedTasks ?? 0 },
          { label: 'Pending Tasks', value: kpis?.activeTasks ?? 0 },
          { label: 'Completion Rate', value: `${kpis?.completionRate ?? 0}%` },
          { label: 'Overdue Tasks', value: kpis?.overdueTasks ?? 0 },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs font-medium text-foreground-secondary">{stat.label}</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
            )}
          </Card>
        ))}
      </div>

      {/* Two Useful Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Task Progress</CardTitle>
            <CardDescription>Tasks grouped by current board column</CardDescription>
          </CardHeader>
          <CardContent>
            {overviewQuery.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <Suspense fallback={<Skeleton className="h-56 w-full" />}>
                <StatusDistributionChart data={overviewQuery.data?.statusDistribution ?? []} />
              </Suspense>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Completed Tasks</CardTitle>
            <CardDescription>Completed vs created tasks over the last 8 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsQuery.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <Suspense fallback={<Skeleton className="h-56 w-full" />}>
                <WeeklyCompletionChart data={trendsQuery.data?.weeklyCompletion ?? []} />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle>Project Progress</CardTitle>
          <CardDescription>Task completion breakdown for every active project</CardDescription>
        </CardHeader>
        <CardContent>
          {progressQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (progressQuery.data?.projects.length ?? 0) === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No active projects"
              description="Create a project to start tracking progress here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-foreground-secondary">
                    <th className="pb-2.5 pr-4 font-medium">Project</th>
                    <th className="pb-2.5 pr-4 font-medium">Status</th>
                    <th className="pb-2.5 pr-4 font-medium">Completed</th>
                    <th className="pb-2.5 pr-4 font-medium">In Progress</th>
                    <th className="pb-2.5 pr-4 font-medium">Due Date</th>
                    <th className="pb-2.5 text-right font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {progressQuery.data!.projects.map((p) => (
                    <tr key={p.id} className="hover:bg-elevated/40">
                      <td className="py-3 pr-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <ProjectStatusBadge status={p.status} />
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-foreground-secondary">
                        {p.completedTasks} / {p.totalTasks}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-foreground-secondary">
                        {p.inProgressTasks}
                      </td>
                      <td className="py-3 pr-4 text-xs text-foreground-secondary">
                        {formatShortDate(p.dueDate)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-elevated">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${p.progress}%`, backgroundColor: p.color }}
                            />
                          </div>
                          <span className="w-9 font-mono text-xs font-semibold tabular-nums">
                            {p.progress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
