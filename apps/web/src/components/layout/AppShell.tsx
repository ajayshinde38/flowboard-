import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Check,
  CheckSquare,
  ChevronDown,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User,
  Users,
} from 'lucide-react';
import { useAuth, useLogoutMutation } from '@/hooks/useAuth';
import { useSocketSync } from '@/hooks/useSocketSync';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUIStore } from '@/stores/uiStore';
import { BrandLogo } from './BrandLogo';
import { CommandPalette } from './CommandPalette';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateTaskModal } from '@/components/shared/CreateTaskModal';
import { CreateProjectModal } from '@/components/shared/CreateProjectModal';
import { TaskDetailDrawer } from '@/components/shared/TaskDetailDrawer';
import { cn } from '@/lib/utils';

const MAIN_NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/tasks', label: 'My Tasks', icon: CheckSquare },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban },
  { to: '/app/kanban', label: 'Board', icon: Kanban },
  { to: '/app/team', label: 'Team', icon: Users },
  { to: '/app/analytics', label: 'Reports', icon: BarChart3 },
  { to: '/app/settings/profile', label: 'Settings', icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { workspaces, activeWorkspace } = useAuth();
  const setActiveWorkspaceId = useUIStore((s) => s.setActiveWorkspaceId);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <Link to="/app/dashboard" onClick={onNavigate} className="min-w-0">
          <BrandLogo />
        </Link>
      </div>

      {/* Workspace Switcher */}
      <div className="border-b border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Switch workspace"
              className="flex w-full items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:border-border-strong"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent-muted text-xs font-semibold text-accent">
                {activeWorkspace?.name?.[0]?.toUpperCase() || 'W'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {activeWorkspace?.name || 'Workspace'}
                </p>
                <p className="truncate text-[11px] text-foreground-secondary">
                  {activeWorkspace?.memberCount ?? 1} member
                  {(activeWorkspace?.memberCount ?? 1) !== 1 ? 's' : ''}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onSelect={() => setActiveWorkspaceId(ws.id)}
                className="justify-between"
              >
                <span className="truncate text-xs font-medium">{ws.name}</span>
                {ws.id === activeWorkspace?.id && <Check className="h-3.5 w-3.5 text-accent" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/app/settings/workspace" onClick={onNavigate}>
                <Settings className="h-3.5 w-3.5 text-foreground-secondary" />
                <span className="text-xs">Workspace Settings</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main 7-Item Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {MAIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-white shadow-subtle'
                        : 'text-foreground-secondary hover:bg-surface hover:text-foreground'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const { user, workspaceId, unreadNotifications } = useAuth();
  const logout = useLogoutMutation();

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal);

  useSocketSync(workspaceId, user?.id ?? null);
  useKeyboardShortcuts(Boolean(user));

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate('/login');
  };

  return (
    <div className="app-layout min-h-screen bg-background text-foreground">
      {/* Fixed Desktop Sidebar (240px, full viewport height, does not scroll with page) */}
      <aside
        data-testid="desktop-sidebar"
        className="app-sidebar hidden border-r border-border bg-sidebar lg:block"
      >
        <SidebarContent />
      </aside>

      {/* Mobile Navigation Drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Independently Scrollable Main Content Column */}
      <div data-testid="main-scroll-container" className="app-main flex min-w-0 flex-1 flex-col">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground sm:w-64"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
              <span className="hidden truncate sm:inline">Quick search...</span>
              <kbd className="ml-auto hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted sm:inline">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => openCreateTaskModal()}
              className="gap-1.5"
              data-testid="topbar-new-task-btn"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Task</span>
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              asChild
              className="relative"
              aria-label="Notifications"
            >
              <Link to="/app/notifications">
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
                )}
              </Link>
            </Button>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="flex items-center gap-2 rounded-full p-0.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <UserAvatar name={user.name} color={user.avatarColor} size="md" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2.5 py-2">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-foreground-secondary">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/app/settings/profile">
                      <User className="h-4 w-4 text-foreground-secondary" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void handleLogout()}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Main Page Content */}
        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Global Dialogs & Drawer */}
      <CommandPalette />
      <CreateTaskModal />
      <CreateProjectModal />
      <TaskDetailDrawer />
    </div>
  );
}
