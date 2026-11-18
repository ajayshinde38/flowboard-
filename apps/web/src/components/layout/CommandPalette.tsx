import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  CheckSquare,
  FolderKanban,
  FolderPlus,
  Kanban,
  LayoutDashboard,
  Moon,
  Plus,
  Search,
  Sun,
  User,
  Users,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useUIStore } from '@/stores/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { projectsApi } from '@/services/api.service';

export function CommandPalette() {
  const navigate = useNavigate();
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal);
  const setCreateProjectModalOpen = useUIStore((s) => s.setCreateProjectModalOpen);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId);

  const { workspaceId, workspaces } = useAuth();

  const { data: projectsData } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: () => projectsApi.list(workspaceId!),
    enabled: Boolean(workspaceId) && open,
  });

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const navItems = [
    { label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard },
    { label: 'My Tasks', to: '/app/tasks', icon: CheckSquare },
    { label: 'Projects', to: '/app/projects', icon: FolderKanban },
    { label: 'Board', to: '/app/kanban', icon: Kanban },
    { label: 'Team', to: '/app/team', icon: Users },
    { label: 'Reports', to: '/app/analytics', icon: BarChart3 },
    { label: 'Notifications', to: '/app/notifications', icon: Bell },
    { label: 'Settings', to: '/app/settings/profile', icon: User },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Global Command Palette</DialogTitle>
        <Command className="flex flex-col bg-surface text-foreground">
          <div className="flex items-center border-b border-border px-3.5">
            <Search className="mr-2.5 h-4 w-4 shrink-0 text-foreground-muted" />
            <Command.Input
              placeholder="Jump to a page, project, or run an action..."
              className="flex h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted"
            />
            <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-xs text-foreground-secondary">
              No matching commands or pages found.
            </Command.Empty>

            <Command.Group
              heading="Quick Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-foreground-muted"
            >
              <Command.Item
                onSelect={() => run(() => openCreateTaskModal())}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-elevated"
              >
                <Plus className="h-4 w-4 text-accent" />
                <span>Create New Task</span>
                <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted">
                  C
                </kbd>
              </Command.Item>
              <Command.Item
                onSelect={() => run(() => setCreateProjectModalOpen(true))}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-elevated"
              >
                <FolderPlus className="h-4 w-4 text-accent" />
                <span>Create New Project</span>
              </Command.Item>
              <Command.Item
                onSelect={() => run(() => toggleTheme())}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-elevated"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-500" />
                )}
                <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
              </Command.Item>
            </Command.Group>

            {projectsData && projectsData.items.length > 0 && (
              <Command.Group
                heading="Projects"
                className="mt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-foreground-muted"
              >
                {projectsData.items.map((proj) => (
                  <Command.Item
                    key={proj.id}
                    value={`project ${proj.name} ${proj.key}`}
                    onSelect={() => run(() => navigate(`/app/projects/${proj.id}`))}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-elevated"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span className="truncate">{proj.name}</span>
                    <span className="ml-auto font-mono text-[11px] text-foreground-muted">
                      {proj.key}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading="Navigation"
              className="mt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-foreground-muted"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.to}
                    value={item.label}
                    onSelect={() => run(() => navigate(item.to))}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-elevated"
                  >
                    <Icon className="h-4 w-4 text-foreground-secondary" />
                    <span>{item.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {workspaces.length > 1 && (
              <Command.Group
                heading="Switch Workspace"
                className="mt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-foreground-muted"
              >
                {workspaces.map((ws) => (
                  <Command.Item
                    key={ws.id}
                    value={`workspace ${ws.name}`}
                    onSelect={() => run(() => setActiveWorkspaceId(ws.id))}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-elevated"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-accent/20 text-[10px] font-semibold text-accent">
                      {ws.name[0]?.toUpperCase()}
                    </span>
                    <span className="truncate">{ws.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
