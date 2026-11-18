import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FolderKanban,
  Kanban,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PublicFooter, PublicNavbar } from '@/components/layout/PublicNavbar';
import { Button } from '@/components/ui/button';

const FEATURE_SECTIONS = [
  {
    icon: FolderKanban,
    title: 'Project Organization',
    summary: 'Group related tasks into projects with clear status, priority, deadlines, and progress.',
    bullets: [
      'Create, edit, archive, and delete projects with confirmation dialogs',
      'Track completion percentage automatically from project tasks',
      'Inspect project tasks in either a list view or a project board',
    ],
  },
  {
    icon: Kanban,
    title: '4-Column Kanban Board',
    summary: 'Track daily work visually across To Do, In Progress, Review, and Done.',
    bullets: [
      'Drag and drop cards between columns or reorder within a column',
      'Quick-move dropdown menu on every card for keyboard and mobile users',
      'Changes persist in PostgreSQL so board order stays intact after refresh',
    ],
  },
  {
    icon: CheckCircle2,
    title: 'Task Search & Filtering',
    summary: 'Find any task quickly without digging through menus.',
    bullets: [
      'Search by title or task ID and filter by status, priority, project, or assignee',
      'Select multiple tasks at once for quick status or priority updates',
      'Open any task in a clean side drawer to edit details or add comments',
    ],
  },
  {
    icon: BarChart3,
    title: 'Simple Progress Reports',
    summary: 'Answer key team questions with real numbers from the database.',
    bullets: [
      'View completed tasks, pending tasks, and project completion percentages',
      'Track task progress across columns and weekly completion trends',
      'See upcoming deadlines at a glance on the Dashboard',
    ],
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    summary: 'Coordinate clearly across developers, designers, and project leads.',
    bullets: [
      'Assign tasks to existing teammates and see each member’s workload',
      'Leave comments on tasks and get notified in the top header',
      'Switch between Light and Dark themes anytime from the header or Settings',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Authentication & Access Control',
    summary: 'Standard web security practices built into the full stack.',
    bullets: [
      'Password hashing with Argon2 and HttpOnly session cookies',
      'Protected routes that redirect signed-out visitors to the login screen',
      'Workspace membership checks on API routes to keep data separated',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicNavbar />

      <main className="flex-1">
        <section className="border-b border-border bg-surface py-14 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Features built for clear, everyday teamwork
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-foreground-secondary sm:text-base">
              FlowBoard focuses on the core tools teams actually use daily: projects, tasks, a
              four-column board, team assignment, and straightforward progress reports.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/register">
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Try Demo</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {FEATURE_SECTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-lg border border-border bg-surface p-6 shadow-card"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-muted text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-3.5 text-base font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-1 text-sm text-foreground-secondary">{item.summary}</p>
                  <ul className="mt-4 space-y-2 border-t border-border pt-3.5">
                    {item.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-xs leading-relaxed text-foreground-secondary"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
