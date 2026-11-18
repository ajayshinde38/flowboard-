import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shield, Trash2, UserPlus, Users } from 'lucide-react';
import { WORKSPACE_ROLES, type WorkspaceRole } from '@flowboard/shared';
import { useAuth } from '@/hooks/useAuth';
import { workspacesApi } from '@/services/api.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { formatShortDate } from '@/lib/utils';

export default function TeamMembersPage() {
  const { workspaceId, activeWorkspace, user } = useAuth();
  const qc = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('MEMBER');

  const canManage = activeWorkspace?.role === 'OWNER' || activeWorkspace?.role === 'ADMIN';

  const membersQuery = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      workspacesApi.inviteMember(workspaceId!, {
        email: inviteEmail.trim(),
        role: inviteRole,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success(
        res.provisioned
          ? `Provisioned & added ${res.member.user.email} to workspace`
          : `Added ${res.member.user.name} to workspace`
      );
      setInviteEmail('');
      setInviteRole('MEMBER');
      setInviteOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: WorkspaceRole }) =>
      workspacesApi.updateMemberRole(workspaceId!, memberId, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      toast.success('Member role updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => workspacesApi.removeMember(workspaceId!, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Member removed from workspace');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const members = membersQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            View team members, manage roles, and see assigned task progress.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Add Member
          </Button>
        )}
      </div>

      {membersQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teammates yet"
          description="Invite your team to collaborate on projects and tasks."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const assigned = m.assignedTaskCount ?? 0;
            const completed = m.completedTaskCount ?? 0;
            const pct = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

            return (
              <Card key={m.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={m.user.name} color={m.user.avatarColor} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {m.user.name}{' '}
                          {m.userId === user?.id && (
                            <span className="text-xs font-normal text-foreground-muted">(You)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-foreground-secondary">{m.user.email}</p>
                        {m.user.jobTitle && (
                          <p className="mt-0.5 truncate text-[11px] text-foreground-muted">
                            {m.user.jobTitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Badge
                      variant={
                        m.role === 'OWNER'
                          ? 'default'
                          : m.role === 'ADMIN'
                            ? 'warning'
                            : 'secondary'
                      }
                    >
                      <Shield className="h-3 w-3" />
                      {m.role}
                    </Badge>
                    <span className="text-[11px] text-foreground-muted">
                      Joined {formatShortDate(m.joinedAt)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground-secondary">Task completion</span>
                      <span className="font-mono tabular-nums">
                        {completed}/{assigned} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {canManage && m.role !== 'OWNER' && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Select
                        value={m.role}
                        onValueChange={(val) =>
                          roleMutation.mutate({ memberId: m.id, role: val as WorkspaceRole })
                        }
                      >
                        <SelectTrigger className="h-8 w-32 text-xs" aria-label={`Role for ${m.user.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKSPACE_ROLES.filter((r) => r !== 'OWNER').map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${m.user.name}`}
                            className="text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {m.user.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              They will lose access to this workspace and its private projects.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeMutation.mutate(m.id)}>
                              Remove Member
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add an existing FlowBoard user by email or provision a teammate account for this
              workspace.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!inviteEmail.trim()) return;
              inviteMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="invite-email" className="text-xs font-medium text-foreground-secondary">
                Email Address
              </label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground-secondary">Role</label>
              <Select
                value={inviteRole}
                onValueChange={(val) => setInviteRole(val as WorkspaceRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member — Create &amp; edit projects/tasks</SelectItem>
                  <SelectItem value="ADMIN">Admin — Manage members &amp; settings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? 'Adding...' : 'Add to Workspace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
