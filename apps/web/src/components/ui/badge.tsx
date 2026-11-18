import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent-muted text-accent',
        secondary: 'border-border bg-elevated text-foreground-secondary',
        outline: 'border-border text-foreground-secondary bg-transparent',
        success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
        warning: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
        destructive: 'border-red-500/25 bg-red-500/10 text-red-500',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
