import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationDTO } from '@flowboard/shared';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { notificationsApi } from '@/services/api.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatRelativeTime } from '@/lib/utils';

export default function NotificationsPage() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const openTaskDrawer = useUIStore((s) => s.openTaskDrawer);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const query = useQuery({
    queryKey: ['notifications', workspaceId, filter],
    queryFn: () => notificationsApi.list(workspaceId ?? undefined, filter === 'unread'),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(workspaceId ?? undefined),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success(`Marked ${res.markedCount} notification(s) as read`);
    },
  });

  const handleOpen = (n: NotificationDTO) => {
    if (!n.readAt) markOne.mutate(n.id);
    if (n.entityType === 'TASK' && n.entityId) {
      openTaskDrawer(n.entityId);
    } else if (n.entityType === 'PROJECT' && n.entityId) {
      navigate(`/app/projects/${n.entityId}`);
    }
  };

  const items = query.data?.items ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Stay up to date with assignments, mentions, and real-time comments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="secondary"
            size="sm"
            disabled={unreadCount === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
      </div>

      <Card className="divide-y divide-border overflow-hidden">
        {query.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Bell}
              title={filter === 'unread' ? 'Inbox zero' : 'No notifications yet'}
              description={
                filter === 'unread'
                  ? 'You have read all your notifications.'
                  : 'Task assignments and teammate comments will show up here.'
              }
            />
          </div>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleOpen(n)}
              className={cn(
                'flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-elevated/40',
                !n.readAt && 'bg-accent-muted/20'
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    n.readAt ? 'bg-border-strong' : 'bg-accent'
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-foreground-secondary">
                    {n.message}
                  </p>
                  <p className="mt-1 text-[11px] text-foreground-muted">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
              </div>
              {!n.readAt && (
                <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  New
                </span>
              )}
            </button>
          ))
        )}
      </Card>
    </div>
  );
}
