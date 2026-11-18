import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axe from 'axe-core';
import { computeNewPosition, POSITION_STEP } from '@flowboard/shared';
import LandingPage from '@/features/public/LandingPage';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import { KanbanBoard } from '@/features/kanban/KanbanBoard';
import { tasksApi } from '@/services/api.service';
import type { PaginatedResponse, TaskDTO } from '@flowboard/shared';

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

const sampleTask: TaskDTO = {
  id: 'task-1',
  workspaceId: 'ws-1',
  projectId: 'proj-1',
  identifier: 'WEB-1',
  title: 'Keep sidebar fixed while scrolling',
  description: 'Verify fixed desktop sidebar layout',
  status: 'TODO',
  priority: 'HIGH',
  position: 65536,
  version: 1,
  dueDate: null,
  completedAt: null,
  assigneeId: null,
  assignee: null,
  creatorId: 'user-1',
  creator: { id: 'user-1', name: 'Ajay Shinde', email: 'ajay@demo.flowboard.local', avatarColor: '#2563EB' },
  project: { id: 'proj-1', name: 'Website Redesign', key: 'WEB', color: '#2563EB' },
  labels: [{ id: 'lbl-1', workspaceId: 'ws-1', name: 'Frontend', color: '#2563EB' }],
  commentCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('FlowBoard Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders LandingPage hero and switches Board / Dashboard preview tabs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Keep your projects, tasks, and team organized/i
    );
    expect(screen.getByRole('tab', { name: 'Board View' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Dashboard' }));
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
  });

  it('validates LoginPage inputs and fills local demo credentials (ajay / ajay)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, '/login');

    await user.click(screen.getByRole('button', { name: /^Sign in$/i }));
    expect(await screen.findByText(/valid email address or demo username/i)).toBeInTheDocument();
    expect(await screen.findByText(/Password is required/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Fill Demo/i }));
    expect(screen.getByLabelText(/Email or Demo Username/i)).toHaveValue('ajay');
    expect(screen.getByLabelText(/^Password$/i)).toHaveValue('ajay');
  });

  it('validates strong password requirements on RegisterPage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, '/register');

    await user.type(screen.getByLabelText(/Full Name/i), 'Sam Dev');
    await user.type(screen.getByLabelText(/Work Email/i), 'sam@example.com');
    await user.type(screen.getByLabelText(/^Password$/i), 'weak');
    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('computes stable fractional board positions and detects tight gaps', () => {
    const first = computeNewPosition(null, null);
    expect(first.position).toBe(POSITION_STEP);
    expect(first.needsRebalance).toBe(false);

    const mid = computeNewPosition(65536, 131072);
    expect(mid.position).toBe(98304);
    expect(mid.needsRebalance).toBe(false);

    const tight = computeNewPosition(1.0, 1.0005);
    expect(tight.needsRebalance).toBe(true);
  });

  it('renders 4 simple board columns (To Do, In Progress, Review, Done) and rolls back on failure', async () => {
    const user = userEvent.setup();
    const moveSpy = vi
      .spyOn(tasksApi, 'move')
      .mockRejectedValueOnce(new Error('409 Conflict: Task modified by another user'));

    const queryKey = ['tasks', 'kanban', 'ws-1'] as const;
    const { qc } = renderWithProviders(
      <KanbanBoard tasks={[sampleTask]} queryKey={queryKey} />
    );

    const initialData: PaginatedResponse<TaskDTO> = {
      items: [sampleTask],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    };
    qc.setQueryData(queryKey, initialData);

    expect(screen.getByTestId('kanban-column-TODO')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-IN_REVIEW')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-DONE')).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Task actions for WEB-1/i));
    await user.click(await screen.findByRole('menuitem', { name: 'Done' }));

    await waitFor(() => {
      expect(moveSpy).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const cached = qc.getQueryData<PaginatedResponse<TaskDTO>>(queryKey);
      expect(cached?.items[0].status).toBe('TODO');
    });
  });

  it('passes axe-core WCAG accessibility checks on LoginPage with zero serious violations', async () => {
    const { container } = renderWithProviders(<LoginPage />, '/login');
    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(serious).toEqual([]);
  });
});
