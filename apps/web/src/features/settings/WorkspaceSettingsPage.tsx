import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { workspacesApi } from '@/services/api.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const LABEL_COLORS = ['#786CFF', '#3B82F6', '#10B981', '#EC4899', '#F59E0B', '#EF4444', '#06B6D4'];

export default function WorkspaceSettingsPage() {
  const { activeWorkspace, workspaceId, workspaces } = useAuth();
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId);
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#786CFF');
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name);
      setDescription(activeWorkspace.description ?? '');
    }
  }, [activeWorkspace]);

  const canAdmin = activeWorkspace?.role === 'OWNER' || activeWorkspace?.role === 'ADMIN';
  const isOwner = activeWorkspace?.role === 'OWNER';

  const labelsQuery = useQuery({
    queryKey: ['workspace-labels', workspaceId],
    queryFn: () => workspacesApi.listLabels(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const updateWsMutation = useMutation({
    mutationFn: () =>
      workspacesApi.update(workspaceId!, {
        name: name.trim(),
        description: description || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Workspace settings saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createWsMutation = useMutation({
    mutationFn: () =>
      workspacesApi.create({
        name: newWsName.trim(),
        description: newWsDesc.trim() || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      setActiveWorkspaceId(res.workspace.id);
      toast.success(`Switched to new workspace "${res.workspace.name}"`);
      setNewWsName('');
      setNewWsDesc('');
      setCreateWsOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteWsMutation = useMutation({
    mutationFn: () => workspacesApi.delete(workspaceId!),
    onSuccess: () => {
      const remaining = workspaces.filter((w) => w.id !== workspaceId);
      setActiveWorkspaceId(remaining[0]?.id ?? null);
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Workspace deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createLabelMutation = useMutation({
    mutationFn: () =>
      workspacesApi.createLabel(workspaceId!, {
        name: newLabelName.trim(),
        color: newLabelColor,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-labels', workspaceId] });
      setNewLabelName('');
      toast.success('Label created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: string) => workspacesApi.deleteLabel(workspaceId!, labelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-labels', workspaceId] });
      toast.success('Label removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Manage workspace details and task labels.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs">
            <Link
              to="/app/settings/profile"
              className="rounded px-3 py-1.5 font-medium text-foreground-secondary hover:text-foreground"
            >
              Profile
            </Link>
            <span className="rounded bg-accent px-3 py-1.5 font-medium text-white">Workspace</span>
          </div>
          <Button size="sm" onClick={() => setCreateWsOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Workspace
          </Button>
        </div>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>
            {canAdmin
              ? 'Update your workspace display name and description.'
              : 'Only Workspace Owners and Admins can modify these settings.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateWsMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="ws-name" className="text-xs font-medium text-foreground-secondary">
                Workspace Name
              </label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canAdmin}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ws-desc" className="text-xs font-medium text-foreground-secondary">
                Description
              </label>
              <Textarea
                id="ws-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canAdmin}
              />
            </div>

            {canAdmin && (
              <div className="flex justify-end">
                <Button type="submit" disabled={updateWsMutation.isPending}>
                  {updateWsMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Labels Manager */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-accent" />
            Task Labels
          </CardTitle>
          <CardDescription>Organize tasks by discipline, category, or severity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newLabelName.trim()) return;
              createLabelMutation.mutate();
            }}
            className="flex flex-wrap items-center gap-2.5"
          >
            <Input
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="New label name (e.g., Mobile)"
              className="flex-1 min-w-[180px]"
            />
            <div className="flex items-center gap-1.5">
              {LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Pick color ${c}`}
                  onClick={() => setNewLabelColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-5 w-5 rounded-full ${
                    newLabelColor === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface' : ''
                  }`}
                />
              ))}
            </div>
            <Button type="submit" size="sm" disabled={!newLabelName.trim() || createLabelMutation.isPending}>
              Add Label
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {(labelsQuery.data?.items ?? []).map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated/50 px-2.5 py-1 text-xs font-medium"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                {label.name}
                {canAdmin && (
                  <button
                    type="button"
                    aria-label={`Delete label ${label.name}`}
                    onClick={() => deleteLabelMutation.mutate(label.id)}
                    className="ml-1 text-foreground-muted hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {isOwner && workspaces.length > 1 && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-500">Danger Zone</CardTitle>
            <CardDescription>
              Permanently delete this workspace and all projects, tasks, and activity inside it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete Workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{activeWorkspace?.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is irreversible and removes all projects, tasks, and comments in
                    this workspace.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteWsMutation.mutate()}>
                    Permanently Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Create Workspace Modal */}
      <Dialog open={createWsOpen} onOpenChange={setCreateWsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Each workspace has isolated projects, tasks, analytics, and team permissions.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newWsName.trim()) return;
              createWsMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="new-ws-name" className="text-xs font-medium text-foreground-secondary">
                Workspace Name
              </label>
              <Input
                id="new-ws-name"
                required
                placeholder="e.g., Platform Engineering"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-ws-desc" className="text-xs font-medium text-foreground-secondary">
                Description (optional)
              </label>
              <Textarea
                id="new-ws-desc"
                rows={2}
                value={newWsDesc}
                onChange={(e) => setNewWsDesc(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateWsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createWsMutation.isPending}>
                {createWsMutation.isPending ? 'Creating...' : 'Create Workspace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
