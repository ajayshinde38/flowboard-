import { useState } from 'react';
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
import { cn } from '@/lib/utils';

type PreviewTab = 'board' | 'dashboard';

const SAMPLE_COLUMNS = [
  {
    title: 'To Do',
    dot: '#64748B',
    items: [
      { key: 'WEB-4', title: 'Fix table padding on small screens', tag: 'Frontend' },
      { key: 'DOCS-2', title: 'Add local setup instructions', tag: 'Docs' },
    ],
  },
  {
    title: 'In Progress',
    dot: '#2563EB',
    items: [
      { key: 'PORT-2', title: 'Save drag-and-drop board order to database', tag: 'Backend' },
      { key: 'MOB-2', title: 'Add Light and Dark theme switcher', tag: 'UI' },
    ],
  },
  {
    title: 'Review',
    dot: '#D97706',
    items: [{ key: 'WEB-3', title: 'Test mobile drawer navigation', tag: 'Testing' }],
  },
  {
    title: 'Done',
    dot: '#16A34A',
    items: [
      { key: 'WEB-2', title: 'Keep desktop sidebar fixed while scrolling', tag: 'Frontend' },
      { key: 'PORT-1', title: 'Add search and status filters to tasks', tag: 'Frontend' },
    ],
  },
];

const CORE_FEATURES = [
  {
    icon: FolderKanban,
    title: 'Simple Project Tracking',
    desc: 'Create projects, set deadlines, track completion percentages, and keep related tasks organized together.',
  },
  {
    icon: Kanban,
    title: '4-Column Task Board',
    desc: 'Move tasks across To Do, In Progress, Review, and Done using drag-and-drop or quick menus.',
  },
  {
    icon: CheckCircle2,
    title: 'Clear Task Management',
    desc: 'Filter and search tasks by status, priority, project, or assignee, and inspect details in a clean side drawer.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    desc: 'Assign tasks to teammates, leave comments on tasks, and stay updated with recent activity.',
  },
  {
    icon: BarChart3,
    title: 'Useful Reports',
    desc: 'See completed tasks, pending tasks, and project progress charts built directly from live database data.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Authentication',
    desc: 'Protected routes, hashed passwords, HttpOnly session cookies, and workspace-level access checks.',
  },
];

export default function LandingPage() {
  const [previewTab, setPreviewTab] = useState<PreviewTab>('board');

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicNavbar />

      <main className="flex-1">
        {/* Clean Light-First Hero */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground-secondary">
                Simple project &amp; task management for teams
              </p>

              <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                Keep your projects, tasks, and team organized in one place.
              </h1>

              <p className="mt-4 text-base leading-relaxed text-foreground-secondary sm:text-lg">
                FlowBoard helps small teams and developers plan projects, track daily tasks on a
                clean Kanban board, and monitor progress without unnecessary clutter.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link to="/register">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                  <Link to="/login">Try Demo</Link>
                </Button>
              </div>

              <p className="mt-4 text-xs text-foreground-secondary">
                Try the live demo with username{' '}
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-foreground">
                  ajay
                </code>{' '}
                and password{' '}
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-foreground">
                  ajay
                </code>
              </p>
            </div>

            {/* Clean App Preview Card */}
            <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-lg border border-border bg-background shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="ml-1 font-medium text-foreground">Demo Workspace</span>
                </div>

                <div
                  role="tablist"
                  aria-label="Preview views"
                  className="inline-flex rounded-md border border-border bg-background p-0.5"
                >
                  {(
                    [
                      { id: 'board', label: 'Board View' },
                      { id: 'dashboard', label: 'Dashboard' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={previewTab === tab.id}
                      type="button"
                      onClick={() => setPreviewTab(tab.id)}
                      className={cn(
                        'rounded px-3 py-1 text-xs font-medium transition-colors',
                        previewTab === tab.id
                          ? 'bg-accent text-white'
                          : 'text-foreground-secondary hover:text-foreground'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {previewTab === 'board' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {SAMPLE_COLUMNS.map((col) => (
                      <div
                        key={col.title}
                        className="rounded-md border border-border bg-sidebar/70 p-2.5"
                      >
                        <div className="mb-2.5 flex items-center justify-between px-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: col.dot }}
                            />
                            {col.title}
                          </span>
                          <span className="text-[11px] text-foreground-secondary">
                            {col.items.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {col.items.map((item) => (
                            <div
                              key={item.key}
                              className="rounded-md border border-border bg-surface p-2.5 shadow-subtle"
                            >
                              <div className="flex items-center justify-between text-[10px] text-foreground-secondary">
                                <span className="font-mono">{item.key}</span>
                                <span className="rounded bg-background px-1.5 py-0.5 font-medium">
                                  {item.tag}
                                </span>
                              </div>
                              <p className="mt-1.5 text-xs font-medium leading-snug text-foreground">
                                {item.title}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: 'Total Projects', value: '4' },
                        { label: 'Active Tasks', value: '10' },
                        { label: 'Completed Tasks', value: '6' },
                        { label: 'Pending Tasks', value: '4' },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-md border border-border bg-surface p-3.5"
                        >
                          <p className="text-xs text-foreground-secondary">{stat.label}</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        { name: 'Website Redesign', pct: 50, color: '#2563EB' },
                        { name: 'Customer Portal', pct: 40, color: '#0D9488' },
                        { name: 'Mobile App Launch', pct: 50, color: '#D97706' },
                        { name: 'API Documentation', pct: 33, color: '#64748B' },
                      ].map((p) => (
                        <div
                          key={p.name}
                          className="rounded-md border border-border bg-surface p-3.5"
                        >
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span>{p.name}</span>
                            <span className="tabular-nums text-foreground-secondary">{p.pct}%</span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${p.pct}%`, backgroundColor: p.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Practical Features Grid */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Built for everyday project work
            </h2>
            <p className="mt-2 text-sm text-foreground-secondary sm:text-base">
              Practical features designed to keep your projects clear and easy to manage.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-lg border border-border bg-surface p-5 shadow-card"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-muted text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3.5 text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground-secondary">
                    {f.desc}
                  </p>
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
