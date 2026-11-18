import { cn } from '@/lib/utils';

export function BrandLogo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-subtle">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-white"
        >
          <rect x="3" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
          <rect x="10" y="4" width="5" height="11" rx="1.5" fill="currentColor" fillOpacity="0.82" />
          <rect x="17" y="4" width="4" height="7" rx="1.5" fill="currentColor" fillOpacity="0.6" />
        </svg>
      </span>
      {!collapsed && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Flow<span className="text-accent">Board</span>
        </span>
      )}
    </span>
  );
}
