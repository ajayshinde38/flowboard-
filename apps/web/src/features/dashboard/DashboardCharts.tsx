import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsOverviewDTO, TaskTrendsDTO } from '@flowboard/shared';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}

function SimpleTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-elevated">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-foreground-secondary">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color || '#2563EB' }}
            />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Simple 4-column Task Progress Bar Chart (merges any Backlog tasks into To Do).
 */
export function StatusDistributionChart({
  data,
}: {
  data: AnalyticsOverviewDTO['statusDistribution'];
}) {
  const backlogCount = data.find((d) => d.status === 'BACKLOG')?.count ?? 0;
  const todoCount = (data.find((d) => d.status === 'TODO')?.count ?? 0) + backlogCount;
  const inProgressCount = data.find((d) => d.status === 'IN_PROGRESS')?.count ?? 0;
  const reviewCount = data.find((d) => d.status === 'IN_REVIEW')?.count ?? 0;
  const doneCount = data.find((d) => d.status === 'DONE')?.count ?? 0;

  const chartData = [
    { status: 'TODO', label: 'To Do', count: todoCount, color: '#64748B' },
    { status: 'IN_PROGRESS', label: 'In Progress', count: inProgressCount, color: '#2563EB' },
    { status: 'IN_REVIEW', label: 'Review', count: reviewCount, color: '#D97706' },
    { status: 'DONE', label: 'Done', count: doneCount, color: '#16A34A' },
  ];

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<SimpleTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
        <Bar dataKey="count" name="Tasks" radius={[5, 5, 0, 0]} maxBarSize={48} animationDuration={300}>
          {chartData.map((entry) => (
            <Cell key={entry.status} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Weekly Completed vs Created Tasks Trend Chart (used on Reports page).
 */
export function WeeklyCompletionChart({
  data,
}: {
  data: TaskTrendsDTO['weeklyCompletion'];
}) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="completedBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<SimpleTooltip />} />
        <Area
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke="#2563EB"
          strokeWidth={2}
          fill="url(#completedBlue)"
          animationDuration={300}
        />
        <Area
          type="monotone"
          dataKey="created"
          name="Created"
          stroke="#16A34A"
          strokeWidth={2}
          fill="transparent"
          animationDuration={300}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
