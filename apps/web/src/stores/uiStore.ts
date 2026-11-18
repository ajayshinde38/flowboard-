import { create } from 'zustand';
import type { TaskStatus } from '@flowboard/shared';

type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('flowboard_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
}

function applyThemeClass(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0F172A' : '#F8FAFC');
  }
}

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandPaletteOpen: boolean;
  activeWorkspaceId: string | null;
  activeTaskId: string | null;
  createTaskModalOpen: boolean;
  createTaskDefaults: {
    status?: TaskStatus;
    projectId?: string;
    dueDate?: string;
  };
  createProjectModalOpen: boolean;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  openTaskDrawer: (taskId: string | null) => void;
  openCreateTaskModal: (defaults?: {
    status?: TaskStatus;
    projectId?: string;
    dueDate?: string;
  }) => void;
  closeCreateTaskModal: () => void;
  setCreateProjectModalOpen: (open: boolean) => void;
}

const initialTheme = getInitialTheme();
applyThemeClass(initialTheme);

export const useUIStore = create<UIState>((set) => ({
  theme: initialTheme,
  sidebarCollapsed: false,
  mobileNavOpen: false,
  commandPaletteOpen: false,
  activeWorkspaceId:
    typeof window !== 'undefined' ? window.localStorage.getItem('flowboard_workspace_id') : null,
  activeTaskId: null,
  createTaskModalOpen: false,
  createTaskDefaults: {},
  createProjectModalOpen: false,

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('flowboard_theme', theme);
    }
    applyThemeClass(theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('flowboard_theme', next);
      }
      applyThemeClass(next);
      return { theme: next };
    }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveWorkspaceId: (id) => {
    if (typeof window !== 'undefined') {
      if (id) window.localStorage.setItem('flowboard_workspace_id', id);
      else window.localStorage.removeItem('flowboard_workspace_id');
    }
    set({ activeWorkspaceId: id });
  },
  openTaskDrawer: (taskId) => set({ activeTaskId: taskId }),
  openCreateTaskModal: (defaults = {}) =>
    set({ createTaskModalOpen: true, createTaskDefaults: defaults }),
  closeCreateTaskModal: () => set({ createTaskModalOpen: false, createTaskDefaults: {} }),
  setCreateProjectModalOpen: (open) => set({ createProjectModalOpen: open }),
}));
