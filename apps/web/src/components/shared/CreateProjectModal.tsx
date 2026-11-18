import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  PRIORITIES,
  PRIORITY_META,
  PROJECT_STATUS_META,
  PROJECT_STATUSES,
  type Priority,
  type ProjectStatus,
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
import { projectsApi, workspacesApi } from '@/services/api.service';
import { cn } from '@/lib/utils';

const COLOR_SWATCHES = ['#2563EB', '#0D9488', '#16A34A', '#D97706', '#4F46E5', '#DC2626', '#64748B'];

const projectFormSchema = z.object({
  name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(120),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z0-9]{2,6})?$/, '2–6 uppercase letters or digits')
    .optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(PRIORITIES),
  color: z.string(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  memberIds: z.array(z.string()),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function CreateProjectModal() {
  const open = useUIStore((s) => s.createProjectModalOpen);
  const setOpen = useUIStore((s) => s.setCreateProjectModalOpen);
  const { workspaceId, user } = useAuth();
  const qc = useQueryClient();

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId!),
    enabled: Boolean(workspaceId) && open,
  });

  const members = membersData?.items ?? [];

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      key: '',
      description: '',
      status: 'ACTIVE',
      priority: 'MEDIUM',
      color: '#2563EB',
      startDate: '',
      dueDate: '',
      memberIds: [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        key: '',
        description: '',
        status: 'ACTIVE',
        priority: 'MEDIUM',
        color: '#2563EB',
        startDate: '',
        dueDate: '',
        memberIds: user ? [user.id] : [],
      });
    }
  }, [open, user, form]);

  const mutation = useMutation({
    mutationFn: (values: ProjectFormValues) =>
      projectsApi.create({
        workspaceId: workspaceId!,
        name: values.name,
        key: values.key || undefined,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        color: values.color,
        startDate: values.startDate
          ? new Date(`${values.startDate}T09:00:00.000Z`).toISOString()
          : null,
        dueDate: values.dueDate
          ? new Date(`${values.dueDate}T17:00:00.000Z`).toISOString()
          : null,
        memberIds: values.memberIds,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      toast.success(`Project "${res.project.name}" created`);
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create project');
    },
  });

  const selectedMembers = form.watch('memberIds');
  const selectedColor = form.watch('color');

  const toggleMember = (uid: string) => {
    const cur = form.getValues('memberIds');
    if (cur.includes(uid)) {
      form.setValue(
        'memberIds',
        cur.filter((x) => x !== uid)
      );
    } else {
      form.setValue('memberIds', [...cur, uid]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Organize tasks, milestones, and teammates under a dedicated project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="proj-name" className="text-xs font-medium text-foreground-secondary">
                Project Name
              </label>
              <Input
                id="proj-name"
                placeholder="e.g., Mobile App v2"
                autoFocus
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="proj-key" className="text-xs font-medium text-foreground-secondary">
                Key (optional)
              </label>
              <Input
                id="proj-key"
                placeholder="MOB"
                maxLength={6}
                className="font-mono uppercase"
                {...form.register('key')}
              />
              {form.formState.errors.key && (
                <p className="text-xs text-red-500">{form.formState.errors.key.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="proj-desc" className="text-xs font-medium text-foreground-secondary">
              Description
            </label>
            <Textarea
              id="proj-desc"
              rows={2}
              placeholder="Goals, scope, and deliverables..."
              {...form.register('description')}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground-secondary">Status</label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as ProjectStatus)}
              >
                <SelectTrigger aria-label="Project status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.filter((s) => s !== 'ARCHIVED').map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground-secondary">Priority</label>
              <Select
                value={form.watch('priority')}
                onValueChange={(v) => form.setValue('priority', v as Priority)}
              >
                <SelectTrigger aria-label="Project priority">
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

            <div className="space-y-1.5">
              <label htmlFor="proj-start" className="text-xs font-medium text-foreground-secondary">
                Start Date
              </label>
              <Input id="proj-start" type="date" {...form.register('startDate')} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="proj-due" className="text-xs font-medium text-foreground-secondary">
                Target Due Date
              </label>
              <Input id="proj-due" type="date" {...form.register('dueDate')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-foreground-secondary">Accent Color</span>
            <div className="flex items-center gap-2 pt-0.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Select color ${c}`}
                  onClick={() => form.setValue('color', c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    'h-6 w-6 rounded-full transition-transform',
                    selectedColor === c
                      ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-surface'
                      : 'opacity-80 hover:opacity-100'
                  )}
                />
              ))}
            </div>
          </div>

          {members.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground-secondary">Project Members</span>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const active = selectedMembers.includes(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => toggleMember(m.userId)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        active
                          ? 'border-accent bg-accent-muted text-foreground'
                          : 'border-border bg-elevated/40 text-foreground-secondary hover:border-border-strong'
                      )}
                    >
                      {m.user.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
