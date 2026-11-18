import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { TASK_STATUS_META, type TaskDTO } from '@flowboard/shared';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { tasksApi } from '@/services/api.service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const { workspaceId } = useAuth();
  const openTaskDrawer = useUIStore((s) => s.openTaskDrawer);
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const tasksQuery = useQuery({
    queryKey: ['tasks', 'calendar', workspaceId],
    queryFn: () => tasksApi.list(workspaceId!, { limit: 200 }),
    enabled: Boolean(workspaceId),
  });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const list = tasksQuery.data?.items ?? [];
    const map = new Map<string, TaskDTO[]>();
    for (const t of list) {
      if (!t.dueDate) continue;
      const key = format(new Date(t.dueDate), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasksQuery.data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Visualize task deadlines across the month and schedule upcoming deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
          <div className="inline-flex items-center rounded-md border border-border bg-surface">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[132px] px-2 text-center text-sm font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={() => openCreateTaskModal()}>
            <Plus className="h-3.5 w-3.5" />
            New Task
          </Button>
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <Skeleton className="h-[540px] w-full rounded-xl" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 border-b border-border bg-elevated/40">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDate.get(key) ?? [];
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);

                  return (
                    <div
                      key={key}
                      className={cn(
                        'group min-h-[116px] border-b border-r border-border/70 p-2 transition-colors',
                        !inMonth && 'bg-elevated/20 text-foreground-muted',
                        today && 'bg-accent-muted/20'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular-nums',
                            today && 'bg-accent font-semibold text-white'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add task due ${format(day, 'MMM d')}`}
                          onClick={() => openCreateTaskModal({ dueDate: key })}
                          className="rounded p-0.5 text-foreground-muted opacity-0 transition-opacity hover:bg-elevated hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-1.5 space-y-1">
                        {dayTasks.slice(0, 3).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => openTaskDrawer(t.id)}
                            className="flex w-full items-center gap-1.5 rounded border border-border/70 bg-surface px-1.5 py-1 text-left text-[11px] font-medium shadow-subtle transition-colors hover:border-accent"
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: TASK_STATUS_META[t.status].color }}
                            />
                            <span className="truncate">{t.title}</span>
                          </button>
                        ))}
                        {dayTasks.length > 3 && (
                          <p className="px-1 text-[10px] font-medium text-foreground-muted">
                            +{dayTasks.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Unscheduled / Today summary hint */}
      {tasksQuery.data && (
        <p className="text-xs text-foreground-muted">
          Showing{' '}
          {
            tasksQuery.data.items.filter(
              (t) => t.dueDate && isSameMonth(new Date(t.dueDate), currentMonth)
            ).length
          }{' '}
          task(s) scheduled in {format(currentMonth, 'MMMM yyyy')} ·{' '}
          {
            tasksQuery.data.items.filter(
              (t) => t.dueDate && isSameDay(new Date(t.dueDate), new Date())
            ).length
          }{' '}
          due today.
        </p>
      )}
    </div>
  );
}
