import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/skeleton';

// Route-level code splitting
const LandingPage = lazy(() => import('@/features/public/LandingPage'));
const FeaturesPage = lazy(() => import('@/features/public/FeaturesPage'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));

const OverviewDashboardPage = lazy(() => import('@/features/dashboard/OverviewDashboardPage'));
const MyTasksPage = lazy(() => import('@/features/tasks/MyTasksPage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/ProjectDetailPage'));
const KanbanBoardPage = lazy(() => import('@/features/kanban/KanbanBoardPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const TeamMembersPage = lazy(() => import('@/features/team/TeamMembersPage'));
const ActivityFeedPage = lazy(() => import('@/features/activity/ActivityFeedPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const WorkspaceSettingsPage = lazy(() => import('@/features/settings/WorkspaceSettingsPage'));
const ProfileSettingsPage = lazy(() => import('@/features/settings/ProfileSettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 25_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, err) => {
        if (err && typeof err === 'object' && 'status' in err) {
          const status = Number((err as { status: number }).status);
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

function PageLoader() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

function AppToaster() {
  const theme = useUIStore((s) => s.theme);
  return <Toaster theme={theme} position="bottom-right" richColors closeButton />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route
          path="/login"
          element={
            <GuestOnlyRoute>
              <LoginPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnlyRoute>
              <RegisterPage />
            </GuestOnlyRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Authenticated Application Routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<OverviewDashboardPage />} />
          <Route path="tasks" element={<MyTasksPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="kanban" element={<KanbanBoardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="team" element={<TeamMembersPage />} />
          <Route path="activity" element={<ActivityFeedPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings/workspace" element={<WorkspaceSettingsPage />} />
          <Route path="settings/profile" element={<ProfileSettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <AppToaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
