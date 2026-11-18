import { useMemo, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import {
  BOARD_STATUSES,
  computeNewPosition,
  TASK_STATUS_META,
  type BoardStatus,
  type PaginatedResponse,
  type TaskDTO,
  type TaskStatus,
} from '@flowboard/shared';
import { tasksApi } from '@/services/api.service';
import { useUIStore } from '@/stores/uiStore';
import { PriorityBadge } from '@/components/ui/status-badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatShortDate, isTaskOverdue } from '@/lib/utils';

/** Map legacy BACKLOG status onto the To Do column so no tasks are ever hidden. */
function toBoardColumn(status: TaskStatus): BoardStatus {
  return status === 'BACKLOG' ? 'TODO' : status;
}

interface KanbanCardProps {
  task: TaskDTO;
  isSyncing?: boolean;
  isOverlay?: boolean;
  onQuickMove?: (task: TaskDTO, nextStatus: BoardStatus) => void;
}

function KanbanCardContent({ task, isSyncing, isOverlay, onQuickMove }: KanbanCardProps) {
  const openTaskDrawer = useUIStore((s) => s.openTaskDrawer);
  const overdue = isTaskOverdue(task.dueDate, task.status);
  const currentCol = toBoardColumn(task.status);

  return (
    <div
      className={cn(
        'group rounded-md border border-border bg-surface p-3 shadow-subtle transition-colors',
        isOverlay
          ? 'border-accent shadow-elevated'
          : 'hover:border-border-strong',
        isSyncing && 'opacity-75'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: task.project.color }}
          />
          <span className="font-mono text-[11px] font-medium text-foreground-secondary">
            {task.identifier}
          </span>
          {isSyncing && (
            <Loader2 className="h-3 w-3 animate-spin text-accent" aria-label="Saving move" />
          )}
        </div>

        {!isOverlay && onQuickMove && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Task actions for ${task.identifier}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded p-1 text-foreground-secondary transition-colors hover:bg-elevated hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openTaskDrawer(task.id)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {BOARD_STATUSES.filter((s) => s !== currentCol).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onQuickMove(task, s)}>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: TASK_STATUS_META[s].color }}
                  />
                  {TASK_STATUS_META[s].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <button
        type="button"
        onClick={() => openTaskDrawer(task.id)}
        className="mt-1.5 block w-full text-left text-sm font-medium leading-snug text-foreground hover:text-accent transition-colors"
      >
        {task.title}
      </button>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${label.color}18`,
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} compact />
          {task.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] tabular-nums',
                overdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-foreground-secondary'
              )}
            >
              <Calendar className="h-3 w-3" />
              {formatShortDate(task.dueDate)}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-foreground-secondary">
              <MessageSquare className="h-3 w-3" />
              {task.commentCount}
            </span>
          )}
        </div>

        {task.assignee ? (
          <UserAvatar name={task.assignee.name} color={task.assignee.avatarColor} size="xs" />
        ) : (
          <span className="h-5 w-5 rounded-full border border-dashed border-border-strong" />
        )}
      </div>
    </div>
  );
}

function SortableKanbanCard({
  task,
  isSyncing,
  onQuickMove,
}: {
  task: TaskDTO;
  isSyncing: boolean;
  onQuickMove: (task: TaskDTO, nextStatus: BoardStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`kanban-card-${task.identifier}`}
      className={cn('relative', isDragging && 'opacity-40')}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <KanbanCardContent task={task} isSyncing={isSyncing} onQuickMove={onQuickMove} />
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  projectId,
  syncingTaskIds,
  onQuickMove,
}: {
  status: BoardStatus;
  tasks: TaskDTO[];
  projectId?: string;
  syncingTaskIds: Set<string>;
  onQuickMove: (task: TaskDTO, nextStatus: BoardStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${status}`,
    data: { type: 'column', status },
  });
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal);
  const meta = TASK_STATUS_META[status];

  return (
    <section
      aria-label={`${meta.label} column`}
      data-testid={`kanban-column-${status}`}
      className={cn(
        'flex min-w-[270px] flex-1 flex-col rounded-lg border border-border bg-sidebar/75 transition-colors',
        isOver && 'border-accent bg-accent-muted/40'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: meta.color }}
          />
          <h2 className="text-xs font-semibold text-foreground">{meta.label}</h2>
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-foreground-secondary">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7"
          aria-label={`Add task to ${meta.label}`}
          onClick={() => openCreateTaskModal({ status, projectId })}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Cards Container */}
      <div ref={setNodeRef} className="flex min-h-[280px] flex-1 flex-col gap-2.5 p-2.5">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-border px-3 py-8 text-center">
              <p className="text-xs text-foreground-secondary">No tasks here</p>
              <button
                type="button"
                onClick={() => openCreateTaskModal({ status, projectId })}
                className="mt-1.5 text-xs font-medium text-accent hover:underline"
              >
                + Add Task
              </button>
            </div>
          ) : (
            tasks.map((task) => (
              <SortableKanbanCard
                key={task.id}
                task={task}
                isSyncing={syncingTaskIds.has(task.id)}
                onQuickMove={onQuickMove}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}

interface KanbanBoardProps {
  tasks: TaskDTO[];
  queryKey: readonly unknown[];
  projectId?: string;
}

export function KanbanBoard({ tasks, queryKey, projectId }: KanbanBoardProps) {
  const qc = useQueryClient();
  const [activeTask, setActiveTask] = useState<TaskDTO | null>(null);
  const [draftTasks, setDraftTasks] = useState<TaskDTO[] | null>(null);
  const [syncingTaskIds, setSyncingTaskIds] = useState<Set<string>>(() => new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const displayTasks = draftTasks ?? tasks;

  const grouped = useMemo(() => {
    const map: Record<BoardStatus, TaskDTO[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const t of displayTasks) {
      map[toBoardColumn(t.status)].push(t);
    }
    for (const status of BOARD_STATUSES) {
      map[status].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [displayTasks]);

  const moveMutation = useMutation({
    mutationFn: (payload: {
      taskId: string;
      status: BoardStatus;
      beforeTaskId?: string | null;
      afterTaskId?: string | null;
      expectedVersion: number;
      optimisticPosition: number;
    }) =>
      tasksApi.move(payload.taskId, {
        status: payload.status,
        beforeTaskId: payload.beforeTaskId,
        afterTaskId: payload.afterTaskId,
        expectedVersion: payload.expectedVersion,
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<PaginatedResponse<TaskDTO>>(queryKey);

      setSyncingTaskIds((prev) => new Set(prev).add(vars.taskId));

      if (previous) {
        qc.setQueryData<PaginatedResponse<TaskDTO>>(queryKey, {
          ...previous,
          items: previous.items.map((t) =>
            t.id === vars.taskId
              ? {
                  ...t,
                  status: vars.status,
                  position: vars.optimisticPosition,
                  version: t.version + 1,
                }
              : t
          ),
        });
      }

      return { previous };
    },
    onSuccess: (res) => {
      qc.setQueryData<PaginatedResponse<TaskDTO>>(queryKey, (cur) =>
        cur
          ? {
              ...cur,
              items: cur.items.map((t) => (t.id === res.task.id ? res.task : t)),
            }
          : cur
      );
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKey, ctx.previous);
      }
      toast.error(err.message || 'Could not move task — changes reverted');
      qc.invalidateQueries({ queryKey });
    },
    onSettled: (_data, _err, vars) => {
      setSyncingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.taskId);
        return next;
      });
    },
  });

  const handleQuickMove = (task: TaskDTO, nextStatus: BoardStatus) => {
    const colTasks = grouped[nextStatus];
    const lastTask = colTasks[colTasks.length - 1] ?? null;
    const { position } = computeNewPosition(lastTask?.position, null);

    moveMutation.mutate({
      taskId: task.id,
      status: nextStatus,
      beforeTaskId: lastTask?.id ?? null,
      afterTaskId: null,
      expectedVersion: task.version,
      optimisticPosition: position,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === String(event.active.id)) ?? null;
    setActiveTask(task);
    setDraftTasks(tasks);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !draftTasks) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeItem = draftTasks.find((t) => t.id === activeId);
    if (!activeItem) return;

    let targetStatus: BoardStatus | null = null;
    if (overId.startsWith('column:')) {
      targetStatus = overId.replace('column:', '') as BoardStatus;
    } else {
      const overTask = draftTasks.find((t) => t.id === overId);
      if (overTask) targetStatus = toBoardColumn(overTask.status);
    }

    if (!targetStatus || targetStatus === toBoardColumn(activeItem.status)) return;

    setDraftTasks((prev) =>
      prev
        ? prev.map((t) =>
            t.id === activeId
              ? { ...t, status: targetStatus!, position: Number.MAX_SAFE_INTEGER }
              : t
          )
        : prev
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const currentDraft = draftTasks ?? tasks;
    const originalTask = tasks.find((t) => t.id === String(active.id));

    setActiveTask(null);
    setDraftTasks(null);

    if (!over || !originalTask) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    let targetStatus: BoardStatus = toBoardColumn(originalTask.status);
    if (overId.startsWith('column:')) {
      targetStatus = overId.replace('column:', '') as BoardStatus;
    } else {
      const overTask = currentDraft.find((t) => t.id === overId);
      if (overTask) targetStatus = toBoardColumn(overTask.status);
    }

    const targetColTasks = tasks
      .filter((t) => toBoardColumn(t.status) === targetStatus && t.id !== activeId)
      .sort((a, b) => a.position - b.position);

    let insertIndex = targetColTasks.length;
    if (!overId.startsWith('column:')) {
      const overIdx = targetColTasks.findIndex((t) => t.id === overId);
      if (overIdx !== -1) {
        insertIndex = overIdx;
      }
    }

    const beforeTask = insertIndex > 0 ? targetColTasks[insertIndex - 1] : null;
    const afterTask = insertIndex < targetColTasks.length ? targetColTasks[insertIndex] : null;

    if (
      targetStatus === toBoardColumn(originalTask.status) &&
      (!beforeTask || beforeTask.position < originalTask.position) &&
      (!afterTask || originalTask.position < afterTask.position)
    ) {
      return;
    }

    const { position } = computeNewPosition(beforeTask?.position, afterTask?.position);

    moveMutation.mutate({
      taskId: originalTask.id,
      status: targetStatus,
      beforeTaskId: beforeTask?.id ?? null,
      afterTaskId: afterTask?.id ?? null,
      expectedVersion: originalTask.version,
      optimisticPosition: position,
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTask(null);
        setDraftTasks(null);
      }}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {BOARD_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={grouped[status]}
            projectId={projectId}
            syncingTaskIds={syncingTaskIds}
            onQuickMove={handleQuickMove}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <KanbanCardContent task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
