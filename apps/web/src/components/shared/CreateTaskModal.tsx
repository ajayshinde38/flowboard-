import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  BOARD_STATUSES,
  PRIORITIES,
  PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUSES,
  type Priority,
  type TaskStatus,
} from '@flowboard/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useUIStore } from '@/stores/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi, tasksApi, workspacesApi } from '@/services/api.service';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  projectId: z.string().min(1, 'Please select a project'),
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  labelIds: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateTaskModal() {
  const open = useUIStore((s) => s.createTaskModalOpen);
  const defaults = useUIStore((s) => s.createTaskDefaults);
  const close = useUIStore((s) => s.closeCreateTaskModal);
  const { workspaceId } = useAuth();
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: () => projectsApi.list(workspaceId!),
    enabled: Boolean(workspaceId) && open,
  });

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId!),
    enabled: Boolean(workspaceId) && open,
  });

  const { data: labelsData } = useQuery({
    queryKey: ['workspace-labels', workspaceId],
    queryFn: () => workspacesApi.listLabels(workspaceId!),
    enabled: Boolean(workspaceId) && open,
  });

  const projects = useMemo(() => projectsData?.items ?? [], [projectsData?.items]);
  const members = membersData?.items ?? [];
  const labels = labelsData?.items ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectId: '',
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeId: 'unassigned',
      dueDate: '',
      labelIds: [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        projectId: defaults.projectId || projects[0]?.id || '',
        title: '',
        description: '',
        status: defaults.status || 'TODO',
        priority: 'MEDIUM',
        assigneeId: 'unassigned',
        dueDate: defaults.dueDate || '',
        labelIds: [],
      });
    }
  }, [open, defaults.projectId, defaults.status, defaults.dueDate, projects, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      tasksApi.create({
        workspaceId: workspaceId!,
        projectId: values.projectId,
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        assigneeId:
          values.assigneeId && values.assigneeId !== 'unassigned' ? values.assigneeId : null,
        dueDate: values.dueDate ? new Date(`${values.dueDate}T17:00:00.000Z`).toISOString() : null,
        labelIds: values.labelIds,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      toast.success(`Created ${res.task.identifier}: ${res.task.title}`);
      close();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create task');
    },
  });

  const selectedLabelIds = form.watch('labelIds');

  const toggleLabel = (id: string) => {
    const current = form.getValues('labelIds');
    if (current.includes(id)) {
      form.setValue(
        'labelIds',
        current.filter((x) => x !== id)
      );
    } else {
      form.setValue('labelIds', [...current, id]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? close() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            Create a new task and assign it to a project or team member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="task-title" className="text-xs font-medium text-foreground-secondary">
              Title
            </label>
            <Input
              id="task-title"
              placeholder="e.g., Implement OAuth session refresh"
              autoFocus
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-desc" className="text-xs font-medium text-foreground-secondary">
              Description
            </label>
            <Textarea
              id="task-desc"
              placeholder="Add context, acceptance criteria, or implementation notes..."
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground-secondary">Project</label>
              <Select
                value={form.watch('projectId')}
                onValueChange={(val) => form.setValue('projectId', val, { shouldValidate: true })}
              >
                <SelectTrigger aria-label="Select project">
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.key} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.projectId && (
                <p className="text-xs text-red-500">{form.formState.errors.projectId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground-secondary">Assignee</label>
              <Select
                value={form.watch('assigneeId')}
                onValueChange={(val) => form.setValue('assigneeId', val)}
              >
                <SelectTrigger aria-label="Select assignee">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground-secondary">Status</label>
              <Select
                value={form.watch('status')}
                onValueChange={(val) => form.setValue('status', val as TaskStatus)}
              >
                <SelectTrigger aria-label="Select status">
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground-secondary">Priority</label>
              <Select
                value={form.watch('priority')}
                onValueChange={(val) => form.setValue('priority', val as Priority)}
              >
                <SelectTrigger aria-label="Select priority">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="task-due" className="text-xs font-medium text-foreground-secondary">
                Due Date
              </label>
              <Input id="task-due" type="date" {...form.register('dueDate')} />
            </div>

            {labels.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-foreground-secondary">Labels</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {labels.map((label) => {
                    const active = selectedLabelIds.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggleLabel(label.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                          active
                            ? 'border-accent bg-accent-muted text-foreground'
                            : 'border-border bg-elevated/50 text-foreground-secondary hover:border-border-strong'
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

          {projects.length === 0 && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
              Create a project first before adding tasks to this workspace.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || projects.length === 0}>
              {mutation.isPending ? 'Saving...' : 'Add Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
