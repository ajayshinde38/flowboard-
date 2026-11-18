import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  Calendar,
  MessageSquare,
  Send,
  Tag,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import {
  BOARD_STATUSES,
  PRIORITIES,
  PRIORITY_META,
  TASK_STATUS_META,
  type Priority,
  type TaskStatus,
} from '@flowboard/shared';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUIStore } from '@/stores/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { tasksApi, workspacesApi } from '@/services/api.service';
import { cn, formatRelativeTime } from '@/lib/utils';

export function TaskDetailDrawer() {
  const taskId = useUIStore((s) => s.activeTaskId);
  const openTaskDrawer = useUIStore((s) => s.openTaskDrawer);
  const { workspaceId, user } = useAuth();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [commentText, setCommentText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!),
    enabled: Boolean(taskId),
  });

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId!),
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });

  const { data: labelsData } = useQuery({
    queryKey: ['workspace-labels', workspaceId],
    queryFn: () => workspacesApi.listLabels(workspaceId!),
    enabled: Boolean(workspaceId) && Boolean(taskId),
  });

  const task = data?.task;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [task]);

  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof tasksApi.update>[1]) =>
      tasksApi.update(taskId!, patch),
    onSuccess: (res) => {
      qc.setQueryData(['task', taskId], (old: { task: typeof res.task } | undefined) =>
        old ? { task: { ...old.task, ...res.task } } : { task: res.task }
      );
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update task');
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(taskId!),
    onSuccess: () => {
      const deletedId = taskId;
      openTaskDrawer(null);
      if (deletedId) qc.removeQueries({ queryKey: ['task', deletedId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Task deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete task'),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => tasksApi.addComment(taskId!, { content }),
    onSuccess: () => {
      setCommentText('');
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to post comment'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(taskId!, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const saveTextFields = () => {
    if (!task) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      setTitle(task.title);
      return;
    }
    if (trimmedTitle !== task.title || description !== (task.description ?? '')) {
      updateMutation.mutate({
        title: trimmedTitle,
        description: description || null,
      });
    }
  };

  const toggleLabel = (labelId: string) => {
    if (!task) return;
    const current = task.labels.map((l) => l.id);
    const next = current.includes(labelId)
      ? current.filter((x) => x !== labelId)
      : [...current, labelId];
    updateMutation.mutate({ labelIds: next });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim());
  };

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => (!open ? openTaskDrawer(null) : undefined)}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto p-0">
        <SheetTitle className="sr-only">
          {task ? `Task ${task.identifier}: ${task.title}` : 'Task Details'}
        </SheetTitle>
        <SheetDescription className="sr-only">
          View and edit task details, comments, and activity history
        </SheetDescription>

        {isLoading || !task ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 pr-14">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: task.project.color }}
                />
                <span className="text-xs font-medium text-foreground-secondary">
                  {task.project.name}
                </span>
                <span className="text-foreground-muted">/</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {task.identifier}
                </span>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-500"
                    data-testid="delete-task-trigger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {task.identifier}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes "{task.title}" and all associated comments. This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                      Delete Task
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {/* Editable Title & Description */}
              <div className="space-y-3">
                <Input
                  aria-label="Task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTextFields}
                  className="h-auto border-transparent bg-transparent px-1 py-1 text-lg font-semibold shadow-none hover:border-border focus-visible:border-accent focus-visible:bg-surface"
                />
                <Textarea
                  aria-label="Task description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveTextFields}
                  rows={4}
                  placeholder="Add a detailed description..."
                  className="resize-y border-border/70 bg-elevated/30 text-sm"
                />
              </div>

              {/* Metadata Properties Grid */}
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-elevated/30 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                    Status
                  </span>
                  <Select
                    value={task.status}
                    onValueChange={(val) => updateMutation.mutate({ status: val as TaskStatus })}
                  >
                    <SelectTrigger aria-label="Task status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOARD_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TASK_STATUS_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                    Priority
                  </span>
                  <Select
                    value={task.priority}
                    onValueChange={(val) => updateMutation.mutate({ priority: val as Priority })}
                  >
                    <SelectTrigger aria-label="Task priority">
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

                <div className="space-y-1">
                  <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                    <UserIcon className="h-3 w-3" /> Assignee
                  </span>
                  <Select
                    value={task.assigneeId ?? 'unassigned'}
                    onValueChange={(val) =>
                      updateMutation.mutate({
                        assigneeId: val === 'unassigned' ? null : val,
                      })
                    }
                  >
                    <SelectTrigger aria-label="Task assignee">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(membersData?.items ?? []).map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                    <Calendar className="h-3 w-3" /> Due Date
                  </span>
                  <Input
                    type="date"
                    aria-label="Task due date"
                    value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                    onChange={(e) =>
                      updateMutation.mutate({
                        dueDate: e.target.value
                          ? new Date(`${e.target.value}T17:00:00.000Z`).toISOString()
                          : null,
                      })
                    }
                  />
                </div>

                {/* Labels */}
                {(labelsData?.items?.length ?? 0) > 0 && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                      <Tag className="h-3 w-3" /> Labels
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(labelsData?.items ?? []).map((label) => {
                        const active = task.labels.some((l) => l.id === label.id);
                        return (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => toggleLabel(label.id)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                              active
                                ? 'border-accent bg-accent-muted text-foreground'
                                : 'border-border bg-surface text-foreground-secondary hover:border-border-strong'
                            )}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: label.color }}
                            />
                            {label.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Comments & Activity Tabs */}
              <Tabs defaultValue="comments">
                <TabsList>
                  <TabsTrigger value="comments" className="gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Comments ({task.comments?.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Activity ({task.activities?.length ?? 0})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="space-y-4">
                  <form onSubmit={handleCommentSubmit} className="space-y-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment or update for your team..."
                      rows={2}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!commentText.trim() || commentMutation.isPending}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {commentMutation.isPending ? 'Posting...' : 'Comment'}
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {(task.comments ?? []).length === 0 ? (
                      <p className="py-4 text-center text-xs text-foreground-muted">
                        No comments yet. Start the discussion above.
                      </p>
                    ) : (
                      (task.comments ?? []).map((c) => (
                        <div
                          key={c.id}
                          className="rounded-lg border border-border bg-elevated/35 p-3.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={c.author.name}
                                color={c.author.avatarColor}
                                size="xs"
                              />
                              <span className="text-xs font-semibold text-foreground">
                                {c.author.name}
                              </span>
                              <span className="text-[11px] text-foreground-muted">
                                {formatRelativeTime(c.createdAt)}
                              </span>
                            </div>
                            {c.authorId === user?.id && (
                              <button
                                type="button"
                                aria-label="Delete comment"
                                onClick={() => deleteCommentMutation.mutate(c.id)}
                                className="rounded p-1 text-foreground-muted hover:bg-elevated hover:text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground-secondary">
                            {c.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="space-y-2.5">
                  {(task.activities ?? []).length === 0 ? (
                    <p className="py-4 text-center text-xs text-foreground-muted">
                      No activity recorded for this task yet.
                    </p>
                  ) : (
                    (task.activities ?? []).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-2.5 rounded-md border border-border/60 bg-elevated/25 px-3 py-2.5 text-xs"
                      >
                        <UserAvatar
                          name={a.actor.name}
                          color={a.actor.avatarColor}
                          size="xs"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground">{a.actor.name}</span>{' '}
                          <span className="text-foreground-secondary">{a.summary}</span>
                          <p className="mt-0.5 text-[11px] text-foreground-muted">
                            {formatRelativeTime(a.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
