import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { workspacesApi } from '@/services/api.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRelativeTime } from '@/lib/utils';

export default function ActivityFeedPage() {
  const { workspaceId } = useAuth();
  const openTaskDrawer = useUIStore((s) => s.openTaskDrawer);
  const [entityType, setEntityType] = useState('all');
  const [page, setPage] = useState(1);

  const activityQuery = useQuery({
    queryKey: ['activity', workspaceId, { entityType, page }],
    queryFn: () =>
      workspacesApi.listActivity(workspaceId!, {
        entityType: entityType === 'all' ? undefined : entityType,
        page,
        limit: 20,
      }),
    enabled: Boolean(workspaceId),
  });

  const items = activityQuery.data?.items ?? [];
  const pagination = activityQuery.data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Feed</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Real-time audit log of task movements, comments, projects, and membership changes.
          </p>
        </div>

        <Select
          value={entityType}
          onValueChange={(v) => {
            setEntityType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter activity by entity type">
            <SelectValue placeholder="All Activity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activity</SelectItem>
            <SelectItem value="TASK">Tasks</SelectItem>
            <SelectItem value="COMMENT">Comments</SelectItem>
            <SelectItem value="PROJECT">Projects</SelectItem>
            <SelectItem value="MEMBER">Team Members</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="divide-y divide-border overflow-hidden">
        {activityQuery.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Actions performed across projects and tasks will appear here in real time."
            />
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-elevated/30"
            >
              <div className="flex min-w-0 items-start gap-3">
                <UserAvatar name={item.actor.name} color={item.actor.avatarColor} size="md" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground-secondary">
                    <span className="font-semibold text-foreground">{item.actor.name}</span>{' '}
                    {item.summary}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {item.entityType}
                    </Badge>
                    <span className="text-xs text-foreground-muted">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                    {item.taskId && (
                      <button
                        type="button"
                        onClick={() => openTaskDrawer(item.taskId)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Inspect task
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-elevated/25 px-5 py-3 text-xs text-foreground-secondary">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} events)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
