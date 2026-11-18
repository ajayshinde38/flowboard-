import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Moon, Sun } from 'lucide-react';
import { useAuth, useUpdateProfileMutation } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { authApi } from '@/services/api.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const AVATAR_SWATCHES = ['#2563EB', '#0D9488', '#16A34A', '#D97706', '#4F46E5', '#DC2626', '#64748B'];

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useUIStore();
  const updateProfile = useUpdateProfileMutation();

  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [bio, setBio] = useState('');
  const [avatarColor, setAvatarColor] = useState('#786CFF');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setJobTitle(user.jobTitle ?? '');
      setBio(user.bio ?? '');
      setAvatarColor(user.avatarColor);
    }
  }, [user]);

  const passwordMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password updated successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-foreground-secondary">
            Update your profile, change your password, or switch light and dark themes.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs">
          <span className="rounded bg-accent px-3 py-1.5 font-medium text-white">Profile</span>
          <Link
            to="/app/settings/workspace"
            className="rounded px-3 py-1.5 font-medium text-foreground-secondary hover:text-foreground"
          >
            Workspace
          </Link>
        </div>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Profile</CardTitle>
          <CardDescription>Visible to teammates across your shared workspaces.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate({
                name: name.trim(),
                jobTitle: jobTitle.trim() || null,
                bio: bio.trim() || null,
                avatarColor,
              });
            }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center gap-4">
              <UserAvatar name={name || user?.name || 'U'} color={avatarColor} size="lg" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground-secondary">Avatar Color</p>
                <div className="flex items-center gap-2">
                  {AVATAR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Choose avatar color ${c}`}
                      onClick={() => setAvatarColor(c)}
                      style={{ backgroundColor: c }}
                      className={cn(
                        'h-6 w-6 rounded-full transition-transform',
                        avatarColor === c &&
                          'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-surface'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="prof-name" className="text-xs font-medium text-foreground-secondary">
                  Full Name
                </label>
                <Input id="prof-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="prof-title" className="text-xs font-medium text-foreground-secondary">
                  Job Title
                </label>
                <Input
                  id="prof-title"
                  placeholder="e.g., Senior Frontend Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prof-bio" className="text-xs font-medium text-foreground-secondary">
                Bio
              </label>
              <Textarea
                id="prof-bio"
                rows={3}
                placeholder="Tell teammates what you focus on..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred interface theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border p-3 text-sm font-medium transition-colors',
                theme === 'dark'
                  ? 'border-accent bg-accent-muted text-foreground'
                  : 'border-border bg-elevated/30 text-foreground-secondary hover:border-border-strong'
              )}
            >
              <Moon className="h-4 w-4 text-accent" />
              Dark Mode
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border p-3 text-sm font-medium transition-colors',
                theme === 'light'
                  ? 'border-accent bg-accent-muted text-foreground'
                  : 'border-border bg-elevated/30 text-foreground-secondary hover:border-border-strong'
              )}
            >
              <Sun className="h-4 w-4 text-amber-500" />
              Light Mode
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Security / Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Passwords are hashed using Argon2id. Minimum 8 characters with uppercase, lowercase, and
            a digit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              passwordMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="cur-pw" className="text-xs font-medium text-foreground-secondary">
                  Current Password
                </label>
                <Input
                  id="cur-pw"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="new-pw" className="text-xs font-medium text-foreground-secondary">
                  New Password
                </label>
                <Input
                  id="new-pw"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
